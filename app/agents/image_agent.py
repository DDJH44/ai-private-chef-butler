"""图片生成子 Agent — 用 Seedream AI 生成菜品照片，带 MySQL 缓存"""

import os
import json
import hashlib
import time
import requests
from typing import TypedDict

from langchain_core.messages import BaseMessage
from langchain.tools import tool
from langgraph.graph import StateGraph, START, END

from app.common.logger import logger
from app.api.v1.oss import proxy_image_url, _get_bucket
from dotenv import load_dotenv

load_dotenv()

# ── 菜名中英对照（用于构建英文 prompt）──
_DISH_NAME_MAP: dict[str, list[str]] = {
    "宫保鸡丁": ["Kung Pao chicken, diced chicken with peanuts and dried chilies in glossy dark sauce"],
    "番茄炒蛋": ["Chinese tomato scrambled eggs, silky egg curds in bright red tomato sauce"],
    "麻婆豆腐": ["mapo tofu, silken tofu cubes in bright red spicy chili oil with minced pork and Sichuan peppercorns"],
    "红烧肉": ["Chinese red braised pork belly, glossy caramelized chunks glistening in dark soy sauce"],
    "糖醋里脊": ["Chinese sweet and sour pork tenderloin, golden crispy strips coated in vibrant orange sweet sour glaze"],
    "水煮鱼": ["Sichuan boiled fish in fiery red chili oil, snow-white fish fillets submerged in bubbling spicy broth topped with dried chilies and Sichuan peppercorns"],
    "鱼香肉丝": ["yuxiang shredded pork, thin pork strips with wood ear mushrooms and carrots in tangy spicy garlic sauce"],
    "回锅肉": ["twice cooked pork belly slices with leeks and fermented black beans on a rustic plate"],
    "北京烤鸭": ["Peking duck, glossy roasted whole duck with crispy amber skin, carved at the table"],
    "烤鸭": ["Chinese roast duck, whole duck with shiny crispy skin hanging on a hook"],
    "饺子": ["Chinese jiaozi dumplings, plump crescent shaped dumplings on a bamboo steamer"],
    "炒面": ["chow mein, stir fried egg noodles with vegetables on a white plate"],
    "炒饭": ["Chinese egg fried rice with peas carrots and green onions in a white bowl"],
    "蛋炒饭": ["Chinese egg fried rice with golden egg bits and green onions in a ceramic bowl"],
    "酸辣汤": ["Chinese hot and sour soup, rich dark broth with tofu strips and wood ear mushrooms"],
    "春卷": ["Chinese spring rolls, golden crispy fried rolls with translucent wrapper"],
    "火锅": ["Chinese hotpot, bubbling red spicy broth in a large metal pot surrounded by raw ingredients"],
    "红烧排骨": ["Chinese braised spare ribs, glossy caramelized pork ribs coated in thick dark soy sauce"],
    "清蒸鱼": ["Cantonese steamed whole fish with fresh ginger shreds scallions and soy sauce on an oval plate"],
    "椒盐虾": ["salt and pepper prawns, crispy golden fried shrimp with garlic and chili flakes"],
    "干煸四季豆": ["dry fried string beans, blistered green beans with minced pork and dried chilies"],
    "可乐鸡翅": ["cola chicken wings, glossy dark caramelized wings on a white plate"],
    "蛋花汤": ["Chinese egg drop soup, delicate swirling egg ribbons in clear golden broth"],
    "西红柿鸡蛋汤": ["Chinese tomato egg drop soup, chunks of tomato in golden egg drop soup"],
    "皮蛋豆腐": ["century egg and tofu salad, sliced black preserved eggs with silky white tofu drizzled soy sauce"],
    "蒜蓉西兰花": ["stir fried broccoli with garlic, bright green broccoli florets topped with minced garlic"],
    "蚝油生菜": ["Chinese lettuce in oyster sauce, glossy blanched romaine lettuce drizzled with dark oyster sauce"],
    "锅包肉": ["Guo Bao Rou, golden crispy fried pork slices coated in translucent sweet and sour starch glaze"],
    "地三鲜": ["di san xian, sauteed potato eggplant and green pepper chunks glistening with oil"],
    "小鸡炖蘑菇": ["Chinese chicken and mushroom stew, tender chicken with shiitake mushrooms in rich brown broth"],
    "西红柿牛腩": ["Chinese tomato beef brisket stew, chunky beef and tomato in thick red sauce"],
    "辣子鸡": ["Chongqing spicy chicken, crispy fried chicken chunks buried in a mountain of red dried chilies"],
    "葱油饼": ["Chinese scallion pancake, golden flaky layered flatbread with green scallions"],
    "小笼包": ["xiaolongbao soup dumplings, delicate translucent dumplings in bamboo steamer with visible soup inside"],
    "烧卖": ["siu mai, open-top pork and shrimp dumplings in yellow wrappers in a bamboo steamer"],
    "叉烧": ["char siu, glossy red glazed Cantonese BBQ pork strips hanging on hooks"],
    "白切鸡": ["Chinese poached chicken, tender white chopped chicken with ginger scallion dipping sauce"],
}

