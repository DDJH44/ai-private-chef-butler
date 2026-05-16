from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm.attributes import flag_modified
from app.models.schemas import (
    ShoppingListCreate, ShoppingListUpdate,
    ShoppingListResponse, ShoppingListListResponse, ShoppingListOperationResponse,
    ShoppingListItemResponse,
)
from app.auth import get_current_user
from app.common.database import get_db
from app.models.db import ShoppingList
from app.common.logger import logger
from datetime import datetime
import uuid

router = APIRouter(dependencies=[Depends(get_current_user)])


def _ensure_item_ids(items: list) -> list:
    for item in items:
        if not item.get("id"):
            item["id"] = f"item_{uuid.uuid4().hex[:12]}"
    return items


def _list_to_dict(row: ShoppingList) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "source_recipes": row.source_recipes or [],
        "source_recipe_names": row.source_recipe_names or [],
        "items": row.items or [],
        "status": row.status or "pending",
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.post("", response_model=ShoppingListResponse)
async def create_shopping_list(data: ShoppingListCreate, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        list_id = f"sl_{uuid.uuid4().hex[:12]}"
        now = int(datetime.now().timestamp() * 1000)
        items = _ensure_item_ids([item.model_dump() for item in data.items])

        with get_db() as session:
            sl = ShoppingList(
                id=list_id, user_id=uid,
                source_recipes=data.source_recipes,
                source_recipe_names=data.source_recipe_names,
                items=items, status="pending",
                created_at=now, updated_at=now,
            )
            session.add(sl)
            session.flush()
            result = _list_to_dict(sl)

        logger.info(f"购物清单创建成功：{list_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建购物清单失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=ShoppingListListResponse)
async def get_shopping_lists(current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as session:
            rows = session.query(ShoppingList).filter(
                ShoppingList.user_id == uid
            ).order_by(ShoppingList.created_at.desc()).all()
            total = session.query(ShoppingList).filter(ShoppingList.user_id == uid).count()

        logger.info(f"获取购物清单列表成功，总数：{total}")
        return {"shopping_lists": [_list_to_dict(r) for r in rows], "total": total}
    except Exception as e:
        logger.error(f"获取购物清单列表失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{list_id}", response_model=ShoppingListResponse)
async def get_shopping_list(list_id: str, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as session:
            row = session.query(ShoppingList).filter(
                ShoppingList.id == list_id, ShoppingList.user_id == uid
            ).first()
        if not row:
            raise HTTPException(status_code=404, detail="购物清单不存在")
        return _list_to_dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取购物清单失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{list_id}", response_model=ShoppingListResponse)
async def update_shopping_list(list_id: str, updates: ShoppingListUpdate, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as session:
            sl = session.query(ShoppingList).filter(
                ShoppingList.id == list_id, ShoppingList.user_id == uid
            ).first()
            if not sl:
                raise HTTPException(status_code=404, detail="购物清单不存在")

            update_data = updates.model_dump(exclude_unset=True)

            if "items" in update_data:
                sl.items = _ensure_item_ids([item.model_dump() for item in updates.items])
                flag_modified(sl, "items")
                del update_data["items"]
            if "source_recipe_names" in update_data:
                sl.source_recipe_names = update_data["source_recipe_names"]
                flag_modified(sl, "source_recipe_names")
                del update_data["source_recipe_names"]
            if "status" in update_data:
                sl.status = update_data["status"]
                del update_data["status"]

            if not update_data and "items" not in updates.model_dump(exclude_unset=True):
                raise HTTPException(status_code=400, detail="没有要更新的字段")

            sl.updated_at = int(datetime.now().timestamp() * 1000)
            session.flush()
            result = _list_to_dict(sl)

        logger.info(f"购物清单更新成功：{list_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新购物清单失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}", response_model=ShoppingListOperationResponse)
async def delete_shopping_list(list_id: str, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as session:
            count = session.query(ShoppingList).filter(
                ShoppingList.id == list_id, ShoppingList.user_id == uid
            ).delete(synchronize_session=False)
        if count == 0:
            raise HTTPException(status_code=404, detail="购物清单不存在")
        logger.info(f"购物清单删除成功：{list_id}")
        return {"success": True, "message": "删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除购物清单失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{list_id}/items/{item_id}/toggle", response_model=ShoppingListResponse)
async def toggle_shopping_item(list_id: str, item_id: str, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as session:
            sl = session.query(ShoppingList).filter(
                ShoppingList.id == list_id, ShoppingList.user_id == uid
            ).first()
            if not sl:
                raise HTTPException(status_code=404, detail="购物清单不存在")

            items = list(sl.items or [])
            found = False
            all_checked = True
            for item in items:
                if item["id"] == item_id:
                    item["checked"] = not item.get("checked", False)
                    found = True
                if not item.get("checked", False):
                    all_checked = False

            if not found:
                raise HTTPException(status_code=404, detail="项目不存在")

            sl.items = items
            sl.status = "completed" if all_checked else "pending"
            sl.updated_at = int(datetime.now().timestamp() * 1000)
            flag_modified(sl, "items")
            session.flush()
            result = _list_to_dict(sl)

        logger.info(f"购物清单项目切换成功：{list_id}/{item_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"切换项目勾选失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))
