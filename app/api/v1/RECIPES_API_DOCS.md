# 菜谱管理 API 文档

## 概述

菜谱管理 API 提供了完整的菜谱 CRUD（创建、读取、更新、删除）功能，支持搜索、分页等操作。

**基础 URL**: `http://127.0.0.1:8001/api/v1/recipes`

---

## API 端点

### 1. 创建菜谱

**端点**: `POST /api/v1/recipes`

**描述**: 创建一个新的菜谱记录

**请求体**:
```json
{
  "thread_id": "session-123",
  "title": "宫保鸡丁",
  "content": "# 宫保鸡丁\n\n## 食材\n- 鸡胸肉\n\n## 步骤\n1. 鸡肉切丁",
  "image_url": "https://example.com/gongbao.jpg",
  "difficulty": "中等",
  "cooking_time": "30 分钟",
  "ingredients": ["鸡胸肉", "花生米", "干辣椒"],
  "seasonings": ["生抽", "老抽", "料酒"]
}
```

**响应** (200 OK):
```json
{
  "id": "recipe_1234567890_0001",
  "title": "宫保鸡丁",
  "content": "# 宫保鸡丁...",
  "image_url": "https://example.com/gongbao.jpg",
  "difficulty": "中等",
  "cooking_time": "30 分钟",
  "ingredients": ["鸡胸肉", "花生米", "干辣椒"],
  "seasonings": ["生抽", "老抽", "料酒"],
  "score": null,
  "reason": null,
  "source_url": null,
  "is_expanded": false,
  "created_at": 1714204800000,
  "updated_at": 1714204800000
}
```

**错误响应**:
- 400 Bad Request - 请求参数错误
- 500 Internal Server Error - 服务器错误

---

### 2. 获取菜谱列表

**端点**: `GET /api/v1/recipes?thread_id={thread_id}`

**描述**: 获取指定会话的所有菜谱

**查询参数**:
- `thread_id` (必需): 会话 ID
- `limit` (可选): 限制返回数量
- `offset` (可选): 偏移量（用于分页）

**示例**:
```
GET /api/v1/recipes?thread_id=session-123&limit=10&offset=0
```

**响应** (200 OK):
```json
{
  "recipes": [
    {
      "id": "recipe_001",
      "title": "宫保鸡丁",
      "content": "...",
      "difficulty": "中等",
      "cooking_time": "30 分钟",
      "ingredients": ["鸡胸肉", "花生米"],
      "seasonings": ["生抽", "老抽"],
      "created_at": 1714204800000,
      "updated_at": 1714204800000
    }
  ],
  "total": 1
}
```

---

### 3. 获取单个菜谱

**端点**: `GET /api/v1/recipes/{recipe_id}`

**描述**: 获取指定菜谱的详细信息

**路径参数**:
- `recipe_id`: 菜谱 ID

**示例**:
```
GET /api/v1/recipes/recipe_1234567890_0001
```

**响应** (200 OK):
```json
{
  "id": "recipe_1234567890_0001",
  "title": "宫保鸡丁",
  "content": "# 宫保鸡丁...",
  "difficulty": "中等",
  "cooking_time": "30 分钟",
  "ingredients": ["鸡胸肉", "花生米"],
  "seasonings": ["生抽", "老抽"],
  "score": 4.5,
  "reason": "经典川菜",
  "source_url": null,
  "is_expanded": true,
  "created_at": 1714204800000,
  "updated_at": 1714204800000
}
```

**错误响应**:
- 404 Not Found - 菜谱不存在

---

### 4. 更新菜谱

**端点**: `PUT /api/v1/recipes/{recipe_id}`

**描述**: 更新菜谱信息（部分更新）

**路径参数**:
- `recipe_id`: 菜谱 ID

**请求体** (所有字段可选):
```json
{
  "title": "新宫保鸡丁",
  "content": "更新后的内容",
  "difficulty": "简单",
  "cooking_time": "25 分钟",
  "score": 4.8,
  "reason": "经过改进，更加美味",
  "source_url": "https://example.com/recipe",
  "is_expanded": false
}
```

**响应** (200 OK):
```json
{
  "id": "recipe_1234567890_0001",
  "title": "新宫保鸡丁",
  "content": "更新后的内容",
  "difficulty": "简单",
  "cooking_time": "25 分钟",
  "score": 4.8,
  "reason": "经过改进，更加美味",
  "source_url": "https://example.com/recipe",
  "is_expanded": false,
  "created_at": 1714204800000,
  "updated_at": 1714205800000
}
```

