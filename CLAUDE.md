# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment

- **Python**: Python 3.12 at `C:/Users/gg/AppData/Local/Programs/Python/Python312/python.exe`（.python-version 写 3.13，实际是 3.12）
- **Node.js**: v24.10.0 at `E:/node.js/node.exe`，npm at `E:/node.js/npm.cmd`
- **MySQL**: 8.0.46 at `C:/Users/gg/mysql/mysql-8.0.46-winx64/`
- **Shell**: Git Bash（Unix-style paths like `/e/DaiMa/1/privatecook`）
- **Platform**: Windows 11

## Running Python

```bash
/c/Users/gg/AppData/Local/Programs/Python/Python312/python script.py
/c/Users/gg/AppData/Local/Programs/Python/Python312/python -m pip install <package>
```

## Running Node.js

```bash
export PATH="/e/node.js:$PATH"
node --version
npm --version
```

## Package management

```bash
# Python
/c/Users/gg/AppData/Local/Programs/Python/Python312/python -m pip install <package>

# Node.js（在 frontend 目录下）
cd frontend && export PATH="/e/node.js:$PATH" && npm install <package>
```

## MySQL 数据库

### 启动 MySQL

```bash
"C:/Users/gg/mysql/mysql-8.0.46-winx64/bin/mysqld.exe" --console --port=3306 &
```

### 连接数据库

```bash
# root 用户
"C:/Users/gg/mysql/mysql-8.0.46-winx64/bin/mysql.exe" -u root -p544547968Sy

# ai_chef 用户
"C:/Users/gg/mysql/mysql-8.0.46-winx64/bin/mysql.exe" -u ai_chef -p544547968Sy ai_private_chef
```

### 数据库信息

| 项目 | 值 |
|------|-----|
| Host | localhost |
| Port | 3306 |
| Database | ai_private_chef |
| User | ai_chef |
| Password | 544547968Sy |
| Root Password | 544547968Sy |
| Charset | utf8mb4 |

### 重置 root 密码（忘记密码时）

```bash
# 1. 杀掉现有 mysqld 进程
taskkill //f //im mysqld.exe

# 2. 跳过权限启动
"C:/Users/gg/mysql/mysql-8.0.46-winx64/bin/mysqld.exe" --console --skip-grant-tables --port=3306 --shared-memory=ON &

# 3. 通过 shared memory 连接并重置密码
"C:/Users/gg/mysql/mysql-8.0.46-winx64/bin/mysql.exe" -u root --protocol=MEMORY -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY '544547968Sy'; FLUSH PRIVILEGES;"

# 4. 杀掉再正常启动
taskkill //f //im mysqld.exe
"C:/Users/gg/mysql/mysql-8.0.46-winx64/bin/mysqld.exe" --console --port=3306 &
```

## 启动项目

### 1. 启动 MySQL

```bash
"C:/Users/gg/mysql/mysql-8.0.46-winx64/bin/mysqld.exe" --console --port=3306 &
```

### 2. 启动后端（FastAPI，端口 8001）

