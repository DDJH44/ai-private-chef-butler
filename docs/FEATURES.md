# AI Private Chef Butler — 功能文档

## 一、项目背景

在快节奏的现代生活中，"今天吃什么"成为每个家庭每天都要面对的问题。传统做法依赖个人经验或随机搜索，往往导致营养不均衡、食材浪费、烹饪效率低下。

**AI Private Chef Butler（AI 私人厨师管家）** 是一个面向家庭饮食场景的智能系统，目标是让 AI 成为每个家庭的专属营养师和厨师顾问。用户可以通过自然语言对话获取菜谱推荐、拍照识别食物营养、规划一周膳食、管理冰箱库存、生成购物清单，并将每日饮食报告推送到飞书。

项目采用 **LangGraph Agent + RAG 混合检索** 架构，AI 不仅能对话，还能自主调用工具搜索菜品图片、检索 B 站教学视频、查询权威营养数据库，真正实现"从问到做"的全链路覆盖。

---

## 二、技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **后端框架** | Python 3.13 + FastAPI | 高性能异步 Web 框架，提供 RESTful API |
| **数据库** | MySQL + SQLAlchemy 2.0 | 业务数据持久化，支持异步查询 |
| **AI Agent** | LangChain + LangGraph | 构建有状态的多轮对话 Agent，支持工具调用和流式输出 |
| **RAG 检索** | ChromaDB + BGE Embedding + BM25 | 混合检索：BGE 语义向量 + BM25 稀疏检索 + 查询扩展 |
| **中文分词** | jieba | BM25 索引的中文分词 |
| **LLM** | 豆包大模型 (Doubao) / MiMo | 通过 OpenAI 兼容 API 调用，支持视觉理解 |
| **前端框架** | Next.js 16 + React 19 + TypeScript | SSR/SSG 支持，生产环境静态导出 |
| **UI 风格** | Neumorphism 2.0 + Tailwind CSS 4 | 拟物化设计语言，自定义 CSS 变量系统 |
| **图片存储** | 阿里云 OSS | 用户上传图片和 AI 生成图片的云端存储 |
| **图片搜索** | Pexels + Unsplash API | 菜品真实成品照片搜索 |
| **图片生成** | 火山引擎 Seedream | AI 生成菜品成品照片 |
| **视频搜索** | B 站 API | 搜索烹饪教学视频 |
| **语音** | OpenAI Whisper + TTS | 语音转文字 / 文字转语音（兜底方案） |
| **消息推送** | 飞书 Webhook | 每日饮食报告和菜谱推送到飞书群 |
| **认证** | JWT + bcrypt | 用户注册登录，Token 认证 + 密码哈希 |
| **部署** | Docker + Nginx | 容器化部署，反向代理 + HTTPS |

---

## 三、功能模块

### 3.1 AI 智能对话（首页）

**入口**：`/` — 首页

**功能描述**：
- 用户通过自然语言与 AI 私厨对话，获取菜谱推荐、烹饪指导、营养咨询
- 支持**流式输出**（SSE），AI 回复实时显示，体验流畅
- 支持**图片上传**：用户可拍照上传食材或菜品照片，AI 通过视觉模型识别
- 支持**多轮对话**：基于 LangGraph 的有状态会话，上下文自动记忆
- 支持**会话管理**：新建对话、清空历史、恢复历史会话

**交互设计**：
- 欢迎页面展示 4 个快捷入口：推荐家常菜、拍照识别食材、冰箱有什么菜、规划一周膳食
- 对话消息支持 Markdown 渲染（代码块、表格、列表等）
- 生成中的消息显示打字动画效果
- 支持停止生成功能

**技术实现**：
- 后端：`app/api/v1/chat.py` + `app/agents/personal_chief.py`
- 前端：`frontend/app/page.tsx` + `ChatMessage` + `ChatInput` 组件
- Agent：LangGraph StateGraph，节点为 agent（LLM 推理）和 tools（工具调用），边为条件路由
- 会话持久化：MySQL Checkpoint Saver

---

### 3.2 菜谱管理

**入口**：`/recipes`

**功能描述**：
- **菜谱收藏**：AI 推荐的菜谱可一键保存到个人菜谱库
- **批量操作**：支持批量选择和批量删除
- **搜索筛选**：按关键词搜索，按标签筛选（如"快手"、"高蛋白"、"川味"）
- **菜谱详情**：查看完整的食材列表、调料、烹饪步骤、营养数据
- **菜谱关联**：每道菜谱关联菜品图片、B 站教学视频、推荐评分