_IMAGE_PROMPT_SUFFIX = """, professional food photography, warm natural lighting, soft shadows, macro detail shot, Michelin restaurant quality, mouth-watering appetizing presentation"""


def _build_prompt(query: str) -> str:
    """中文菜名 → 英文 image generation prompt（中文名提供菜系上下文）"""
    mapped = _DISH_NAME_MAP.get(query, [query])
    en = mapped[0] if mapped else query
    return f"A beautifully plated {en}, {query}, Chinese cuisine,{_IMAGE_PROMPT_SUFFIX}"


def _lookup_cache(query: str) -> str | None:
    """MySQL 缓存查询"""
    try:
        from app.models.db import ImageCache
        from app.common.database import SessionLocal
        session = SessionLocal()
        try:
            row = session.query(ImageCache).filter(ImageCache.dish_query == query).first()
            return row.oss_url if row else None
        finally:
            session.close()
    except Exception as e:
        logger.warning(f"[image_agent] cache lookup failed: {e}")
        return None


def _write_cache(query: str, url: str):
    """写入 MySQL 缓存"""
    try:
        from app.models.db import ImageCache
        from app.common.database import SessionLocal
        session = SessionLocal()
        try:
            existing = session.query(ImageCache).filter(ImageCache.dish_query == query).first()
            if existing:
                existing.oss_url = url
                existing.created_at = int(time.time() * 1000)
            else:
                session.add(ImageCache(dish_query=query, oss_url=url, created_at=int(time.time() * 1000)))
            session.commit()
        except Exception as e:
            session.rollback()
            logger.warning(f"[image_agent] cache write failed: {e}")
        finally:
            session.close()
    except Exception as e:
        logger.warning(f"[image_agent] cache write error: {e}")


