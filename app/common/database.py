"""中央数据库引擎和会话管理"""
import os
from contextlib import contextmanager
from pathlib import Path
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL 环境变量未设置，请参考 .env.example 配置 MySQL 连接")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=10,
    max_overflow=20,
    echo=os.getenv("APP_ENV", "production") == "development",
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)


def verify_schema_revision(connection) -> None:
    alembic_config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    expected_revision = ScriptDirectory.from_config(alembic_config).get_current_head()
    current_revision = MigrationContext.configure(connection).get_current_revision()
    if current_revision != expected_revision:
        raise RuntimeError(
            "数据库迁移版本不匹配："
            f"当前={current_revision or '未初始化'}，"
            f"代码要求={expected_revision}。请先备份并执行数据库迁移。"
        )


@contextmanager
def get_db() -> Session:
    """SQLAlchemy session 上下文管理器，替换所有模块的私有 get_db()"""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
