from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, AIMessageChunk, AIMessage
from langchain.tools import tool
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode
from app.common.logger import logger
import os
import hashlib
import time
from app.common.checkpoint_saver import MySQLSaver
import json
import requests
from dotenv import load_dotenv
from app.api.v1.oss import proxy_image_url, _get_bucket
load_dotenv()

# 常见中餐菜品的中英对照，用于提升 Pexels 英文搜索准确度
_DISH_NAME_MAP: dict[str, list[str]] = {
    "宫保鸡丁": ["kung pao chicken", "spicy diced chicken with peanuts"],
    "番茄炒蛋": ["tomato scrambled eggs", "tomato egg stir fry"],
    "麻婆豆腐": ["mapo tofu", "spicy tofu with minced pork"],
    "红烧肉": ["braised pork belly", "red braised pork"],
    "糖醋里脊": ["sweet and sour pork", "sweet sour pork tenderloin"],
    "水煮鱼": ["boiled fish in chili sauce", "sichuan boiled fish"],
    "鱼香肉丝": ["yu xiang shredded pork", "fish fragrant pork"],
    "回锅肉": ["twice cooked pork", "double cooked pork"],
    "北京烤鸭": ["peking duck", "beijing roast duck"],
    "烤鸭": ["roast duck", "peking duck"],
    "饺子": ["chinese dumplings", "jiaozi dumplings"],
    "炒面": ["chow mein", "stir fried noodles"],
    "炒饭": ["fried rice", "egg fried rice"],
    "蛋炒饭": ["egg fried rice", "fried rice"],
    "扬州炒饭": ["yangzhou fried rice", "fried rice"],
    "酸辣汤": ["hot and sour soup", "sour and spicy soup"],
    "春卷": ["spring rolls", "chinese spring rolls"],
    "火锅": ["hot pot", "chinese hotpot"],
    "红烧排骨": ["braised spare ribs", "braised pork ribs"],
    "清蒸鱼": ["steamed fish", "steamed whole fish"],
    "椒盐虾": ["salt and pepper shrimp", "pepper salt prawns"],
    "干煸四季豆": ["dry fried green beans", "stir fried string beans"],
    "可乐鸡翅": ["cola chicken wings", "coca cola chicken wings"],
    "蛋花汤": ["egg drop soup", "egg flower soup"],
    "西红柿鸡蛋汤": ["tomato egg soup", "tomato and egg soup"],
    "皮蛋豆腐": ["century egg tofu", "preserved egg tofu"],
    "蒜蓉西兰花": ["garlic broccoli", "stir fried broccoli with garlic"],
    "蚝油生菜": ["lettuce in oyster sauce", "oyster sauce lettuce"],
    "锅包肉": ["guo bao rou", "sweet and sour pork"],
    "地三鲜": ["di san xian", "sauteed potato green pepper and eggplant"],
    "小鸡炖蘑菇": ["chicken with mushrooms", "braised chicken with mushroom"],
    "西红柿牛腩": ["tomato beef brisket", "beef stew with tomato"],
    "辣子鸡": ["spicy chicken", "chongqing spicy chicken"],
    "葱油饼": ["scallion pancake", "green onion pancake"],
    "小笼包": ["xiaolongbao", "soup dumplings"],
    "烧卖": ["siu mai", "shumai"],
    "叉烧": ["char siu", "bbq pork"],
    "白切鸡": ["white cut chicken", "poached chicken"],
}

def _build_search_queries(query: str) -> list[str]:
    """为中文菜品名构造最优的英文搜索词组合"""
    queries: list[str] = []

    # 1. 查中英对照表，用精确英文名优先
    mapped = _DISH_NAME_MAP.get(query, [])
    for en in mapped:
        queries.append(f"{en} dish food photography")
        queries.append(f"{en} authentic chinese")

    # 2. 中文原词 + food/chinese food 作为兜底
    queries.append(f"{query} food photography")
    queries.append(f"{query} dish")

    # 3. 如果 query 全中文，额外用拼音尝试
    if all('一' <= c <= '鿿' or c == ' ' for c in query):
        import pypinyin
        try:
            pinyin_name = ''.join(pypinyin.lazy_pinyin(query, style=pypinyin.Style.NORMAL))
            queries.append(f"{pinyin_name} chinese food")
        except Exception:
            pass

    return queries

