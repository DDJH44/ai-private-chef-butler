from pydantic import BaseModel
from typing import Optional, List

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
    is_expanded: Optional[bool] = None


class RecipeResponse(BaseModel):
    """菜谱响应"""
    id: str
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
    is_expanded: Optional[bool] = False
    created_at: int
    updated_at: int

    class Config:
        from_attributes = True


class RecipeListResponse(BaseModel):
    """菜谱列表响应"""
    recipes: List[RecipeResponse]
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


class ShoppingListResponse(BaseModel):
    id: str
    created_at: int
    source_recipes: List[str]
    source_recipe_names: List[str]
    items: List[ShoppingListItemResponse]
    status: str


class ShoppingListListResponse(BaseModel):
    shopping_lists: List[ShoppingListResponse]
    total: int


class ShoppingListOperationResponse(BaseModel):
    success: bool
    message: Optional[str] = None
