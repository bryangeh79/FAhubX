#!/bin/bash

# Puppeteer执行器构建脚本

set -e

echo "🔨 Building Puppeteer Executor..."

# 进入项目目录
cd "$(dirname "$0")/.."

# 清理之前的构建
echo "🧹 Cleaning previous builds..."
rm -rf packages/puppeteer-executor/dist
rm -rf packages/puppeteer-executor/node_modules

# 安装依赖
echo "📦 Installing dependencies..."
cd packages/puppeteer-executor
npm ci

# 构建TypeScript
echo "⚙️  Building TypeScript..."
npm run build

# 运行测试
echo "🧪 Running tests..."
npm test

# 检查代码质量
echo "🔍 Checking code quality..."
npm run lint

echo "✅ Build completed successfully!"

# 显示构建信息
echo ""
echo "📊 Build Information:"
echo "  - Package: @facebook-bot/puppeteer-executor"
echo "  - Version: $(node -p "require('./package.json').version")"
echo "  - Output: packages/puppeteer-executor/dist"
echo "  - Tests: $(find test -name "*.test.ts" | wc -l) test files"
echo ""