def _score_photo(photo: dict, query_keywords: list[str]) -> int:
    """对 Pexels 图片进行相关性打分，越高越匹配"""
    score = 0
    alt = (photo.get("alt") or "").lower()
    photographer = (photo.get("photographer") or "").lower()
    photo_url = (photo.get("url") or "").lower()
    combined = f"{alt} {photographer}"

    for kw in query_keywords:
        kw_lower = kw.lower()
        parts = kw_lower.split()
        for part in parts:
            if len(part) < 3:
                continue
            if part in alt:
                score += 5
            if part in photographer:
                score += 3
            if part in photo_url:
                score += 2

    # 处罚泛化标签
    generic_terms = ["restaurant", "table", "plate", "bowl", "kitchen", "interior", "people", "person", "woman", "man", "chef", "cook", "market", "store", "shop"]
    for term in generic_terms:
        if term in alt:
            score -= 2

    # 加分项：明确食物标签
    food_terms = ["food", "dish", "cuisine", "meal", "dinner", "lunch", "cooking", "homemade", "traditional", "authentic", "chinese", "spicy", "soup", "sauce", "fried", "steamed", "boiled", "braised", "roast"]
    for term in food_terms:
        if term in alt:
            score += 1

    return score

def _search_pexels_candidates(query: str, query_keywords: list[str]) -> list[dict]:
    """从 Pexels 搜索候选图片，返回带原始 URL 和代理 URL 的列表"""
    pexels_key = os.getenv("PEXELS_API_KEY", "")
    results: list[dict] = []
    seen_urls: set[str] = set()

    queries = _build_search_queries(query)
    for search_query in queries:
        pexels_url = f"https://api.pexels.com/v1/search?query={requests.utils.quote(search_query)}&per_page=12&orientation=landscape&locale=zh-CN"
        pexels_resp = requests.get(pexels_url, headers={"Authorization": pexels_key}, timeout=10)
        if pexels_resp.status_code != 200:
            continue

        for photo in pexels_resp.json().get("photos", []):
            original_url = photo.get("src", {}).get("large", "")
            if not original_url or original_url in seen_urls:
                continue
            seen_urls.add(original_url)

            score = _score_photo(photo, query_keywords)
            results.append({
                "original_url": original_url,       # 视觉验证用原始 URL
                "url": proxy_image_url(original_url),  # 前端展示用代理 URL
                "content": photo.get("alt", query),
                "photographer": photo.get("photographer", ""),
                "score": score,
            })

    results.sort(key=lambda r: r.get("score", 0), reverse=True)
    return results


def _verify_images_with_vision(query: str, candidates: list[dict]) -> list[dict]:
    """用视觉模型验证候选图片，使用原始 URL"""
    if not candidates:
        return []

    try:
        content_parts: list[dict] = []
        for c in candidates:
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": c["original_url"]},  # 用原始 Pexels URL
            })

        content_parts.append({
            "type": "text",
            "text": f"""上面有 {len(candidates)} 张图片，编号 0-{len(candidates)-1}。
逐一判断每张是否确实是菜品「{query}」的成品照片：
- 图片主体是该菜品的成品 → 匹配
- 图片是其他菜/食材/厨房/人物/餐厅 → 不匹配
- 不确定就判不匹配

只返回 JSON：{{"matches":[编号],"reasons":{{"0":"理由"}}}}"""
        })

        vision_model = model
        response = vision_model.invoke([HumanMessage(content=content_parts)])
        response_text = response.content if isinstance(response.content, str) else str(response.content)

        json_match = _re.search(r'\{[\s\S]*\}', response_text)
        if not json_match:
            return []

        result = json.loads(json_match.group())
        match_ids: list[int] = result.get("matches", [])

        verified: list[dict] = []
        for idx in match_ids:
            if 0 <= idx < len(candidates):
                c = candidates[idx]
                verified.append({
                    "title": f"{query}",
                    "url": c["url"],
                    "content": c["content"],
                    "photographer": c.get("photographer", ""),
                })

        logger.info(f"[vision_verify] {query}: {len(candidates)}候选 → {len(verified)}通过")
        return verified

    except Exception as e:
        logger.warning(f"[vision_verify] 异常: {e}")
        return []


