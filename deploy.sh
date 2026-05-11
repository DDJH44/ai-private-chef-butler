#!/bin/bash
set -e

echo "🚀 AI 私人厨师 - 服务器部署脚本"
echo "=================================="

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
        -subj "/C=CN/ST=Shanghai/L=Shanghai/O=AI-Chef/OU=IT/CN=localhost"
    echo "✅ 自签名证书已生成（仅用于测试，生产环境请使用正式证书）"
fi

echo ""
echo "🔨 构建 Docker 镜像..."
docker-compose build

echo ""
echo "🚀 启动服务..."
docker-compose up -d

echo ""
echo "⏳ 等待服务启动..."
sleep 5

echo ""
echo "🔍 检查服务状态..."
docker-compose ps

echo ""
echo "✅ 部署完成!"
echo ""
echo "访问地址:"
echo "  - HTTP:  http://localhost"
echo "  - HTTPS: https://localhost"
echo ""
echo "常用命令:"
echo "  查看日志:   docker-compose logs -f"
echo "  停止服务:   docker-compose down"
echo "  重启服务:   docker-compose restart"
echo "  更新部署:   git pull && docker-compose up -d --build"
