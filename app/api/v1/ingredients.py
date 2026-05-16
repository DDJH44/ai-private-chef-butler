"""食材库存 API"""
import uuid
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.auth import get_current_user
from app.common.database import get_db
from app.models.db import Ingredient

router = APIRouter()


class IngredientCreate(BaseModel):
    name: str
    category: str = "其他"
    quantity: float = 1
    unit: str = "个"
    purchase_date: Optional[str] = None
    shelf_life_days: int = 7
    expiry_date: Optional[str] = None
    status: str = "normal"


class IngredientUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    purchase_date: Optional[str] = None
    shelf_life_days: Optional[int] = None
    expiry_date: Optional[str] = None
    status: Optional[str] = None


def _ingredient_to_dict(r: Ingredient) -> dict:
    return {
        "id": r.id, "name": r.name, "category": r.category,
        "quantity": r.quantity, "unit": r.unit,
        "purchase_date": r.purchase_date, "shelf_life_days": r.shelf_life_days,
        "expiry_date": r.expiry_date, "status": r.status,
        "created_at": r.created_at, "updated_at": r.updated_at,
        "user_id": r.user_id,
    }


@router.get("")
def list_ingredients(current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    with get_db() as session:
        rows = session.query(Ingredient).filter(
            Ingredient.user_id == uid
        ).order_by(Ingredient.created_at.desc()).all()
    return {"ingredients": [_ingredient_to_dict(r) for r in rows]}


@router.post("")
def create_ingredient(data: IngredientCreate, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    ing_id = f"ing_{uuid.uuid4().hex[:12]}"
    now = int(time.time())
    with get_db() as session:
        ing = Ingredient(
            id=ing_id, user_id=uid, name=data.name, category=data.category,
            quantity=data.quantity, unit=data.unit,
            purchase_date=data.purchase_date or "",
            shelf_life_days=data.shelf_life_days,
            expiry_date=data.expiry_date or "",
            status=data.status, created_at=now, updated_at=now,
        )
        session.add(ing)
        session.flush()
        result = _ingredient_to_dict(ing)
    return result


@router.put("/{ingredient_id}")
def update_ingredient(ingredient_id: str, data: IngredientUpdate, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    now = int(time.time())
    with get_db() as session:
        ing = session.query(Ingredient).filter(
            Ingredient.id == ingredient_id, Ingredient.user_id == uid
        ).first()
        if not ing:
            raise HTTPException(404, "食材不存在")
        updates = data.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(ing, key, value)
        ing.updated_at = now
        session.flush()
        result = _ingredient_to_dict(ing)
    return result


@router.delete("/{ingredient_id}")
def delete_ingredient(ingredient_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    with get_db() as session:
        count = session.query(Ingredient).filter(
            Ingredient.id == ingredient_id, Ingredient.user_id == uid
        ).delete(synchronize_session=False)
        if count == 0:
            raise HTTPException(404, "食材不存在")
    return {"message": "已删除"}
