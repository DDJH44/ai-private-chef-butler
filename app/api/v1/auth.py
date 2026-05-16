"""用户认证 API"""
import os
import time
import uuid
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.exc import IntegrityError

from app.models.schemas import UserRegister, UserLogin, UserResponse, TokenResponse
from app.models.db import User
from app.common.database import get_db
from app.auth import hash_password, verify_password, create_access_token, get_current_user, revoke_token

router = APIRouter()
_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# 简易内存速率限制器
_rate_limits: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(key: str, max_requests: int = 10, window: int = 60) -> None:
    now = time.time()
    _rate_limits[key] = [t for t in _rate_limits[key] if now - t < window]
    if len(_rate_limits[key]) >= max_requests:
        raise HTTPException(429, f"请求过于频繁，请 {window} 秒后重试")
    _rate_limits[key].append(now)


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/register", response_model=TokenResponse)
def register(req: UserRegister, request: Request):
    _check_rate_limit(f"register:{_get_client_ip(request)}", max_requests=5, window=60)
    if len(req.username) < 2:
        raise HTTPException(400, "用户名至少需要2个字符")
    if len(req.password) < 6:
        raise HTTPException(400, "密码至少需要6个字符")
    if "@" not in req.email:
        raise HTTPException(400, "请输入有效的邮箱地址")

    user_id = str(uuid.uuid4())
    hashed = hash_password(req.password)
    created_at = int(time.time())

    with get_db() as session:
        existing = session.query(User).filter(
            (User.username == req.username) | (User.email == req.email)
        ).first()
        if existing:
            raise HTTPException(409, "用户名或邮箱已被注册")
        try:
            user = User(id=user_id, username=req.username, email=req.email,
                        hashed_password=hashed, created_at=created_at)
            session.add(user)
            session.flush()
        except IntegrityError:
            raise HTTPException(409, "用户名或邮箱已被注册")

    token = create_access_token({"sub": user_id, "username": req.username})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_id, username=req.username, email=req.email, created_at=created_at)
    )


@router.post("/login", response_model=TokenResponse)
def login(req: UserLogin, request: Request):
    _check_rate_limit(f"login:{_get_client_ip(request)}", max_requests=10, window=60)
    with get_db() as session:
        user = session.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(401, "用户名或密码错误")

    token = create_access_token({"sub": user.id, "username": user.username})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, username=user.username, email=user.email, created_at=user.created_at)
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    with get_db() as session:
        user = session.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(404, "用户不存在")
    return UserResponse(id=user.id, username=user.username, email=user.email, created_at=user.created_at)


@router.post("/logout")
def logout(raw_token: str = Depends(_oauth2)):
    revoke_token(raw_token)
    return {"message": "已登出"}
