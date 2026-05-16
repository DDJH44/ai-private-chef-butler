import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Body, Depends
from sqlalchemy.orm.attributes import flag_modified
from app.models.schemas import RecipeCreate, RecipeUpdate, RecipeResponse, RecipeListResponse, RecipeOperationResponse
from app.auth import get_current_user
from app.common.database import get_db
from app.models.db import Recipe
from app.common.logger import logger

router = APIRouter(dependencies=[Depends(get_current_user)])

_JSON_FIELDS = {"ingredients", "seasonings", "tags"}


def _recipe_to_dict(r: Recipe) -> dict:
    return {
        "id": r.id, "user_id": r.user_id, "thread_id": r.thread_id,
        "title": r.title, "content": r.content, "image_url": r.image_url,
        "difficulty": r.difficulty, "cooking_time": r.cooking_time,
        "ingredients": r.ingredients or [],
        "seasonings": r.seasonings or [],
        "tags": r.tags or [],
        "score": r.score, "reason": r.reason,
        "source_url": r.source_url, "video_url": r.video_url,
        "is_expanded": bool(r.is_expanded),
        "created_at": r.created_at, "updated_at": r.updated_at,
    }


@router.post("", response_model=RecipeResponse)
async def create_recipe(recipe: RecipeCreate, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        recipe_id = f"recipe_{uuid.uuid4().hex[:12]}"
        now = int(datetime.now().timestamp() * 1000)

        with get_db() as session:
            r = Recipe(
                id=recipe_id, user_id=uid, title=recipe.title, content=recipe.content,
                image_url=recipe.image_url, difficulty=recipe.difficulty,
                cooking_time=recipe.cooking_time,
                ingredients=recipe.ingredients or [],
                seasonings=recipe.seasonings or [],
                tags=recipe.tags or [],
                score=recipe.score, reason=recipe.reason,
                source_url=recipe.source_url, video_url=recipe.video_url,
                is_expanded=False, created_at=now, updated_at=now,
            )
            session.add(r)
            session.flush()
            result = _recipe_to_dict(r)

        logger.info(f"菜谱创建成功：{recipe_id}, 标题：{r.title}, 用户：{uid}")
        return result
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
        with get_db() as session:
            query = session.query(Recipe).filter(Recipe.user_id == uid).order_by(Recipe.created_at.desc())
            total = query.count()
            if offset:
                query = query.offset(offset)
            if limit:
                query = query.limit(limit)
            rows = query.all()

        logger.info(f"获取菜谱列表成功，总数：{total}")
        return {"recipes": [_recipe_to_dict(r) for r in rows], "total": total}
    except Exception as e:
        logger.error(f"获取菜谱列表失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-create", response_model=RecipeListResponse)
async def batch_create_recipes(recipes_data: List[RecipeCreate] = Body(...), current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        logger.info(f"[batch-create] 收到 {len(recipes_data)} 条菜谱")
        results = []
        now = int(datetime.now().timestamp() * 1000)
        with get_db() as session:
            for recipe in recipes_data:
                recipe_id = f"recipe_{uuid.uuid4().hex[:12]}"
                r = Recipe(
                    id=recipe_id, user_id=uid, title=recipe.title, content=recipe.content,
                    image_url=recipe.image_url, difficulty=recipe.difficulty,
                    cooking_time=recipe.cooking_time,
                    ingredients=recipe.ingredients or [],
                    seasonings=recipe.seasonings or [],
                    tags=recipe.tags or [],
                    score=recipe.score, reason=recipe.reason,
                    source_url=recipe.source_url, video_url=recipe.video_url,
                    is_expanded=False, created_at=now, updated_at=now,
                )
                session.add(r)
                session.flush()
                results.append(_recipe_to_dict(r))
        logger.info(f"批量创建菜谱成功，数量：{len(results)}")
        return {"recipes": results, "total": len(results)}
    except Exception as e:
        logger.error(f"批量创建菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-delete", response_model=RecipeOperationResponse)
async def batch_delete_recipes(ids: List[str] = Body(...), current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as session:
            count = session.query(Recipe).filter(
                Recipe.id.in_(ids), Recipe.user_id == uid
            ).delete(synchronize_session=False)
        logger.info(f"批量删除菜谱成功，删除数量：{count}")
        return {'success': True, 'message': f'已删除 {count} 道菜谱'}
    except Exception as e:
        logger.error(f"批量删除菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search", response_model=RecipeListResponse)
async def search_recipes(q: str = Query(..., description="搜索关键词"), current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        search_pattern = f"%{q}%"
        with get_db() as session:
            rows = session.query(Recipe).filter(
                (Recipe.title.like(search_pattern) | Recipe.content.like(search_pattern)),
                Recipe.user_id == uid
            ).order_by(Recipe.created_at.desc()).all()
        recipes = [_recipe_to_dict(r) for r in rows]
        return {'recipes': recipes, 'total': len(recipes)}
    except Exception as e:
        logger.error(f"搜索菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(recipe_id: str, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as session:
            r = session.query(Recipe).filter(
                Recipe.id == recipe_id, Recipe.user_id == uid
            ).first()
        if not r:
            raise HTTPException(status_code=404, detail="菜谱不存在")
        return _recipe_to_dict(r)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(recipe_id: str, updates: RecipeUpdate, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as session:
            r = session.query(Recipe).filter(
                Recipe.id == recipe_id, Recipe.user_id == uid
            ).first()
            if not r:
                raise HTTPException(status_code=404, detail="菜谱不存在")

            update_data = updates.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if field in _JSON_FIELDS and value is not None:
                    setattr(r, field, value)
                    flag_modified(r, field)
                else:
                    setattr(r, field, value)

            r.updated_at = int(datetime.now().timestamp() * 1000)
            session.flush()
            result = _recipe_to_dict(r)

        logger.info(f"菜谱更新成功：{recipe_id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{recipe_id}", response_model=RecipeOperationResponse)
async def delete_recipe(recipe_id: str, current_user: dict = Depends(get_current_user)):
    try:
        uid = current_user["user_id"]
        with get_db() as session:
            count = session.query(Recipe).filter(
                Recipe.id == recipe_id, Recipe.user_id == uid
            ).delete(synchronize_session=False)
        if count == 0:
            raise HTTPException(status_code=404, detail="菜谱不存在")
        logger.info(f"菜谱删除成功：{recipe_id}")
        return {'success': True, 'message': '删除成功'}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除菜谱失败：{e}")
        raise HTTPException(status_code=500, detail=str(e))
