#!/bin/bash

# Docker构建脚本

set -e

echo "🐳 Building Docker image for Puppeteer Executor..."

# 进入项目目录
cd "$(dirname "$0")/.."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# 检查是否已登录Docker Hub（如果需要推送）
if [[ "$1" == "--push" ]]; then
    if ! docker info &> /dev/null; then
        echo "❌ Docker daemon is not running. Please start Docker."
        exit 1
    fi
fi

# 构建镜像
IMAGE_NAME="facebook-bot/puppeteer-executor"
IMAGE_TAG="latest"

echo "📦 Building image: ${IMAGE_NAME}:${IMAGE_TAG}"

# 先构建TypeScript代码
echo "🔨 Building TypeScript code..."
cd packages/puppeteer-executor
npm run build
cd ../..

# 构建Docker镜像
docker build \
    -t "${IMAGE_NAME}:${IMAGE_TAG}" \
    -f docker/Dockerfile \
    .

echo "✅ Docker image built successfully: ${IMAGE_NAME}:${IMAGE_TAG}"

# 显示镜像信息
echo ""
echo "📊 Image Information:"
docker images | grep "${IMAGE_NAME}"

# 运行测试容器（可选）
if [[ "$1" == "--test" ]]; then
    echo "🧪 Running test container..."
    
    # 创建测试数据目录
    mkdir -p test-data/{sessions,logs,screenshots}
    
    # 运行测试容器
    docker run -d \
        --name puppeteer-test \
        -p 3000:3000 \
        -v "$(pwd)/test-data/sessions:/app/data/sessions" \
        -v "$(pwd)/test-data/logs:/app/data/logs" \
        -v "$(pwd)/test-data/screenshots:/app/data/screenshots" \
        -e NODE_ENV=test \
        -e LOG_LEVEL=debug \
        "${IMAGE_NAME}:${IMAGE_TAG}"
    
    echo "✅ Test container started. Check logs with: docker logs puppeteer-test"
    echo "   Stop container with: docker stop puppeteer-test && docker rm puppeteer-test"
fi

# 推送到Docker Hub（如果需要）
if [[ "$1" == "--push" ]]; then
    echo "🚀 Pushing image to Docker Hub..."
    
    # 检查是否设置了DOCKER_USERNAME和DOCKER_PASSWORD
    if [[ -z "${DOCKER_USERNAME}" || -z "${DOCKER_PASSWORD}" ]]; then
        echo "⚠️  DOCKER_USERNAME or DOCKER_PASSWORD not set. Skipping push."
    else
        echo "${DOCKER_PASSWORD}" | docker login -u "${DOCKER_USERNAME}" --password-stdin
        docker push "${IMAGE_NAME}:${IMAGE_TAG}"
        echo "✅ Image pushed to Docker Hub"
    fi
fi