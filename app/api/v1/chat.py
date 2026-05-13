import threading
from fastapi import APIRouter, Depends, Request
from app.models.schemas import ChatRequest
from fastapi.responses import StreamingResponse
from app.agents.personal_chief import search_recipes, get_messages, clear_messages
from app.auth import get_current_user
from app.common.logger import logger

router = APIRouter(dependencies=[Depends(get_current_user)])

def _user_thread(user_id: str, thread_id: str) -> str:
    return f"{user_id}::{thread_id}"

@router.post("/chat/stream")
def chat_endpoint(chat_request: ChatRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    isolated_thread = _user_thread(uid, chat_request.thread_id)
    stop_event = threading.Event()

    def event_generator():
        gen = search_recipes(
            chat_request.message, chat_request.image_url, isolated_thread,
            chat_request.preference, chat_request.inventory
        )
        try:
            for chunk_text in gen:
                if stop_event.is_set():
                    logger.info(f"客户端断开，停止生成: {isolated_thread}")
                    break
                yield chunk_text
        except GeneratorExit:
            stop_event.set()
        finally:
            gen.close()
            stop_event.set()

    return StreamingResponse(
        event_generator(),
        media_type="text/plain",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"}
    )

@router.get("/chat/messages")
async def get_chat_messages(thread_id: str, current_user: dict = Depends(get_current_user)):
    """获取历史消息"""
    uid = current_user["user_id"]
    messages = get_messages(_user_thread(uid, thread_id))
    return {"messages": messages}

@router.delete("/chat/messages")
async def clear_chat_messages(thread_id: str, current_user: dict = Depends(get_current_user)):
    """清空历史消息"""
    uid = current_user["user_id"]
    clear_messages(_user_thread(uid, thread_id))
    return {"success": True}
