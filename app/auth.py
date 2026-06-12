"""JWT 认证工具模块"""
import os
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
import jwt
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET 环境变量未设置")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "168"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

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


def _extract_token(request: Request) -> str | None:
    """从请求中提取 JWT token（先检查 Authorization header，再检查 cookie）"""
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get("auth_token")


def verify_jwt(token: str) -> dict:
    """验证 JWT token，返回 payload。不访问数据库。"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        username = payload.get("username")
        if sub and username:
            return {"user_id": sub, "username": username}
    except jwt.PyJWTError:
        pass
    raise HTTPException(status_code=401, detail="无效的认证凭据")


def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict:
    from app.common.database import get_db
    from app.models.db import User
    if not token:
        raise HTTPException(status_code=401, detail="请先登录")
    if is_token_revoked(token):
        raise HTTPException(status_code=401, detail="无效的认证凭据")
    payload = verify_jwt(token)
    with get_db() as session:
        user = session.query(User).filter(User.id == payload["user_id"]).first()
    if user is None:
        raise HTTPException(status_code=401, detail="无效的认证凭据")
    return {"user_id": user.id, "username": user.username}
