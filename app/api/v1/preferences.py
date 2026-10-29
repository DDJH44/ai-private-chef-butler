"""用户偏好设置 API"""
import time
from fastapi import APIRouter, Depends
from typing import Literal, Optional
from pydantic import BaseModel, Field, StrictInt, field_validator
from app.auth import get_current_user
from app.common.database import get_db
from app.common.preference_context import DIET_TYPE_LABELS
from app.models.db import Preference

router = APIRouter()

VALID_DIET_TYPES = frozenset(DIET_TYPE_LABELS)


class NutritionTargetsInput(BaseModel):
    daily_calories: Optional[int] = Field(None, ge=0, le=10000)
    protein_target: Optional[int] = Field(None, ge=0, le=500)
    carbs_target: Optional[int] = Field(None, ge=0, le=1000)
    fat_target: Optional[int] = Field(None, ge=0, le=500)
    fiber_target: Optional[int] = Field(None, ge=0, le=200)
    goal_type: Optional[Literal["muscle_gain", "fat_loss", "maintain", "custom"]] = "maintain"

class PreferenceData(BaseModel):
    allergies: list[str] = Field(default_factory=list)
    custom_allergies: list[str] = Field(default_factory=list)
    diet_type: str = "normal"
    taste: dict = Field(default_factory=dict)
    family_members: list[dict] = Field(default_factory=list)
    nutrition_targets: Optional[NutritionTargetsInput] = None
    training_days: list[StrictInt] = Field(default_factory=list)

    @field_validator("training_days")
    @classmethod
    def validate_training_days(cls, days: list[int]) -> list[int]:
        if any(day < 0 or day > 6 for day in days):
            raise ValueError("training_days must contain weekdays from 0 to 6")
        if len(days) != len(set(days)):
            raise ValueError("training_days must not contain duplicates")
        return days


@router.get("")
def get_preferences(current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    with get_db() as session:
        pref = session.query(Preference).filter(Preference.user_id == uid).first()
    if not pref:
        return {"data": None}
    return {"data": pref.data}


@router.put("")
def save_preferences(data: PreferenceData, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    data_dict = data.model_dump()
    # Validate diet_type (Pydantic model_validator behaves inconsistently with FastAPI)
    if data_dict.get("diet_type", "normal") not in VALID_DIET_TYPES:
        data_dict["diet_type"] = "normal"
    now = int(time.time() * 1000)
    with get_db() as session:
        pref = session.query(Preference).filter(Preference.user_id == uid).first()
        if pref:
            pref.data = data_dict
            pref.updated_at = now
        else:
            session.add(Preference(user_id=uid, data=data_dict, updated_at=now))
    return {"message": "已保存", "data": data_dict}
