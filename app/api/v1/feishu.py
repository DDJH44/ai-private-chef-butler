"""飞书集成 API — 每用户独立配置"""
import os
import json
import sqlite3
import time
import httpx
from contextlib import contextmanager
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv
from app.auth import get_current_user

load_dotenv()

router = APIRouter(dependencies=[Depends(get_current_user)])

GLOBAL_WEBHOOK_URL = os.getenv("FEISHU_WEBHOOK_URL", "")
DB_PATH = os.getenv("FEISHU_DB_PATH", "data/feishu.db")


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    import os as _os
    _os.makedirs(_os.path.dirname(DB_PATH), exist_ok=True)
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS feishu_config (
                user_id TEXT PRIMARY KEY,
                webhook_url TEXT NOT NULL,
                onboarding_step TEXT NOT NULL DEFAULT 'webhook_saved',
                enabled INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        conn.commit()


def get_user_config(user_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM feishu_config WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        return None
    return {
        "webhook_url": row["webhook_url"],
        "onboarding_step": row["onboarding_step"],
        "enabled": bool(row["enabled"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def get_user_webhook_url(user_id: str) -> str:
    """优先使用用户配置的 webhook，否则回退到全局配置"""
    cfg = get_user_config(user_id)
    if cfg and cfg["enabled"] and cfg["webhook_url"]:
        return cfg["webhook_url"]
    return GLOBAL_WEBHOOK_URL


async def send_to_feishu(webhook_url: str, card: dict) -> None:
    async with httpx.AsyncClient() as client:
        resp = await client.post(webhook_url, json=card, timeout=10)
        if resp.status_code != 200:
            body = resp.text[:200]
            raise HTTPException(status_code=500, detail=f"飞书推送失败: {body}")


# ── Pydantic Models ──

class FeishuConfigRequest(BaseModel):
    webhook_url: str


class FeishuMessage(BaseModel):
    title: str
    content: str
    link: Optional[str] = None


class DailyReportRequest(BaseModel):
    date: str
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    meals: List[dict]
    analysis: str
    health_score: Optional[float] = None
    health_eval: Optional[str] = None


# ── 配置端点 ──

@router.get("/config")
def get_feishu_config(current_user: dict = Depends(get_current_user)):
    cfg = get_user_config(current_user["user_id"])
    if not cfg:
        return {
            "configured": False,
            "has_global": bool(GLOBAL_WEBHOOK_URL),
            "onboarding_step": "not_started",
            "enabled": False,
            "onboarding": {
                "step": 1,
                "title": "创建飞书机器人",
                "steps": [
                    {"num": 1, "title": "创建飞书机器人", "desc": "打开飞书 → 搜索「飞书机器人助手」→ 创建自定义机器人 → 复制 Webhook 地址"},
                    {"num": 2, "title": "填写 Webhook 地址", "desc": "将复制的地址粘贴到下方输入框中"},
                    {"num": 3, "title": "测试连接", "desc": "点击「发送测试」按钮，确认飞书群收到消息"},
                    {"num": 4, "title": "开启推送", "desc": "开启开关，AI 私厨将自动推送每日饮食报告和推荐菜谱到你的飞书"},
                ],
            },
        }
    return {
        "configured": True,
        "has_global": bool(GLOBAL_WEBHOOK_URL),
        "webhook_url_masked": mask_url(cfg["webhook_url"]),
        "onboarding_step": cfg["onboarding_step"],
        "enabled": cfg["enabled"],
        "created_at": cfg["created_at"],
    }


@router.put("/config")
def save_feishu_config(data: FeishuConfigRequest, current_user: dict = Depends(get_current_user)):
    url = data.webhook_url.strip()
    if not url.startswith("https://open.feishu.cn/open-apis/bot/v2/hook/"):
        raise HTTPException(400, "Webhook 地址格式不正确，应以 https://open.feishu.cn/open-apis/bot/v2/hook/ 开头")

    uid = current_user["user_id"]
    now = int(time.time())
    existing = get_user_config(uid)
    step = existing["onboarding_step"] if existing else "webhook_saved"
    if step == "not_started":
        step = "webhook_saved"

    with get_db() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO feishu_config (user_id, webhook_url, onboarding_step, enabled, created_at, updated_at)
            VALUES (?, ?, ?, 0, ?, ?)
        """, (uid, url, step, existing["created_at"] if existing else now, now))
        conn.commit()
    return {"message": "已保存", "onboarding_step": step, "webhook_url_masked": mask_url(url)}


@router.delete("/config")
def delete_feishu_config(current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    with get_db() as conn:
        conn.execute("DELETE FROM feishu_config WHERE user_id = ?", (uid,))
        conn.commit()
    return {"message": "已断开飞书连接"}


@router.post("/test")
async def test_feishu(data: FeishuConfigRequest | None = None, current_user: dict = Depends(get_current_user)):
    """发送测试消息验证 webhook 是否可用"""
    url = ""
    if data and data.webhook_url.strip():
        url = data.webhook_url.strip()
    else:
        cfg = get_user_config(current_user["user_id"])
        if cfg and cfg["webhook_url"]:
            url = cfg["webhook_url"]
        elif GLOBAL_WEBHOOK_URL:
            url = GLOBAL_WEBHOOK_URL
        else:
            raise HTTPException(400, "未配置飞书 Webhook 地址")

    card = {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": "✅ 飞书连接测试"},
                "template": "green",
            },
            "elements": [
                {"tag": "markdown", "content": "🎉 恭喜！AI 私厨已成功连接你的飞书。\n\n从现在开始，每日饮食报告和推荐菜谱将自动推送到这里。"},
                {"tag": "hr"},
                {"tag": "note", "elements": [{"tag": "plain_text", "content": "来自 AI 私人厨师 · " + time.strftime("%Y-%m-%d %H:%M")}]},
            ],
        },
    }

    await send_to_feishu(url, card)

    # 更新引导状态
    uid = current_user["user_id"]
    now = int(time.time())
    existing = get_user_config(uid)
    with get_db() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO feishu_config (user_id, webhook_url, onboarding_step, enabled, created_at, updated_at)
            VALUES (?, ?, 'test_success', 1, ?, ?)
        """, (uid, url, existing["created_at"] if existing else now, now))
        conn.commit()

    return {"message": "测试消息已发送", "onboarding_step": "active", "enabled": True}


@router.put("/toggle")
def toggle_feishu(current_user: dict = Depends(get_current_user)):
    cfg = get_user_config(current_user["user_id"])
    if not cfg:
        raise HTTPException(400, "请先配置飞书 Webhook 地址")
    new_enabled = not cfg["enabled"]
    now = int(time.time())
    with get_db() as conn:
        conn.execute("UPDATE feishu_config SET enabled = ?, updated_at = ? WHERE user_id = ?",
                    (int(new_enabled), now, current_user["user_id"]))
        conn.commit()
    return {"enabled": new_enabled}


# ── 推送端点（使用每用户 webhook）──

@router.post("/send")
async def send_message(message: FeishuMessage, current_user: dict = Depends(get_current_user)):
    url = get_user_webhook_url(current_user["user_id"])
    if not url:
        raise HTTPException(400, "飞书未配置，请在个人中心 → 飞书集成中设置")

    card = {
        "msg_type": "interactive",
        "card": {
            "header": {"title": {"tag": "plain_text", "content": message.title}, "template": "blue"},
            "elements": [{"tag": "markdown", "content": message.content}],
        },
    }
    if message.link:
        card["card"]["elements"].append({
            "tag": "action",
            "actions": [{"tag": "button", "text": {"tag": "plain_text", "content": "查看详情"}, "url": message.link, "type": "primary"}],
        })

    await send_to_feishu(url, card)
    return {"status": "ok", "message": "推送成功"}


@router.post("/daily-report")
async def send_daily_report(report: DailyReportRequest, current_user: dict = Depends(get_current_user)):
    url = get_user_webhook_url(current_user["user_id"])
    if not url:
        raise HTTPException(400, "飞书未配置，请在个人中心 → 飞书集成中设置")

    meals_by_type: dict[str, list] = {}
    for m in report.meals:
        mt = m.get("meal_type", "其他")
        meals_by_type.setdefault(mt, []).append(m)

    meal_icons = {"早餐": "🌅", "午餐": "☀️", "晚餐": "🌙", "加餐": "🍎"}
    meal_lines = []
    for mt, items in meals_by_type.items():
        icon = meal_icons.get(mt, "🍽️")
        foods = "、".join(f"{i.get('food_name', '未知')}" for i in items)
        cal = sum(i.get("calories", 0) or 0 for i in items)
        meal_lines.append(f"{icon} **{mt}**　{foods}　{cal:.0f}kcal")
    meal_summary = "\n".join(meal_lines)

    cal_status = "偏低 ⚠️" if report.total_calories < 1200 else "偏高 ⚠️" if report.total_calories > 2500 else "适中 ✅"
    protein_pct = report.total_protein * 4 / report.total_calories * 100 if report.total_calories > 0 else 0
    carbs_pct = report.total_carbs * 4 / report.total_calories * 100 if report.total_calories > 0 else 0
    fat_pct = report.total_fat * 9 / report.total_calories * 100 if report.total_calories > 0 else 0

    bar_len = 20
    p_bar = "█" * int(protein_pct / 100 * bar_len) + "░" * (bar_len - int(protein_pct / 100 * bar_len))
    c_bar = "█" * int(carbs_pct / 100 * bar_len) + "░" * (bar_len - int(carbs_pct / 100 * bar_len))
    f_bar = "█" * int(fat_pct / 100 * bar_len) + "░" * (bar_len - int(fat_pct / 100 * bar_len))

    health_section = ""
    if report.health_score is not None:
        score = report.health_score
        score_emoji = "🟢" if score >= 80 else "🟡" if score >= 60 else "🔴"
        score_label = "优秀" if score >= 90 else "良好" if score >= 80 else "一般" if score >= 60 else "需改善"
        s_bar_len = 15
        filled = int(score / 100 * s_bar_len)
        s_bar = "█" * filled + "░" * (s_bar_len - filled)
        health_section = f"""
---
🏥 **健康评估**　{score_emoji} **{score:.0f}** / 100　{score_label}
`{s_bar}`

{report.health_eval or ''}

"""

    content = f"""📊 **营养总览**　🔥 {report.total_calories:.0f} kcal　{cal_status}

🥩 蛋白质 {report.total_protein:.0f}g ({protein_pct:.0f}%)
`{p_bar}`
🍚 碳水 {report.total_carbs:.0f}g ({carbs_pct:.0f}%)
`{c_bar}`
🧈 脂肪 {report.total_fat:.0f}g ({fat_pct:.0f}%)
`{f_bar}`

---
📝 **三餐记录**
{meal_summary}
{health_section}"""

    card = {
        "msg_type": "interactive",
        "card": {
            "header": {"title": {"tag": "plain_text", "content": f"🍽️ 每日饮食报告 · {report.date}"}, "template": "turquoise"},
            "elements": [{"tag": "markdown", "content": content}],
        },
    }

    await send_to_feishu(url, card)
    return {"status": "ok", "message": "每日报告推送成功"}


@router.post("/recipe-share")
async def share_recipe(recipe: dict, current_user: dict = Depends(get_current_user)):
    url = get_user_webhook_url(current_user["user_id"])
    if not url:
        raise HTTPException(400, "飞书未配置，请在个人中心 → 飞书集成中设置")

    ingredients = recipe.get("ingredients", [])
    ingredients_str = "、".join(ingredients[:8]) if ingredients else "无"

    content = f"""🍳 **{recipe.get('title', '未知菜品')}**

⏱ 烹饪时间: {recipe.get('cookingTime', '未知')}
🎯 难度: {recipe.get('difficulty', '未知')}
⭐ 推荐指数: {recipe.get('score', 'N/A')}

📝 **食材**: {ingredients_str}

💡 **推荐理由**: {recipe.get('reason', '无')}"""

    card = {
        "msg_type": "interactive",
        "card": {
            "header": {"title": {"tag": "plain_text", "content": f"🍳 今日推荐 - {recipe.get('title', '菜谱')}"}, "template": "orange"},
            "elements": [{"tag": "markdown", "content": content}],
        },
    }
    if recipe.get("videoUrl"):
        card["card"]["elements"].append({
            "tag": "action",
            "actions": [{"tag": "button", "text": {"tag": "plain_text", "content": "🎬 观看视频教程"}, "url": recipe["videoUrl"], "type": "primary"}],
        })

    await send_to_feishu(url, card)
    return {"status": "ok", "message": "菜谱分享成功"}


def mask_url(url: str) -> str:
    """隐藏 webhook URL 中的敏感部分"""
    if len(url) <= 40:
        return url[:20] + "****"
    return url[:30] + "****" + url[-10:]
