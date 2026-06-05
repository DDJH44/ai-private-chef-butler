"""Body metrics tracking API — weight, body fat, muscle mass, etc."""
import uuid
import json
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Depends
from app.auth import get_current_user
from app.common.database import get_db
from app.models.db import BodyMetric
from app.models.schemas import BodyMetricCreate, BodyMetricResponse
from app.common.logger import logger

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("", response_model=BodyMetricResponse)
async def create_metric(body: BodyMetricCreate, current_user: dict = Depends(get_current_user)):
    """Record a new body measurement."""
    uid = current_user["user_id"]
    now = int(datetime.now().timestamp())
    metric_id = str(uuid.uuid4())

    with get_db() as session:
        m = BodyMetric(
            id=metric_id, user_id=uid, date=body.date,
            weight=body.weight, body_fat=body.body_fat,
            muscle_mass=body.muscle_mass, waist=body.waist,
            notes=body.notes, created_at=now,
        )
        session.add(m)
        return BodyMetricResponse(
            id=m.id, user_id=m.user_id, date=m.date,
            weight=m.weight, body_fat=m.body_fat,
            muscle_mass=m.muscle_mass, waist=m.waist,
            notes=m.notes, created_at=m.created_at,
        )


@router.get("", response_model=List[BodyMetricResponse])
async def list_metrics(
    days: int = Query(default=30, ge=7, le=365),
    current_user: dict = Depends(get_current_user),
):
    """Get body metrics history for the past N days."""
    uid = current_user["user_id"]
    with get_db() as session:
        rows = session.query(BodyMetric).filter(
            BodyMetric.user_id == uid
        ).order_by(BodyMetric.date.desc()).limit(days).all()

        return [
            BodyMetricResponse(
                id=r.id, user_id=r.user_id, date=r.date,
                weight=r.weight, body_fat=r.body_fat,
                muscle_mass=r.muscle_mass, waist=r.waist,
                notes=r.notes, created_at=r.created_at,
            )
            for r in rows
        ]


@router.delete("/{metric_id}")
async def delete_metric(metric_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a body metric record."""
    uid = current_user["user_id"]
    with get_db() as session:
        m = session.query(BodyMetric).filter(
            BodyMetric.id == metric_id, BodyMetric.user_id == uid
        ).first()
        if not m:
            raise HTTPException(status_code=404, detail="记录不存在")
        session.delete(m)
        return {"status": "ok"}
