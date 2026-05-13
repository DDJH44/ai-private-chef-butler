"""烹饪历史 API"""
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
DB_PATH = os.getenv("COOK_HISTORY_DB_PATH", "data/cook_history.db")


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
            CREATE TABLE IF NOT EXISTS cook_records (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                recipe_id TEXT NOT NULL DEFAULT '',
                recipe_name TEXT NOT NULL,
                cook_date TEXT NOT NULL,
                rating INTEGER NOT NULL DEFAULT 0,
                notes TEXT NOT NULL DEFAULT '',
                photos TEXT NOT NULL DEFAULT '[]',
                created_at INTEGER NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_cook_user ON cook_records(user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_cook_date ON cook_records(cook_date DESC)")
        conn.commit()


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


def row_to_dict(row) -> dict:
    return {
        "id": row["id"], "recipe_id": row["recipe_id"], "recipe_name": row["recipe_name"],
        "cook_date": row["cook_date"], "rating": row["rating"], "notes": row["notes"],
        "photos": json.loads(row["photos"]), "created_at": row["created_at"],
    }


@router.get("")
def list_records(current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM cook_records WHERE user_id = ? ORDER BY cook_date DESC LIMIT 200", (uid,)
        ).fetchall()
    return {"records": [row_to_dict(r) for r in rows]}


@router.post("")
def create_record(data: CookRecordCreate, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    record_id = f"cook_{uuid.uuid4().hex[:12]}"
    now = int(time.time())
    with get_db() as conn:
        conn.execute("""
            INSERT INTO cook_records (id, user_id, recipe_id, recipe_name, cook_date, rating, notes, photos, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (record_id, uid, data.recipe_id, data.recipe_name, data.cook_date,
              data.rating, data.notes, json.dumps(data.photos, ensure_ascii=False), now))
        conn.commit()
        row = conn.execute("SELECT * FROM cook_records WHERE id = ?", (record_id,)).fetchone()
    return row_to_dict(row)


@router.delete("/{record_id}")
def delete_record(record_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    with get_db() as conn:
        cur = conn.execute("DELETE FROM cook_records WHERE id = ? AND user_id = ?", (record_id, uid))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "记录不存在")
    return {"message": "已删除"}
