"""用户偏好设置 API"""
import time
from fastapi import APIRouter, Depends
from typing import Optional
from pydantic import BaseModel
from app.auth import get_current_user
from app.common.database import get_db
from app.models.db import Preference

router = APIRouter()


class PreferenceData(BaseModel):
    allergies: list[str] = []
    custom_allergies: list[str] = []
    diet_type: str = "normal"
    taste: dict = {}
    family_members: list[dict] = []
    nutrition_targets: Optional[dict] = None  # {daily_calories, protein_target, carbs_target, fat_target, fiber_target, goal_type}


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
    now = int(time.time() * 1000)
    with get_db() as session:
        pref = session.query(Preference).filter(Preference.user_id == uid).first()
        if pref:
            pref.data = data_dict
            pref.updated_at = now
        else:
            session.add(Preference(user_id=uid, data=data_dict, updated_at=now))
    return {"message": "已保存", "data": data_dict}
