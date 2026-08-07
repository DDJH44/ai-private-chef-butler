from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from pydantic import BaseModel
from typing import Optional, List, Literal
from app.agents.personal_chief import model, _build_preference_context
from langchain_core.messages import HumanMessage
from app.common.json_utils import repair_truncated_json
from app.common.logger import logger
from app.common.database import get_db
from app.models.db import MealPlanDB
from sqlalchemy import select, delete
import json
import re
import asyncio
import time
from datetime import datetime, timedelta

router = APIRouter(dependencies=[Depends(get_current_user)])

ModeType = Literal["full", "breakfast_only", "lunch_only", "dinner_only"]

MODE_LABELS = {
    "full": "三餐（早、午、晚）全部规划",
    "breakfast_only": "仅规划早餐，午餐和晚餐由用户自行安排",
    "lunch_only": "仅规划午餐，早餐和晚餐由用户自行安排",
    "dinner_only": "仅规划晚餐，早餐和午餐由用户自行安排",
}

MEAL_KEYS = ["breakfast", "lunch", "dinner"]


class MealPlanRequest(BaseModel):
    week_start: str
    week_end: str
    mode: ModeType = "full"
    requirements: Optional[str] = None
    preference: Optional[dict] = None
    inventory: Optional[List[dict]] = None
    existing_plan: Optional[dict] = None  # 用户已编辑的计划，只替换生成部分


def _repair_truncated_json(raw: str) -> str:
    """尝试修复被截断的 JSON：补全缺失的闭合括号"""
    return repair_truncated_json(raw)


async def _call_llm_day(prompt: str, max_tokens: int = 1024) -> dict | None:
    """调用 LLM 生成单日膳食计划，返回解析后的 meal dict 或 None"""
    msg = HumanMessage(content=prompt)
    bound = model.bind(max_tokens=max_tokens)
    resp = await bound.ainvoke([msg])
    content = resp.content
    if isinstance(content, list):
        content = "".join(str(c) for c in content)
    if not content:
        return None
    json_match = re.search(r'\{[\s\S]*\}', content)
    if not json_match:
        return None
    json_str = json_match.group()
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        try:
            return json.loads(repair_truncated_json(json_str))
        except json.JSONDecodeError:
            return None


def _build_existing_context(existing_plan: dict, mode: str) -> str:
    """构建已有计划的上下文，标明哪些餐次需要保留"""
    if not existing_plan:
        return ""

    days = existing_plan.get("days", [])
    if not days:
        return ""

    preserved = []
    for day in days:
        date = day.get("date", "")
        meals = day.get("meals", {})
        for key in MEAL_KEYS:
            meal = meals.get(key, {})
            if meal and meal.get("recipe_name"):
                preserved.append(f"  {date} {key}: {meal['recipe_name']} ({meal.get('calories', 0)}kcal)")

    if not preserved:
        return ""

    return "\n【用户已保留的餐次 — 以下内容不要修改，保持原样】\n" + "\n".join(preserved)


def _get_target_meals(mode: str) -> list[str]:
    """返回需要生成的餐次列表"""
    if mode == "full":
        return MEAL_KEYS
    elif mode == "breakfast_only":
        return ["breakfast"]
    elif mode == "lunch_only":
        return ["lunch"]
    elif mode == "dinner_only":
        return ["dinner"]
    return MEAL_KEYS


