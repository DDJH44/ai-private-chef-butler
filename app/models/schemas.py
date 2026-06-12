from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
import warnings

class ChatRequest(BaseModel):
    """聊天请求"""
    message: str
    image_url: Optional[str] = None
    thread_id: str
    preference: Optional[dict] = None
    inventory: Optional[list] = None

class ChatResponse(BaseModel):
    """聊天响应"""
    response: str
    thread_id: str

class Message(BaseModel):
    """消息"""
    role: str
    content: str

class OSSUploadRequest(BaseModel):
    """OSS 上传请求"""
    filename: str
    content_type: str = "image/jpeg"

class OSSUploadResponse(BaseModel):
    """OSS 上传响应"""
    upload_url: str
    file_url: str
    expires: int


# ========================================
# 菜谱管理相关模型
# ========================================

ALLOWED_RECIPE_TAGS: set[str] = {
    "快手", "高蛋白", "低卡", "川味", "粤菜", "家常", "汤品",
    "早餐", "午餐", "晚餐", "加餐", "甜品", "饮品",
}


def _validate_tags(tags: List[str]) -> List[str]:
    unknown = [t for t in tags if t not in ALLOWED_RECIPE_TAGS]
    if unknown:
        warnings.warn(f"非标准标签: {', '.join(unknown)}", UserWarning, stacklevel=3)
    return tags


class RecipeCreate(BaseModel):
    """创建菜谱请求（全局存储，不绑定会话）"""
    title: str
    content: str
    image_url: Optional[str] = None
    difficulty: Optional[str] = None
    cooking_time: Optional[str] = None
    ingredients: Optional[List[str]] = []
    seasonings: Optional[List[str]] = []
    tags: Optional[List[str]] = []
    score: Optional[float] = None
    reason: Optional[str] = None
    source_url: Optional[str] = None
    video_url: Optional[str] = None
    videos: Optional[List[dict]] = []

    @field_validator("tags")
    @classmethod
    def check_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v:
            return _validate_tags(v)
        return v


class RecipeUpdate(BaseModel):
    """更新菜谱请求"""
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    difficulty: Optional[str] = None
    cooking_time: Optional[str] = None
    ingredients: Optional[List[str]] = None
    seasonings: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    score: Optional[float] = None
    reason: Optional[str] = None
    source_url: Optional[str] = None
    video_url: Optional[str] = None
    videos: Optional[List[dict]] = None
    is_expanded: Optional[bool] = None

    @field_validator("tags")
    @classmethod
    def check_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v:
            return _validate_tags(v)
        return v


class RecipeResponse(BaseModel):
    """菜谱响应"""
    id: str
    title: str
    content: str = ""
    image_url: Optional[str] = None
    difficulty: Optional[str] = None
    cooking_time: Optional[str] = None
    ingredients: Optional[List[str]] = []
    seasonings: Optional[List[str]] = []
    tags: Optional[List[str]] = []
    score: Optional[float] = None
    reason: Optional[str] = None
    source_url: Optional[str] = None
    video_url: Optional[str] = None
    videos: Optional[List[dict]] = []
    is_expanded: Optional[bool] = False
    created_at: int
    updated_at: int

    class Config:
        from_attributes = True


class RecipeListResponse(BaseModel):
    """菜谱列表响应"""
    items: List[RecipeResponse]
    total: int


class RecipeOperationResponse(BaseModel):
    """菜谱操作响应"""
    success: bool
    message: Optional[str] = None
    recipe: Optional[RecipeResponse] = None
    error: Optional[str] = None


# ========================================
# 购物清单管理相关模型
# ========================================

class ShoppingListItemCreate(BaseModel):
    ingredient_name: str
    required_amount: float = 1
    unit: str = "份"
    in_stock: bool = False
    stock_amount: float = 0
    checked: bool = False
    recipe_names: Optional[List[str]] = None


class ShoppingListCreate(BaseModel):
    source_recipes: List[str] = []
    source_recipe_names: List[str] = []
    items: List[ShoppingListItemCreate]


class ShoppingListUpdate(BaseModel):
    source_recipe_names: Optional[List[str]] = None
    items: Optional[List[ShoppingListItemCreate]] = None
    status: Optional[str] = None


class ShoppingListItemResponse(BaseModel):
    id: str
    ingredient_name: str
    required_amount: float
    unit: str
    in_stock: bool
    stock_amount: float
    checked: bool
    recipe_names: Optional[List[str]] = None


class ShoppingListResponse(BaseModel):
    id: str
    created_at: int
    source_recipes: List[str]
    source_recipe_names: List[str]
    items: List[ShoppingListItemResponse]
    status: str


class ShoppingListListResponse(BaseModel):
    items: List[ShoppingListResponse]
    total: int


class ShoppingListOperationResponse(BaseModel):
    success: bool
    message: Optional[str] = None


# ========================================
# 用户认证相关模型
# ========================================

class UserRegister(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    avatar: Optional[str] = None
    created_at: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ========================================
# 身体指标 & 营养素目标
# ========================================

class BodyMetricCreate(BaseModel):
    date: str
    weight: Optional[float] = Field(None, ge=1, le=500)
    body_fat: Optional[float] = Field(None, ge=0, le=100)
    muscle_mass: Optional[float] = Field(None, ge=0, le=200)
    waist: Optional[float] = Field(None, ge=20, le=300)
    notes: Optional[str] = None


class BodyMetricResponse(BaseModel):
    id: str
    user_id: str
    date: str
    weight: Optional[float] = None
    body_fat: Optional[float] = None
    muscle_mass: Optional[float] = None
    waist: Optional[float] = None
    notes: Optional[str] = None
    created_at: int


class NutritionTargets(BaseModel):
    daily_calories: Optional[int] = Field(None, ge=0, le=10000)
    protein_target: Optional[int] = Field(None, ge=0, le=500)
    carbs_target: Optional[int] = Field(None, ge=0, le=1000)
    fat_target: Optional[int] = Field(None, ge=0, le=500)
    fiber_target: Optional[int] = Field(None, ge=0, le=200)
    goal_type: Optional[str] = "maintain"