**数据结构**：
- 标题、内容（Markdown）、食材列表、调料列表、标签
- 难度等级、烹饪时间、推荐评分、推荐理由
- 菜品图片 URL、视频 URL、视频列表

**技术实现**：
- 后端：`app/api/v1/recipes.py` — 完整 CRUD + 搜索 + 批量操作
- 前端：`frontend/app/recipes/page.tsx` + `RecipeCard` + `RecipeDetailModal`
- 数据库：`Recipe` 模型，JSON 字段存储食材/调料/标签

---

### 3.3 拍照营养识别

**入口**：`/nutrition` — 拍照识别区域

**功能描述**：
- 用户拍摄或上传一日三餐的照片
- AI 视觉模型自动识别照片中的所有食物
- 估算每种食物的重量、热量、蛋白质、碳水、脂肪、膳食纤维、钠
- 分析结果自动保存到当日饮食记录
- **RAG 数据增强**：用权威营养数据库（中国食物成分表）校准 AI 估算值

**识别流程**：
1. 用户选择餐次（早餐/午餐/晚餐/加餐）并上传照片
2. 图片转 Base64 发送到后端
3. 后端调用豆包视觉模型进行食物识别
4. 用 RAG 营养数据库校准每种食物的营养数据
5. 保存识别结果到数据库
6. 图片上传到阿里云 OSS
7. 返回结构化的分析结果

**技术实现**：
- 后端：`app/api/v1/nutrition.py` — `POST /analyze-photo`
- 视觉模型：豆包 Seed 1.8，支持图片理解
- RAG 校准：`rag_store.search(food_name + " 营养成分", "nutrition", k=1)`

---

### 3.4 健康评估

**入口**：`/nutrition` — 健康评估区域

**功能描述**：
- 基于当日所有饮食记录，AI 生成健康评分（0-100 分）
- 评估维度：营养均衡性、三餐合理性、热量控制、蛋白质摄入
- 提供具体改善建议和推荐调整方案
- 支持健身用户特殊评估（基于运动营养学标准）

**技术实现**：
- 后端：`app/api/v1/nutrition.py` — `GET /health-eval/{date}`
- LLM 生成：豆包大模型，注入 RAG 运动营养学知识
- 健身用户检测：读取用户偏好中的 `diet_type` 字段

---

### 3.5 每周膳食规划

**入口**：`/meal-plan`

**功能描述**：
- AI 自动生成一周膳食计划（早、午、晚三餐）
- 支持 4 种规划模式：三餐全规划、仅早餐、仅午餐、仅晚餐
- 综合考虑用户口味偏好、过敏源、冰箱库存
- 支持保留已编辑的餐次，只重新生成未选择的部分
- 一键生成购物清单（从膳食计划提取食材）
- 支持手动编辑每餐的菜品

**技术实现**：
- 后端：`app/api/v1/meal_plan.py` — `POST /meal-plan/generate`
- 前端：`frontend/app/meal-plan/page.tsx`
- JSON 截断修复：`repair_truncated_json()` 处理 LLM 输出不完整的情况
- 购物清单联动：`generateShoppingListFromRecipes()`

---

### 3.6 冰箱库存管理

**入口**：`/fridge`

**功能描述**：
- 管理家中冰箱/储藏室的食材库存
- 记录食材名称、分类、数量、单位、购买日期、保质期
- 自动计算食材状态：正常、即将过期（3 天内）、已过期
- 按分类筛选（蔬菜、肉类、水产、蛋奶、主食、调味品等）
- 过期食材提醒
- AI 对话时自动注入冰箱库存上下文，优先使用已有食材

**技术实现**：
- 后端：`app/api/v1/ingredients.py` — 完整 CRUD
- 前端：`frontend/app/fridge/page.tsx`
- 智能分类：`classifyIngredient()` 自动识别食材分类
- Agent 联动：对话时将库存作为 SystemMessage 注入

---

### 3.7 购物清单

**入口**：`/shopping-list`

**功能描述**：
- 从膳食计划一键生成购物清单
- 手动创建自定义购物清单
- 逐项勾选已购买的食材
- 全部勾选后自动标记为"已完成"
- 复制清单内容到剪贴板
- 关联来源菜谱名称

**技术实现**：
- 后端：`app/api/v1/shopping.py` — 完整 CRUD + 单项勾选切换
- 前端：`frontend/app/shopping-list/page.tsx`
- 乐观更新：勾选操作先更新 UI 再同步后端，提升响应速度

