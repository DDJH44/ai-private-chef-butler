"""ChromaDB vector store for RAG knowledge retrieval with hybrid search.

Collections:
- nutrition_db: China food composition table (authoritative nutrition data)
- recipe_db: Chinese recipe knowledge base
- fitness_knowledge: Sports nutrition science

Search pipeline: query expansion → BM25 sparse + dense (BGE) → weighted fusion → sort
"""

import os
import json
import logging
import threading
from pathlib import Path
from chromadb import PersistentClient
from chromadb.utils import embedding_functions

logger = logging.getLogger("personal_chief")

_PERSIST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "chroma_db")

# ============================================================
# Query expansion: synonym mapping for Chinese food/recipe terms
# ============================================================
_QUERY_EXPANSIONS: dict[str, list[str]] = {
    "鸡胸": ["鸡胸肉 低脂 高蛋白", "鸡胸肉 营养成分"],
    "鸡腿": ["鸡腿肉 去皮 蛋白质"],
    "牛肉": ["牛腱子肉 高蛋白 低脂", "牛肉 蛋白质 营养成分"],
    "猪肉": ["猪瘦肉 里脊 蛋白质", "猪瘦肉 营养成分"],
    "鱼": ["鲈鱼 鳕鱼 清蒸 高蛋白 低脂"],
    "虾": ["虾仁 高蛋白 低脂 营养成分"],
    "蛋": ["鸡蛋 蛋白质 营养成分"],
    "鸡蛋": ["鸡蛋 蛋白质 营养成分"],
    "牛奶": ["牛奶 全脂 蛋白质 营养成分"],
    "豆腐": ["豆腐 高蛋白 素食 营养成分"],
    "蔬菜": ["西兰花 菠菜 生菜 低卡 高纤维"],
    "西兰花": ["西兰花 低卡 高纤维 健身餐"],
    "番茄": ["番茄 低卡 蔬菜 营养成分"],
    "西红柿": ["番茄 低卡 蔬菜 营养成分"],
    "土豆": ["土豆 碳水 蔬菜 营养成分"],
    "红薯": ["红薯 碳水 高纤维 健身餐"],
    "米饭": ["米饭 主食 碳水 热量"],
    "燕麦": ["燕麦片 高纤维 碳水 健身"],
    "减脂": ["减脂 低卡 热量缺口 高蛋白", "减脂期营养原则"],
    "增肌": ["增肌 蛋白质 热量盈余 碳水", "增肌期营养原则"],
    "健身": ["健身 高蛋白 训练前后营养", "训练前后营养"],
    "减肥": ["减脂 低卡 热量缺口", "减脂期营养原则"],
    "补剂": ["蛋白粉 乳清蛋白 使用指南", "蛋白粉使用指南"],
    "碳水循环": ["碳水循环 高碳日 低碳日", "碳水循环基础"],
    "高蛋白": ["高蛋白 鸡胸肉 牛肉 鱼 虾 豆腐"],
    "低脂": ["低脂 低卡 鸡胸肉 鱼 蔬菜"],
    "低卡": ["低卡 低脂 蔬菜 鸡胸肉"],
    "快手": ["快手 简单 快速 新手友好"],
    "下饭": ["下饭 家常 经典"],
    "汤": ["汤品 滋补 养身"],
}

# Lazy import jieba
_jieba = None


def _get_jieba():
    global _jieba
    if _jieba is None:
        import jieba
        jieba.setLogLevel(20)
        _jieba = jieba
    return _jieba


def _tokenize(text: str) -> list[str]:
    """Tokenize Chinese text with jieba, fallback to character-level."""
    try:
        return list(_get_jieba().cut(text))
    except Exception:
        return list(text)


def _expand_query(query: str) -> str:
    """Expand query with synonyms and related terms."""
    expanded = query
    for key, expansions in _QUERY_EXPANSIONS.items():
        if key in query:
            for exp in expansions:
                if exp not in expanded:
                    expanded += " " + exp
            break  # Only apply the first match to avoid over-expansion
    return expanded