```bash
cd /e/DaiMa/1/privatecook
/c/Users/gg/AppData/Local/Programs/Python/Python312/python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. 启动前端（Next.js，端口 3000）

```bash
cd /e/DaiMa/1/privatecook/frontend
export PATH="/e/node.js:$PATH"
npm run dev
```

### 服务端口

| 服务 | 地址 |
|------|------|
| 后端 API | http://localhost:8001 |
| 健康检查 | http://localhost:8001/health |
| API 健康检查 | http://localhost:8001/api/v1/health |
| 前端页面 | http://localhost:3000 |

## 环境变量（.env）

配置文件位于项目根目录 `privatecook/.env`，包含：
- **MIMO_API_KEY** - 小米 MIMO 模型（主用 AI）
- **DOUBAO_API_KEY** - 火山引擎/豆包（备用 AI）
- **IMAGE_GEN_MODEL** - 图片生成模型（doubao-seedream）
- **PEXELS_API_KEY** - 图片搜索
- **OSS_* ** - 阿里云 OSS 图片存储
- **FEISHU_WEBHOOK_URL** - 飞书机器人推送
- **JWT_SECRET** - JWT 认证密钥
- **DATABASE_URL** / **MYSQL_* ** - 数据库连接
- **CORS_ORIGINS** - 跨域配置
- **LANGSMITH_* ** - LangSmith 追踪

## Key installed packages

| Category | Packages |
|----------|----------|
| AI/ML | `chromadb`, `huggingface-hub`, `langgraph`, `openai`, `onnxruntime`, `numpy`, `scikit-learn` |
| Web | `fastapi`, `starlette`, `uvicorn`, `httpx`, `aiohttp`, `requests` |
| Database | `sqlalchemy`, `alembic`, `aiomysql`, `aiosqlite`, `asyncpg` |
| Cloud | `aliyunsdkcore`, `aliyunsdkkms` (Alibaba Cloud) |
| Auth | `cryptography`, `bcrypt`, `PyJWT`, `python-jose` |
| Testing | `pytest`, `coverage` |

## 项目结构

```
privatecook/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── api/v1/              # API 路由（chat, recipes, auth, meal_plan, shopping, nutrition, feishu, etc.）
│   ├── agents/              # AI Agent（personal_chief, image_agent）
│   ├── models/              # SQLAlchemy 模型和 Pydantic schemas
│   └── common/              # 公共模块（database, logger, checkpoint_saver）
├── frontend/                # Next.js 前端
│   ├── app/                 # 页面（login, register, recipes, meal-plan, shopping-list, nutrition, etc.）
│   └── components/          # React 组件
├── .env                     # 环境变量（不进 git）
├── docker-compose.yml       # Docker 编排（需 Docker 环境）
├── Dockerfile               # 应用镜像
└── deploy.sh                # 部署脚本
```

## 注意事项

- `.env` 文件包含真实密钥，不要提交到 git
- 数据库表由 FastAPI startup 事件自动创建（`Base.metadata.create_all`）
- Docker 未安装，日常开发直接运行本地服务
- 前端 dev 模式 Turbopack 会监控文件变化自动热更新
- 后端使用 `--reload` 模式，代码改动自动重启

### 关于我
不开挖机｜一名软件工程专业学生。我用 Claude Code 做【编程开发，项目编写】，做事追求高效简洁，逻辑严谨，精确落地，保质保量快速完成代码开发相关任务。
### 思维原则
所有决策从问题本质出发，不因「惯例如此」照搬。回到问题本身，要解决什么？最直接的路径「当然可以」。给我真实判断，方案有问题直接指出来，发现更好的做法直接说，不用等我问。
### 约束先行
无论开发项目还是知识管理项目，第一步永远是建规则：新项目先写 CLAUDE.md，新目录先定结构约定（什么放哪、怎么命名、何时清理）。没有规范的工作空间不动手。已有规范的项目，严格遵守其 CLAUDE.md 中的约定。需要调整规范时先改文档、再改实践，不要反过来。
### 沟通方式
默认中文，代码、命令、变量名用英文
结论先行，再给理由，不要先铺垫背景
遇到模糊需求，先给最合理的方案，再问要不要调整
不要问「你确定要这样吗」，除非命中下方红线
#### 自主边界（红线，必须先问我）
以下操作即使在 auto-accept 模式下也必须停下来问我：
删除文件、目录或 git 历史
修改 .env、密钥、token、CI/CD 配置
数据库 schema 变更或数据迁移
git push、git rebase、git reset --hard、强制推送
安装新的全局依赖或修改系统配置
公开发布（npm publish、部署到生产、发文章等）
### 通用工程纪律
改完主动跑验证（具体命令见各项目 CLAUDE.md），不要只改不验
不要为了让代码跑起来注释报错或加垃圾标记，找根本原因
密钥、token、密码不进代码、不进 commit、不进日志
改动前先在 Plan Mode 出方案，我确认后再动手
在每次回答完之后都加上一句：主人，我完成任务了呢喵~
