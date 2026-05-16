"""SQLAlchemy ORM 模型 —— 映射原 SQLite 表到 MySQL"""
from sqlalchemy import Column, String, Integer, Float, Text, JSON, Boolean, BigInteger, Index, LargeBinary
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(BigInteger, nullable=False)


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(String(50), primary_key=True)
    user_id = Column(String(36), nullable=False, default="", index=True)
    thread_id = Column(String(100), nullable=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    image_url = Column(Text, nullable=True)
    difficulty = Column(String(50), nullable=True)
    cooking_time = Column(String(50), nullable=True)
    ingredients = Column(JSON, nullable=True)
    seasonings = Column(JSON, nullable=True)
    score = Column(Float, nullable=True)
    reason = Column(Text, nullable=True)
    source_url = Column(Text, nullable=True)
    video_url = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True, default=list)
    is_expanded = Column(Boolean, nullable=True, default=False)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index("idx_recipes_created_at", "created_at"),
    )


class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(String(50), primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False, default="其他")
    quantity = Column(Float, nullable=False, default=1)
    unit = Column(String(20), nullable=False, default="个")
    purchase_date = Column(String(20), nullable=True)
    shelf_life_days = Column(Integer, nullable=False, default=7)
    expiry_date = Column(String(20), nullable=True)
    status = Column(String(20), nullable=False, default="normal")
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


class ShoppingList(Base):
    __tablename__ = "shopping_lists"

    id = Column(String(50), primary_key=True)
    user_id = Column(String(36), nullable=False, default="", index=True)
    source_recipes = Column(JSON, nullable=True, default=list)
    source_recipe_names = Column(JSON, nullable=True, default=list)
    items = Column(JSON, nullable=True, default=list)
    status = Column(String(20), nullable=True, default="pending")
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index("idx_shopping_created_at", "created_at"),
    )


class CookRecord(Base):
    __tablename__ = "cook_records"

    id = Column(String(50), primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    recipe_id = Column(String(50), nullable=False, default="")
    recipe_name = Column(String(500), nullable=False)
    cook_date = Column(String(20), nullable=False, index=True)
    rating = Column(Integer, nullable=False, default=0)
    notes = Column(Text, nullable=False, default="")
    photos = Column(JSON, nullable=False, default=list)
    created_at = Column(BigInteger, nullable=False)


class NutritionRecord(Base):
    __tablename__ = "nutrition_records"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False, default="")
    date = Column(String(20), nullable=False, index=True)
    meal_type = Column(String(20), nullable=False)
    food_name = Column(String(500), nullable=False)
    calories = Column(Float, nullable=True)
    protein = Column(Float, nullable=True)
    carbs = Column(Float, nullable=True)
    fat = Column(Float, nullable=True)
    fiber = Column(Float, nullable=True)
    sodium = Column(Float, nullable=True)
    image_url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(BigInteger, nullable=False)


class FeishuConfig(Base):
    __tablename__ = "feishu_config"

    user_id = Column(String(36), primary_key=True)
    webhook_url = Column(Text, nullable=False)
    onboarding_step = Column(String(50), nullable=False, default="webhook_saved")
    enabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(BigInteger, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


class Preference(Base):
    __tablename__ = "preferences"

    user_id = Column(String(36), primary_key=True)
    data = Column(JSON, nullable=False)
    updated_at = Column(BigInteger, nullable=False)


# LangGraph checkpoint tables (VARCHAR 限制长度以兼容 MySQL 5.7 索引 3072 字节上限)
class CheckpointRow(Base):
    __tablename__ = "checkpoints"

    thread_id = Column(String(128), primary_key=True, nullable=False)
    checkpoint_ns = Column(String(100), primary_key=True, nullable=False, default="")
    checkpoint_id = Column(String(64), primary_key=True, nullable=False)
    parent_checkpoint_id = Column(String(64), nullable=True)
    type = Column(String(100), nullable=True)
    checkpoint = Column(LargeBinary, nullable=True)
    meta = Column("metadata", LargeBinary, nullable=True)


class WriteRow(Base):
    __tablename__ = "writes"

    thread_id = Column(String(128), primary_key=True, nullable=False)
    checkpoint_ns = Column(String(100), primary_key=True, nullable=False, default="")
    checkpoint_id = Column(String(64), primary_key=True, nullable=False)
    task_id = Column(String(128), primary_key=True, nullable=False)
    idx = Column(Integer, primary_key=True, nullable=False)
    channel = Column(String(100), nullable=False)
    type = Column(String(100), nullable=True)
    value = Column(LargeBinary, nullable=True)


class ImageCache(Base):
    """AI 生成图片缓存 — 同一菜名不重复生成"""
    __tablename__ = "image_cache"

    dish_query = Column(String(200), primary_key=True, nullable=False)
    oss_url = Column(Text, nullable=False)
    created_at = Column(BigInteger, nullable=False)