# ============================================================
# BM25 Sparse Index
# ============================================================
class BM25Index:
    """Lightweight BM25 index per collection, rebuilt on document addition."""

    def __init__(self):
        self.bm25 = None
        self.documents: list[str] = []

    def index(self, documents: list[str]):
        from rank_bm25 import BM25Okapi
        self.documents = list(documents)
        tokenized = [_tokenize(d) for d in documents]
        self.bm25 = BM25Okapi(tokenized)

    def search(self, query: str, top_k: int = 10) -> list[tuple[int, float]]:
        """Return list of (doc_index, score) sorted by BM25 score descending."""
        if not self.bm25 or not self.documents:
            return []
        tokens = _tokenize(query)
        scores = self.bm25.get_scores(tokens)
        # Normalize to 0-1 range
        max_score = max(scores) if max(scores) > 0 else 1.0
        ranked = sorted(
            [(i, s / max_score) for i, s in enumerate(scores) if s > 0],
            key=lambda x: x[1], reverse=True
        )
        return ranked[:top_k]


# ============================================================
# RAG Store with Hybrid Search
# ============================================================
class RAGStore:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._ready = False
        self._loading = False

        os.makedirs(_PERSIST_DIR, exist_ok=True)
        self.client = PersistentClient(path=_PERSIST_DIR)
        self._ef = None
        self.nutrition = None
        self.recipes = None
        self.fitness = None
        self._collections = {}
        self._bm25: dict[str, BM25Index] = {}
        self._doc_cache: dict[str, list[str]] = {}

    @property
    def is_ready(self) -> bool:
        return self._ready

    def _ensure_initialized(self):
        if self._ready:
            return
        # If background thread already loading, wait for it to finish
        if self._loading:
            import time
            waited = 0
            while self._loading and waited < 120:
                time.sleep(0.5); waited += 0.5
                if self._ready:
                    return
        if self._ready:
            return
        self._loading = True
        try:
            self._ef = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name="BAAI/bge-small-zh-v1.5"
            )
            logger.info("RAG: Using BAAI/bge-small-zh-v1.5 embedding model")
        except Exception as e:
            logger.warning(f"RAG: Failed to load sentence-transformers model: {e}")
            self._ef = embedding_functions.DefaultEmbeddingFunction()

        self.nutrition = self.client.get_or_create_collection(
            name="nutrition_db", embedding_function=self._ef,
            metadata={"description": "China food composition table"}
        )
        self.recipes = self.client.get_or_create_collection(
            name="recipe_db", embedding_function=self._ef,
            metadata={"description": "Chinese recipe knowledge base"}
        )
        self.fitness = self.client.get_or_create_collection(
            name="fitness_knowledge", embedding_function=self._ef,
            metadata={"description": "Sports nutrition science"}
        )
        self._collections = {
            "nutrition": self.nutrition,
            "recipe": self.recipes,
            "fitness": self.fitness,
        }

        # Rebuild BM25 indices from existing data
        self._rebuild_bm25("nutrition")
        self._rebuild_bm25("recipe")
        self._rebuild_bm25("fitness")

        self._ready = True
        logger.info(
            f"RAG ready: nutrition={self.nutrition.count()}, "
            f"recipes={self.recipes.count()}, fitness={self.fitness.count()}"
        )
        self._loading = False

    def _rebuild_bm25(self, knowledge_type: str):
        """Rebuild BM25 index for a collection from current documents."""
        if knowledge_type not in self._collections:
            return
        collection = self._collections[knowledge_type]
        count = collection.count()
        if count == 0:
            self._bm25[knowledge_type] = BM25Index()
            return
        # Fetch all documents
        results = collection.get(limit=count, include=["documents"])
        docs = results.get("documents", []) if results else []
        self._doc_cache[knowledge_type] = docs
        bm25 = BM25Index()
        bm25.index(docs)
        self._bm25[knowledge_type] = bm25
        logger.debug(f"BM25 index rebuilt for {knowledge_type}: {len(docs)} docs")

    def search(self, query: str, knowledge_type: str = "nutrition",
               k: int = 5, metadata_filter: dict = None,
               alpha: float = 0.6) -> list[dict]:
        """Hybrid search: BM25 (sparse) + BGE (dense) weighted fusion.

        Args:
            query: Search query text
            knowledge_type: One of "nutrition", "recipe", "fitness"
            k: Number of results to return
            metadata_filter: Optional ChromaDB where filter (e.g. {"category": "肉类"})
            alpha: Weight for dense scores (1-alpha for BM25). Higher = more semantic.

        Returns:
            List of dicts with keys: content, source, score, bm25_score, dense_score
        """
        self._ensure_initialized()
        if knowledge_type not in self._collections:
            return []

        # 1. Query expansion
        expanded_query = _expand_query(query)
        logger.debug(f"RAG search [{knowledge_type}]: '{query}' -> '{expanded_query}'")

        collection = self._collections[knowledge_type]
        count = collection.count()
        if count == 0:
            return []

        fetch_k = min(max(k * 3, 10), count)

        # 2. Dense retrieval (BGE embeddings via ChromaDB)
        try:
            query_kwargs = {"query_texts": [expanded_query], "n_results": fetch_k}
            if metadata_filter:
                query_kwargs["where"] = metadata_filter
            dense_results = collection.query(**query_kwargs)
        except Exception as e:
            logger.error(f"RAG dense search error ({knowledge_type}): {e}")
            return []

        if not dense_results or not dense_results.get("documents") or not dense_results["documents"][0]:
            return []

        # Build dense results map: doc_text → dense_score
        dense_scores: dict[str, float] = {}
        for i, doc in enumerate(dense_results["documents"][0]):
            dist = dense_results["distances"][0][i] if dense_results.get("distances") else 1.0
            dense_scores[doc] = 1.0 - min(dist, 1.0)

        # 3. BM25 sparse retrieval
        bm25 = self._bm25.get(knowledge_type)
        bm25_scores: dict[str, float] = {}
        if bm25 and bm25.bm25:
            ranked = bm25.search(expanded_query, top_k=fetch_k)
            cached = self._doc_cache.get(knowledge_type, [])
            for idx, score in ranked:
                if idx < len(cached):
                    bm25_scores[cached[idx]] = score

        # 4. Weighted fusion (alpha * dense + (1-alpha) * BM25)
        all_docs = set(list(dense_scores.keys()) + list(bm25_scores.keys()))
        combined = []
        for doc in all_docs:
            d_score = dense_scores.get(doc, 0.0)
            b_score = bm25_scores.get(doc, 0.0)
            final_score = alpha * d_score + (1.0 - alpha) * b_score
            combined.append((doc, final_score, d_score, b_score))

        combined.sort(key=lambda x: x[1], reverse=True)
        top = combined[:k]

        # 5. Build output
        output = []
        metas = dense_results.get("metadatas", [[]])[0] if dense_results.get("metadatas") else []
        for doc, final, d_score, b_score in top:
            # Find metadata
            meta = {}
            if metas:
                try:
                    idx = list(dense_scores.keys()).index(doc)
                    if idx < len(metas):
                        meta = metas[idx]
                except ValueError:
                    pass
            output.append({
                "content": doc,
                "source": meta.get("source", "unknown"),
                "score": round(final, 4),
                "dense_score": round(d_score, 4),
                "bm25_score": round(b_score, 4),
            })

        return output

    def multi_search(self, query: str, knowledge_types: list[str], k: int = 3) -> dict[str, list[dict]]:
        self._ensure_initialized()
        results = {}
        for ktype in knowledge_types:
            hits = self.search(query, ktype, k=k)
            if hits:
                results[ktype] = hits
        return results

    def add_documents(self, knowledge_type: str, documents: list[str],
                      metadatas: list[dict] = None, ids: list[str] = None):
        self._ensure_initialized()
        if knowledge_type not in self._collections:
            raise ValueError(f"Unknown knowledge type: {knowledge_type}")

        if ids is None:
            count = self._collections[knowledge_type].count()
            ids = [f"{knowledge_type}_{count + i}" for i in range(len(documents))]

        collection = self._collections[knowledge_type]
        collection.add(documents=documents, metadatas=metadatas, ids=ids)
        self._rebuild_bm25(knowledge_type)
        logger.info(f"RAG: Added {len(documents)} documents to {knowledge_type}")

    def get_stats(self) -> dict:
        if not self._ready:
            return {"persist_dir": _PERSIST_DIR, "collections": {}, "status": "not_initialized"}
        return {
            "persist_dir": _PERSIST_DIR,
            "collections": {
                "nutrition": self.nutrition.count(),
                "recipes": self.recipes.count(),
                "fitness": self.fitness.count(),
            }
        }

    def clear_collection(self, knowledge_type: str):
        if knowledge_type in self._collections:
            self.client.delete_collection(knowledge_type)
            self._collections[knowledge_type] = self.client.get_or_create_collection(
                name=f"{knowledge_type}_db",
                embedding_function=self._ef,
            )
            self._bm25[knowledge_type] = BM25Index()
            self._doc_cache[knowledge_type] = []
            logger.info(f"RAG: Cleared collection {knowledge_type}")


# ============================================================
# Module-level singleton
# ============================================================
rag_store = RAGStore()


def _bg_init():
    try:
        rag_store._ensure_initialized()
    except Exception as e:
        logger.warning(f"RAG background init failed: {e}")


_bg_thread = threading.Thread(target=_bg_init, daemon=True)
_bg_thread.start()
