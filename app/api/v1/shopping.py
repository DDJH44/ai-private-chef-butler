from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import (
    ShoppingListCreate, ShoppingListUpdate,
    ShoppingListResponse, ShoppingListListResponse, ShoppingListOperationResponse,
    ShoppingListItemResponse,
)
import sqlite3
import json
from datetime import datetime
import uuid
from app.common.logger import logger
from typing import Optional
from contextlib import contextmanager

router = APIRouter()

DB_PATH = "app/db/shopping.db"


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row) -> dict:
    data = dict(row)
    for field in ("source_recipes", "source_recipe_names", "items"):
        if field in data and data[field] is not None:
            try:
                data[field] = json.loads(data[field])
            except (json.JSONDecodeError, TypeError):
                data[field] = [] if field != "source_recipes" else []
    if "source_recipes" in data and not isinstance(data["source_recipes"], list):
        data["source_recipes"] = []
    if "source_recipe_names" in data and not isinstance(data["source_recipe_names"], list):
        data["source_recipe_names"] = []
    if "items" in data and not isinstance(data["items"], list):
        data["items"] = []
    return data


def init_db():
    try:
        with get_db() as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS shopping_lists (
                    id TEXT PRIMARY KEY,
                    source_recipes TEXT DEFAULT '[]',
                    source_recipe_names TEXT DEFAULT '[]',
                    items TEXT DEFAULT '[]',
                    status TEXT DEFAULT 'pending',
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            ''')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_shopping_created_at ON shopping_lists(created_at DESC)')
            conn.commit()
        logger.info("购物清单数据库初始化成功")
    except Exception as e:
        logger.error(f"购物清单数据库初始化失败：{e}")
        raise


init_db()


def _ensure_item_ids(items: list) -> list:
    for item in items:
        if not item.get("id"):
            item["id"] = f"item_{uuid.uuid4().hex[:12]}"
    return items


@router.post("", response_model=ShoppingListResponse)
async def create_shopping_list(data: ShoppingListCreate):
    try:
        list_id = f"sl_{uuid.uuid4().hex[:12]}"
        now = int(datetime.now().timestamp() * 1000)
        items = _ensure_item_ids([item.model_dump() for item in data.items])

        with get_db() as conn:
            conn.execute('''
                INSERT INTO shopping_lists (id, source_recipes, source_recipe_names, items, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'pending', ?, ?)
            ''', (
                list_id,
                json.dumps(data.source_recipes),
                json.dumps(data.source_recipe_names),
                json.dumps(items),
                now, now,
            ))
            conn.commit()
            row = conn.execute('SELECT * FROM shopping_lists WHERE id = ?', (list_id,)).fetchone()

        if not row:
            raise HTTPException(status_code=500, detail="创建购物清单失败")

        logger.info(f"购物清单创建成功：{list_id}")
        return row_to_dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建购物清单失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=ShoppingListListResponse)
async def get_shopping_lists():
    try:
        with get_db() as conn:
            rows = conn.execute('SELECT * FROM shopping_lists ORDER BY created_at DESC').fetchall()
            total = conn.execute('SELECT COUNT(*) FROM shopping_lists').fetchone()[0]

        logger.info(f"获取购物清单列表成功，总数：{total}")
        return {"shopping_lists": [row_to_dict(row) for row in rows], "total": total}
    except Exception as e:
        logger.error(f"获取购物清单列表失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{list_id}", response_model=ShoppingListResponse)
async def get_shopping_list(list_id: str):
    try:
        with get_db() as conn:
            row = conn.execute('SELECT * FROM shopping_lists WHERE id = ?', (list_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="购物清单不存在")
        return row_to_dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取购物清单失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{list_id}", response_model=ShoppingListResponse)
async def update_shopping_list(list_id: str, updates: ShoppingListUpdate):
    try:
        with get_db() as conn:
            existing = conn.execute('SELECT * FROM shopping_lists WHERE id = ?', (list_id,)).fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="购物清单不存在")

            update_fields = []
            values = []
            update_data = updates.model_dump(exclude_unset=True)

            if "items" in update_data:
                update_fields.append("items = ?")
                values.append(json.dumps(_ensure_item_ids([item.model_dump() for item in update_data["items"]])))
                del update_data["items"]
            if "source_recipe_names" in update_data:
                update_fields.append("source_recipe_names = ?")
                values.append(json.dumps(update_data["source_recipe_names"]))
                del update_data["source_recipe_names"]
            if "status" in update_data:
                update_fields.append("status = ?")
                values.append(update_data["status"])
                del update_data["status"]

            if not update_fields:
                raise HTTPException(status_code=400, detail="没有要更新的字段")

            now = int(datetime.now().timestamp() * 1000)
            update_fields.append("updated_at = ?")
            values.append(now)
            values.append(list_id)

            query = f"UPDATE shopping_lists SET {', '.join(update_fields)} WHERE id = ?"
            conn.execute(query, values)
            conn.commit()
            row = conn.execute('SELECT * FROM shopping_lists WHERE id = ?', (list_id,)).fetchone()

        if not row:
            raise HTTPException(status_code=500, detail="更新购物清单失败")

        logger.info(f"购物清单更新成功：{list_id}")
        return row_to_dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新购物清单失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{list_id}", response_model=ShoppingListOperationResponse)
async def delete_shopping_list(list_id: str):
    try:
        with get_db() as conn:
            conn.execute('DELETE FROM shopping_lists WHERE id = ?', (list_id,))
            affected = conn.total_changes
            conn.commit()
        if affected == 0:
            raise HTTPException(status_code=404, detail="购物清单不存在")
        logger.info(f"购物清单删除成功：{list_id}")
        return {"success": True, "message": "删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除购物清单失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{list_id}/items/{item_id}/toggle", response_model=ShoppingListResponse)
async def toggle_shopping_item(list_id: str, item_id: str):
    try:
        with get_db() as conn:
            row = conn.execute('SELECT * FROM shopping_lists WHERE id = ?', (list_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="购物清单不存在")

            data = row_to_dict(row)
            items = data["items"]
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

            status = "completed" if all_checked else "pending"
            now = int(datetime.now().timestamp() * 1000)

            conn.execute(
                'UPDATE shopping_lists SET items = ?, status = ?, updated_at = ? WHERE id = ?',
                (json.dumps(items), status, now, list_id),
            )
            conn.commit()
            row = conn.execute('SELECT * FROM shopping_lists WHERE id = ?', (list_id,)).fetchone()

        logger.info(f"购物清单项目切换成功：{list_id}/{item_id}")
        return row_to_dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"切换项目勾选失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))
