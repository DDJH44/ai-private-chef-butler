"""食材库存 API"""
import uuid
import time
import os
import base64
import json
import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from app.auth import get_current_user
from app.common.database import get_db
from app.common.logger import logger
from app.models.db import Ingredient
from app.agents.personal_chief import vision_model
from langchain_core.messages import HumanMessage

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
    return {"items": [_ingredient_to_dict(r) for r in rows], "total": len(rows)}


@router.post("")
def create_ingredient(data: IngredientCreate, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    ing_id = f"ing_{uuid.uuid4().hex[:12]}"
    now = int(time.time() * 1000)
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
    now = int(time.time() * 1000)
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


class BatchCreateRequest(BaseModel):
    items: List[IngredientCreate]


@router.post("/batch")
def batch_create_ingredients(data: BatchCreateRequest, current_user: dict = Depends(get_current_user)):
    """批量添加食材"""
    uid = current_user["user_id"]
    now = int(time.time() * 1000)
    results = []
    with get_db() as session:
        for item in data.items:
            ing_id = f"ing_{uuid.uuid4().hex[:12]}"
            ing = Ingredient(
                id=ing_id, user_id=uid, name=item.name, category=item.category,
                quantity=item.quantity, unit=item.unit,
                purchase_date=item.purchase_date or "",
                shelf_life_days=item.shelf_life_days,
                expiry_date=item.expiry_date or "",
                status=item.status, created_at=now, updated_at=now,
            )
            session.add(ing)
            results.append(_ingredient_to_dict(ing))
        session.flush()
    return {"items": results, "total": len(results)}


@router.post("/identify-from-photo")
async def identify_ingredients_from_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """拍照识别生食材，返回结构化食材列表供用户确认后添加到冰箱"""
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(413, "图片不能超过 10MB")

    b64 = base64.b64encode(contents).decode()
    mime = file.content_type or "image/jpeg"
    data_url = f"data:{mime};base64,{b64}"

    prompt = """你是食材识别专家。请识别这张照片中的所有生食材（未加工的蔬菜、肉类、蛋奶、干货等），不要识别熟食或成品菜。

对每种食材，返回：name(中文名)、category(蔬菜/肉类/蛋奶/调味料/干货/水果/其他)、quantity(建议数量)、unit(个/把/斤/盒/袋/瓶等)、shelf_life_days(建议保质期天数)。

只返回纯 JSON 数组，不要任何解释：
[{"name": "西红柿", "category": "蔬菜", "quantity": 3, "unit": "个", "shelf_life_days": 7}, ...]

如果图片中没有生食材（全是熟食或其他物品），返回空数组 []。"""

    try:
        msg = HumanMessage(content=[
            {"type": "image_url", "image_url": {"url": data_url}},
            {"type": "text", "text": prompt},
        ])
        resp = await vision_model.ainvoke([msg])
        content = resp.content
        if isinstance(content, list):
            content = "".join(str(c) for c in content)

        # 提取 JSON 数组
        json_match = re.search(r'\[[\s\S]*\]', str(content))
        if not json_match:
            return {"items": [], "raw": str(content)[:200]}

        items = json.loads(json_match.group())
        # 规范化字段
        for item in items:
            item.setdefault("category", "其他")
            item.setdefault("quantity", 1)
            item.setdefault("unit", "个")
            item.setdefault("shelf_life_days", 7)

        logger.info(f"[identify-from-photo] 识别到 {len(items)} 种食材")
        return {"items": items}
    except Exception as e:
        logger.error(f"[identify-from-photo] 失败: {e}")
        raise HTTPException(500, f"识别失败: {str(e)}")