---

### 3.8 口味偏好设置

**入口**：`/preferences`

**功能描述**：
- **过敏源管理**：选择常见过敏源（花生、海鲜、牛奶等）+ 自定义过敏源
- **饮食类型**：普通饮食、纯素食、蛋奶素、生酮饮食、健身增肌、低卡减脂
- **口味偏好**：辣度、咸度、甜度、油度的滑块调节（1-5 级）
- **家庭成员**：添加家庭成员（成人/儿童/老人/婴儿），记录年龄和特殊备注
- **营养目标**：设定每日热量、蛋白质、碳水、脂肪目标值

**偏好联动**：
- AI 对话时自动注入偏好上下文
- 过敏源作为"严禁使用"指令注入，确保 AI 不推荐含过敏源的菜品
- 有儿童/老人时自动推荐软烂、少刺、低盐的菜品
- 有婴儿时推荐辅食类

**技术实现**：
- 后端：`app/api/v1/preferences.py`
- 前端：`frontend/app/preferences/page.tsx`
- Agent 联动：`_build_preference_context()` 构建偏好上下文

---

### 3.9 烹饪历史

**入口**：`/history`

**功能描述**：
- **对话历史**：查看所有 AI 对话会话，支持恢复和删除
- **浏览记录**：查看浏览过的菜谱记录
- **烹饪记录**：记录实际做过的菜品，包括烹饪日期、评分（1-5 星）、笔记、照片

**技术实现**：
- 后端：`app/api/v1/cook_history.py`
- 前端：`frontend/app/history/page.tsx` — 三个 Tab 切换

---

### 3.10 体征数据追踪

**入口**：API 接口

**功能描述**：
- 记录体重、体脂率、肌肉量、腰围等身体指标
- 查看历史趋势（默认 30 天，可选 7-365 天）
- 用于配合饮食调整和健身目标追踪

**技术实现**：
- 后端：`app/api/v1/body_metrics.py`
- 数据库：`BodyMetric` 模型

---

### 3.11 飞书集成

**入口**：`/profile` — 飞书设置区域

**功能描述**：
- **Webhook 配置**：每用户独立配置飞书机器人 Webhook 地址
- **连接测试**：发送测试消息验证配置是否正确
- **每日饮食报告**：推送到飞书群，包含：
  - 营养总览（热量、蛋白质/碳水/脂肪占比 + 进度条）
  - 三餐记录（按餐次分组，含食物名称和热量）
  - 健康评估（评分 + 评估详情）
- **菜谱分享**：将菜谱信息推送到飞书，附带视频教程链接
- **开关控制**：可随时开启/关闭飞书推送

**技术实现**：
- 后端：`app/api/v1/feishu.py`
- 前端：`frontend/components/FeishuSettings.tsx`
- 消息格式：飞书 Interactive Card（富文本卡片）

---

### 3.12 用户认证

**入口**：`/login` + `/register`

**功能描述**：
- 用户注册（用户名 + 邮箱 + 密码）
- 用户登录（用户名 + 密码）
- JWT Token 认证
- 头像上传（Base64 裁剪后存储）
- 退出登录（Token 失效）
- 速率限制（防止暴力破解）

**技术实现**：
- 后端：`app/api/v1/auth.py` + `app/auth.py`
- 密码加密：bcrypt
- Token：python-jose JWT
- 速率限制：内存滑动窗口（10 次/60 秒）

---

### 3.13 语音交互（兜底方案）

**功能描述**：
- **语音转文字**：通过 OpenAI Whisper API 识别用户语音输入
- **文字转语音**：通过 OpenAI TTS API 将 AI 回复合成为语音

**技术实现**：
- 后端：`app/api/v1/speech.py`
- 模型：whisper-1（STT）+ tts-1（TTS）

---

### 3.14 图片代理

**功能描述**：
- 代理外部图片 URL，解决浏览器 CORS 跨域问题
- URL 安全验证（防止 SSRF 攻击）
- 支持 OSS 上传（签名 URL + 直接上传两种方式）

**技术实现**：
- 后端：`app/api/v1/oss.py`
- 安全检查：`is_safe_image_url()` 过滤内网地址和危险协议

---

## 四、智能体功能详解

### 4.1 LangGraph Agent 架构

```
用户消息 → [Agent Node] → (需要工具?) → [Tool Node] → [Agent Node] → 流式输出
                ↓ (不需要)
              END
```

