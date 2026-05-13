"""食材库存 API"""
import os
import json
import sqlite3
import uuid
import time
from contextlib import contextmanager
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.auth import get_current_user

router = APIRouter()
DB_PATH = os.getenv("INGREDIENT_DB_PATH", "data/ingredients.db")


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    import os as _os
    _os.makedirs(_os.path.dirname(DB_PATH), exist_ok=True)
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ingredients (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT '其他',
                quantity REAL NOT NULL DEFAULT 1,
                unit TEXT NOT NULL DEFAULT '个',
                purchase_date TEXT,
                shelf_life_days INTEGER NOT NULL DEFAULT 7,
                expiry_date TEXT,
                status TEXT NOT NULL DEFAULT 'normal',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ingredients_user ON ingredients(user_id)")
        conn.commit()


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


def row_to_dict(row) -> dict:
    return {
        "id": row["id"], "name": row["name"], "category": row["category"],
        "quantity": row["quantity"], "unit": row["unit"],
        "purchase_date": row["purchase_date"], "shelf_life_days": row["shelf_life_days"],
        "expiry_date": row["expiry_date"], "status": row["status"],
        "created_at": row["created_at"], "updated_at": row["updated_at"],
    }


@router.get("")
def list_ingredients(current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM ingredients WHERE user_id = ? ORDER BY created_at DESC", (uid,)
        ).fetchall()
    return {"ingredients": [row_to_dict(r) for r in rows]}


@router.post("")
def create_ingredient(data: IngredientCreate, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    ing_id = f"ing_{uuid.uuid4().hex[:12]}"
    now = int(time.time())
    with get_db() as conn:
        conn.execute("""
            INSERT INTO ingredients (id, user_id, name, category, quantity, unit, purchase_date, shelf_life_days, expiry_date, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (ing_id, uid, data.name, data.category, data.quantity, data.unit,
              data.purchase_date or "", data.shelf_life_days, data.expiry_date or "", data.status, now, now))
        conn.commit()
        row = conn.execute("SELECT * FROM ingredients WHERE id = ?", (ing_id,)).fetchone()
    return row_to_dict(row)


@router.put("/{ingredient_id}")
def update_ingredient(ingredient_id: str, data: IngredientUpdate, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    now = int(time.time())
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM ingredients WHERE id = ? AND user_id = ?", (ingredient_id, uid)).fetchone()
        if not existing:
            raise HTTPException(404, "食材不存在")
        updates = data.model_dump(exclude_unset=True)
        updates["updated_at"] = now
        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(f"UPDATE ingredients SET {set_clause} WHERE id = ? AND user_id = ?",
                        list(updates.values()) + [ingredient_id, uid])
            conn.commit()
        row = conn.execute("SELECT * FROM ingredients WHERE id = ?", (ingredient_id,)).fetchone()
    return row_to_dict(row)


@router.delete("/{ingredient_id}")
def delete_ingredient(ingredient_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    with get_db() as conn:
        cur = conn.execute("DELETE FROM ingredients WHERE id = ? AND user_id = ?", (ingredient_id, uid))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "食材不存在")
    return {"message": "已删除"}
