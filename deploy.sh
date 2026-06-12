#!/bin/bash
set -e

echo "🚀 AI 私人厨师 - 服务器部署脚本"
echo "=================================="

# Check docker-compose or docker compose availability
if command -v docker-compose &>/dev/null; then
    DC="docker-compose"
elif command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
    DC="docker compose"
else
    echo "❌ 错误: docker-compose 未安装"
    echo "   请安装 Docker Compose V1 或 V2"
    exit 1
fi

if [ ! -f .env ]; then
    echo "❌ 错误: .env 文件不存在"
    echo "   请复制 .env.example 为 .env 并填写配置"
    exit 1
fi

if [ ! -d nginx/ssl ]; then
    echo "📁 创建 SSL 证书目录..."
    mkdir -p nginx/ssl
fi

if [ ! -f nginx/ssl/cert.pem ] || [ ! -f nginx/ssl/key.pem ]; then
    echo "⚠️  警告: SSL 证书不存在，生成自签名证书..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=CN/ST=Shanghai/L=Shanghai/O=AI-Chef/OU=IT/CN=121.89.84.232"
    echo "✅ 自签名证书已生成（仅用于测试，生产环境请使用正式证书）"
fi

echo ""
echo "🔨 构建 Docker 镜像..."
$DC build

echo ""
echo "🚀 启动服务..."
$DC up -d

echo ""
echo "⏳ 等待服务启动..."
# Wait for app health check to pass (up to 120s)
ATTEMPTS=0
while [ $ATTEMPTS -lt 60 ]; do
    if curl -sf http://localhost:8001/api/v1/health > /dev/null 2>&1; then
        echo "✅ 服务已就绪"
        break
    fi
    sleep 2
    ATTEMPTS=$((ATTEMPTS + 1))
done

if [ $ATTEMPTS -ge 60 ]; then
    echo "⚠️  警告: 服务启动超时，请检查日志: $DC logs app"
fi

echo ""
echo "🔍 检查服务状态..."
$DC ps

echo ""
echo "✅ 部署完成!"
echo ""
echo "访问地址:"
echo "  - HTTP:  http://121.89.84.232"
echo "  - HTTPS: https://121.89.84.232"
echo ""
echo "常用命令:"
echo "  查看日志:   $DC logs -f"
echo "  停止服务:   $DC down"
echo "  重启服务:   $DC restart"
echo "  更新部署:   git pull && $DC up -d --build"
