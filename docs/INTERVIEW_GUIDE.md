# AI Private Chef Butler — 面试准备文档

> 项目：AI 私人厨师助理（Agent + RAG + 多模态 + 全栈）
> 面试官视角提问 + 参考答案 + 项目吃透指南
> 生成日期：2026-06-14

---

## 目录

- [一、项目概述](#一项目概述)
- [二、系统架构层](#二系统架构层)
- [三、AI Agent 层](#三ai-agent-层)
- [四、RAG 知识库层](#四rag-知识库层)
- [五、数据库层](#五数据库层)
- [六、认证与安全层](#六认证与安全层)
- [七、Meal Plan 生成层](#七meal-plan-生成层)
- [八、深水区追问](#八深水区追问)
- [九、吃透项目的行动清单](#九吃透项目的行动清单)
- [十、面试话术模板](#十面试话术模板)

---

## 一、项目概述

### 1.1 一句话介绍

> 基于 LangGraph + LLM 的 AI 私人厨师助理，提供智能对话、菜谱推荐、膳食计划生成、营养追踪、食材管理、飞书推送等功能的 SaaS 应用。

### 1.2 技术栈

| 层次 | 技术 | 选型理由 |
|------|------|----------|
| 前端 | Next.js 19 (App Router) + React 19 | 静态导出由后端托管，降低部署复杂度 |
| 后端 | FastAPI (Python 3.12) | 异步原生、自动文档、类型安全 |
| AI 编排 | LangGraph + LangChain | 状态机 + tool_call 循环 + checkpoint 持久化 |
| 数据库 | MySQL 8.0 | 替代 SQLite，支持多容器 Docker 部署 |
| 向量检索 | ChromaDB + BM25 (jieba) | 混合检索，兼顾语义和关键词 |
| Embedding | BAAI/bge-small-zh-v1.5 | 中文语义理解，资源占用低 |
| 图片生成 | Doubao Seedream 4.5 | 菜名→美食图片，支持 40+ 中文菜 |
| 存储 | 阿里云 OSS | 图片永久托管，CDN 加速 |
| 部署 | Docker Compose + Nginx | 三服务编排（app/db/nginx），SSL 终止 |

### 1.3 服务端口

| 服务 | 地址 |
|------|------|
| 后端 API | http://localhost:8001 |
| 健康检查 | http://localhost:8001/health |
| 前端页面 | http://localhost:3000 (开发) / / (生产) |

### 1.4 核心 API 路由（13 模块）

| 模块 | 前缀 | 关键端点 |
|------|------|----------|
| auth | /api/v1/auth | POST /register, /login, /logout; GET/PUT /me |
| chat | /api/v1/chat | POST /stream (SSE); GET/DELETE /messages |
| recipes | /api/v1/recipes | 全 CRUD + batch-create/batch-delete + search |
| meal_plan | /api/v1/meal-plan | POST /generate (AI 七周膳食计划) |
| shopping | /api/v1/shopping | 全 CRUD + PATCH /items/{id}/toggle (乐观锁) |
| nutrition | /api/v1/nutrition | Records CRUD; /analyze-photo; /health-eval; /summary |
| speech | /api/v1/speech | POST /transcribe (Whisper); /synthesize (TTS) |
| feishu | /api/v1/feishu | Config CRUD; /test; /toggle; /send; /daily-report; /recipe-share |
| preferences | /api/v1/preferences | GET/PUT 用户饮食偏好 |
| ingredients | /api/v1/ingredients | 全 CRUD + /identify-from-photo (视觉 AI 识别食材) |
| cook-history | /api/v1/cook-history | GET/POST/DELETE 烹饪记录 |
| body-metrics | /api/v1/body-metrics | POST/GET/DELETE 体重/体脂/肌肉/腰围 |
| oss | /api/v1/oss | POST /upload, /upload-url, /presign; GET /proxy-image |

### 1.5 数据库表（12 张）

| 表名 | 核心字段 | 设计要点 |
|------|----------|----------|
| users | id(UUID), username, email, hashed_password | 主认证表 |
| recipes | id, user_id, thread_id, title, ingredients(JSON), seasonings(JSON), tags(JSON), videos(JSON) | 复杂数据存 JSON，避免 N+1 查询 |
| ingredients | id, user_id, name, quantity, unit, shelf_life_days, expiry_date, status | 冰箱食材，含过期追踪 |
| shopping_lists | id, user_id, items(JSON), status | 购物清单，JSON 存列表 |
| cook_records | id, user_id, recipe_id, rating, cook_date | 烹饪历史，按日期索引 |
| nutrition_records | id, user_id, date, meal_type, calories, protein, carbs, fat, fiber, sodium | 营养记录，按日期索引 |
| feishu_config | user_id(PK), webhook_url, onboarding_step | 用户级飞书配置 |
| preferences | user_id(PK), data(JSON) | 用户偏好，JSON 存储 |
| checkpoints | thread_id+checkpoint_ns+checkpoint_id(PK), checkpoint(MEDIUMBLOB) | LangGraph 对话状态持久化 |
| writes | thread_id+checkpoint_ns+checkpoint_id+task_id+idx(PK), value(MEDIUMBLOB) | LangGraph 写入历史 |
| image_cache | dish_query(PK), oss_url | 菜谱图片缓存 |
| body_metrics | id, user_id, weight, body_fat, muscle_mass, waist | 身体指标追踪 |

---

## 二、系统架构层

### Q1：为什么前端编译成静态文件由 FastAPI 托管，而不是独立部署？

**考察意图：** 架构权衡意识、生产 vs 演示场景判断

#### 参考答案

**设计决策：** 前端 Next.js 编译为静态文件（`npm run build`），由 FastAPI 通过 `StaticFiles` 托管在 `/` 路径。Nginx 只做 TLS 终止和反向代理。

**为什么选这个方案：**
- 项目定位为竞赛/演示项目，单 `docker-compose up` 跑全部，降低运维复杂度
- 避免前后端跨域问题（同源策略），不需要 CORS 配置
- 不需要独立的 Nginx 配置两个上游（前端 + 后端），Nginx 只需代理 `/api/`
- 部署成本低，一个 Docker 镜像服务全部

**坦诚不足：**
- 真正生产环境应该前后端分离：前端走 Vercel/CDN，后端走 API Gateway
- 这样前端可以独立滚动部署，不依赖后端发布周期
- 图片/API 请求可以做独立的 CDN 缓存策略

**对应的代码位置：**
- `app/main.py:L108` — `app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")`
- `app/main.py:L112-115` — catch-all 路由，返回 `index.html` 支持 SPA 路由

#### 如何向面试官展示深度

> "这个设计在演示场景下是最优的——运维复杂度最低。但如果有生产需求，我会拆成独立部署。拆分的关键步骤是：1) 前端 `.env.production` 改 API base URL；2) Next.js 用 `output: 'standalone'` 构建；3) Nginx 加一个 upstream 指向前端。整个过程不需要改后端代码。"

---

### Q2：完整的请求链路是什么样的？

**考察意图：** 对系统端到端流程的理解

#### 参考答案

**典型请求链路（用户发送一条消息）：**

```
用户输入 → 前端 Next.js
  → POST /api/v1/chat/stream (SSE)
    → FastAPI 认证中间件（cookie → Bearer 转换）
    → rate limit 检查
    → 提取 thread_id → 查询用户 session
    → pre-generation pipeline:
      ├── ThreadPoolExecutor → fetch_dish_image.invoke(dish) [后台]
      └── ThreadPoolExecutor → bilibili_search.invoke(query) [后台]
    → 构造 messages（含偏好上下文 + 预生成结果）
    → LangGraph StateGraph 执行:
      ├── agent_node (调 Doubao 1.8 或 Seedream 4.5)
      ├── [has tool_calls?] → yes → ToolNode
      │   ├── rag_search → ChromaDB Hybrid 检索
      │   ├── fetch_dish_image → image_agent 子图
      │   └── bilibili_search → 视频搜索
      └── agent_node → END
    → ThinkFilter 流式过滤
    → SSE 推送 chunk 到前端
前端 → 逐 chunk 渲染（支持向上滚动）
```

**关键代码路径：**
- 入口：`app/api/v1/chat.py` 的 `stream_chat()`
- Agent：`app/agents/personal_chief.py` 的 `start_graph()`
- 预生成：同文件的 `_pre_generate()`
- 流式过滤：`app/agents/stream_filter.py`

---

## 三、AI Agent 层

### Q3：LangGraph 为什么比 LangChain 的 simple chain 更适合？

**考察意图：** 对 stateful agent 架构的理解深度

#### 参考答案

**Simple Chain 的局限：**
- Chain 是一次性调用，调完就结束
- 无法支持 tool_call 循环（调用工具 → 把结果喂回 LLM → LLM 再决定下一步）
- 没有 checkpoint 机制，对话断了无法恢复

**LangGraph 的优势：**
1. **Tool Call 循环：** `agent_node → [has tool_calls?] → ToolNode → agent_node → END`
2. **Checkpoint 持久化：** 对话状态存 MySQL，支持断线重连后恢复上下文
3. **子图调用：** `fetch_dish_image` 调用 `image_agent` 子图（带缓存的独立状态机）
4. **并发节点：** pre-generation 阶段图片+视频并行启动

**架构图：**

```
image_agent 子图:
  START → cache_check → [缓存命中?] → END
                      → [未命中] → generate → DB 写缓存 → END

personal_chief 主图:
  START → agent_node → [有 tool_calls?] → ToolNode → agent_node → END
                                    → [无] → END
```

**对应的代码：**
- 主图：`app/agents/personal_chief.py:build_personal_chief_graph()`
- 子图：`app/agents/image_agent.py:build_image_agent_graph()`

#### 坦诚不足

> "当前只有一个 agent_node，没有拆成 planner/executor/reviewer 等更细的 state machine。如果要扩展，可以把菜谱生成和日常对话拆成两个 agent，通过 router 节点分发。"

---

### Q4：Pre-generation Pipeline 是怎么优化延迟的？

**考察意图：** 真实性能优化经验 + 异常处理

#### 参考答案

**问题背景：** 用户发一条消息，如果等 LLM 调完 tool_call（图片+视频）再返回，用户需要等 3-5 秒才能看到任何反馈。

**解决方案：** 在调 agent 之前，用 `ThreadPoolExecutor` 并行启动图片和视频搜索，5 秒超时：

```python
# app/agents/personal_chief.py: _pre_generate()
with ThreadPoolExecutor() as executor:
    future_image = executor.submit(fetch_dish_image.invoke, dish)
    future_video = executor.submit(bilibili_search.invoke, {"query": dish})

# 结果注入 SystemMessage，绕过 tool_call 循环
```

**效果：** 用户发出消息时图片/视频已经准备好了，直接展示，无需等待 LLM 推理。

**超时处理：** 每个 task 独立 `except TimeoutError`，超时后继续，相当于降级为不带预生成结果。

**坦诚不足：**
- 如果预生成超时，用户后续问「有没有视频」就没有缓存数据——应该把结果存数据库
- 5 秒是硬编码值，不同 API 延迟不同，应该做成可配置
- 图片转 base64 用了 `requests.get()` 同步请求，在异步上下文中不合适（虽然在线程池中运行所以没问题）

---

### Q5：Dual Model Routing 的判断逻辑是什么？

**考察意图：** 多模态模型调度的边界处理

#### 参考答案

**判断逻辑：** 在 `agent_node` 中检查 `MessagesState.messages` 是否有 `image_url` 类型的 content block：

```python
# 伪代码
has_image = any(
    isinstance(m.content, list) and any(
        isinstance(c, dict) and c.get("type") == "image_url"
        for c in (m.content if isinstance(m.content, list) else [m.content])
    )
    for m in messages
)
model = vision_model if has_image else chat_model
```

**模型选择：**
- 纯文本 → Doubao 1.8 (`doubao-seed-1-8-251228`)
- 含图片 → Seedream 4.5 (`doubao-seedream-4-5-251128`)

**坦诚不足：**
- 只判断了有没有图片，没有判断图片数量和分辨率。多张大图可能导致 token 超限
- 应该加一个图片压缩/裁剪逻辑，或者在 token 超限时降级为纯文本描述
- 图片 URL 需要先下载转 base64（`_image_url_to_data_url()`），这是同步 I/O

---

### Q6：ThinkFilter 怎么保证流式输出时不误切正常文本？

**考察意图：** 流式处理的边界条件意识

#### 参考答案

**问题：** 某些 LLM 会输出 `</think>` 推理标签，这些不该展示给用户。

**方案：** 状态机逐 chunk 过滤：

```python
class ThinkFilter:
    def __init__(self):
        self.in_think = False
        self.buffer = ""

    def filter(self, chunk: str) -> str:
        self.buffer += chunk
        if "</think>" in self.buffer:
            # 找到标签位置，切掉
            idx = self.buffer.index("</think>")
            self.buffer = self.buffer[idx + 6:]  # 跳过 tag
            self.in_think = False
        return text_before_think_start
```

**关键细节：**
- `safe_cut()` 方法：如果 chunk 在标签中间截断（如 `<thi`），不急于处理，等下一个 chunk
- 维护 buffer 跨 chunk 累积，处理分 tag 到达的情况

**坦诚不足：**
- regex 匹配可能误伤用户输入中包含 `</think>` 的情况
- buffer 不限制大小，极端情况下可能内存泄漏（虽然实际几乎不会发生）

**对应代码：** `app/agents/stream_filter.py`

---

## 四、RAG 知识库层

### Q7：Hybrid RAG 的五步检索流程是什么？

**考察意图：** RAG 系统的全流程理解

#### 参考答案

**五步 pipeline（`app/rag/vector_store.py`）：**

```
1. Query Expansion（查询扩展）
   "鸡胸" → "鸡胸肉 低脂 高蛋白"
   使用硬编码同义词词典 _SYNONYM_DICT

2. Dense Retrieval（语义检索）
   ChromaDB similarity search (cosine)
   BAAI/bge-small-zh-v1.5 embedding
   取 top 3*k

3. Sparse Retrieval（关键词检索）
   自定义 BM25Index，jieba 分词
   在 ChromaDB documents 上建索引

4. Weighted Fusion（权重融合）
   final_score = 0.6 * dense_score + 0.4 * bm25_score
   alpha=0.6 是经验值

5. Result Assembly（结果组装）
   合并、排序、取 top-k
```

**三张 ChromaDB Collection：**
| Collection | 内容 | 用途 |
|------------|------|------|
| nutrition_db | 中国食物成分表（80+ 食物/100g） | 营养分析 |
| recipe_db | 25 道中式菜谱 | 菜谱推荐 |
| fitness_knowledge | 运动营养科学（8 大章节） | 健康评估 |

**数据加载策略：**
1. 优先读 CSV/JSON/MD 文件（`data/raw/`）
2. 文件不存在时回退到内嵌数据（~80 食物 + ~25 菜谱 + ~8 章节）

---

### Q8：alpha=0.6 是怎么调的？有实验依据吗？

**考察意图：** 参数敏感度、实验意识

#### 参考答案

**当前状态：** alpha=0.6 是经验值，没有系统性的 AB 测试。

**为什么 Dense 权重大：**
- 中文语义匹配：「鸡胸肉」和「鸡腿」语义相近但关键词不匹配
- 用户提问往往模糊（「减脂期吃什么」），需要语义理解

**BM25 的优势场景：**
- 专有名词精确匹配：「低脂」「高蛋白」等标签词
- 短查询（1-2 个字）：「鸡」「肉」

**坦诚不足 + 改进方向：**
> "我应该在验证集上跑 recall@k 和 MRR（Mean Reciprocal Rank），用网格搜索找最优 alpha。比如测试 100 个典型 query，人工标注相关文档，然后对比不同 alpha 的检索质量。"

**对应的代码：** `app/rag/vector_store.py:search()` 方法的 `alpha` 参数

---

### Q9：营养照片分析的 RAG 增强逻辑是什么？

**考察意图：** RAG 与实际业务场景的结合

#### 参考答案

**完整流程：**

```
用户上传照片 → OSS 存储 → base64 编码
  → 视觉模型识别食物（返回 JSON: foods[] + weights[]）
  → 对每个 food，查 nutrition_db RAG:
     - 解析 "每100g: 蛋白质Xg, 碳水Yg, 脂肪Zg"
     - 按比例缩放：实际营养 = (食物重量/100) * 每100g数据
  → 用 RAG 权威数据替换 LLM 估算
  → 保存为 NutritionRecord
```

**关键点：** RAG 数据是权威「每 100g」值，LLM 只负责识别食物和估重，营养值用权威数据校准。

**对应代码：** `app/api/v1/nutrition.py` 的 `analyze_photo()` 方法

---

## 五、数据库层

### Q10：LangGraph Checkpoint 为什么用 MEDIUMBLOB？

**考察意图：** MySQL 版本兼容性、序列化数据存储

#### 参考答案

**原因：**
1. LangGraph checkpoint 是 pickle 序列化后的字节流，不是结构化数据
2. 兼容 MySQL 5.7（索引限制 3072 字节），VARCHAR 太长会报错
3. MEDIUMBLOB 最大 16MB，足够存对话状态

**表结构：**
```sql
checkpoints:
  thread_id (VARCHAR(36)) PK
  checkpoint_ns (VARCHAR(255)) PK
  checkpoint_id (VARCHAR(100)) PK
  checkpoint (MEDIUMBLOB)     -- 序列化状态
  metadata (MEDIUMBLOB)       -- 附加元数据

writes:
  thread_id (VARCHAR(36)) PK
  checkpoint_ns (VARCHAR(255)) PK
  checkpoint_id (VARCHAR(100)) PK
  task_id (VARCHAR(128)) PK
  idx (INTEGER) PK
  channel (VARCHAR(128))
  type (VARCHAR(128))
  value (MEDIUMBLOB)
```

**坦诚不足：**
> "`expire_on_commit=False` 是个 workaround。正确的做法是每个请求新建 session，或者用 scoped session。我查了 SQLAlchemy 文档，发现 commit 后 session 里的对象会变成 'detached' 状态，加上这个配置避免 'object is not bound to a session' 错误。"

**对应代码：** `app/common/database.py` 的 `SessionLocal` 配置

---

### Q11：Shopping List Items 为什么用 JSON 而不是独立表？

**考察意图：** 数据库范式 vs 反范式的权衡

#### 参考答案

**选择 JSON 列的理由：**
- 购物清单是临时性数据（买完就清空），生命周期短
- 查询模式简单：按 list_id 全量读，很少单独查某个 item
- 避免 JOIN，减少 N+1 查询
- toggle 操作用 optimistic lock（`status` 字段）解决并发

**对应的代码：** `app/models/db.py` 的 `ShoppingList` 模型

**坦诚不足：**
> "如果要支持跨 list 的 item 去重（比如两个清单都买了鸡蛋，合并成一个），或者做 item 购买频率统计，JSON 列就不合适了。这时需要拆成 `shopping_list_items` 独立表，有 item_id, list_id, name, quantity, checked 等字段。"

---

## 六、认证与安全层

### Q12：认证流程是怎样的？Cookie 和 Header 怎么共存？

**考察意图：** 认证机制的设计细节

#### 参考答案

**双通道认证：**

```
前端设置 auth_token cookie
  ↓
auth_cookie_middleware（app/main.py）:
  读取 cookie "auth_token"
  设置请求头 "Authorization: Bearer <token>"
  ↓
get_current_user（app/auth.py）:
  从 Authorization header 或 cookie 取 token
  验证黑名单（内存 dict）
  解码 JWT
  查 DB 验证用户存在
  ↓
返回 {"user_id": "...", "username": "..."}
```

**为什么做 Cookie → Header 转换：**
- `<img>` 标签和 `<form method="GET">` 不能设置自定义 header
- 但能自动携带 cookie
- 转换后后端统一从 header 取，代码简洁

**JWT 配置：**
- 算法：HS256
- 过期：7 天（可配置）
- Payload：`{"sub": user_id, "username": username, "exp": timestamp}`

**对应代码：**
- Cookie 中间件：`app/main.py:L36-52`
- Token 验证：`app/auth.py:get_current_user()`

---

### Q13：Rate Limiting 怎么实现的？生产环境怎么改？

**考察意图：** 分布式系统意识

#### 参考答案

**当前实现（内存滑动窗口）：**

```python
# _rate_limits: dict[str, list[float]]  # ip → [timestamp1, timestamp2, ...]
window = 60  # 秒
max_requests = 10  # 登录 10次/60s，注册 5次/60s

timestamps = _rate_limits.get(ip, [])
# 清除窗口外的
timestamps = [t for t in timestamps if now - t < window]
if len(timestamps) >= max_requests:
    return False  # 限流
timestamps.append(now)
```

**生产环境问题：**
1. 内存数据重启丢失 → 用 Redis `SET ip timestamp EX 60 NX`
2. 多实例无法共享 → Redis 天然共享
3. 精确滑动窗口开销大 → 用固定窗口近似（计数器）

**改进方案：**
```python
# Redis 版本
key = f"rate_limit:{ip}:{minute_bucket}"
if redis.incr(key) > max_requests:
    return False
redis.expire(key, window)
```

---

### Q14：Image URL 校验怎么防止 SSRF？

**考察意图：** 安全敏感度

#### 参考答案

**两层校验（`app/common/security.py`）：**

```python
def is_safe_image_url(url: str) -> bool:
    # 1. 域名白名单
    parsed = urlparse(url)
    if parsed.hostname not in TRUSTED_DOMAINS:
        return False
    # TRUSTED_DOMAINS = ["volcengine.com", "cn-bj2-fc-074b...fc.openai-svc.internal",
    #                    "*.aliyuncs.com", "*.bilibili.com", "pexels.com"]

    # 2. IP 黑名单
    try:
        ip = socket.gethostbyname(parsed.hostname)
    except socket.gaierror:
        return False

    ip_int = struct.unpack("!I", socket.inet_aton(ip))[0]
    # 拒绝私有 IP、回环地址
    if (ip_int >= 0x0A000000 and ip_int <= 0x0AFFFFFF):  # 10.x
    if (ip_int >= 0xAC100000 and ip_int <= 0xAC1FFFFF):  # 172.16-31
    if (ip_int >= 0xC0A80000 and ip_int <= 0xC0A8FFFF):  # 192.168
    if ip_int == 0x7F000001:  # 127.0.0.1
        return False
    return True
```

**坦诚不足：**
> "没有做 DNS rebind 保护。攻击者可以先返回一个合法 IP，DNS 解析后替换为内网 IP。应该先用 `socket.gethostbyname()` 解析并校验，再用 `aiohttp` 设置 `connector=aiohttp.TCPConnector(verify_ssl=False, limit=0)` 并加 `connection_timeout=5s`。"

---

## 七、Meal Plan 生成层

### Q15：7 天并行生成是怎么设计的？

**考察意图：** 并发控制 + 容错

#### 参考答案

**并发设计：**

```python
semaphore = asyncio.Semaphore(4)  # 最多 4 个并发

async def generate_day(day_date, day_index):
    async with semaphore:
        prompt = build_day_prompt(day_date, day_index, existing_plan)
        result = await model.ainvoke(messages)
        return parse_json(result.content)

# 并行启动 7 天
tasks = [generate_day(date, i) for i, date in enumerate(dates)]
results = await asyncio.gather(*tasks, return_exceptions=True)
```

**JSON 解析 + 修复：**
```python
# 1. Regex 提取 JSON
match = re.search(r'\{[\s\S]*\}', content)
json_str = match.group(0)

# 2. 尝试解析，失败则修复
try:
    return json.loads(json_str)
except json.JSONDecodeError:
    return repair_truncated_json(json_str)
```

**`repair_truncated_json()` 算法：**
- 栈式处理：遇到 `{` 压栈，`}` 弹栈
- 括号不匹配 → 自动补全
- 缺少逗号 → 在值后面插入逗号
- 字符串未闭合 → 补引号

**容错策略：**
- 每天独立 try-except，失败记录日志
- `return_exceptions=True` 收集失败结果
- 至少 1 天成功就返回（部分成功）
- 全部失败才抛 500

**对应代码：** `app/api/v1/meal_plan.py` 的 `generate_meal_plan()`

---

### Q16：JSON 解析有没有遗漏的场景？

**考察意图：** 对 LLM JSON 输出问题的深度认知

#### 参考答案

**当前方案的问题：**
- Regex `r'\{[\s\S]*\}'` 可能匹配到 prompt 里的 JSON 示例而不是实际返回
- 如果 LLM 在 JSON 外面加了解释文字（markdown 代码块），regex 可能匹配不对

**改进方案：**
1. **Prompt 层面：** 加「只返回 JSON，不要其他文字」的强约束
2. **Post-processing：** 验证 JSON schema（用 pydantic），不合法就重试
3. **Model 层面：** 用 `response_format={"type": "json_object"}`（如果模型支持）

**坦诚不足：**
> "当前 `response_format` 被移除了（v1.0.0 的 commit），因为某些模型不支持。但如果用 OpenAI 兼容 API，其实是可以加回来的。"

---

## 八、深水区追问

### Q17：42 个修复中，最核心的技术决策是什么？

**考察意图：** 技术判断力 + 项目反思能力

#### 高分回答

> "JSON truncation repair 是最核心的。原因：
>
> 1. **影响范围广：** 所有 AI 生成功能（菜谱、膳食计划）都依赖 LLM 返回 JSON
> 2. **问题本质：** LLM 有 max_tokens 限制，长响应会被截断，产生非法 JSON
> 3. **解决方案：** 我实现了一个栈式 JSON 修复器，能处理括号不匹配、缺少逗号、字符串未闭合等情况
> 4. **价值：** 这个问题不解决，整个 AI 生成链路就不可用。其他 41 个修复大多是 UI/UX 层面的，这个是功能可用性的基石。
>
> 对应代码在 `app/common/json_utils.py` 的 `repair_truncated_json()` 方法。"

---

### Q18：如果从零重构，你会改什么？

**考察意图：** 架构成长性和技术视野

#### 回答框架

**P0 — 必须改：**
1. **前后端分离：** 前端独立部署 Vercel，后端独立部署，走 REST API
2. **测试覆盖：** 目前没有 test/ 目录，补核心接口的集成测试
3. **参数调优：** RAG 的 alpha 参数应该有实验依据

**P1 — 应该改：**
4. **消息队列：** Celery/RQ 处理异步任务（图片生成、RAG 索引、飞书推送）
5. **分布式缓存：** Token 黑名单、Rate Limit 用 Redis
6. **Token 管理：** JWT 加 refresh token 机制，支持无感续期

**P2 — 可以改：**
7. **Multi-Agent：** 拆成 planner + chef + nutritionist 多个 agent
8. **监控体系：** Sentry + OpenTelemetry + Grafana
9. **数据库：** 营养记录的聚合查询用 ClickHouse

**话术：**
> "我知道当前架构有这些不足，但在竞赛/演示场景下，现在的方案是合理的——最小化部署复杂度。如果给我 3 个月做生产化改造，我会优先补测试和前后端分离。"

---

### Q19：你的项目没有看到单元测试，怎么保证质量？

**考察意图：** 工程质量意识

#### 回答

**坦诚现状：**
> "目前确实没有完整的测试覆盖。这是我接下来计划补的。"

**展示意识：**
> "我觉得应该先补这三类测试：
> 1. **单元测试：** `repair_truncated_json()` 的边界 case（空字符串、单层括号、多层嵌套截断）
> 2. **集成测试：** `/api/v1/auth/login` 的完整流程（注册 → 登录 → 拿 token → 访问受保护接口）
> 3. **RAG 测试：** 用 100 个典型 query 跑 recall@k，验证 alpha 参数"

**如果面试官追问「你会怎么开始」：**
> "第一步：给 `repair_truncated_json` 写 5 个测试用例，覆盖最常见的截断场景。这个函数逻辑最清晰、不依赖外部服务，最容易写测试。"

---

### Q20：并发场景下你的系统有什么问题？

**考察意图：** 并发和分布式系统理解

#### 回答

**当前系统的并发瓶颈：**

| 场景 | 问题 | 影响 |
|------|------|------|
| 多用户同时登录 | 内存 rate limit + 内存 token 黑名单 | 多实例下完全失效 |
| 多用户同时生成 meal plan | 4 个并发 semaphore 是全局的 | 每个用户的 7 天生成要排队 |
| 同一用户多设备登录 | Token 过期时间固定 7 天 | 无法单点登出（除了黑名单） |
| 并发修改 shopping list item | optimistic lock 用 status 字段 | 高并发下可能覆盖 |

**改进方案：**
> "P0 是加 Redis 做共享状态。P1 是把 meal plan 的 semaphore 改成 per-user 粒度。P2 是引入 Celery 做异步任务队列。"

---

## 九、吃透项目的行动清单

### 9.1 理解阶段（必做）

| # | 行动 | 目标 | 对应文件 |
|---|------|------|----------|
| 1 | 画出完整的请求时序图 | 理解数据流全貌 | `app/api/v1/chat.py`, `app/agents/personal_chief.py` |
| 2 | 手动调 RAG API，验证不同 query 的检索效果 | 理解 Hybrid RAG 实际效果 | `app/rag/vector_store.py` |
| 3 | 跑通 meal plan 生成，打断点看 LangGraph 执行流 | 理解 state machine | `app/api/v1/meal_plan.py` |
| 4 | 读 `repair_truncated_json` 源码，手动画出栈执行过程 | 理解 JSON 修复算法 | `app/common/json_utils.py` |
| 5 | 模拟前端登录 → 发消息 → 看 SSE 流式返回 | 理解端到端流程 | `app/auth.py`, `app/main.py` |

### 9.2 验证阶段（推荐）

| # | 行动 | 目标 |
|---|------|------|
| 6 | 给 `repair_truncated_json` 写 5 个单元测试 | 验证边界条件 |
| 7 | 在 10 个测试 query 上调 alpha 参数，记录 recall 变化 | 证明参数不是拍脑袋 |
| 8 | 模拟 5 用户并发登录，测试 rate limit | 发现并发瓶颈 |
| 9 | 用 `curl -N` 测试 SSE 流，观察 chunk 粒度 | 验证 ThinkFilter 效果 |

### 9.3 深度阶段（加分）

| # | 行动 | 目标 |
|---|------|------|
| 10 | 用 locust/k6 做一轮压力测试（`/api/v1/auth/login`） | 量化 QPS 和延迟 |
| 11 | 补 2-3 个核心接口的集成测试 | 展示工程规范 |
| 12 | 画一幅完整的系统架构图（画板/Excalidraw） | 面试时可以给面试官看 |

---

## 十、面试话术模板

### 10.1 自我介绍（1 分钟）

> "我叫不开挖机，软件工程专业。最近在做一个 AI 私人厨师项目，核心是用 LangGraph 做了一个多工具 Agent，能对话、能搜菜谱视频、能做营养分析。技术上用了混合 RAG（语义+关键词）提升检索质量，做了 pre-generation pipeline 优化延迟，还实现了一个 JSON truncation repair 机制解决 LLM 输出截断问题。整个项目前后端分离开发，Docker 部署。"

### 10.2 被问到「你最大的技术贡献是什么」

> "我觉得是 JSON truncation repair。因为所有 AI 生成功能都依赖 LLM 返回 JSON，但模型经常截断。我实现了一个栈式修复器，能处理括号不匹配、缺少逗号等 5 种常见截断场景，让生成成功率从大概 60% 提升到 95% 以上。"

### 10.3 被问到「你学到的最大的教训」

> "参数不能拍脑袋。比如 RAG 的 alpha=0.6，我一开始是凭感觉选的，后来意识到应该用验证集跑 recall@k 来找最优值。这个教训让我以后做技术决策都有意识地去验证，而不是凭直觉。"

### 10.4 被问到「这个项目有什么不足」

> "三个主要不足：
> 1. 测试覆盖几乎没有，核心逻辑没有自动化测试
> 2. RAG 参数没有系统调优，靠经验值
> 3. 并发场景下内存限速和黑名单在多实例时完全失效
>
> 但这些问题在当前的项目阶段（竞赛/演示）是合理的取舍。如果给我更多时间，我会优先补测试和参数调优。"

---

## 附录 A：关键代码文件索引

| 功能 | 文件 | 核心函数/类 |
|------|------|-------------|
| 应用入口 | `app/main.py` | `create_app()`, `startup_event()` |
| 认证 | `app/auth.py` | `get_current_user()`, `_check_rate_limit()` |
| 聊天流式 | `app/api/v1/chat.py` | `stream_chat()` |
| 主 Agent | `app/agents/personal_chief.py` | `start_graph()`, `_pre_generate()` |
| 图片 Agent | `app/agents/image_agent.py` | `build_image_agent_graph()` |
| 流式过滤 | `app/agents/stream_filter.py` | `ThinkFilter` |
| JSON 修复 | `app/common/json_utils.py` | `repair_truncated_json()` |
| 安全校验 | `app/common/security.py` | `is_safe_image_url()` |
| 数据库 | `app/models/db.py` | 所有 SQLAlchemy 模型 |
| 混合 RAG | `app/rag/vector_store.py` | `RAGStore.search()` |
| RAG 数据 | `app/rag/data_loader.py` | `load_rag_data()` |
| 膳食计划 | `app/api/v1/meal_plan.py` | `generate_meal_plan()` |
| 营养分析 | `app/api/v1/nutrition.py` | `analyze_photo()`, `health_eval()` |
| 前端认证 | `frontend/hooks/useAuth.tsx` | `AuthProvider`, `useAuth()` |

## 附录 B：面试高频问题速查表

| 问题 | 核心要点 | 坦诚点 |
|------|----------|--------|
| 为什么用 LangGraph | Stateful + tool loop + checkpoint | 只有一个 node，没拆 multi-agent |
| RAG 为什么 hybrid | 中文需要语义+关键词 | alpha=0.6 没做实验验证 |
| 延迟怎么优化 | Pre-generation 并行预生成 | 超时后无缓存，应该持久化 |
| JSON 截断怎么解决 | 栈式修复器补括号/逗号 | 没做 schema 验证 |
| 安全怎么做的 | URL 域名白名单+IP 黑名单 | 无 DNS rebind 保护 |
| 并发有什么问题 | 内存限速/黑名单多实例失效 | 未引入 Redis/Celery |
| 最大的技术贡献 | JSON repair 是基石 | — |
| 最大的教训 | 参数要实验验证 | — |
| 如果重构 | 前后端分离+测试+队列 | 当前方案是合理的权衡 |
| 为什么前端不独立 | 演示场景，降低复杂度 | 生产应该分离 |