**Agent Node**：调用 LLM（豆包大模型）进行推理，决定是否需要调用工具
**Tool Node**：执行具体的工具调用，将结果返回给 Agent
**条件路由**：`should_continue` 检查 LLM 是否发出了工具调用请求

**工具列表**：
1. `fetch_dish_image` — 搜索/生成菜品图片
2. `bilibili_search` — 搜索 B 站烹饪教学视频
3. `rag_search` — 检索专业知识库（营养/菜谱/运动营养学）

### 4.2 RAG 混合检索系统

**三大知识库**：

| 知识库 | 内容 | 数据量 | 来源 |
|--------|------|--------|------|
| `nutrition_db` | 中国食物成分表 | 70+ 种常见食材 | 中国食物成分表第 6 版 |
| `recipe_db` | 中式菜谱知识 | 25+ 道经典菜品 | 内置常见家常菜 |
| `fitness_knowledge` | 运动营养学 | 8 个专题 | 增肌/减脂/训练营养 |

**检索流程**：
1. **查询扩展**：同义词映射（如"鸡胸"→"鸡胸肉 低脂 高蛋白 营养成分"）
2. **稠密检索**：BGE-small-zh-v1.5 向量相似度搜索（ChromaDB）
3. **稀疏检索**：BM25 关键词匹配（jieba 中文分词 + rank-bm25）
4. **加权融合**：`alpha * dense_score + (1-alpha) * bm25_score`（默认 alpha=0.6）
5. **阈值过滤**：score >= 0.15 的结果才返回

### 4.3 菜品图片获取策略

**三级图片获取**：

1. **Pexels/Unsplash 搜索**：中英文对照搜索 → 文本相关性打分 → 视觉模型验证
2. **AI 图片生成**：火山引擎 Seedream 模型生成 → 上传 OSS → MySQL 缓存
3. **降级方案**：搜索失败时返回占位提示

**图片验证**：
- 视觉模型批量验证候选图片是否确实是目标菜品
- 过滤泛化标签（restaurant、table、plate 等）
- 食物标签加分（food、dish、cuisine 等）

### 4.4 预生成优化

在 Agent 开始推理之前，系统会从用户消息中提取可能的菜名，提前并行执行：
- 预生成菜品图片
- 预搜索 B 站教学视频

这样 Agent 推理完成时，图片和视频已经准备好，显著减少用户等待时间。

### 4.5 上下文注入

每次对话，系统会自动注入以下上下文（作为 SystemMessage）：

1. **用户偏好**：过敏源（严禁）、饮食类型、口味偏好、家庭成员
2. **冰箱库存**：当前冰箱中的食材列表
3. **预生成内容**：提前搜索到的图片 URL 和视频链接

---

## 五、前端页面总览

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页/对话 | `/` | AI 智能对话，流式输出，图片上传 |
| 菜谱库 | `/recipes` | 菜谱收藏管理，搜索筛选，批量操作 |
| 营养追踪 | `/nutrition` | 拍照识别、饮食记录、健康评估 |
| 膳食规划 | `/meal-plan` | AI 生成一周膳食计划，手动编辑 |
| 冰箱管理 | `/fridge` | 食材库存管理，过期提醒 |
| 购物清单 | `/shopping-list` | 购物清单管理，勾选购买 |
| 口味偏好 | `/preferences` | 过敏源、饮食类型、口味、家庭成员 |
| 历史记录 | `/history` | 对话历史、浏览记录、烹饪记录 |
| 个人中心 | `/profile` | 用户信息、飞书集成、设置入口 |
| 登录 | `/login` | 用户登录 |
| 注册 | `/register` | 用户注册 |

---

## 六、改进方向

### 6.1 短期优化（P0-P1）

| 方向 | 说明 | 预估工时 |
|------|------|----------|
| **AI 主动推荐** | 识别用户状态（健身后/感冒/减脂期），主动推荐适合的菜品 | 2.5h |
| **营养目标追踪** | 结合用户设定的营养目标，实时显示完成进度 | 2h |
| **膳食计划手动编辑增强** | 支持拖拽调整餐次、替换菜品、调整份量 | 3h |
| **饮食趋势图表** | 按周/月展示热量和营养素趋势曲线 | 3h |

### 6.2 中期规划（P2）

| 方向 | 说明 |
|------|------|
| **多用户/家庭共享** | 支持家庭成员共用一个账号，各自记录饮食 |
| **菜谱社区** | 用户可上传和分享自己的菜谱 |
| **智能购物建议** | 根据膳食计划和库存差异，自动生成补货建议 |
| **OCR 营养标签识别** | 拍照识别食品包装上的营养成分表 |
| **微信小程序** | 开发微信小程序版本，降低使用门槛 |