@router.post("/meal-plan/generate")
async def generate_meal_plan(request: MealPlanRequest):
    """AI 生成一周膳食计划 — 7 天并行生成，大幅缩短等待时间"""
    preference_ctx = _build_preference_context(request.preference or {})

    inventory_ctx = ""
    if request.inventory:
        items = [f"{i.get('name','')}({i.get('quantity','')}{i.get('unit','')})状态:{i.get('status','')}" for i in request.inventory if i.get('name')]
        if items:
            inventory_ctx = f"当前冰箱库存：{'; '.join(items)}。优先使用库存食材。"

    target_meals = _get_target_meals(request.mode)
    target_desc = "、".join({"breakfast": "早餐", "lunch": "午餐", "dinner": "晚餐"}[k] for k in target_meals)
    req_text = f"额外要求：{request.requirements}" if request.requirements else ""

    # 构建已有计划的日期索引（用户已编辑的餐次保持不变）
    preserved: dict[str, dict[str, dict]] = {}
    if request.existing_plan:
        for day in (request.existing_plan.get("days") or []):
            date = day.get("date", "")
            meals = day.get("meals", {})
            preserved[date] = {}
            for key in MEAL_KEYS:
                m = meals.get(key)
                if m and m.get("recipe_name"):
                    preserved[date][key] = m

    # 生成日期列表
    start = datetime.strptime(request.week_start, "%Y-%m-%d")
    dates = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]

    # 并发信号量，限制同时最多 4 个请求
    semaphore = asyncio.Semaphore(4)

    async def generate_day(date: str) -> tuple[str, dict | None, str | None]:
        """生成单日膳食计划，返回 (date, meals_dict, error)"""
        async with semaphore:
            # 构建当天已有餐次的保留上下文
            day_preserved = preserved.get(date, {})
            preserved_lines = []
            for key in MEAL_KEYS:
                if key in day_preserved:
                    m = day_preserved[key]
                    preserved_lines.append(f"  {key}: {m['recipe_name']} ({m.get('calories', 0)}kcal) — 已保留，不要修改")
            preserved_ctx = ""
            if preserved_lines:
                preserved_ctx = "\n【当天已保留的餐次 — 以下内容不要修改，保持原样】\n" + "\n".join(preserved_lines)

            # 当天已保留的餐次不需要 AI 再生成
            day_target = [k for k in target_meals if k not in day_preserved]

            # 构建当天目标 JSON 结构
            meal_template = {}
            for key in MEAL_KEYS:
                if key in day_target:
                    meal_template[key] = '{"recipe_name": "菜品名", "ingredients": ["食材1", "食材2"], "calories": 热量, "protein": 蛋白克数, "carbs": 碳水克数, "fat": 脂肪克数}'
                elif key in day_preserved:
                    meal_template[key] = '"保留"'
                else:
                    meal_template[key] = "null"

            prompt = f"""你是专业营养师。为 {date} 生成当天膳食计划。

规划范围：{target_desc}
{req_text}
{preference_ctx}
{inventory_ctx}
{preserved_ctx}

只返回如下 JSON，不要任何解释：
{{
  "date": "{date}",
  "meals": {{
    "breakfast": {meal_template.get("breakfast", "null")},
    "lunch": {meal_template.get("lunch", "null")},
    "dinner": {meal_template.get("dinner", "null")}
  }}
}}

规则：
- 当天总热量 1600-2400 kcal
- 菜品名用中文，营养数值为整数
- 只返回 JSON，不要任何解释"""

            try:
                result = await _call_llm_day(prompt)
                if result:
                    return (date, result.get("meals"), None)
                return (date, None, f"{date} 返回数据无法解析")
            except Exception as e:
                logger.error(f"[meal_plan] {date} 生成失败: {e}")
                return (date, None, str(e))

    # 并行生成所有日期
    tasks = [generate_day(date) for date in dates]
    results = await asyncio.gather(*tasks)

    # 组装完整计划
    errors = []
    days = []
    for date, meals, error in results:
        if error:
            errors.append(error)
        days.append({
            "date": date,
            "meals": meals or {k: None for k in MEAL_KEYS},
        })

    if len(errors) >= 7:
        raise HTTPException(status_code=500, detail="所有日期生成均失败，请重试")

    # 规范化：未生成和已保留的餐次
    for day in days:
        meals = day["meals"]
        date = day["date"]
        day_preserved = preserved.get(date, {})
        for key in MEAL_KEYS:
            if key in day_preserved:
                meals[key] = day_preserved[key]
            elif key not in target_meals:
                meals[key] = None

    logger.info(f"[meal_plan] 生成完成: {len(days)} 天, {sum(1 for d in days for k in target_meals if d['meals'].get(k) and d['meals'][k] != '保留')} 个新餐次, {len(errors)} 个错误")

    return {"plan": {"days": days}}


# ==================== 膳食计划 CRUD ====================


class MealPlanSave(BaseModel):
    """前端保存膳食计划的请求体"""
    id: str
    week_start: str
    week_end: str
    plan_data: dict  # 完整的 MealPlan JSON
    status: str = "active"


@router.get("/meal-plan/plans")
async def list_meal_plans(current_user: dict = Depends(get_current_user)):
    """获取用户所有膳食计划"""
    uid = current_user["user_id"]
    with get_db() as session:
        rows = session.execute(
            select(MealPlanDB)
            .where(MealPlanDB.user_id == uid)
            .order_by(MealPlanDB.week_start.desc())
        ).scalars().all()
        return {
            "items": [
                {
                    "id": r.id,
                    "week_start": r.week_start,
                    "week_end": r.week_end,
                    "plan_data": r.plan_data,
                    "status": r.status,
                    "created_at": r.created_at,
                    "updated_at": r.updated_at,
                }
                for r in rows
            ]
        }


@router.put("/meal-plan/plans/{plan_id}")
async def save_meal_plan(plan_id: str, body: MealPlanSave, current_user: dict = Depends(get_current_user)):
    """保存或更新膳食计划（upsert）"""
    uid = current_user["user_id"]
    now = int(time.time() * 1000)
    with get_db() as session:
        existing = session.execute(
            select(MealPlanDB).where(
                MealPlanDB.id == plan_id,
                MealPlanDB.user_id == uid,
            )
        ).scalar_one_or_none()

        if existing:
            existing.plan_data = body.plan_data
            existing.week_start = body.week_start
            existing.week_end = body.week_end
            existing.status = body.status
            existing.updated_at = now
        else:
            row = MealPlanDB(
                id=plan_id,
                user_id=uid,
                week_start=body.week_start,
                week_end=body.week_end,
                plan_data=body.plan_data,
                status=body.status,
                created_at=now,
                updated_at=now,
            )
            session.add(row)
    return {"message": "ok", "updated_at": now}


@router.delete("/meal-plan/plans/{plan_id}")
async def delete_meal_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    """删除膳食计划"""
    uid = current_user["user_id"]
    with get_db() as session:
        session.execute(
            delete(MealPlanDB).where(
                MealPlanDB.id == plan_id,
                MealPlanDB.user_id == uid,
            )
        )
    return {"message": "deleted"}
