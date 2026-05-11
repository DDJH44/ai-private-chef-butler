import os
import json
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

FEISHU_WEBHOOK_URL = os.getenv("FEISHU_WEBHOOK_URL", "")


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


@router.post("/send")
async def send_message(message: FeishuMessage):
    if not FEISHU_WEBHOOK_URL:
        raise HTTPException(status_code=400, detail="FEISHU_WEBHOOK_URL 未配置")
    
    card = {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": message.title},
                "template": "blue"
            },
            "elements": [
                {"tag": "markdown", "content": message.content}
            ]
        }
    }
    
    if message.link:
        card["card"]["elements"].append({
            "tag": "action",
            "actions": [{
                "tag": "button",
                "text": {"tag": "plain_text", "content": "查看详情"},
                "url": message.link,
                "type": "primary"
            }]
        })
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(FEISHU_WEBHOOK_URL, json=card, timeout=10)
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail=f"飞书推送失败: {resp.text}")
    
    return {"status": "ok", "message": "推送成功"}


@router.post("/daily-report")
async def send_daily_report(report: DailyReportRequest):
    if not FEISHU_WEBHOOK_URL:
        raise HTTPException(status_code=400, detail="FEISHU_WEBHOOK_URL 未配置")

    meals_by_type: dict[str, list] = {}
    for m in report.meals:
        mt = m.get("meal_type", "其他")
        meals_by_type.setdefault(mt, []).append(m)

    meal_lines = []
    meal_icons = {"早餐": "🌅", "午餐": "☀️", "晚餐": "🌙", "加餐": "🍎"}
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
            "header": {
                "title": {"tag": "plain_text", "content": f"🍽️ 每日饮食报告 · {report.date}"},
                "template": "turquoise"
            },
            "elements": [
                {"tag": "markdown", "content": content}
            ]
        }
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(FEISHU_WEBHOOK_URL, json=card, timeout=10)
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail=f"飞书推送失败: {resp.text}")

    return {"status": "ok", "message": "每日报告推送成功"}


@router.post("/recipe-share")
async def share_recipe(recipe: dict):
    if not FEISHU_WEBHOOK_URL:
        raise HTTPException(status_code=400, detail="FEISHU_WEBHOOK_URL 未配置")
    
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
            "header": {
                "title": {"tag": "plain_text", "content": f"🍳 今日推荐 - {recipe.get('title', '菜谱')}"},
                "template": "orange"
            },
            "elements": [
                {"tag": "markdown", "content": content}
            ]
        }
    }
    
    if recipe.get("videoUrl"):
        card["card"]["elements"].append({
            "tag": "action",
            "actions": [{
                "tag": "button",
                "text": {"tag": "plain_text", "content": "🎬 观看视频教程"},
                "url": recipe["videoUrl"],
                "type": "primary"
            }]
        })
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(FEISHU_WEBHOOK_URL, json=card, timeout=10)
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail=f"飞书推送失败: {resp.text}")
    
    return {"status": "ok", "message": "菜谱分享成功"}
