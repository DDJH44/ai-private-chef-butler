"""烹饪历史 API"""
import uuid
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.auth import get_current_user
from app.common.database import get_db
from app.models.db import CookRecord

router = APIRouter()


class CookRecordCreate(BaseModel):
    recipe_id: str = ""
    recipe_name: str
    cook_date: str
    rating: int = 0
    notes: str = ""
    photos: list[str] = []


class CookRecordUpdate(BaseModel):
    recipe_name: Optional[str] = None
    cook_date: Optional[str] = None
    rating: Optional[int] = None
    notes: Optional[str] = None
    photos: Optional[list[str]] = None


def _record_to_dict(r: CookRecord) -> dict:
    return {
        "id": r.id, "recipe_id": r.recipe_id, "recipe_name": r.recipe_name,
        "cook_date": r.cook_date, "rating": r.rating, "notes": r.notes,
        "photos": r.photos, "created_at": r.created_at,
    }


@router.get("")
def list_records(current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    with get_db() as session:
        rows = session.query(CookRecord).filter(
            CookRecord.user_id == uid
        ).order_by(CookRecord.cook_date.desc()).limit(200).all()
    return {"records": [_record_to_dict(r) for r in rows]}


@router.post("")
def create_record(data: CookRecordCreate, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    record_id = f"cook_{uuid.uuid4().hex[:12]}"
    now = int(time.time())
    with get_db() as session:
        record = CookRecord(
            id=record_id, user_id=uid, recipe_id=data.recipe_id,
            recipe_name=data.recipe_name, cook_date=data.cook_date,
            rating=data.rating, notes=data.notes, photos=data.photos,
            created_at=now,
        )
        session.add(record)
        session.flush()
        result = _record_to_dict(record)
    return result


@router.delete("/{record_id}")
def delete_record(record_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    with get_db() as session:
        count = session.query(CookRecord).filter(
            CookRecord.id == record_id, CookRecord.user_id == uid
        ).delete(synchronize_session=False)
        if count == 0:
            raise HTTPException(404, "记录不存在")
    return {"message": "已删除"}