def _search_unsplash_candidates(query: str, query_keywords: list[str]) -> list[dict]:
    """从 Unsplash 搜索候选图片作为补充"""
    access_key = os.getenv("UNSPLASH_ACCESS_KEY", "")
    if not access_key:
        return []

    results: list[dict] = []
    seen_urls: set[str] = set()

    try:
        queries = _build_search_queries(query)[:3]
        for search_query in queries:
            unsplash_url = f"https://api.unsplash.com/search/photos?query={requests.utils.quote(search_query)}&per_page=8&orientation=landscape"
            resp = requests.get(unsplash_url, headers={"Authorization": f"Client-ID {access_key}"}, timeout=10)
            if resp.status_code != 200:
                continue
            for photo in resp.json().get("results", []):
                original_url = photo.get("urls", {}).get("regular", "")
                if not original_url or original_url in seen_urls:
                    continue
                seen_urls.add(original_url)
                score = _score_photo({"alt": (photo.get("alt_description") or "") + " " + (photo.get("description") or ""), "photographer": photo.get("user", {}).get("name", "")}, query_keywords)
                results.append({
                    "original_url": original_url,
                    "url": proxy_image_url(original_url),
                    "content": photo.get("alt_description") or query,
                    "photographer": photo.get("user", {}).get("name", ""),
                    "score": score,
                })
    except Exception:
        pass

    return results


@tool
def recipe_search(query: str):
    """搜索指定菜品的真实成品照片。输入准确的菜品名称如'宫保鸡丁'或'番茄炒蛋'，返回该菜品的高质量食物摄影图片URL"""
    pexels_key = os.getenv("PEXELS_API_KEY", "")
    if not pexels_key:
        return json.dumps([{"title": "错误", "content": "PEXELS_API_KEY 未配置"}], ensure_ascii=False)

    try:
        query_keywords = [query] + _DISH_NAME_MAP.get(query, [])

        # 1. Pexels 搜索
        pexels_results = _search_pexels_candidates(query, query_keywords)

        # 2. Unsplash 补充搜索
        unsplash_results = _search_unsplash_candidates(query, query_keywords)

        # 3. 合并去重，按文本相关性排序
        all_results = pexels_results + unsplash_results
        all_results.sort(key=lambda r: r.get("score", 0), reverse=True)

        if not all_results:
            return json.dumps([{"title": "无结果", "content": f"未找到'{query}'的图片"}], ensure_ascii=False)

        # 4. 视觉验证 top 8
        candidates = all_results[:8]
        verified = _verify_images_with_vision(query, candidates)

        # 5. 验证通过的直接返回；否则退回文本 top 5
        final = verified if verified else all_results[:5]
        for r in final:
            r.pop("score", None)
            r.pop("original_url", None)

        return json.dumps(final, ensure_ascii=False)

    except Exception as e:
        return json.dumps([{"title": "异常", "content": str(e)}], ensure_ascii=False)


@tool
def bilibili_search(query: str):
    """搜索B站烹饪教学视频。输入菜品名称如'番茄炒蛋'，返回B站上相关的高质量烹饪教学视频（标题、链接、播放量、UP主）"""
    try:
        import urllib.parse
        encoded = urllib.parse.quote(f"{query} 做法 教程")
        url = f"https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword={encoded}&page=1"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com",
        }
        resp = requests.get(url, headers=headers, timeout=8)
        if resp.status_code != 200:
            return json.dumps([{"title": "B站搜索失败", "content": f"HTTP {resp.status_code}"}], ensure_ascii=False)

        data = resp.json()
        videos = data.get("data", {}).get("result", [])
        if not videos:
            return json.dumps([{"title": "无结果", "content": f"B站未找到'{query}'的教学视频"}], ensure_ascii=False)

        results = []
        for v in videos[:3]:
            results.append({
                "title": v.get("title", "").replace("<em class=\"keyword\">", "").replace("</em>", ""),
                "url": f"https://www.bilibili.com/video/{v.get('bvid', '')}",
                "cover": v.get("pic", ""),
                "author": v.get("author", ""),
                "play": v.get("play", 0),
                "duration": v.get("duration", ""),
            })
        return json.dumps(results, ensure_ascii=False)
    except Exception as e:
        return json.dumps([{"title": "异常", "content": str(e)}], ensure_ascii=False)


