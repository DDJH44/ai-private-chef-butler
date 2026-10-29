from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, AIMessageChunk, AIMessage, SystemMessage
from langchain.tools import tool
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode
import base64
from app.common.logger import logger
from app.common.preference_context import (
    DIET_TYPE_LABELS,
    GOAL_TYPE_LABELS,
    build_training_schedule_context,
)
import os
import time
from app.common.checkpoint_saver import MySQLSaver
import json
import math
import requests
from dotenv import load_dotenv
load_dotenv()

MAX_REMOTE_IMAGE_SIZE = 10 * 1024 * 1024


def _image_url_to_data_url(url: str) -> str:
    if url[:5].lower() == "data:":
        return url if url[:11].lower() == "data:image/" else ""
    from app.api.v1.oss import is_safe_image_url

    if not is_safe_image_url(url):
        logger.warning("拒绝读取不安全的图片 URL")
        return ""

    try:
        with requests.get(url, timeout=15, stream=True, allow_redirects=False) as resp:
            if resp.status_code != 200:
                return ""
            content_type = resp.headers.get("content-type", "").split(";", 1)[0].strip().lower()
            if not content_type.startswith("image/"):
                return ""
            content_length = resp.headers.get("content-length")
            if content_length and int(content_length) > MAX_REMOTE_IMAGE_SIZE:
                return ""

            image_data = bytearray()
            for chunk in resp.iter_content(64 * 1024):
                if not chunk:
                    continue
                image_data.extend(chunk)
                if len(image_data) > MAX_REMOTE_IMAGE_SIZE:
                    return ""

        if not image_data:
            return ""
        b64 = base64.b64encode(image_data).decode()
        return f"data:{content_type};base64,{b64}"
    except Exception as e:
        logger.warning(f"图片转Base64失败 ({type(e).__name__})")
        return ""
from app.agents.image_agent import fetch_dish_image, _DISH_NAME_MAP
from app.rag.vector_store import rag_store


@tool
def bilibili_search(query: str):
    """搜索B站烹饪教学视频。返回真实视频标题、链接、UP主、播放量。搜不到时返回B站搜索链接"""
    try:
        import urllib.parse

        encoded = urllib.parse.quote(f"{query} 做法 教程")
        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
        })

        try:
            session.get("https://www.bilibili.com", timeout=10)
        except Exception:
            pass

        api_url = f"https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword={encoded}&page=1"
        resp = session.get(api_url, timeout=10, headers={
            "Referer": f"https://search.bilibili.com/video?keyword={encoded}",
        })
        if resp.status_code != 200:
            url = f"https://search.bilibili.com/video?keyword={urllib.parse.quote(query + ' 做法 教程')}"
            return json.dumps([{"title": f"点击在B站搜索「{query}」的教学视频", "url": url}], ensure_ascii=False)

        try:
            data = resp.json()
        except Exception:
            url = f"https://search.bilibili.com/video?keyword={urllib.parse.quote(query + ' 做法 教程')}"
            return json.dumps([{"title": f"点击在B站搜索「{query}」的教学视频", "url": url}], ensure_ascii=False)

        if data.get("code") != 0:
            url = f"https://search.bilibili.com/video?keyword={urllib.parse.quote(query + ' 做法 教程')}"
            return json.dumps([{"title": f"点击在B站搜索「{query}」的教学视频", "url": url}], ensure_ascii=False)

        videos = data.get("data", {}).get("result", [])
        if not videos:
            url = f"https://search.bilibili.com/video?keyword={urllib.parse.quote(query + ' 做法 教程')}"
            return json.dumps([{"title": f"点击在B站搜索「{query}」的教学视频", "url": url}], ensure_ascii=False)

        results = []
        for v in videos[:3]:
            title = v.get("title", "").replace("<em class=\"keyword\">", "").replace("</em>", "")
            results.append({
                "title": title,
                "url": f"https://www.bilibili.com/video/{v.get('bvid', '')}",
                "author": v.get("author", ""),
                "play": str(v.get("play", "")),
            })
        return json.dumps(results, ensure_ascii=False)
    except Exception as e:
        return json.dumps([{"title": "异常", "content": str(e)}], ensure_ascii=False)