**错误响应**:
- 404 Not Found - 菜谱不存在
- 400 Bad Request - 请求参数错误

---

### 5. 删除菜谱

**端点**: `DELETE /api/v1/recipes/{recipe_id}`

**描述**: 删除指定的菜谱

**路径参数**:
- `recipe_id`: 菜谱 ID

**示例**:
```
DELETE /api/v1/recipes/recipe_1234567890_0001
```

**响应** (200 OK):
```json
{
  "success": true,
  "message": "删除成功"
}
```

**错误响应**:
- 404 Not Found - 菜谱不存在
- 500 Internal Server Error - 服务器错误

---

### 6. 搜索菜谱

**端点**: `GET /api/v1/recipes/search?q={query}&thread_id={thread_id}`

**描述**: 根据关键词搜索菜谱（支持标题和内容搜索）

**查询参数**:
- `q` (必需): 搜索关键词
- `thread_id` (必需): 会话 ID

**示例**:
```
GET /api/v1/recipes/search?q=宫保&thread_id=session-123
```

**响应** (200 OK):
```json
{
  "recipes": [
    {
      "id": "recipe_001",
      "title": "宫保鸡丁",
      "content": "...",
      "difficulty": "中等",
      "cooking_time": "30 分钟",
      "created_at": 1714204800000,
      "updated_at": 1714204800000
    }
  ],
  "total": 1
}
```

---

## 数据模型

### RecipeCreate (创建请求)
```python
{
  "thread_id": str,           # 会话 ID（必需）
  "title": str,               # 菜品名称（必需）
  "content": str,             # 完整做法（必需）
  "image_url": str | null,    # 图片 URL（可选）
  "difficulty": str | null,   # 难度等级（可选）
  "cooking_time": str | null, # 烹饪时间（可选）
  "ingredients": [str],       # 食材清单（可选）
  "seasonings": [str]         # 调味料清单（可选）
}
```

### RecipeUpdate (更新请求)
```python
{
  "title": str | null,        # 菜品名称（可选）
  "content": str | null,      # 完整做法（可选）
  "image_url": str | null,    # 图片 URL（可选）
  "difficulty": str | null,   # 难度等级（可选）
  "cooking_time": str | null, # 烹饪时间（可选）
  "score": float | null,      # 评分（可选）
  "reason": str | null,       # 推荐理由（可选）
  "source_url": str | null,   # 原食谱链接（可选）
  "is_expanded": bool | null  # 展开状态（可选）
}
```

### RecipeResponse (响应)
```python
{
  "id": str,                  # 菜谱 ID
  "title": str,               # 菜品名称
  "content": str,             # 完整做法
  "image_url": str | null,    # 图片 URL
  "difficulty": str | null,   # 难度等级
  "cooking_time": str | null, # 烹饪时间
  "ingredients": [str],       # 食材清单
  "seasonings": [str],        # 调味料清单
  "score": float | null,      # 评分
  "reason": str | null,       # 推荐理由
  "source_url": str | null,   # 原食谱链接
  "is_expanded": bool,        # 展开状态
  "created_at": int,          # 创建时间戳（毫秒）
  "updated_at": int           # 更新时间戳（毫秒）
}
```

### RecipeListResponse (列表响应)
```python
{
  "recipes": [RecipeResponse],  # 菜谱列表
  "total": int                  # 总数
}
```

### RecipeOperationResponse (操作响应)
```python
{
  "success": bool,            # 是否成功
  "message": str | null,      # 消息
  "recipe": RecipeResponse | null,  # 菜谱数据
  "error": str | null         # 错误信息
}
```

---

## 使用示例

### Python 示例

