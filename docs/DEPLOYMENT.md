# AI 私人厨师 - 服务器部署指南

## 目录

- [环境要求](#环境要求)
- [快速部署](#快速部署)
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
```

### 2. 一键部署

```bash
# 添加执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh
```

### 3. 验证部署

```bash
# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs -f app
```

访问 `http://your-server-ip` 或 `https://your-server-ip` 验证服务是否正常运行。

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

### 数据持久化

以下目录会自动挂载到宿主机：

| 容器路径 | 宿主机路径 | 说明 |
|----------|------------|------|
| `/app/data` | `./data` | SQLite 数据库 |
| `/app/logs` | `./logs` | 应用日志 |

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

# 更新部署
git pull && docker-compose up -d --build

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
# 进入容器
docker exec -it ai-chef bash

# 检查数据库
sqlite3 /app/data/recipes.db ".tables"
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
        │ SQLite  │  │  OSS    │  │ 豆包 AI │
        │ (数据)  │  │ (图片)  │  │ (LLM)  │
        └─────────┘  └─────────┘  └─────────┘
```
