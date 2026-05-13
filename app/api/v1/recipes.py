import os
from fastapi import APIRouter, HTTPException, Query, Body, Depends
from app.models.schemas import RecipeCreate, RecipeUpdate, RecipeResponse, RecipeListResponse, RecipeOperationResponse
from app.auth import get_current_user
import sqlite3
import json
from datetime import datetime
from typing import List
import uuid
from app.common.logger import logger
from typing import Optional
from contextlib import contextmanager

router = APIRouter(dependencies=[Depends(get_current_user)])

DB_PATH = os.getenv("RECIPES_DB_PATH", "data/recipes.db")


@contextmanager
def get_db():
    """数据库连接上下文管理器"""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
    finally:
        conn.close()

_JSON_FIELDS = {"ingredients", "seasonings", "tags"}
_BOOL_FIELDS = {"is_expanded"}


def row_to_dict(row: sqlite3.Row) -> dict:
    """SQLite Row → dict，自动反序列化 JSON 字段和布尔值"""
    data = dict(row)
    for field in _JSON_FIELDS:
        if field in data and data[field] is not None:
            try:
                data[field] = json.loads(data[field])
            except (json.JSONDecodeError, TypeError):
                data[field] = []
    for field in _BOOL_FIELDS:
        if field in data:
            data[field] = bool(data[field])
    return data


def _serialize(data: dict) -> dict:
    """将列表字段序列化为 JSON 字符串"""
    for field in _JSON_FIELDS:
        if field in data and isinstance(data[field], list):
            data[field] = json.dumps(data[field])
    return data


def init_db():
    """初始化数据库表"""
    try:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        with get_db() as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS recipes (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL DEFAULT '',
                    thread_id TEXT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    image_url TEXT,
                    difficulty TEXT,
                    cooking_time TEXT,
                    ingredients TEXT,
                    seasonings TEXT,
                    score REAL,
                    reason TEXT,
                    source_url TEXT,
                    video_url TEXT,
                    tags TEXT DEFAULT '[]',
                    is_expanded INTEGER DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            ''')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_title ON recipes(title)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_created_at ON recipes(created_at DESC)')
            # Migration: add tags column if missing
            try:
                conn.execute('SELECT tags FROM recipes LIMIT 1')
            except sqlite3.OperationalError:
                conn.execute('ALTER TABLE recipes ADD COLUMN tags TEXT DEFAULT \'[]\'')
            # Migration: add video_url column if missing
            try:
                conn.execute('SELECT video_url FROM recipes LIMIT 1')
            except sqlite3.OperationalError:
                conn.execute('ALTER TABLE recipes ADD COLUMN video_url TEXT')
            # Migration: add user_id column if missing
            try:
                conn.execute('SELECT user_id FROM recipes LIMIT 1')
            except sqlite3.OperationalError:
                conn.execute('ALTER TABLE recipes ADD COLUMN user_id TEXT NOT NULL DEFAULT \'\'')
            conn.commit()
        logger.info("菜谱数据库初始化成功（全局存储模式）")
    except Exception as e:
        logger.error(f"菜谱数据库初始化失败：{e}")
        raise


# 初始化数据库
init_db()


@router.post("", response_model=RecipeResponse)
async def create_recipe(recipe: RecipeCreate, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        recipe_id = f"recipe_{uuid.uuid4().hex[:12]}"
        now = int(datetime.now().timestamp() * 1000)

        with get_db() as conn:
            conn.execute('''
                INSERT INTO recipes (
                    id, user_id, thread_id, title, content, image_url,
                    difficulty, cooking_time, ingredients,
                    seasonings, tags, score, reason, source_url, video_url,
                    is_expanded, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                recipe_id, uid, None,
                recipe.title, recipe.content, recipe.image_url,
                recipe.difficulty, recipe.cooking_time,
                json.dumps(recipe.ingredients or []),
                json.dumps(recipe.seasonings or []),
                json.dumps(recipe.tags or []),
                recipe.score, recipe.reason, recipe.source_url, recipe.video_url,
                0, now, now
            ))
            conn.commit()
            row = conn.execute('SELECT * FROM recipes WHERE id = ? AND user_id = ?', (recipe_id, uid)).fetchone()

        if not row:
            raise HTTPException(status_code=500, detail="创建菜谱失败")

        logger.info(f"菜谱创建成功：{recipe_id}, 标题：{row['title']}, 用户：{uid}")
        return row_to_dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=RecipeListResponse)