### 6.3 长期愿景（P3）

| 方向 | 说明 |
|------|------|
| **健康设备联动** | 对接智能秤、运动手环等设备，自动同步体征数据 |
| **个性化饮食模型** | 基于用户长期饮食数据，训练个性化推荐模型 |
| **语音助手集成** | 接入小爱同学/天猫精灵，实现语音交互 |
| **食材溯源** | 对接生鲜电商平台，支持一键购买缺失食材 |
| **多语言支持** | 支持英文、日文等多语言界面 |

---

## 七、服务器部署

### 7.1 服务器信息

| 项目 | 值 |
|------|------|
| 云服务商 | 阿里云 ECS |
| 公网 IP | `47.108.69.229` |
| 操作系统 | Ubuntu (Debian) |
| 内存 | 2GB+ |
| 部署方式 | Docker Compose |

### 7.2 部署架构

```
用户浏览器
    ↓
Nginx (80/443)
    ↓
FastAPI (8001) ← 前端静态文件由 FastAPI 直接服务
    ↓
├── MySQL (业务数据 + Agent 检查点)
├── ChromaDB (向量数据库，本地持久化)
└── 阿里云 OSS (图片存储)
```

### 7.3 访问地址

| 服务 | 地址 |
|------|------|
| 前端页面 | `http://47.108.69.229` |
| API 接口 | `http://47.108.69.229/api/v1/` |
| 健康检查 | `http://47.108.69.229/api/v1/health` |
| API 文档 | `http://47.108.69.229/docs` |

### 7.4 环境变量

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `DATABASE_URL` | MySQL 连接地址 | ✅ |
| `DOUBAO_API_KEY` | 豆包大模型 API Key | ✅ |
| `DOUBAO_BASE_URL` | 豆包 API Base URL | ✅ |
| `DOUBAO_MODEL_NAME` | 豆包模型名称 | ✅ |
| `OSS_ACCESS_KEY_ID` | 阿里云 OSS Access Key | ✅ |
| `OSS_ACCESS_KEY_SECRET` | 阿里云 OSS Secret Key | ✅ |
| `OSS_ENDPOINT` | OSS 端点 | ✅ |
| `OSS_BUCKET` | OSS Bucket 名称 | ✅ |
| `JWT_SECRET` | JWT 签名密钥 | ✅ |
| `PEXELS_API_KEY` | Pexels 图片搜索 API Key | 可选 |
| `UNSPLASH_ACCESS_KEY` | Unsplash 图片搜索 Key | 可选 |
| `FEISHU_WEBHOOK_URL` | 飞书全局 Webhook 地址 | 可选 |

---

## 八、API 接口总览

| 模块 | 前缀 | 主要接口 |
|------|------|----------|
| 认证 | `/api/v1/auth` | `POST /register`, `POST /login`, `GET /me`, `POST /logout` |
| 对话 | `/api/v1` | `POST /chat/stream`, `GET /chat/messages`, `DELETE /chat/messages` |
| 菜谱 | `/api/v1/recipes` | `POST /`, `GET /`, `GET /search`, `PUT /{id}`, `DELETE /{id}`, `POST /batch-create` |
| 营养 | `/api/v1/nutrition` | `POST /records`, `GET /records`, `POST /analyze-photo`, `GET /health-eval/{date}`, `GET /summary/{date}` |
| 膳食计划 | `/api/v1` | `POST /meal-plan/generate` |
| 购物清单 | `/api/v1/shopping` | `POST /`, `GET /`, `PUT /{id}`, `PATCH /{id}/items/{item_id}/toggle` |
| 食材库存 | `/api/v1/ingredients` | `GET /`, `POST /`, `PUT /{id}`, `DELETE /{id}` |
| 偏好设置 | `/api/v1/preferences` | `GET /`, `PUT /` |
| 烹饪记录 | `/api/v1/cook-history` | `GET /`, `POST /`, `DELETE /{id}` |
| 体征数据 | `/api/v1/body-metrics` | `POST /`, `GET /`, `DELETE /{id}` |
| 飞书 | `/api/v1/feishu` | `GET /config`, `POST /test`, `POST /daily-report`, `POST /recipe-share` |
| 语音 | `/api/v1` | `POST /speech/transcribe`, `POST /speech/synthesize` |
| OSS | `/api/v1` | `POST /oss/upload`, `GET /oss/proxy-image`, `GET /oss/presign` |
