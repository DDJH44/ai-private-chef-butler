# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment

- **Python**: 3.13.12 at `D:/Develop/python/python.exe`
- **Shell**: Git Bash (Unix-style paths work, e.g., `/d/Develop/...`)
- **Platform**: Windows 11

## Key installed packages

| Category | Packages |
|----------|----------|
| AI/ML | `chromadb`, `huggingface-hub`, `langgraph`, `openai`, `onnxruntime`, `numpy`, `scikit-learn` |
| Web | `fastapi`, `starlette`, `uvicorn`, `httpx`, `aiohttp`, `requests` |
| Database | `sqlalchemy`, `alembic`, `aiomysql`, `aiosqlite`, `asyncpg` |
| Cloud | `aliyunsdkcore`, `aliyunsdkkms` (Alibaba Cloud) |
| Auth | `cryptography`, `bcrypt`, `PyJWT`, `python-jose` |
| Testing | `pytest`, `coverage` |

## Running Python

```bash
D:/Develop/python/python.exe script.py
# or via shebang with the scripts in PATH
```

## Package management

Use `pip` from this Python installation:
```bash
D:/Develop/python/python.exe -m pip install <package>
```
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