```python
import requests

BASE_URL = "http://127.0.0.1:8001"

# 创建菜谱
def create_recipe():
    data = {
        "thread_id": "session-123",
        "title": "宫保鸡丁",
        "content": "# 宫保鸡丁\n\n## 食材\n- 鸡胸肉",
        "difficulty": "中等",
        "cooking_time": "30 分钟",
        "ingredients": ["鸡胸肉", "花生米"],
        "seasonings": ["生抽", "老抽"]
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/recipes", json=data)
    if response.status_code == 200:
        recipe = response.json()
        print(f"创建成功：{recipe['id']}")
        return recipe
    else:
        print(f"创建失败：{response.text}")
        return None

# 获取菜谱列表
def get_recipes(thread_id):
    params = {"thread_id": thread_id}
    response = requests.get(f"{BASE_URL}/api/v1/recipes", params=params)
    
    if response.status_code == 200:
        data = response.json()
        return data["recipes"]
    else:
        return []

# 更新菜谱
def update_recipe(recipe_id, updates):
    response = requests.put(
        f"{BASE_URL}/api/v1/recipes/{recipe_id}",
        json=updates
    )
    
    if response.status_code == 200:
        return response.json()
    else:
        return None

# 删除菜谱
def delete_recipe(recipe_id):
    response = requests.delete(f"{BASE_URL}/api/v1/recipes/{recipe_id}")
    return response.status_code == 200

# 搜索菜谱
def search_recipes(query, thread_id):
    params = {"q": query, "thread_id": thread_id}
    response = requests.get(f"{BASE_URL}/api/v1/recipes/search", params=params)
    
    if response.status_code == 200:
        data = response.json()
        return data["recipes"]
    else:
        return []
```

### JavaScript 示例

```javascript
const BASE_URL = "http://127.0.0.1:8001";

// 创建菜谱
async function createRecipe(recipeData) {
  const response = await fetch(`${BASE_URL}/api/v1/recipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipeData)
  });
  
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error('创建失败');
  }
}

// 获取菜谱列表
async function getRecipes(threadId) {
  const params = new URLSearchParams({ thread_id: threadId });
  const response = await fetch(`${BASE_URL}/api/v1/recipes?${params}`);
  
  if (response.ok) {
    const data = await response.json();
    return data.recipes;
  } else {
    return [];
  }
}

// 更新菜谱
async function updateRecipe(recipeId, updates) {
  const response = await fetch(`${BASE_URL}/api/v1/recipes/${recipeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error('更新失败');
  }
}

// 删除菜谱
async function deleteRecipe(recipeId) {
  const response = await fetch(`${BASE_URL}/api/v1/recipes/${recipeId}`, {
    method: 'DELETE'
  });
  
  return response.ok;
}

// 搜索菜谱
async function searchRecipes(query, threadId) {
  const params = new URLSearchParams({ q: query, thread_id: threadId });
  const response = await fetch(`${BASE_URL}/api/v1/recipes/search?${params}`);
  
  if (response.ok) {
    const data = await response.json();
    return data.recipes;
  } else {
    return [];
  }
}
```

---

## 错误处理

所有 API 端点都可能返回以下错误：

### 400 Bad Request
```json
{
  "detail": "请求参数错误"
}
```

### 404 Not Found
```json
{
  "detail": "菜谱不存在"
}
```

### 500 Internal Server Error
```json
{
  "detail": "具体的错误信息"
}
```

---

## 数据库

### 表结构

```sql
CREATE TABLE recipes (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    difficulty TEXT,
    cooking_time TEXT,
    ingredients TEXT,  -- JSON 格式
    seasonings TEXT,   -- JSON 格式
    score REAL,
    reason TEXT,
    source_url TEXT,
    is_expanded INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_thread_id ON recipes(thread_id);
CREATE INDEX idx_title ON recipes(title);
```

### 数据库位置

`app/db/recipes.db`

---

## 测试

运行测试脚本：

```bash
python test_recipes_api.py
```

测试将执行：
1. 创建菜谱
2. 获取列表
3. 获取单个详情
4. 更新菜谱
5. 搜索菜谱
6. 删除菜谱（清理测试数据）

---

## 最佳实践

### 1. 批量操作
对于批量创建/更新，建议使用循环调用单个 API。

### 2. 错误重试
网络请求可能失败，建议实现重试机制：

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def create_recipe_with_retry(data):
    return create_recipe(data)
```

### 3. 数据验证
在发送到 API 之前，先在客户端验证数据：

```python
def validate_recipe(data):
    if not data.get('title'):
        raise ValueError("标题不能为空")
    if not data.get('content'):
        raise ValueError("做法内容不能为空")
    # 更多验证...
```

### 4. 分页处理
对于大量数据，使用分页：

```python
def get_all_recipes(thread_id):
    all_recipes = []
    offset = 0
    limit = 50
    
    while True:
        recipes = get_recipes(thread_id, limit=limit, offset=offset)
        if not recipes:
            break
        all_recipes.extend(recipes)
        offset += limit
    
    return all_recipes
```

---

## 更新日志

### v1.0.0 (2026-04-27)
- ✨ 初始版本
- ✅ 创建菜谱
- ✅ 获取列表
- ✅ 获取单个
- ✅ 更新菜谱
- ✅ 删除菜谱
- ✅ 搜索功能
