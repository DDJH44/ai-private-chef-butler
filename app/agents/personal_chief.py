from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, AIMessageChunk, AIMessage
from langchain.tools import tool
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode
from app.common.logger import logger
import os
from langgraph.checkpoint.sqlite import SqliteSaver
import sqlite3
import json
import requests
import hashlib
import time
from dotenv import load_dotenv
from app.api.v1.oss import _get_bucket
load_dotenv()

# 常见中餐菜品的中英对照，用于 AI 图片生成提示词
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

# Seedream 图像生成提示词模板
_IMAGE_PROMPT_PREFIX = "professional food photography of "
_IMAGE_PROMPT_SUFFIX = """, authentic Chinese cuisine, served on a handcrafted ceramic plate,
overhead angle, natural window lighting, shallow depth of field,
garnished with fresh herbs, steam rising gently,
4K resolution, Michelin quality, warm tones, sharp focus"""

_IMAGE_NEGATIVE = """no people, no hands, no chopsticks, no text, no watermark,
no cartoon, no illustration, no plastic containers, no takeout boxes,
no restaurant background, no blurry, no low quality, no distorted proportions"""


def _build_image_prompt(query: str) -> str:
    """从中文菜名构建英文图像生成提示词"""
    mapped = _DISH_NAME_MAP.get(query, [query])
    en_name = mapped[0] if mapped else query
    return f"{_IMAGE_PROMPT_PREFIX}{en_name},{_IMAGE_PROMPT_SUFFIX}"


def _init_image_cache_db():
    """初始化图片缓存 SQLite 数据库"""
    db_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(os.path.join(db_dir, "image_cache.db"))
    conn.execute("""CREATE TABLE IF NOT EXISTS image_cache (
        dish_query TEXT PRIMARY KEY,
        oss_url TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        hit_count INTEGER DEFAULT 1
    )""")
    conn.commit()
    return conn


def _generate_food_image(query: str) -> str | None:
    """通过火山引擎 ARK Seedream 生成菜品图片，返回 OSS 公开 URL"""
    api_key = os.getenv("DOUBAO_API_KEY")
    base_url = os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v1")
    model_name = os.getenv("IMAGE_GEN_MODEL", "doubao-seedream-3-0-t2i-250415")

    prompt = _build_image_prompt(query)

    resp = requests.post(
        f"{base_url}/images/generations",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model_name,
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024",
        },
        timeout=90
    )
    if resp.status_code != 200:
        logger.warning(f"[image_gen] API {resp.status_code}: {resp.text[:200]}")
        return None

    data = resp.json()
    image_url = data.get("data", [{}])[0].get("url", "")
    if not image_url:
        logger.warning(f"[image_gen] 无 URL: {resp.text[:200]}")
        return None

    img_resp = requests.get(image_url, timeout=30)
    if img_resp.status_code != 200:
        logger.warning(f"[image_gen] 下载失败 {img_resp.status_code}")
        return None

    image_bytes = img_resp.content
    filename = f"ai-generated/{hashlib.md5(query.encode('utf-8')).hexdigest()[:12]}_{int(time.time())}.jpg"
    try:
        bucket = _get_bucket()
        bucket.put_object(filename, image_bytes, headers={
            "Content-Type": "image/jpeg",
            "x-oss-object-acl": "public-read"
        })
    except Exception as e:
        logger.warning(f"[image_gen] OSS 上传失败: {e}")
        return None

    endpoint = os.getenv("OSS_ENDPOINT", "oss-cn-beijing.aliyuncs.com")
    bucket_name = os.getenv("OSS_BUCKET")
    logger.info(f"[image_gen] {query} 生成完成 → OSS")
    return f"https://{bucket_name}.{endpoint}/{filename}"


@tool
def recipe_search(query: str):
    """搜索指定菜品的真实成品照片。输入准确的菜品名称如'宫保鸡丁'或'番茄炒蛋'，返回该菜品的高质量食物摄影图片URL"""
    try:
        # 1. 查缓存
        cache_conn = _init_image_cache_db()
        row = cache_conn.execute(
            "SELECT oss_url, hit_count FROM image_cache WHERE dish_query = ?",
            (query,)
        ).fetchone()

        if row:
            cache_conn.execute(
                "UPDATE image_cache SET hit_count = ? WHERE dish_query = ?",
                (row[1] + 1, query)
            )
            cache_conn.commit()
            cache_conn.close()
            logger.info(f"[recipe_search] 缓存命中: {query}")
            return json.dumps([{"title": query, "url": row[0], "content": query}], ensure_ascii=False)

        # 2. AI 生成新图片
        logger.info(f"[recipe_search] 生成新图片: {query}")
        oss_url = _generate_food_image(query)

        if oss_url:
            cache_conn.execute(
                "INSERT OR REPLACE INTO image_cache (dish_query, oss_url, created_at) VALUES (?, ?, ?)",
                (query, oss_url, int(time.time()))
            )
            cache_conn.commit()
            cache_conn.close()
            return json.dumps([{"title": query, "url": oss_url, "content": query}], ensure_ascii=False)

        cache_conn.close()
        return json.dumps([{"title": "无结果", "content": f"暂未找到'{query}'的图片"}], ensure_ascii=False)

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


model = init_chat_model(
    model=os.getenv("DOUBAO_MODEL_NAME", "doubao-seed-1-8-251228"),
    model_provider="openai",
    base_url=os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v1"),
    api_key=os.getenv("DOUBAO_API_KEY")
)

model_with_tools = model.bind_tools([recipe_search, bilibili_search])

_db_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
os.makedirs(_db_dir, exist_ok=True)
connection = sqlite3.connect(os.path.join(_db_dir, "personal_chief.db"), check_same_thread=False, timeout=10)
connection.execute("PRAGMA journal_mode=WAL")
checkpointer = SqliteSaver(connection)
checkpointer.setup()

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
workflow.add_node("tools", ToolNode([recipe_search, bilibili_search]))
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

def _filter_thinking(content: str) -> str:
    """过滤推理模型的思考标签及内容"""
    return _THINK_BLOCK_RE.sub('', content).lstrip()


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
                    yield _filter_thinking(chunk.content)
                elif isinstance(chunk.content, list):
                    for item in chunk.content:
                        if isinstance(item, str):
                            yield _filter_thinking(item)
                        elif isinstance(item, dict) and item.get("type") == "text":
                            yield _filter_thinking(str(item.get("text", "")))

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