def _call_seedream(query: str) -> str | None:
    """调用 Seedream API 生成图片。返回代理 URL（OSS 成功）或直接返回 Seedream 临时 URL（OSS 失败时兜底）"""
    api_key = os.getenv("DOUBAO_API_KEY")
    base_url = os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v1")
    model_name = os.getenv("IMAGE_GEN_MODEL", "doubao-seedream-4-5-251128")
    prompt = _build_prompt(query)

    try:
        resp = requests.post(
            f"{base_url}/images/generations",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model_name, "prompt": prompt, "n": 1, "size": "1920x1920"},
            timeout=120,
        )
    except Exception as e:
        logger.warning(f"[image_agent] Seedream request failed: {e}")
        return None
    if resp.status_code != 200:
        logger.warning(f"[image_agent] Seedream {resp.status_code}: {resp.text[:200]}")
        return None

    data = resp.json()
    seedream_url = (data.get("data") or [{}])[0].get("url", "")
    if not seedream_url:
        logger.warning("[image_agent] no image URL in response")
        return None

    # 尝试下载并上传 OSS
    try:
        img_resp = requests.get(seedream_url, timeout=30)
        if img_resp.status_code == 200:
            image_bytes = img_resp.content
            h = hashlib.md5(query.encode()).hexdigest()[:12]
            filename = f"ai-generated/{h}_{int(time.time() * 1000)}.jpg"
            bucket = _get_bucket()
            bucket.put_object(filename, image_bytes, headers={"Content-Type": "image/jpeg", "x-oss-object-acl": "public-read"})
            endpoint = os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com")
            oss_url = f"https://{os.getenv('OSS_BUCKET')}.{endpoint}/{filename}"
            proxy_url = proxy_image_url(oss_url)
            logger.info(f"[image_agent] generated+OSS: {query}")
            return proxy_url
    except Exception as e:
        logger.warning(f"[image_agent] OSS upload failed ({e}), using Seedream direct URL")

    # OSS 不可用时，直接用 Seedream 临时 URL（通过代理包装）
    direct_proxy = proxy_image_url(seedream_url)
    logger.info(f"[image_agent] generated (direct): {query}")
    return direct_proxy


# ── 子 Agent 状态与节点 ──

class ImageAgentState(TypedDict):
    query: str
    messages: list[BaseMessage]
    cache_hit: bool
    final_result: str


def _cache_check_node(state: ImageAgentState) -> dict:
    """缓存检查节点：命中缓存直接返回"""
    query = state["query"]
    logger.info(f"[image_agent] check cache: {query}")
    cached = _lookup_cache(query)
    if cached:
        logger.info(f"[image_agent] cache HIT: {query}")
        return {"cache_hit": True, "final_result": json.dumps(
            [{"title": query, "url": cached, "content": f"{query}（AI生成·缓存）"}],
            ensure_ascii=False
        )}
    return {"cache_hit": False}


def _decide_after_cache(state: ImageAgentState) -> str:
    return "return" if state["cache_hit"] else "generate"


def _generate_node(state: ImageAgentState) -> dict:
    """生成节点：调用 Seedream + OSS 上传 + 写缓存"""
    query = state["query"]
    logger.info(f"[image_agent] generating: {query}")
    url = _call_seedream(query)
    if url:
        _write_cache(query, url)
        return {"final_result": json.dumps(
            [{"title": query, "url": url, "content": f"{query}（AI生成）"}],
            ensure_ascii=False
        )}
    return {"final_result": json.dumps(
        [{"title": "生成失败", "content": f"未能为'{query}'生成图片，请稍后重试"}],
        ensure_ascii=False
    )}


# ── 编译子 Agent ──

_image_agent_graph = None


def _build() -> StateGraph:
    builder = StateGraph(ImageAgentState)
    builder.add_node("cache_check", _cache_check_node)
    builder.add_node("generate", _generate_node)

    builder.add_edge(START, "cache_check")
    builder.add_conditional_edges("cache_check", _decide_after_cache, {
        "return": END,
        "generate": "generate",
    })
    builder.add_edge("generate", END)

    return builder.compile()


def get_image_agent():
    global _image_agent_graph
    if _image_agent_graph is None:
        _image_agent_graph = _build()
    return _image_agent_graph


# ── 对外工具 ──

@tool
def fetch_dish_image(query: str) -> str:
    """AI生成指定菜品的成品照片。输入中文菜名如'宫保鸡丁'，返回 AI 生成的高质量菜品图片 URL 列表 JSON。自动缓存已生成的图片避免重复生成。"""
    agent = get_image_agent()
    try:
        result = agent.invoke({"query": query, "messages": [], "cache_hit": False, "final_result": ""})
        final = result.get("final_result", "[]")
        logger.info(f"[image_agent] done: {query}")
        return final
    except Exception as e:
        logger.error(f"[image_agent] error: {e}")
        return json.dumps([{"title": "错误", "content": str(e)}], ensure_ascii=False)
