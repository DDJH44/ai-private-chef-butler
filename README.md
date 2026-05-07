# AI 私人厨师 - AI Private Chef Butler

一个基于 AI 的智能食谱推荐系统，支持图片识别食材并生成个性化菜谱。

## 功能特性

- 🖼️ **图片识别**: 上传食材图片，AI 自动识别食材
- 💬 **智能对话**: 通过聊天描述需求，获取个性化菜谱推荐
- 📚 **菜谱管理**: 保存、搜索、管理您的菜谱收藏
- 🍳 **详细步骤**: 提供详细的烹饪步骤和食材清单

## 项目结构

```
AI Private Chef Butler/
├── app/                    # 后端应用 (FastAPI)
│   ├── api/               # API 路由
│   │   └── v1/           # API v1 版本
│   │       ├── chat.py   # 聊天 API
│   │       ├── oss.py    # 文件上传 API
│   │       └── recipes.py # 菜谱 API
│   ├── agents/           # AI 代理
│   ├── common/           # 通用工具
│   ├── db/               # 数据库文件
│   ├── models/           # 数据模型
│   ├── static/           # 前端构建产物 (生产模式)
│   └── main.py           # FastAPI 主入口
├── frontend/              # 前端应用 (Next.js)
│   ├── app/              # Next.js 页面
│   ├── components/       # React 组件
│   ├── lib/              # 工具库
│   ├── public/           # 静态资源
│   └── types/            # TypeScript 类型
├── docs/                  # 项目文档
├── start-dev.bat          # Windows 开发模式启动脚本
├── start-dev.ps1          # PowerShell 开发模式启动脚本
├── start-prod.bat         # Windows 生产模式启动脚本
└── start-prod.ps1         # PowerShell 生产模式启动脚本
```

## 快速开始

### 环境要求

- Python 3.12+
- Node.js 18+
- uv (Python 包管理器)

### 开发模式

开发模式下，前端和后端分别运行：
- 后端 API: http://localhost:8001
- 前端界面: http://localhost:3000

**Windows (批处理):**
```bash
start-dev.bat
```

**Windows (PowerShell):**
```powershell
.\start-dev.ps1
```

**手动启动:**
```bash
# 终端 1: 启动后端
uv run python main.py

# 终端 2: 启动前端
cd frontend
npm run dev
```

### 生产模式

生产模式下，前端会被构建为静态文件并由后端服务：
- 访问地址: http://localhost:8001

**Windows (批处理):**
```bash
start-prod.bat
```

**Windows (PowerShell):**
```powershell
.\start-prod.ps1
```

**手动构建和启动:**
```bash
# 1. 构建前端
cd frontend
npm run build:prod
cd ..

# 2. 启动服务器
uv run python main.py
```

## 环境变量

在项目根目录创建 `.env` 文件：

```env
# 阿里云 OSS 配置 (可选，用于图片存储)
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_ENDPOINT=your_oss_endpoint
OSS_BUCKET_NAME=your_bucket_name

# OpenAI API 配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
```

## 技术栈

### 后端
- **FastAPI**: 高性能 Python Web 框架
- **LangChain**: AI 应用开发框架
- **SQLite**: 轻量级数据库

### 前端
- **Next.js**: React 框架
- **Tailwind CSS**: 实用优先的 CSS 框架
- **Lucide React**: 图标库

## 开发指南

### 添加新 API

1. 在 `app/api/v1/` 目录下创建新的路由文件
2. 在 `app/main.py` 中注册路由

### 添加新组件

1. 在 `frontend/components/` 目录下创建新组件
2. 使用 TypeScript 和 Tailwind CSS
3. 遵循现有组件的代码风格

## 常见问题

### Q: 为什么看到两个前端网页？

A: 这是因为同时运行了前端开发服务器 (端口 3000) 和后端服务器 (端口 8001)。
- 开发时使用 http://localhost:3000
- 生产环境使用 http://localhost:8001

### Q: 如何只运行一个服务？

A: 使用生产模式：
1. 运行 `start-prod.bat` 或 `.\start-prod.ps1`
2. 访问 http://localhost:8001

## 许可证

MIT License