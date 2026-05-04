from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional, List
from app.agents.personal_chief import model, _build_preference_context
from langchain_core.messages import HumanMessage
import json
import re

router = APIRouter()


class MealPlanRequest(BaseModel):
    week_start: str
    week_end: str
    mode: str = "full"  # "full" | "dinner_only"
    requirements: Optional[str] = None
    preference: Optional[dict] = None
    inventory: Optional[List[dict]] = None


async def _call_llm(prompt: str) -> str:
    """Call the LLM (non-streaming) and return full response text."""
    msg = HumanMessage(content=prompt)
    resp = await model.ainvoke([msg])
    content = resp.content
    if isinstance(content, list):
        return "".join(str(c) for c in content)
    return str(content)


@router.post("/meal-plan/generate")
async def generate_meal_plan(request: MealPlanRequest):
    """AI 生成一周膳食计划"""
    # Build context
    preference_ctx = _build_preference_context(request.preference or {})

    inventory_ctx = ""
    if request.inventory:
        items = [f"{i.get('name','')}({i.get('quantity','')}{i.get('unit','')})状态:{i.get('status','')}" for i in request.inventory if i.get('name')]
        if items:
            inventory_ctx = f"当前冰箱库存：{'; '.join(items)}。优先使用库存食材。"

    mode_desc = "三餐（早、午、晚）全部规划" if request.mode == "full" else "仅规划晚餐，早午餐由用户自行安排"
    req_text = f"额外要求：{request.requirements}" if request.requirements else ""

    prompt = f"""你是一名专业的营养师和膳食规划师。请根据以下信息生成一周的膳食计划。

日期范围：{request.week_start} 至 {request.week_end}
规划模式：{mode_desc}
{req_text}
{preference_ctx}
{inventory_ctx}

请生成一个 JSON 格式的膳食计划，严格按照下面的结构输出。只输出 JSON，不要有其他内容。

输出 JSON 结构：
{{
  "days": [
    {{
      "date": "YYYY-MM-DD",
      "meals": {{
        "breakfast": {{"recipe_name": "菜品名", "ingredients": ["食材1", "食材2"], "calories": 热量整数, "protein": 蛋白质克数, "carbs": 碳水克数, "fat": 脂肪克数}},
        "lunch": {{"recipe_name": "菜品名", "ingredients": ["食材1", "食材2"], "calories": 热量整数, "protein": 蛋白质克数, "carbs": 碳水克数, "fat": 脂肪克数}},
        "dinner": {{"recipe_name": "菜品名", "ingredients": ["食材1", "食材2"], "calories": 热量整数, "protein": 蛋白质克数, "carbs": 碳水克数, "fat": 脂肪克数}}
      }}
    }}
  ]
}}

规则：
- 每天三餐都要有菜品名，不能为空
- 菜品名用中文
- 菜品要符合用户的口味偏好和库存食材
- 一周内菜品尽量不重复
- 营养要均衡，每天总热量在 1800-2400 kcal 之间
"""

    try:
        raw = await _call_llm(prompt)
        # Extract JSON from the response
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if not json_match:
            return {"error": "AI 返回的内容无法解析", "raw": raw[:500]}

        data = json.loads(json_match.group())
        return {"plan": data}
    except json.JSONDecodeError as e:
        return {"error": f"JSON 解析失败: {str(e)}", "raw": raw[:500] if 'raw' in dir() else ""}
    except Exception as e:
        return {"error": f"生成失败: {str(e)}"}
