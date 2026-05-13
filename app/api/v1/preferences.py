"""用户偏好设置 API"""
import os
import json
import sqlite3
from contextlib import contextmanager
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user

router = APIRouter()
DB_PATH = os.getenv("PREFERENCE_DB_PATH", "data/preferences.db")


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
            CREATE TABLE IF NOT EXISTS preferences (
                user_id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        conn.commit()


class PreferenceData(BaseModel):
    allergies: list[str] = []
    custom_allergies: list[str] = []
    diet_type: str = "normal"
    taste: dict = {}
    family_members: list[dict] = []


@router.get("")
def get_preferences(current_user: dict = Depends(get_current_user)):
    uid = current_user["user_id"]
    with get_db() as conn:
        row = conn.execute("SELECT data FROM preferences WHERE user_id = ?", (uid,)).fetchone()
    if not row:
        return {"preference": None}
    return {"preference": json.loads(row["data"])}


@router.put("")
def save_preferences(data: PreferenceData, current_user: dict = Depends(get_current_user)):
    import time
    uid = current_user["user_id"]
    data_dict = data.model_dump()
    now = int(time.time())
    with get_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO preferences (user_id, data, updated_at) VALUES (?, ?, ?)",
            (uid, json.dumps(data_dict, ensure_ascii=False), now)
        )
        conn.commit()
    return {"message": "已保存", "preference": data_dict}
