# AI 私人厨师 — AI Private Chef Butler

智能厨房助手：AI 对话推荐菜谱、拍照识别营养、一周膳食规划、购物清单生成。

## 功能

| 模块 | 功能 |
|------|------|
| 💬 **AI 智能对话** | 文字描述需求 / 拍照识别食材 → AI 推荐菜谱，支持流式输出 |
| 📸 **拍照营养分析** | 拍食物照片 → AI 识别菜品 + 估算热量/蛋白质/碳水/脂肪 |
| 📅 **膳食规划** | 一键生成一周 21 餐计划，可选仅生成早/午/晚餐 |
| 🛒 **购物清单** | 从膳食计划自动汇总食材采购清单 |
| 🧊 **冰箱管理** | 记录库存食材，AI 优先消耗临近过期食材 |
| 📖 **菜谱收藏** | 保存、搜索、评分菜谱，含详细烹饪步骤 |
| 🎤 **语音输入** | 浏览器语音识别 + Whisper 云端转写（iOS/Android/PC） |
| 🏥 **健康评估** | AI 评估每日饮食质量并给出改进建议 |
| 🪽 **飞书推送** | 每日饮食报告一键推送到飞书群 |

## 架构

```
用户浏览器 ──▶ Nginx (:80/:443) ──▶ FastAPI (:8001) ──▶ 豆包 LLM
                    │                      │
                    ▼                      ▼
              静态文件 (Next.js)     SQLite + 阿里云 OSS
```

- **前端**: Next.js 16 (静态导出) + TypeScript + 内联样式
- **后端**: FastAPI + LangGraph (有状态 Agent) + SQLite checkpoint
- **AI**: 豆包 Seed 2.0 (兼容 OpenAI API) + Whisper 语音转写
- **存储**: 阿里云 OSS (图片) + SQLite (用户/食谱/对话数据)
- **集成**: 飞书 Webhook / Pexels 图片搜索 / Bilibili 视频搜索

## 快速开始

### 要求

- Python 3.12+ + uv
- Node.js 18+ + npm
- Docker 20+ (服务器部署)

### 开发模式

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填写 DOUBAO_API_KEY 等

# 2. 启动后端
uv run python main.py

# 3. 启动前端 (新终端)
cd frontend && npm run dev
```

- 前端: http://localhost:3000
- 后端: http://localhost:8001
- API 文档: http://localhost:8001/docs

### 生产模式

```bash
cd frontend && npm run build && cd ..
uv run python main.py
# 访问 http://localhost:8001
```

### Docker 部署

```bash
cp .env.example .env   # 编辑配置
bash deploy.sh          # 构建 + 启动
```

## 环境变量

```env
# LLM (必填)
DOUBAO_API_KEY=your_key
DOUBAO_MODEL_NAME=doubao-seed-2-0-mini-260428
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v1

# OSS 图片存储 (可选)
OSS_ACCESS_KEY_ID=your_key
OSS_ACCESS_KEY_SECRET=your_secret
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
OSS_BUCKET=your_bucket

# JWT 认证
JWT_SECRET=<random-32-chars>
```

完整列表见 `.env.example`。

## 演示流程

1. **注册/登录** → 进入主页
2. **AI 对话** → 输入"推荐几道川菜" → 查看流式回复 + 菜谱卡片
3. **拍照识别** → 点击 ➕ → 拍照 → AI 识别食材并推荐
4. **冰箱管理** → 添加食材 → AI 根据库存推荐
5. **膳食规划** → 点日期 → 选日历日期 → AI 生成一周计划
6. **购物清单** → 从膳食计划自动汇总
7. **饮食记录** → 拍照分析营养 → 查看每日摄入 → 健康评估
8. **飞书推送** → 推送每日饮食报告到群

## 项目结构

```
├── app/                    # FastAPI 后端
│   ├── api/v1/             # REST API (chat, nutrition, meal-plan, recipes...)
│   ├── agents/             # LangGraph Agent + LLM 配置
│   ├── models/             # Pydantic schemas
│   └── main.py             # 路由注册
├── frontend/               # Next.js 前端
│   ├── app/                # 页面 (/, /meal-plan, /nutrition, /fridge...)
│   ├── components/         # 通用组件 (DatePicker, ChatInput, Toast...)
│   ├── hooks/              # 自定义 hooks (语音识别/合成)
│   └── lib/                # 状态管理 + API 封装
├── docs/                   # 文档
├── deploy.sh               # 一键部署脚本
└── docker-compose.yml      # Docker 编排
```

## 许可证

MIT License
