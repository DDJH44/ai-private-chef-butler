from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from pydantic import BaseModel
from typing import Optional, List, Literal
from app.agents.personal_chief import model, _build_preference_context
from langchain_core.messages import HumanMessage
import json
import re

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


async def _call_llm(prompt: str) -> str:
    """Call the LLM (non-streaming) and return full response text."""
    msg = HumanMessage(content=prompt)
    resp = await model.ainvoke([msg])
    content = resp.content
    if isinstance(content, list):
        return "".join(str(c) for c in content)
    return str(content)


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
    """AI 生成一周膳食计划"""
    preference_ctx = _build_preference_context(request.preference or {})

    inventory_ctx = ""
    if request.inventory:
        items = [f"{i.get('name','')}({i.get('quantity','')}{i.get('unit','')})状态:{i.get('status','')}" for i in request.inventory if i.get('name')]
        if items:
            inventory_ctx = f"当前冰箱库存：{'; '.join(items)}。优先使用库存食材。"

    existing_ctx = _build_existing_context(request.existing_plan, request.mode)
    target_meals = _get_target_meals(request.mode)
    target_desc = "、".join({"breakfast": "早餐", "lunch": "午餐", "dinner": "晚餐"}[k] for k in target_meals)
    mode_desc = MODE_LABELS[request.mode]
    req_text = f"额外要求：{request.requirements}" if request.requirements else ""

    # 构建未生成餐次的 null JSON 模板
    null_meals = {}
    for key in MEAL_KEYS:
        if key not in target_meals:
            null_meals[key] = "null"

    prompt = f"""你是一名专业的营养师和膳食规划师。请根据以下信息生成一周的膳食计划。

日期范围：{request.week_start} 至 {request.week_end}
规划模式：{mode_desc}
本次只生成：{target_desc}
{req_text}
{preference_ctx}
{inventory_ctx}
{existing_ctx}

请生成一个 JSON 格式的膳食计划，严格按照下面的结构输出。只输出 JSON，不要有任何解释性文字。

输出 JSON 结构（注意：不在生成范围内的餐次必须设为 null）：
{{
  "days": [
    {{
      "date": "YYYY-MM-DD",
      "meals": {{
        "breakfast": {"null" if "breakfast" not in target_meals else '{{"recipe_name": "菜品名", "ingredients": ["食材1", "食材2"], "calories": 热量整数, "protein": 蛋白质克数, "carbs": 碳水克数, "fat": 脂肪克数}}'},
        "lunch": {"null" if "lunch" not in target_meals else '{{"recipe_name": "菜品名", "ingredients": ["食材1", "食材2"], "calories": 热量整数, "protein": 蛋白质克数, "carbs": 碳水克数, "fat": 脂肪克数}}'},
        "dinner": {"null" if "dinner" not in target_meals else '{{"recipe_name": "菜品名", "ingredients": ["食材1", "食材2"], "calories": 热量整数, "protein": 蛋白质克数, "carbs": 碳水克数, "fat": 脂肪克数}}'}
      }}
    }}
  ]
}}

规则：
- 只生成 {target_desc}，其余餐次字段必须设为 null
- 若提供了"用户已保留的餐次"，不要修改这些餐次的菜品名，可以直接复用或保持原样
- 每餐的菜谱选择独立考虑，不需要因为早餐做了某道菜就在午晚餐刻意避开
- 菜品名用中文，符合用户的口味偏好和库存食材
- 营养均衡，每天总热量在 1800-2400 kcal 之间
- 不要添加任何解释性文字，仅返回上述 JSON
"""

    try:
        raw = await _call_llm(prompt)
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if not json_match:
            raise HTTPException(status_code=500, detail="AI 返回的内容无法解析")

        data = json.loads(json_match.group())

        # 规范化：确保未生成餐次为 null
        days = data.get("days", [])
        for day in days:
            meals = day.get("meals", {})
            for key in MEAL_KEYS:
                if key not in target_meals:
                    meals[key] = None

        return {"plan": data}
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="膳食计划生成失败，请重试")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")