# ── Seedream 图片生成 ──

_IMAGE_PROMPT_SUFFIX = """, authentic Chinese cuisine, served on a handcrafted ceramic plate,
overhead angle, natural window lighting, shallow depth of field,
garnished with fresh herbs, steam rising gently,
4K resolution, warm tones, sharp focus,
no people, no hands, no chopsticks, no text, no watermark,
no cartoon, no illustration, no plastic containers, no takeout boxes"""


def _build_image_prompt(query: str) -> str:
    """从中文菜名构建英文图像生成提示词"""
    mapped = _DISH_NAME_MAP.get(query, [query])
    en_name = mapped[0] if mapped else query
    return f"professional food photography of {en_name},{_IMAGE_PROMPT_SUFFIX}"


def _lookup_image_cache(dish_query: str) -> str | None:
    """从 MySQL 缓存查找已生成的图片 URL"""
    from app.models.db import ImageCache
    from app.common.database import SessionLocal
    session = SessionLocal()
    try:
        row = session.query(ImageCache).filter(
            ImageCache.dish_query == dish_query
        ).first()
        return row.oss_url if row else None
    except Exception as e:
        logger.warning(f"[image_cache] 查询失败: {e}")
        return None
    finally:
        session.close()


def _save_image_cache(dish_query: str, oss_url: str):
    """将生成的图片 URL 写入 MySQL 缓存"""
    from app.models.db import ImageCache
    from app.common.database import SessionLocal
    session = SessionLocal()
    try:
        existing = session.query(ImageCache).filter(
            ImageCache.dish_query == dish_query
        ).first()
        if existing:
            existing.oss_url = oss_url
            existing.created_at = int(time.time())
        else:
            session.add(ImageCache(
                dish_query=dish_query, oss_url=oss_url,
                created_at=int(time.time()),
            ))
        session.commit()
    except Exception as e:
        session.rollback()
        logger.warning(f"[image_cache] 写入失败: {e}")
    finally:
        session.close()


def _generate_and_upload_image(query: str) -> str | None:
    """通过火山引擎 ARK Seedream 生成菜品图片并上传 OSS"""
    api_key = os.getenv("DOUBAO_API_KEY")
    base_url = os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v1")
    model_name = os.getenv("IMAGE_GEN_MODEL", "doubao-seedream-4-5-251128")

    prompt = _build_image_prompt(query)

    resp = requests.post(
        f"{base_url}/images/generations",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model_name,
            "prompt": prompt,
            "n": 1,
            "size": "1920x1920",
        },
        timeout=120,
    )
    if resp.status_code != 200:
        logger.warning(f"[image_gen] ARK API 返回 {resp.status_code}: {resp.text[:300]}")
        return None

    data = resp.json()
    image_url = (data.get("data") or [{}])[0].get("url", "")
    if not image_url:
        logger.warning(f"[image_gen] ARK 响应中未找到图片 URL: {str(data)[:300]}")
        return None

    img_resp = requests.get(image_url, timeout=60)
    if img_resp.status_code != 200:
        logger.warning(f"[image_gen] 下载图片失败 HTTP {img_resp.status_code}")
        return None

    image_bytes = img_resp.content
    hash_prefix = hashlib.md5(query.encode("utf-8")).hexdigest()[:12]
    filename = f"ai-generated/{hash_prefix}_{int(time.time())}.jpg"

    try:
        bucket = _get_bucket()
        bucket.put_object(filename, image_bytes, headers={
            "Content-Type": "image/jpeg",
            "x-oss-object-acl": "public-read",
        })
    except Exception as e:
        logger.warning(f"[image_gen] OSS 上传失败: {e}")
        return None

    endpoint = os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com")
    bucket_name = os.getenv("OSS_BUCKET")
    oss_url = f"https://{bucket_name}.{endpoint}/{filename}"
    proxy_url = proxy_image_url(oss_url)
    logger.info(f"[image_gen] {query} -> {proxy_url}")
    return proxy_url


