"""JWT 认证工具模块"""
import os
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET 环境变量未设置")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "168"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Token 黑名单（服务重启后清空，生产环境应使用 Redis）
_token_blacklist: set[str] = set()


def revoke_token(token: str) -> None:
    _token_blacklist.add(token)


def is_token_revoked(token: str) -> bool:
    return token in _token_blacklist


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    from app.api.v1.auth import get_db
    credentials_exception = HTTPException(status_code=401, detail="无效的认证凭据")
    if is_token_revoked(token):
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        username: str = payload.get("username")
        if user_id is None or username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    with get_db() as conn:
        row = conn.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise credentials_exception
    return {"user_id": row["id"], "username": row["username"]}
