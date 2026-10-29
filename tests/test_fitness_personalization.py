import pytest
from pydantic import ValidationError

from app.api.v1.dashboard import _get_nutrition_targets
from app.api.v1.meal_plan import _build_training_day_rule
from app.api.v1.preferences import PreferenceData
from app.common.preference_context import (
    DIET_TYPE_LABELS,
    build_fitness_knowledge_query,
    build_training_schedule_context,
    get_training_days,
)


def test_training_day_rule_uses_sunday_zero_weekday_index():
    preference = {"training_days": [0, 3]}

    assert "训练日" in _build_training_day_rule(preference, "2026-09-27")
    assert "训练日" in _build_training_day_rule(preference, "2026-09-30")
    assert "休息日" in _build_training_day_rule(preference, "2026-09-28")


def test_training_day_rule_is_omitted_when_schedule_is_not_configured():
    assert _build_training_day_rule({}, "2026-09-27") == ""
    assert _build_training_day_rule({"training_days": [True, 9]}, "2026-09-27") == ""


def test_preference_rejects_invalid_or_duplicate_training_days():
    with pytest.raises(ValidationError):
        PreferenceData(training_days=[7])
    with pytest.raises(ValidationError):
        PreferenceData(training_days=[1, 1])
    with pytest.raises(ValidationError):
        PreferenceData(training_days=[True])


def test_dashboard_targets_filter_invalid_and_unset_values():
    assert _get_nutrition_targets({"nutrition_targets": {
        "daily_calories": 2200,
        "protein_target": 0,
        "fat_target": float("nan"),
        "unknown": 123,
    }}) == {"daily_calories": 2200}
    assert _get_nutrition_targets({"nutrition_targets": {"protein_target": 0}}) is None
    assert _get_nutrition_targets(None) is None


def test_training_schedule_context_is_shared_and_sunday_first():
    preference = {"training_days": [3, 0, True, 9, 3]}

    assert get_training_days(preference) == [0, 3]
    assert build_training_schedule_context(preference) == (
        "每周通常训练日：周日、周三；当天安排以用户实际说明为准"
    )
    assert build_training_schedule_context({"training_days": []}) == ""


def test_every_accepted_diet_type_has_a_chat_label():
    from app.api.v1.preferences import VALID_DIET_TYPES

    assert VALID_DIET_TYPES == frozenset(DIET_TYPE_LABELS)


@pytest.mark.parametrize(
    ("preference", "expected_focus"),
    [
        ({"nutrition_targets": {"goal_type": "muscle_gain"}}, "增肌"),
        ({"nutrition_targets": {"goal_type": "fat_loss"}}, "减脂"),
        ({"diet_type": "fitness"}, "运动营养"),
        ({"diet_type": "low_calorie"}, "减脂"),
    ],
)
def test_fitness_knowledge_query_follows_goal_or_diet(preference, expected_focus):
    assert expected_focus in build_fitness_knowledge_query(preference)


def test_general_preferences_do_not_force_fitness_retrieval():
    assert build_fitness_knowledge_query({"diet_type": "normal"}) is None