@tool
def generate_recipe_image(query: str):
    """AI生成指定菜品的成品照片。输入准确的菜品名称如'宫保鸡丁'或'番茄炒蛋'，返回AI生成的高质量菜品图片URL。用于没有现成照片的定制菜品或创意菜。"""
    try:
        cached_url = _lookup_image_cache(query)
        if cached_url:
            logger.info(f"[generate_recipe_image] 缓存命中: {query}")
            return json.dumps(
                [{"title": query, "url": cached_url, "content": f"{query}（AI生成）"}],
                ensure_ascii=False
            )

        logger.info(f"[generate_recipe_image] 生成新图片: {query}")
        oss_url = _generate_and_upload_image(query)

        if oss_url:
            _save_image_cache(query, oss_url)
            return json.dumps(
                [{"title": query, "url": oss_url, "content": f"{query}（AI生成）"}],
                ensure_ascii=False
            )

        return json.dumps(
            [{"title": "生成失败", "content": f"未能为'{query}'生成图片，请稍后重试"}],
            ensure_ascii=False
        )
    except Exception as e:
        logger.error(f"[generate_recipe_image] 异常: {e}")
        return json.dumps(
            [{"title": "异常", "content": str(e)}],
            ensure_ascii=False
        )


model = init_chat_model(
    model=os.getenv("DOUBAO_MODEL_NAME", "doubao-seed-1-8-251228"),
    model_provider="openai",
    base_url=os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v1"),
    api_key=os.getenv("DOUBAO_API_KEY"),
    extra_body={"thinking": {"type": "disabled"}},
)

model_with_tools = model.bind_tools([recipe_search, bilibili_search, generate_recipe_image])

checkpointer = MySQLSaver()

def _load_system_prompt() -> str:
    prompt_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "system_prompt.txt")
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        logger.warning(f"system_prompt.txt 未找到: {prompt_path}，使用降级提示词")
        return "你是一名私人厨师，帮助用户根据食材推荐菜谱。"

system_prompt = _load_system_prompt()

class AgentState(MessagesState):
    pass

def agent_node(state: AgentState):
    messages = state["messages"]
    if system_prompt:
        messages = [{"role": "system", "content": system_prompt}] + messages
    response = model_with_tools.invoke(messages)
    return {"messages": [response]}

def should_continue(state: AgentState):
    messages = state["messages"]
    last_message = messages[-1]
    if last_message.tool_calls:
        return "tools"
    return END

workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", ToolNode([recipe_search, bilibili_search, generate_recipe_image]))
workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", should_continue)
workflow.add_edge("tools", "agent")

agent = workflow.compile(checkpointer=checkpointer)

