"""Dashboard 聚合统计接口 — 一次性返回首页仪表盘所需的全部数据"""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc
from app.auth import get_current_user
from app.common.database import get_db
from app.common.logger import logger
from app.models.db import (
    Recipe,
    CookRecord,
    NutritionRecord,
    ShoppingList,
    Ingredient,
    MealPlanDB,
    Preference,
)
from datetime import datetime, timedelta

router = APIRouter(dependencies=[Depends(get_current_user)])

_DAYS = 7  # 趋势天数


def _date_str(d: datetime) -> str:
    return d.strftime("%Y-%m-%d")


@router.get("/summary")
async def get_dashboard_summary(current_user: dict = Depends(get_current_user)):
    """返回 Dashboard 全部聚合数据"""
    uid = current_user["user_id"]
    today = datetime.now().date()
    today_str = _date_str(today)
    week_ago = today - timedelta(days=_DAYS - 1)
    week_dates = [_date_str(week_ago + timedelta(days=i)) for i in range(_DAYS)]

    try:
        with get_db() as session:
            # ── 统计卡片 ──
            recipe_count = session.query(func.count(Recipe.id)).filter(
                Recipe.user_id == uid
            ).scalar() or 0

            cook_count = session.query(func.count(CookRecord.id)).filter(
                CookRecord.user_id == uid
            ).scalar() or 0

            today_nutrition = session.query(
                func.coalesce(func.sum(NutritionRecord.calories), 0).label("calories"),
                func.coalesce(func.sum(NutritionRecord.protein), 0).label("protein"),
                func.coalesce(func.sum(NutritionRecord.carbs), 0).label("carbs"),
                func.coalesce(func.sum(NutritionRecord.fat), 0).label("fat"),
            ).filter(
                NutritionRecord.user_id == uid,
                NutritionRecord.date == today_str,
            ).one()

            pending_shopping = session.query(func.count(ShoppingList.id)).filter(
                ShoppingList.user_id == uid,
                ShoppingList.status == "pending",
            ).scalar() or 0

            ingredient_count = session.query(func.count(Ingredient.id)).filter(
                Ingredient.user_id == uid
            ).scalar() or 0

            # 即将过期（3天内，含今天）
            soon_str = _date_str(today + timedelta(days=3))
            expiring_ingredients = session.query(func.count(Ingredient.id)).filter(
                Ingredient.user_id == uid,
                Ingredient.expiry_date.isnot(None),
                Ingredient.expiry_date >= today_str,
                Ingredient.expiry_date <= soon_str,
            ).scalar() or 0

            # 已过期
            expired_ingredients = session.query(func.count(Ingredient.id)).filter(
                Ingredient.user_id == uid,
                Ingredient.expiry_date.isnot(None),
                Ingredient.expiry_date < today_str,
            ).scalar() or 0

            meal_plan_count = session.query(func.count(MealPlanDB.id)).filter(
                MealPlanDB.user_id == uid,
                MealPlanDB.status == "active",
            ).scalar() or 0

            avg_rating = session.query(
                func.coalesce(func.avg(CookRecord.rating), 0)
            ).filter(
                CookRecord.user_id == uid,
                CookRecord.rating > 0,
            ).scalar() or 0

            has_preference = session.query(func.count(Preference.user_id)).filter(
                Preference.user_id == uid
            ).scalar() or 0

            # ── 近7天卡路里趋势 ──
            cal_rows = session.query(
                NutritionRecord.date,
                func.coalesce(func.sum(NutritionRecord.calories), 0),
            ).filter(
                NutritionRecord.user_id == uid,
                NutritionRecord.date.in_(week_dates),
            ).group_by(NutritionRecord.date).all()
            cal_map = {r[0]: float(r[1]) for r in cal_rows}
            calories_trend = [
                {"date": d, "calories": round(cal_map.get(d, 0), 1)} for d in week_dates
            ]

            # ── 近7天烹饪次数趋势 ──
            cook_rows = session.query(
                CookRecord.cook_date,
                func.count(CookRecord.id),
            ).filter(
                CookRecord.user_id == uid,
                CookRecord.cook_date.in_(week_dates),
            ).group_by(CookRecord.cook_date).all()
            cook_map = {r[0]: int(r[1]) for r in cook_rows}
            cook_trend = [
                {"date": d, "count": cook_map.get(d, 0)} for d in week_dates
            ]

            # ── 最近菜谱（5条）──
            recent_recipes = session.query(
                Recipe.id, Recipe.title, Recipe.image_url,
                Recipe.difficulty, Recipe.score, Recipe.created_at,
            ).filter(
                Recipe.user_id == uid
            ).order_by(desc(Recipe.created_at)).limit(5).all()

            # ── 最近烹饪记录（5条）──
            recent_cooks = session.query(
                CookRecord.recipe_id, CookRecord.recipe_name,
                CookRecord.cook_date, CookRecord.rating,
            ).filter(
                CookRecord.user_id == uid
            ).order_by(desc(CookRecord.cook_date), desc(CookRecord.created_at)).limit(5).all()

            # ── 最近购物清单（3条）──
            recent_shopping = session.query(
                ShoppingList.id, ShoppingList.status,
                ShoppingList.source_recipe_names, ShoppingList.created_at,
                ShoppingList.items,
            ).filter(
                ShoppingList.user_id == uid
            ).order_by(desc(ShoppingList.created_at)).limit(3).all()

            # ── 食材分类分布 ──
            category_rows = session.query(
                Ingredient.category, func.count(Ingredient.id),
            ).filter(
                Ingredient.user_id == uid
            ).group_by(Ingredient.category).all()

        return {
            "stats": {
                "recipe_count": recipe_count,
                "cook_count": cook_count,
                "today_calories": round(float(today_nutrition.calories), 1),
                "today_protein": round(float(today_nutrition.protein), 1),
                "today_carbs": round(float(today_nutrition.carbs), 1),
                "today_fat": round(float(today_nutrition.fat), 1),
                "pending_shopping": pending_shopping,
                "ingredient_count": ingredient_count,
                "expiring_ingredients": expiring_ingredients,
                "expired_ingredients": expired_ingredients,
                "meal_plan_count": meal_plan_count,
                "avg_rating": round(float(avg_rating), 1),
                "has_preference": has_preference > 0,
            },
            "calories_trend": calories_trend,
            "cook_trend": cook_trend,
            "nutrition_breakdown": {
                "protein": round(float(today_nutrition.protein), 1),
                "carbs": round(float(today_nutrition.carbs), 1),
                "fat": round(float(today_nutrition.fat), 1),
            },
            "recent_recipes": [
                {
                    "id": r.id,
                    "title": r.title,
                    "image_url": r.image_url,
                    "difficulty": r.difficulty,
                    "score": r.score,
                    "created_at": r.created_at,
                }
                for r in recent_recipes
            ],
            "recent_cooks": [
                {
                    "recipe_id": c.recipe_id,
                    "recipe_name": c.recipe_name,
                    "cook_date": c.cook_date,
                    "rating": c.rating,
                }
                for c in recent_cooks
            ],
            "recent_shopping": [
                {
                    "id": s.id,
                    "status": s.status,
                    "source_recipe_names": s.source_recipe_names or [],
                    "item_count": len(s.items) if s.items else 0,
                    "created_at": s.created_at,
                }
                for s in recent_shopping
            ],
            "ingredient_categories": [
                {"category": cat, "count": cnt}
                for cat, cnt in category_rows
            ],
        }
    except Exception as e:
        logger.error(f"Dashboard summary 查询失败: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"统计数据加载失败: {e}")
