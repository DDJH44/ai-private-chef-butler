"""用户认证 API"""
import os
from fastapi import APIRouter, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from app.models.schemas import UserRegister, UserLogin, UserResponse, TokenResponse
from app.auth import hash_password, verify_password, create_access_token, get_current_user, revoke_token
from app.common.logger import logger
import sqlite3
import uuid
import time
from contextlib import contextmanager
from fastapi import Depends
from collections import defaultdict

router = APIRouter()
_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

DB_PATH = os.getenv("USER_DB_PATH", "data/users.db")

# 简易内存速率限制器
_rate_limits: dict[str, list[float]] = defaultdict(list)

def _check_rate_limit(key: str, max_requests: int = 10, window: int = 60) -> None:
    """检查速率限制，超出则抛出 HTTPException"""
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
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        conn.commit()


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

    with get_db() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ? OR email = ?", (req.username, req.email)).fetchone()
        if existing:
            raise HTTPException(409, "用户名或邮箱已被注册")
        try:
            conn.execute(
                "INSERT INTO users (id, username, email, hashed_password, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, req.username, req.email, hashed, created_at)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(409, "用户名或邮箱已被注册")

    token = create_access_token({"sub": user_id, "username": req.username})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_id, username=req.username, email=req.email, created_at=created_at)
    )


@router.post("/login", response_model=TokenResponse)
def login(req: UserLogin, request: Request):
    _check_rate_limit(f"login:{_get_client_ip(request)}", max_requests=10, window=60)
    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (req.username,)).fetchone()
    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(401, "用户名或密码错误")

    token = create_access_token({"sub": user["id"], "username": user["username"]})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user["id"], username=user["username"], email=user["email"], created_at=user["created_at"])
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        user = conn.execute(
            "SELECT id, username, email, created_at FROM users WHERE id = ?",
            (current_user["user_id"],)
        ).fetchone()
    if not user:
        raise HTTPException(404, "用户不存在")
    return UserResponse(id=user["id"], username=user["username"], email=user["email"], created_at=user["created_at"])


@router.post("/logout")
def logout(raw_token: str = Depends(_oauth2)):
    revoke_token(raw_token)
    return {"message": "已登出"}