@tool
def rag_search(query: str, knowledge_type: str = "auto"):
    """搜索内置参考资料，返回营养、菜谱或运动营养相关的匹配片段。

    参数：
    - query: 搜索查询，如"鸡胸肉的营养成分"或"增肌期碳水摄入建议"
    - knowledge_type: 知识库类型，可选 "nutrition"（营养数据）、"recipe"（菜谱知识）、"fitness"（运动营养学）、"auto"（自动判断）

    返回内容可能来自内置样例或项目数据文件；匹配结果不等同于权威结论。
    """
    nutrition_keywords = ["热量", "营养", "蛋白质", "碳水", "脂肪", "卡路里", "成分",
                          "每100克", "kcal", "多少克", "含量"]
    recipe_keywords = ["做法", "怎么做", "菜谱", "步骤", "食材搭配", "调味", "烹饪",
                       "食谱", "怎么炒", "怎么炖", "怎么煮"]
    fitness_keywords = ["增肌", "减脂", "健身", "训练", "补剂", "碳水循环", "蛋白粉",
                        "减重", "增重", "塑形", "肌肉", "体脂"]

    types_to_search = []
    if knowledge_type == "auto":
        if any(kw in query for kw in nutrition_keywords):
            types_to_search.append("nutrition")
        if any(kw in query for kw in recipe_keywords):
            types_to_search.append("recipe")
        if any(kw in query for kw in fitness_keywords):
            types_to_search.append("fitness")
        if not types_to_search:
            types_to_search = ["nutrition"]
    else:
        types_to_search = [knowledge_type]

    results = []
    for ktype in types_to_search:
        try:
            hits = rag_store.search(query, ktype, k=5)
            for h in hits:
                if h["score"] >= 0.15:
                    results.append({
                        "knowledge_type": ktype,
                        "content": h["content"],
                        "source": h.get("source", "unknown"),
                        "score": h["score"],
                    })
        except Exception as e:
            logger.error(f"[rag_search] {ktype} 搜索异常: {e}")

    if not results:
        return json.dumps([{"message": "未找到相关知识"}], ensure_ascii=False)

    return json.dumps(results, ensure_ascii=False)


model = init_chat_model(
    model=os.getenv("MIMO_MODEL_NAME") or os.getenv("DOUBAO_MODEL_NAME", "doubao-seed-1-8-251228"),
    model_provider="openai",
    base_url=os.getenv("MIMO_BASE_URL") or os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v1"),
    api_key=os.getenv("MIMO_API_KEY") or os.getenv("DOUBAO_API_KEY"),
)

vision_model = init_chat_model(
    model=os.getenv("MIMO_MODEL_NAME") or os.getenv("DOUBAO_MODEL_NAME", "doubao-seed-1-8-251228"),
    model_provider="openai",
    base_url=os.getenv("MIMO_BASE_URL") or os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v1"),
    api_key=os.getenv("MIMO_API_KEY") or os.getenv("DOUBAO_API_KEY"),
)

model_with_tools = model.bind_tools([bilibili_search, fetch_dish_image, rag_search])
vision_model_with_tools = vision_model.bind_tools([bilibili_search, fetch_dish_image, rag_search])

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

def _has_image(messages) -> bool:
    for msg in messages:
        content = msg.get("content") if isinstance(msg, dict) else getattr(msg, "content", None)
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "image_url":
                    return True
    return False

def agent_node(state: AgentState):
    messages = state["messages"]
    if system_prompt:
        messages = [{"role": "system", "content": system_prompt}] + messages
    bound = vision_model_with_tools if _has_image(messages) else model_with_tools
    # 流式消费：触发 on_llm_new_token 回调，LangGraph stream_mode="messages"
    # 才能把 token 实时转发给前端；invoke 模式下要等完整响应生成完才有输出
    final = None
    for chunk in bound.stream(messages):
        final = chunk if final is None else final + chunk
    if final is None:
        final = bound.invoke(messages)
    return {"messages": [final]}

def should_continue(state: AgentState):
    messages = state["messages"]
    last_message = messages[-1]
    if last_message.tool_calls:
        return "tools"
    return END

workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", ToolNode([fetch_dish_image, bilibili_search, rag_search]))
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
    if diet_type and diet_type != "normal":
        parts.append(f"饮食类型：{DIET_TYPE_LABELS.get(diet_type, diet_type)}")

    training_context = build_training_schedule_context(preference)
    if training_context:
        parts.append(training_context)

    targets = preference.get("nutrition_targets")
    if isinstance(targets, dict):
        target_parts = []
        goal_type = targets.get("goal_type")
        if isinstance(goal_type, str) and goal_type in GOAL_TYPE_LABELS:
            target_parts.append(f"目标：{GOAL_TYPE_LABELS[goal_type]}")

        target_fields = (
            ("daily_calories", "每日热量", "kcal", 10000),
            ("protein_target", "蛋白质", "g", 500),
            ("carbs_target", "碳水", "g", 1000),
            ("fat_target", "脂肪", "g", 500),
            ("fiber_target", "膳食纤维", "g", 200),
        )
        for key, label, unit, maximum in target_fields:
            value = targets.get(key)
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                continue
            if value <= 0 or value > maximum or not math.isfinite(value):
                continue
            target_parts.append(f"{label}{value:g}{unit}")

        if target_parts:
            parts.append("用户设定的营养目标（规划参考）：" + "，".join(target_parts))
            parts.append("营养数值按常见份量估算；建议应围绕用户目标，不作医疗诊断或治疗建议")
    
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
            parts.append("注意：家庭成员中有婴儿；如需给具体辅食建议，先确认月龄和当前需求，不要仅凭此标签直接推荐食材")
    
    if not parts:
        return ""
    
    return "\n【用户饮食偏好】\n" + "\n".join(f"- {p}" for p in parts) + "\n请在推荐时严格遵守以上偏好要求。\n"


import re as _re
from app.agents.stream_filter import ThinkFilter as _ThinkFilter, filter_thinking as _filter_thinking


