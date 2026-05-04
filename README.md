<p align="center">
  <img src="https://img.shields.io/badge/AI-私人厨师-6c5ce7?style=for-the-badge&labelColor=e4e8ed&color=6c5ce7" alt="AI Private Chef Butler" />
</p>

<p align="center">
  <strong>你的 AI 私人厨师管家 — 智能菜谱推荐 · 食材管理 · 膳食规划</strong>
</p>

<p align="center">
  <a href="https://github.com/DDJH44/ai-private-chef-butler/stargazers"><img src="https://img.shields.io/github/stars/DDJH44/ai-private-chef-butler?style=social" alt="Stars"></a>
  <a href="https://github.com/DDJH44/ai-private-chef-butler/network/members"><img src="https://img.shields.io/github/forks/DDJH44/ai-private-chef-butler?style=social" alt="Forks"></a>
  <a href="https://github.com/DDJH44/ai-private-chef-butler/issues"><img src="https://img.shields.io/github/issues/DDJH44/ai-private-chef-butler?style=social" alt="Issues"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/LangGraph-0.3-1C3C3C?logo=langchain&logoColor=white" alt="LangGraph">
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

<br>

<!-- 视频演示占位 - 替换为你的实际视频链接 -->
<p align="center">
  <em>在这里放置演示视频或截图</em>
</p>

<br>

## 一句话介绍

> **用自然语言和冰箱对话，AI 帮你从食材到上桌全搞定。**

拍一张冰箱照片 → AI 识别食材 → 推荐菜谱 → 生成购物清单 → 规划一周膳食 → 记录烹饪历史，全程对话式交互。

<br>

## 核心功能

| 功能 | 说明 |
|:---:|:---|
| 🤖 **AI 对话** | 自然语言描述需求，AI 实时推荐菜谱，支持流式输出 |
| 📷 **图片识别** | 拍照上传食材，AI 自动识别并推荐可做的菜 |
| 🧊 **冰箱管理** | 录入食材库存，自动追踪保质期，临期提醒 |
| 📖 **菜谱收藏** | 一键保存 AI 推荐的菜谱，支持搜索和筛选 |
| 📅 **膳食规划** | AI 一键生成一周三餐计划，营养数据可视化 |
| 🛒 **购物清单** | 根据菜谱自动生成购物清单，分类管理 |
| 🕐 **烹饪历史** | 记录做菜次数、评分和心得，追溯烹饪轨迹 |
| ⚙️ **个人偏好** | 设置忌口、口味偏好、过敏原，AI 个性化推荐 |

<br>

## 界览

<p align="center">
  <em>新拟态 2.0 (Neumorphism 2.0) 设计风格 — 柔和光影 · 紫色强调 · 沉浸交互</em>
</p>

<!-- 在这里放置截图 -->
<!-- <p align="center">
  <img src="screenshots/chat.png" width="250" alt="对话">
  <img src="screenshots/recipe.png" width="250" alt="菜谱">
  <img src="screenshots/fridge.png" width="250" alt="冰箱">
</p> -->

<br>

## 快速开始

### 环境要求

- Python 3.13+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (Python 包管理器)

### 1. 克隆项目

```bash
git clone https://github.com/DDJH44/ai-private-chef-butler.git
cd ai-private-chef-butler
```

### 2. 配置环境变量

```bash
cp .env.example .env  # 或手动创建 .env
```

```env
# 豆包大模型 API
DOUBAO_API_KEY=your_api_key
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v1
DOUBAO_MODEL_NAME=doubao-seed-code-preview-251028

# 图片搜索 (Pexels)
PEXELS_API_KEY=your_pexels_key

# 阿里云 OSS (可选)
OSS_ACCESS_KEY_ID=your_key
OSS_ACCESS_KEY_SECRET=your_secret
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
OSS_BUCKET=your_bucket
```

### 3. 一键启动

**Windows:**
```bash
start-dev.bat
```

**手动启动:**
```bash
# 终端 1: 后端 (端口 8001)
uv run python main.py

# 终端 2: 前端 (端口 3000)
cd frontend && npm install && npm run dev
```

访问 http://localhost:3000 即可使用。

<br>

## 技术架构

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│         Next.js 16 · React 19 · CSS         │
│          Neumorphism 2.0 Design              │
└──────────────────┬──────────────────────────┘
                   │ HTTP
┌──────────────────▼──────────────────────────┐
│                  Backend                     │
│           FastAPI · LangGraph                │
│      AI Agent · SQLite · OSS Storage         │
└──────────────────┬──────────────────────────┘
                   │ API
┌──────────────────▼──────────────────────────┐
│              AI Models                       │
│       豆包 (Doubao) · OpenAI Compatible      │
└─────────────────────────────────────────────┘
```

### 后端

| 技术 | 用途 |
|:---|:---|
| FastAPI | Web 框架，提供 REST API |
| LangGraph | AI Agent 编排框架 |
| SQLAlchemy | ORM，数据持久化 |
| Aliyun OSS | 图片云存储 |

### 前端

| 技术 | 用途 |
|:---|:---|
| Next.js 16 | React 框架，App Router |
| React 19 | UI 框架 |
| TypeScript | 类型安全 |
| Neumorphism 2.0 | 自研设计系统，纯 CSS 实现 |

<br>

## 项目结构

```
.
├── app/                        # 后端
│   ├── agents/                 #   AI Agent (LangGraph)
│   ├── api/v1/                 #   API 路由
│   ├── common/                 #   通用工具
│   ├── models/                 #   数据模型
│   └── main.py                 #   FastAPI 入口
├── frontend/                   # 前端
│   ├── app/                    #   页面 (App Router)
│   ├── components/             #   React 组件
│   ├── lib/                    #   工具库 & Store
│   └── types/                  #   TypeScript 类型
├── main.py                     # 启动入口
├── pyproject.toml              # Python 依赖
└── langgraph.json              # LangGraph 配置
```

<br>

## 许可证

[MIT](LICENSE) © DDJH44
