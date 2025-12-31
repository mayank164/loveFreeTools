#!/bin/bash
# Neon PostgreSQL Worker 快速部署脚本

echo "🚀 开始部署 Neon PostgreSQL Worker..."

# 检查是否安装了 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查是否安装了 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未安装 npm，请先安装 npm"
    exit 1
fi

# 安装 Wrangler（如果还没有）
if ! command -v wrangler &> /dev/null; then
    echo "📦 安装 Wrangler CLI..."
    npm install -g wrangler
fi

# 安装依赖
echo "📦 安装依赖包..."
npm install @neondatabase/serverless

# 登录 Cloudflare（如果需要）
echo "🔐 检查 Cloudflare 登录状态..."
wrangler whoami || wrangler login

# 部署
echo "🚀 部署 Worker..."
wrangler deploy

echo "✅ 部署完成！"
echo ""
echo "📝 下一步："
echo "1. 在 Cloudflare Dashboard 中设置环境变量："
echo "   - DATABASE_URL (Secret)"
echo "   - ADMIN_KEY (Secret, 可选)"
echo "   - RESEND_API_KEY (Secret, 可选)"
echo ""
echo "2. 测试 API："
echo "   curl https://你的worker.workers.dev/api/domains"

