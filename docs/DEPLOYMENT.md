# AI 私人厨师 - 服务器部署指南

## 目录

- [环境要求](#环境要求)
- [快速部署](#快速部署)
- [数据库迁移](#数据库迁移)
- [详细配置](#详细配置)
- [HTTPS 证书配置](#https-证书配置)
- [常用命令](#常用命令)
- [故障排查](#故障排查)

---

## 环境要求

| 软件 | 版本 | 说明 |
|------|------|------|
| Docker | 20.10+ | 容器运行时 |
| Docker Compose | 2.0+ | 容器编排工具 |
| 内存 | 2GB+ | 推荐 4GB |
| 磁盘 | 10GB+ | 数据存储空间 |

---

## 快速部署

### 1. 准备配置文件

```bash
# 克隆项目
git clone <repository-url>
cd ai-private-chef-butler

# 创建环境变量文件
cp .env.example .env

# 编辑 .env 文件，填写必要配置
vim .env

# 创建 ChromaDB 外部数据卷（已存在时此命令会直接返回卷名）
docker volume create aiprivatechefbutler_chroma_data
```

### 2. 初始化数据库并部署

```bash
# 构建含迁移工具的 app 镜像
docker compose build app

# 新 MySQL 数据库：创建初始表结构
docker compose run --rm app alembic upgrade head

# 添加执行权限
chmod +x deploy.sh

# 启动应用和 Nginx
./deploy.sh
```

如果 MySQL 中已有业务数据，不要直接运行 `upgrade head`。按下方“已有数据库接入”先核验并标记迁移基线。

### 3. 验证部署

```bash
# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs -f app
```

访问 `http://your-server-ip` 或 `https://your-server-ip` 验证服务是否正常运行。

---

## 数据库迁移

应用启动时不再自动创建表，而会检查 MySQL 连通性及 Alembic 当前版本；未初始化或版本落后时应用启动失败，避免在不知情时运行在不匹配的 schema 上。迁移脚本位于 `migrations/versions/`，已应用的脚本不可修改；后续 schema 变化必须新增并审阅迁移。

初始迁移的 `downgrade` 会删除应用表及其中数据。生产环境不要将初始迁移回退到 `base`；需要修复时优先编写前向迁移并先完成备份。

### 新数据库

完成 `.env` 配置并构建 app 镜像后，显式初始化数据库：

```bash
docker compose build app
docker compose run --rm app alembic upgrade head
```

然后执行 `./deploy.sh` 启动应用。`docker compose run` 会按 Compose 依赖先启动并等待 MySQL 健康检查。

### 已有数据库接入

先停止应用写入并完成 MySQL 备份。以下命令中的 `alembic check` 只读比较数据库与 ORM 模型，不会应用 schema 变更：

```bash
docker compose build app
docker compose run --rm app alembic check
```

只有当比较确认数据库完整匹配初始迁移基线时，才执行下面命令登记版本。`stamp` 不创建业务表，但会写入 Alembic 版本记录：

```bash
docker compose run --rm app alembic stamp head
```

如果比较发现任何缺表、缺列、类型或索引差异，立即停止，不要 `stamp`，也不要对已有库运行初始 `upgrade head`；先基于实际 schema 制定并审阅专用的兼容迁移。迁移/标记后再执行 `./deploy.sh`。

### 后续 schema 变更

开发环境中生成迁移后，必须人工检查脚本的新增、修改和删除操作，再备份目标数据库并显式升级：

```bash
alembic revision --autogenerate -m "describe_schema_change"
alembic upgrade head
```

部署新版本时，先构建新镜像，再显式执行迁移，然后启动应用：

```bash
docker compose build app
docker compose run --rm app alembic upgrade head
docker compose up -d
```

---

## 详细配置

### 环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DOUBAO_API_KEY` | ✅ | 豆包 AI API 密钥 |
| `DOUBAO_MODEL_NAME` | ✅ | 豆包模型名称 |
| `DOUBAO_BASE_URL` | ✅ | 豆包 API 地址 |
| `OSS_ACCESS_KEY_ID` | ❌ | 阿里云 OSS AccessKey ID |
| `OSS_ACCESS_KEY_SECRET` | ❌ | 阿里云 OSS AccessKey Secret |
| `OSS_ENDPOINT` | ❌ | OSS 区域节点 |
| `OSS_BUCKET` | ❌ | OSS 存储桶名称 |
| `FEISHU_WEBHOOK_URL` | ❌ | 飞书机器人 Webhook 地址 |
| `DATABASE_URL` | ✅ | MySQL SQLAlchemy 连接串 |
| `MYSQL_HOST` | ✅ | MySQL 服务地址 |
| `MYSQL_DATABASE` | ✅ | MySQL 数据库名 |
| `MYSQL_USER` | ✅ | MySQL 用户名 |
| `MYSQL_PASSWORD` | ✅ | MySQL 用户密码 |
| `MYSQL_ROOT_PASSWORD` | ✅ | MySQL root 密码 |

### 数据持久化

以下数据通过 Docker 命名卷或宿主机目录持久化：

| 容器路径 | 持久化位置 | 说明 |
|----------|------------|------|
| `/var/lib/mysql` | `mysql_data`（Docker 命名卷） | MySQL 数据卷 |
| `/app/app/data/chroma_db` | `aiprivatechefbutler_chroma_data`（外部 Docker 命名卷） | ChromaDB 向量库 |
| `/app/logs` | `./logs`（宿主机目录） | 应用日志 |

ChromaDB 卷使用固定名称，首次部署前需创建。`docker compose down -v` 会删除 Compose 管理的 MySQL 卷；ChromaDB 外部卷不会随之删除，但手动执行 `docker volume rm aiprivatechefbutler_chroma_data` 会永久删除其中数据。

```bash
mkdir -p "$HOME/ai-chef-backups"
docker run --rm \
    -v aiprivatechefbutler_chroma_data:/source:ro \
    -v "$HOME/ai-chef-backups:/backup" \
    alpine tar -czf "/backup/chroma_db-$(date +%F).tar.gz" -C /source .
```

---

## HTTPS 证书配置

### 方式一：Let's Encrypt（推荐）

```bash
# 安装 certbot
apt install certbot

# 申请证书（替换 your-domain.com）
certbot certonly --standalone -d your-domain.com

# 复制证书
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# 设置自动续期
crontab -e
# 添加: 0 0 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/your-domain.com/*.pem /path/to/nginx/ssl/
```

### 方式二：自签名证书（仅测试）

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=AI-Chef/CN=localhost"
```

---

## 常用命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f app

# 查看服务状态
docker-compose ps

# 进入容器
docker exec -it ai-chef bash

# 更新部署（先审阅迁移并备份数据库）
git pull
docker compose build app
docker compose run --rm app alembic upgrade head
docker compose up -d

# 清理旧镜像
docker image prune -f
```

---

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker-compose logs app

# 检查端口占用
netstat -tlnp | grep -E '80|443|8001'

# 检查配置文件
docker-compose config
```

### API 请求失败

```bash
# 检查后端健康状态
curl http://localhost:8001/api/v1/health

# 检查环境变量
docker exec ai-chef env | grep DOUBAO
```

### 数据库问题

```bash
# 检查 MySQL 服务健康状态
docker exec -it ai-chef-db mysqladmin ping -h localhost -u root -p

# 查看业务表
docker exec -it ai-chef-db mysql -u "$MYSQL_USER" -p "$MYSQL_DATABASE" -e "SHOW TABLES;"
```

### SSL 证书问题

```bash
# 检查证书
openssl x509 -in nginx/ssl/cert.pem -text -noout

# 测试 HTTPS
curl -k https://localhost/api/v1/health
```

---

## 云服务器推荐配置

| 平台 | 配置 | 月费用 | 说明 |
|------|------|--------|------|
| 阿里云 | 2核4G | ¥100+ | 国内访问快 |
| 腾讯云 | 2核4G | ¥80+ | 性价比高 |
| AWS | t3.medium | $30+ | 海外用户 |

### 安全组配置

开放以下端口：

| 端口 | 协议 | 说明 |
|------|------|------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS |

---

## 架构图

```
                    ┌─────────────┐
                    │   用户请求   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    Nginx    │
                    │  (反向代理)  │
                    │   :80/:443  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   FastAPI   │
                    │   :8001     │
                    │  (AI 服务)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ MySQL   │  │  OSS    │  │ 豆包 AI │
        │业务/记忆│  │ (图片)  │  │ (LLM)  │
        └─────────┘  └─────────┘  └─────────┘
              │
              ▼
        ┌─────────┐
        │ChromaDB │
        │向量知识库│
        └─────────┘
```