async def get_recipes(
    limit: Optional[int] = Query(None),
    offset: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    try:
        uid = current_user["user_id"]
        with get_db() as conn:
            cols = 'id, title, image_url, difficulty, cooking_time, ingredients, seasonings, tags, score, reason, source_url, video_url, is_expanded, created_at, updated_at'
            query = f'SELECT {cols} FROM recipes WHERE user_id = ? ORDER BY created_at DESC'
            params: list = [uid]
            if limit:
                query += ' LIMIT ?'
                params.append(limit)
            if offset:
                query += ' OFFSET ?'
                params.append(offset)
            rows = conn.execute(query, params).fetchall()
            total = conn.execute('SELECT COUNT(*) FROM recipes WHERE user_id = ?', (uid,)).fetchone()[0]

        logger.info(f"获取菜谱列表成功，总数：{total}")
        return {"recipes": [row_to_dict(row) for row in rows], "total": total}
    except Exception as e:
        logger.error(f"获取菜谱列表失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-create", response_model=RecipeListResponse)
async def batch_create_recipes(recipes_data: List[RecipeCreate] = Body(...), current_user: dict = Depends(get_current_user)):
    """批量创建菜谱"""
    try:
        uid = current_user["user_id"]
        logger.info(f"[batch-create] 收到 {len(recipes_data)} 条菜谱: {[{ 'title': r.title, 'has_content': bool(r.content), 'difficulty': r.difficulty } for r in recipes_data]}")
        results = []
        now = int(datetime.now().timestamp() * 1000)
        with get_db() as conn:
            for recipe in recipes_data:
                recipe_id = f"recipe_{uuid.uuid4().hex[:12]}"
                conn.execute('''
                    INSERT INTO recipes (
                        id, user_id, thread_id, title, content, image_url,
                        difficulty, cooking_time, ingredients,
                        seasonings, tags, score, reason, source_url, video_url,
                        is_expanded, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    recipe_id, uid, None,
                    recipe.title, recipe.content, recipe.image_url,
                    recipe.difficulty, recipe.cooking_time,
                    json.dumps(recipe.ingredients or []),
                    json.dumps(recipe.seasonings or []),
                    json.dumps(recipe.tags or []),
                    recipe.score, recipe.reason, recipe.source_url, recipe.video_url,
                    0, now, now,
                ))
                row = conn.execute('SELECT * FROM recipes WHERE id = ? AND user_id = ?', (recipe_id, uid)).fetchone()
                if row:
                    results.append(row_to_dict(row))
            conn.commit()
        logger.info(f"批量创建菜谱成功，数量：{len(results)}")
        return {"recipes": results, "total": len(results)}
    except Exception as e:
        logger.error(f"批量创建菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-delete", response_model=RecipeOperationResponse)
async def batch_delete_recipes(ids: List[str] = Body(...), current_user: dict = Depends(get_current_user)):
    """批量删除菜谱"""
    try:
        uid = current_user["user_id"]
        with get_db() as conn:
            placeholders = ','.join(['?'] * len(ids))
            conn.execute(f'DELETE FROM recipes WHERE id IN ({placeholders}) AND user_id = ?', [*ids, uid])
            affected = conn.total_changes
            conn.commit()
        logger.info(f"批量删除菜谱成功，删除数量：{affected}")
        return {'success': True, 'message': f'已删除 {affected} 道菜谱'}
    except Exception as e:
        logger.error(f"批量删除菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search", response_model=RecipeListResponse)
async def search_recipes(q: str = Query(..., description="搜索关键词"), current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as conn:
            search_pattern = f"%{q}%"
            rows = conn.execute('''
                SELECT * FROM recipes
                WHERE (title LIKE ? OR content LIKE ?) AND user_id = ?
                ORDER BY created_at DESC
            ''', [search_pattern, search_pattern, uid]).fetchall()
        recipes = [row_to_dict(row) for row in rows]
        return {'recipes': recipes, 'total': len(recipes)}
    except Exception as e:
        logger.error(f"搜索菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(recipe_id: str, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as conn:
            row = conn.execute('SELECT * FROM recipes WHERE id = ? AND user_id = ?', (recipe_id, uid)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="菜谱不存在")
        return row_to_dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(recipe_id: str, updates: RecipeUpdate, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as conn:
            existing = conn.execute('SELECT * FROM recipes WHERE id = ? AND user_id = ?', (recipe_id, uid)).fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="菜谱不存在")

            update_fields = []
            values = []
            update_data = updates.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if field in _BOOL_FIELDS:
                    value = 1 if value else 0
                elif field in _JSON_FIELDS and value is not None:
                    value = json.dumps(value)
                update_fields.append(f"{field} = ?")
                values.append(value)

            now = int(datetime.now().timestamp() * 1000)
            update_fields.append("updated_at = ?")
            values.append(now)
            values.append(recipe_id)

            values.append(uid)
            query = f"UPDATE recipes SET {', '.join(update_fields)} WHERE id = ? AND user_id = ?"
            conn.execute(query, values)
            conn.commit()
            row = conn.execute('SELECT * FROM recipes WHERE id = ? AND user_id = ?', (recipe_id, uid)).fetchone()

        if not row:
            raise HTTPException(status_code=500, detail="更新菜谱失败")

        logger.info(f"菜谱更新成功：{recipe_id}")
        return row_to_dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{recipe_id}", response_model=RecipeOperationResponse)
async def delete_recipe(recipe_id: str, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as conn:
            conn.execute('DELETE FROM recipes WHERE id = ? AND user_id = ?', (recipe_id, uid))
            affected = conn.total_changes
            conn.commit()
        if affected == 0:
            raise HTTPException(status_code=404, detail="菜谱不存在")
        logger.info(f"菜谱删除成功：{recipe_id}")
        return {'success': True, 'message': '删除成功'}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))