def search_recipes(prompt: str, image: str, thread_id: str, preference: dict = None, inventory: list = None):
    """调用Agent搜索食谱"""
    logger.info(f"[用户]: {prompt}, image: {image}, thread_id: {thread_id}")

    preference_context = _build_preference_context(preference)

    inventory_context = ""
    if inventory:
        items = [f"{i.get('name', '')}({i.get('quantity', '')}{i.get('unit', '')})" for i in inventory if i.get('name')]
        if items:
            inventory_context = f"\n【冰箱库存】\n当前冰箱中有：{', '.join(items)}\n以上是用户冰箱中的食材。请根据用户的实际问题来回应，不要自动推荐菜品，除非用户明确请求推荐。\n"

    # 预生成图片+视频：后台线程并行执行，最多等待 5 秒，超时则跳过（LLM 工具兜底）
    pregen_context = ""
    potential_dishes = _re.findall(r'[一-鿿]{1,6}(?:炒|烧|炖|蒸|煮|炸|煎|焖|煲|烤|拌|烩|煨|熘|爆|焗|汤|羹|面|饭|粥|饼|饺|包|卷|丝|片|丁|块|丸|球)[一-鿿]{0,4}', prompt)
    simple_dishes = _re.findall(r'(?:做[个份道]?|来[个份道]?|要[个份道]?|想吃)([一-鿿]{2,10})', prompt)
    all_hints = list(set(potential_dishes + [m for m in simple_dishes if m]))
    # 词库菜名优先：命中已知菜名直接采用，保证图片缓存 key 干净统一
    # （否则"我想学习番茄炒蛋"这类整句会变成脏 key，同一道菜换个问法就重复生成）
    _known = sorted(_DISH_NAME_MAP.keys(), key=len, reverse=True)
    _canonical = next((n for n in _known if n in prompt), None)
    if _canonical:
        all_hints = [_canonical]
    if all_hints:
        dish = all_hints[0].strip()
        # 剥离菜名杂质：前导助词与"图片"类后缀（避免"的可乐鸡翅图片"式脏缓存 key）
        dish = _re.sub(r'^[的了]+', '', dish.strip())
        dish = _re.sub(r'(图片|照片|配图|图像)$', '', dish)
        for suffix in ['怎么做', '怎么烧', '怎么炖', '怎么煮', '如何做', '怎样做', '的做法', '的视频', '教程', '的做法教程']:
            if dish.endswith(suffix):
                dish = dish[:-len(suffix)]
                break
        if len(dish) >= 2:
            # 用户明确要求重新生成/换图时，预生成也走强制重新生成（跳过缓存），新图由 LLM 工具兜底
            force_regen = bool(_re.search(r'重新生成|重新画|重新配图|换一张|换张图|再来一张|不一样的图|不同的图|新的图片|另出一张', prompt))
            from concurrent.futures import ThreadPoolExecutor
            def _run_image_gen(d, force=False):
                try: return json.loads(fetch_dish_image.invoke({"query": d, "force_regenerate": force}))
                except Exception: return None
            def _run_video_search(d):
                try: return json.loads(bilibili_search.invoke({"query": d}))
                except Exception: return None
            executor = ThreadPoolExecutor(max_workers=2)
            img_future = executor.submit(_run_image_gen, dish, force_regen)
            video_future = executor.submit(_run_video_search, dish)
            # 并行等待：两个 future 共享一次 3s 总预算（原先串行 5s+5s 最多阻塞 10s）
            from concurrent.futures import wait as _fwait
            _fwait([img_future, video_future], timeout=3)
            try:
                if img_future.done():
                    result = img_future.result()
                    if result and isinstance(result, list):
                        img_url = result[0].get("url", "")
                        if img_url and (img_url.startswith("/api/") or img_url.startswith("http://") or img_url.startswith("https://")):
                            pregen_context = f"\n【预生成图片】{dish}: {img_url}\n请在菜谱中使用此图片URL。\n"
                            logger.info(f"[pregen] 图片成功: {img_url[:60]}")
                else:
                    logger.info(f"[pregen] 图片超时，交给 LLM 工具调用兜底")
            except Exception as e:
                logger.warning(f"[pregen] 图片异常: {e}")
            try:
                if video_future.done():
                    video_result = video_future.result()
                    if video_result and isinstance(video_result, list) and video_result[0].get("url"):
                        has_exact = any(dish in str(v.get("title", "")) for v in video_result)
                        video_lines = "\n".join(
                            f'- [{v.get("title", "教学视频")}]({v.get("url", "")})'
                            for v in video_result[:3]
                        )
                        if has_exact:
                            pregen_context += f"\n【预搜索视频】已找到「{dish}」的教学视频，直接列出（不要加说明文字）：\n{video_lines}\n"
                        else:
                            pregen_context += f"\n【预搜索视频】未找到「{dish}」的精准视频，以下是相似菜品视频（先说明未找到，再列出）：\n{video_lines}\n"
                        logger.info(f"[pregen] 视频成功: {len(video_result)} 个")
                else:
                    logger.info(f"[pregen] 视频超时，交给 LLM 工具调用兜底")
            except Exception as e:
                logger.warning(f"[pregen] 视频异常: {e}")
            executor.shutdown(wait=False)

    # 将预生成内容、偏好记忆等作为 SystemMessage，不混入用户消息也不在历史中展示
    context_parts = []
    if preference_context:
        context_parts.append(preference_context)
    if pregen_context:
        context_parts.append(pregen_context)
    if inventory_context:
        context_parts.append(inventory_context)

    try:
        messages = []
        if context_parts:
            messages.append(SystemMessage(content="\n".join(context_parts)))

        if not image or image.strip() == "":
            messages.append(HumanMessage(content=prompt))
        else:
            data_url = _image_url_to_data_url(image)
            if data_url:
                messages.append(HumanMessage(content=[
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": prompt}
                ]))
            else:
                messages.append(SystemMessage(content="用户图片未能安全读取；请基于文字回答，并提示用户重新上传图片。"))
                messages.append(HumanMessage(content=prompt))

        filter = _ThinkFilter()

        for chunk, metadata in agent.stream(
            {"messages": messages},
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
        # 过滤空白消息：工具调用跳的 AIMessage 常只含 '\n' 等空白（stream 聚合产物），
        # 不过滤会被前端渲染成永久的"加载中"点动画
        if not text or not text.strip():
            continue

        if isinstance(msg, HumanMessage):
            result.append({"role": "user", "content": text})
        elif isinstance(msg, AIMessage):
            result.append({"role": "assistant", "content": text})

    return result