def _build_preference_context(preference: dict) -> str:
    """将用户偏好数据构建为上下文字符串"""
    if not preference:
        return ""
    
    parts = []
    
    allergies = [a for a in (preference.get("allergies", []) + preference.get("custom_allergies", [])) if a and isinstance(a, str) and a.strip()]
    if allergies:
        parts.append(f"🚫 过敏源（严禁使用，违反将危害健康）：{', '.join(allergies)}")
    
    diet_type = preference.get("diet_type", "")
    diet_map = {
        "normal": "普通饮食", "vegan": "纯素食", "vegetarian": "蛋奶素",
        "keto": "生酮饮食", "fitness": "健身增肌", "low_calorie": "低卡减脂",
    }
    if diet_type and diet_type != "normal":
        parts.append(f"饮食类型：{diet_map.get(diet_type, diet_type)}")
    
    taste = preference.get("taste", {})
    if taste:
        taste_desc = []
        if taste.get("spice", 3) <= 2:
            taste_desc.append("少辣/不辣")
        elif taste.get("spice", 3) >= 4:
            taste_desc.append("偏辣/嗜辣")
        if taste.get("salt", 3) <= 2:
            taste_desc.append("偏淡")
        elif taste.get("salt", 3) >= 4:
            taste_desc.append("偏咸")
        if taste.get("sweet", 3) <= 2:
            taste_desc.append("少甜")
        elif taste.get("sweet", 3) >= 4:
            taste_desc.append("偏甜")
        if taste.get("oil", 3) <= 2:
            taste_desc.append("少油")
        if taste_desc:
            parts.append(f"口味偏好：{', '.join(taste_desc)}")
    
    members = preference.get("family_members", [])
    if members:
        member_desc = []
        for m in members:
            role_map = {"adult": "成人", "child": "儿童", "elderly": "老人", "baby": "婴儿"}
            role = role_map.get(m.get("role", "adult"), "成人")
            desc = f"{role}（{m.get('age', '?')}岁）"
            if m.get("notes"):
                desc += f"，备注：{m['notes']}"
            member_desc.append(desc)
        parts.append(f"用餐成员：{'; '.join(member_desc)}")
        has_child_or_elderly = any(m.get("role") in ("child", "elderly") for m in members)
        if has_child_or_elderly:
            parts.append("注意：有儿童或老人，请推荐软烂、少刺、低盐的菜品")
        has_baby = any(m.get("role") == "baby" for m in members)
        if has_baby:
            parts.append("注意：有婴儿，请推荐辅食类")
    
    if not parts:
        return ""
    
    return "\n【用户饮食偏好】\n" + "\n".join(f"- {p}" for p in parts) + "\n请在推荐时严格遵守以上偏好要求。\n"


import re as _re

# 推理模型可能输出 奥... 或 <think>...</think> 标签包裹的思考内容
# DeepSeek/豆包 格式: <|think|>...</|/think|> 或 <|response|>...</|/response|>
_THINK_BLOCK_RE = _re.compile(
    r'<\|?\s*(?:think|thinking|reasoning|response)\s*\|?\s*>[\s\S]*?<\|?\s*/\s*(?:think|thinking|reasoning|response)\s*\|?\s*>',
    _re.IGNORECASE
)
# 检测可能开启 think 块的模式（跨 chunk 安全）
_THINK_OPEN_RE = _re.compile(
    r'<\|?\s*(?:think|thinking|reasoning|response)\s*\|?\s*>',
    _re.IGNORECASE
)

def _filter_thinking(content: str) -> str:
    """过滤推理模型的思考标签及内容"""
    return _THINK_BLOCK_RE.sub('', content).lstrip()


class _ThinkFilter:
    """有状态流式过滤器：跨 chunk 正确移除思考块"""
    def __init__(self):
        self._buf = ""
        self._in_think = False

    def feed(self, chunk: str) -> str:
        self._buf += chunk
        out_parts: list[str] = []

        while self._buf:
            if self._in_think:
                m = _THINK_CLOSE_RE.search(self._buf)
                if m:
                    self._buf = self._buf[m.end():]
                    self._in_think = False
                else:
                    break  # 等待闭合标签
            else:
                m = _THINK_OPEN_RE.search(self._buf)
                if m:
                    out_parts.append(self._buf[:m.start()])
                    self._buf = self._buf[m.end():]
                    self._in_think = True
                else:
                    # 安全截断：保留可能是标签前缀的部分
                    safe = _safe_cut(self._buf)
                    out_parts.append(self._buf[:safe])
                    self._buf = self._buf[safe:]
                    break

        return ''.join(out_parts)

    def flush(self) -> str:
        if self._in_think:
            self._buf = ""
            self._in_think = False
            return ""
        rest = self._buf
        self._buf = ""
        return rest


_THINK_CLOSE_RE = _re.compile(
    r'<\|?\s*/\s*(?:think|thinking|reasoning|response)\s*\|?\s*>',
    _re.IGNORECASE
)
_THINK_PREFIXES = ('<|', '<think', '<thinking', '<reasoning', '<response', '</', '</|')

