"""Shared preference normalization for chat, planning, and nutrition flows."""

from collections.abc import Mapping


DIET_TYPE_LABELS = {
    "normal": "普通饮食",
    "vegetarian": "蛋奶素",
    "vegan": "纯素食",
    "keto": "生酮饮食",
    "low_carb": "低碳水饮食",
    "high_protein": "高蛋白饮食",
    "mediterranean": "地中海饮食",
    "pescatarian": "鱼素饮食",
    "gluten_free": "无麸质饮食",
    "dairy_free": "无乳制品饮食",
    "fitness": "高蛋白健身饮食",
    "low_calorie": "低卡饮食",
}

GOAL_TYPE_LABELS = {
    "muscle_gain": "增肌",
    "fat_loss": "减脂",
    "maintain": "维持体重",
    "custom": "自定义营养目标",
}

WEEKDAY_LABELS_SUNDAY_FIRST = ("周日", "周一", "周二", "周三", "周四", "周五", "周六")


def get_training_days(preference: object) -> list[int]:
    if not isinstance(preference, Mapping):
        return []
    raw_days = preference.get("training_days")
    if not isinstance(raw_days, list):
        return []
    return sorted({
        day for day in raw_days
        if isinstance(day, int) and not isinstance(day, bool) and 0 <= day <= 6
    })


def build_training_schedule_context(preference: object) -> str:
    days = get_training_days(preference)
    if not days:
        return ""
    labels = "、".join(WEEKDAY_LABELS_SUNDAY_FIRST[day] for day in days)
    return f"每周通常训练日：{labels}；当天安排以用户实际说明为准"


def build_fitness_knowledge_query(preference: object) -> str | None:
    if not isinstance(preference, Mapping):
        return None

    targets = preference.get("nutrition_targets")
    goal_type = targets.get("goal_type") if isinstance(targets, Mapping) else None
    diet_type = preference.get("diet_type")

    if goal_type == "muscle_gain":
        focus = "增肌"
    elif goal_type == "fat_loss":
        focus = "减脂"
    elif diet_type == "low_calorie":
        focus = "减脂"
    elif diet_type in ("fitness", "high_protein"):
        focus = "运动营养"
    else:
        return None

    return f"{focus} 每日营养标准 蛋白质 碳水 推荐摄入"
