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
from dotenv import load_dotenv
from app.api.v1.oss import proxy_image_url
load_dotenv()

@tool
def recipe_search(query: str):
    """搜索指定菜品的真实成品照片。输入准确的菜品名称如'宫保鸡丁'或'番茄炒蛋'，返回该菜品的高质量食物摄影图片URL"""
    pexels_key = os.getenv("PEXELS_API_KEY", "")
    if not pexels_key:
        return json.dumps([{"title": "错误", "content": "PEXELS_API_KEY 未配置"}], ensure_ascii=False)

    results = []
    try:
        search_queries = [
            f"{query} chinese food",
            f"{query} dish cooking",
            f"{query} food",
        ]
        for search_query in search_queries:
            pexels_url = f"https://api.pexels.com/v1/search?query={requests.utils.quote(search_query)}&per_page=3&orientation=landscape&locale=zh-CN"
            pexels_resp = requests.get(pexels_url, headers={"Authorization": pexels_key}, timeout=10)
            if pexels_resp.status_code == 200:
                for photo in pexels_resp.json().get("photos", []):
                    img_url = photo.get("src", {}).get("large", "")
                    alt_text = photo.get("alt", "").lower()
                    photographer = photo.get("photographer", "").lower()
                    if img_url and img_url not in [r.get("url") for r in results]:
                        results.append({
                            "title": f"{query}",
                            "url": proxy_image_url(img_url),
                            "content": photo.get("alt", query),
                            "photographer": photo.get("photographer", ""),
                        })
            if len(results) >= 5:
                break
        if not results:
            return json.dumps([{"title": "无结果", "content": f"Pexels 未找到'{query}'的图片"}], ensure_ascii=False)
    except Exception as e:
        return json.dumps([{"title": "异常", "content": str(e)}], ensure_ascii=False)

    return json.dumps(results[:5], ensure_ascii=False)


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
    model=os.getenv("DOUBAO_MODEL_NAME", "doubao-seed-2-0-mini-260215"),
    model_provider="openai",
    base_url=os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v1"),
    api_key=os.getenv("DOUBAO_API_KEY")
).bind(extra_body={"reasoning_effort": "low"})

model_with_tools = model.bind_tools([recipe_search, bilibili_search])

connection = sqlite3.connect("app/db/personal_chief.db", check_same_thread=False, timeout=10)
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
                if isinstance(chunk.content, str):
                    yield chunk.content
                elif isinstance(chunk.content, list):
                    for item in chunk.content:
                        if isinstance(item, str):
                            yield item
                        elif isinstance(item, dict) and item.get("type") == "text":
                            yield str(item.get("text", ""))

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
