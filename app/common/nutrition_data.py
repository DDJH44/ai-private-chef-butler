"""Parse approximate nutrition values from a matching per-100g reference."""

import math
import re


_FOOD_NAME_RE = re.compile(r"食物\s*[：:]\s*([^，,]+)")
_WEIGHT_RE = re.compile(r"(?<![\d.,])(\d+(?:\.\d+)?)\s*(?:g|克)(?![a-z])", re.IGNORECASE)
_NUTRIENT_PATTERNS = {
    "calories": re.compile(r"热量\s*(\d+(?:\.\d+)?)\s*kcal", re.IGNORECASE),
    "protein": re.compile(r"蛋白质\s*(\d+(?:\.\d+)?)\s*g", re.IGNORECASE),
    "carbs": re.compile(r"碳水\s*(\d+(?:\.\d+)?)\s*g", re.IGNORECASE),
    "fat": re.compile(r"脂肪\s*(\d+(?:\.\d+)?)\s*g", re.IGNORECASE),
    "fiber": re.compile(r"纤维\s*(\d+(?:\.\d+)?)\s*g", re.IGNORECASE),
    "sodium": re.compile(r"钠\s*(\d+(?:\.\d+)?)\s*mg", re.IGNORECASE),
}


def extract_weight_grams(value: object) -> float | None:
    if not isinstance(value, str):
        return None
    match = _WEIGHT_RE.search(value)
    if not match:
        return None
    weight = float(match.group(1))
    return weight if 0 < weight <= 10000 else None


def _normalize_food_name(value: str) -> str:
    return re.sub(r"[\s·_-]+", "", value.strip()).casefold()


def scale_matching_nutrition_reference(
    food_name: object,
    document: object,
    weight_grams: float | None,
) -> dict[str, float] | None:
    if (
        not isinstance(food_name, str)
        or not isinstance(document, str)
        or isinstance(weight_grams, bool)
        or not isinstance(weight_grams, (int, float))
        or not math.isfinite(weight_grams)
    ):
        return None
    if not food_name.strip() or not 0 < weight_grams <= 10000:
        return None

    name_match = _FOOD_NAME_RE.search(document)
    if not name_match or _normalize_food_name(food_name) != _normalize_food_name(name_match.group(1)):
        return None

    ratio = weight_grams / 100
    values = {}
    for field, pattern in _NUTRIENT_PATTERNS.items():
        match = pattern.search(document)
        if match:
            values[field] = round(float(match.group(1)) * ratio, 1)
    return values if "calories" in values else None