def _safe_cut(text: str) -> int:
    """返回可安全输出的前缀长度（不含可能的标签起始）"""
    cut = len(text)
    lo = text.lower()
    for prefix in _THINK_PREFIXES:
        for n in range(len(prefix), 0, -1):
            if lo.endswith(prefix[:n]):
                candidate = len(text) - n
                if candidate < cut:
                    cut = candidate
                break
    # 也检查 buffer 内部可能被截断的标签起始符（如 "Hello<|thi" 中的 "<|"）
    lt_pos = text.rfind('<')
    if lt_pos >= 0:
        remaining = len(text) - lt_pos
        if remaining < 20 and lt_pos < cut:
            cut = lt_pos
    return max(cut, 0)


def search_recipes(prompt: str, image: str, thread_id: str, preference: dict = None, inventory: list = None):
    """调用Agent搜索食谱"""
    logger.info(f"[用户]: {prompt}, image: {image}, thread_id: {thread_id}")

    preference_context = _build_preference_context(preference)

    inventory_context = ""
    if inventory:
        items = [f"{i.get('name', '')}({i.get('quantity', '')}{i.get('unit', '')})" for i in inventory if i.get('name')]
        if items:
            inventory_context = f"\n【冰箱库存】\n当前冰箱中有：{', '.join(items)}\n根据这些食材推荐菜品。如果食材不足以独立成菜，列出缺少的关键食材及完整菜名。\n"

    full_prompt = (preference_context + inventory_context + prompt).strip()

    try:
        if not image or image.strip() == "":
            message = HumanMessage(content=full_prompt)
        else:
            message = HumanMessage(content=[
                {"type": "image_url", "image_url": {"url": image}},
                {"type": "text", "text": full_prompt}
            ])

        filter = _ThinkFilter()

        for chunk, metadata in agent.stream(
            {"messages": [message]},
            {"configurable": {"thread_id": thread_id}},
            stream_mode="messages"
        ):
            if isinstance(chunk, AIMessageChunk) and chunk.content:
                # 跳过仅包含推理内容的 chunk（兼容新版 langchain-openai）
                if chunk.additional_kwargs.get("reasoning_content") and not chunk.content:
                    continue

                if isinstance(chunk.content, str):
                    text = chunk.content
                elif isinstance(chunk.content, list):
                    text = "".join(
                        item if isinstance(item, str) else str(item.get("text", ""))
                        for item in chunk.content
                        if isinstance(item, (str, dict))
                    )
                else:
                    continue

                cleaned = filter.feed(text)
                if cleaned:
                    yield cleaned

        rest = filter.flush()
        if rest:
            yield rest

    except Exception as e:
        logger.error(f"[错误]: {str(e)}")
        yield f"信息检索失败: {str(e)}"

def clear_messages(thread_id: str):
    """清空会话"""
    logger.info(f"清空历史消息，thread_id: {thread_id}")
    checkpointer.delete_thread(thread_id)

def get_messages(thread_id: str) -> list[dict[str, str]]:
    """获取会话历史"""
    logger.info(f"获取历史消息，thread_id: {thread_id}")
    
    checkpoint = checkpointer.get({"configurable": {"thread_id": thread_id}})
    if not checkpoint:
        return []
    
    channel_values = checkpoint.get("channel_values")
    if not channel_values:
        return []
    
    messages = channel_values.get("messages", [])
    if not messages:
        return []
    
    def _extract_text(content) -> str:
        """从消息内容中提取纯文本，兼容字符串和列表两种格式"""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    parts.append(str(item.get("text", "")))
                elif isinstance(item, str):
                    parts.append(item)
            return " ".join(parts)
        return str(content)

    result = []
    for msg in messages:
        text = _extract_text(msg.content)
        if not text:
            continue

        if isinstance(msg, HumanMessage):
            result.append({"role": "user", "content": text})
        elif isinstance(msg, AIMessage):
            result.append({"role": "assistant", "content": text})

    return result
