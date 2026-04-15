# Facebook Auto Bot - Phase 6.0 生产环境部署配置

## 概述

本文档提供 Facebook Auto Bot 项目的完整生产环境部署配置方案，包括容器化部署、环境配置、监控告警、高可用架构和部署流水线。

## 1. 部署架构设计

### 1.1 服务架构
```
┌─────────────────────────────────────────────────────────────┐
│                    负载均衡器 (Nginx/Traefik)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
│   前端服务    │  │   后端API     │  │   监控服务    │
│   (React)    │  │   (NestJS)   │  │ (Grafana)    │
└───────┬──────┘  └───────┬──────┘  └───────┬──────┘
        │                  │                  │
┌───────▼─────────────────▼──────────────────▼──────┐
│                内部服务网络                         │
└───────┬─────────────────┬──────────────────┬──────┘
        │                 │                  │
┌───────▼──────┐ ┌───────▼──────┐ ┌─────────▼──────┐
│ PostgreSQL   │ │    Redis     │ │   RabbitMQ     │
│  数据库       │ │    缓存       │ │   消息队列      │
└──────────────┘ └──────────────┘ └────────────────┘
```

### 1.2 网络架构
- **外部网络**: 80/443端口对外提供服务
- **内部网络**: 服务间通信使用内部网络
- **管理网络**: 监控和管理接口使用独立网络

### 1.3 存储架构
- **数据库存储**: PostgreSQL 持久化存储
- **缓存存储**: Redis AOF持久化
- **对象存储**: MinIO 对象存储
- **日志存储**: Loki 日志存储
- **监控存储**: Prometheus 时序数据

## 2. 容器化配置

### 2.1 Docker 镜像构建配置

#### 2.1.1 后端服务 Dockerfile (生产环境)
```dockerfile
# /workspace/docker/backend/Dockerfile
FROM node:18-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM node:18-alpine

# 安装运行时依赖
RUN apk add --no-cache tini curl

# 设置工作目录
WORKDIR /app

# 复制构建产物和依赖
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 更改文件所有权
RUN chown -R nodejs:nodejs /app

# 切换到非root用户
USER nodejs

# 使用 tini 作为 init 进程
ENTRYPOINT ["/sbin/tini", "--"]

# 启动应用
CMD ["node", "dist/main.js"]
```

#### 2.1.2 前端服务 Dockerfile (生产环境)
```dockerfile
# /workspace/docker/frontend/Dockerfile
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM nginx:alpine

# 复制构建产物到 nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx-security-headers.conf /etc/nginx/conf.d/security-headers.conf

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
```

### 2.2 Docker Compose 生产环境配置

#### 2.2.1 主配置文件 (docker-compose.prod.yml)
```yaml
# /workspace/docker-compose.prod.yml
version: '3.8'

services:
  # Nginx 反向代理和负载均衡
  nginx:
    image: nginx:alpine
    container_name: fbautobot-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/conf.d:/etc/nginx/conf.d:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - backend
      - frontend
    networks:
      - fbautobot-network
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 10s
      retries: 3

  # 后端 API 服务 (多实例)
  backend:
    build:
      context: ./backend
      dockerfile: ../docker/backend/Dockerfile
    image: fbautobot-backend:${TAG:-latest}
    container_name: fbautobot-backend
    restart: unless-stopped
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=${DB_NAME}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - RABBITMQ_URL=amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@rabbitmq:5672
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_EXPIRES_IN=7d
      - PORT=3000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - fbautobot-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # 前端服务
  frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/frontend/Dockerfile
    image: fbautobot-frontend:${TAG:-latest}
    container_name: fbautobot-frontend
    restart: unless-stopped
    environment:
      - VITE_API_URL=${API_URL}
      - VITE_WS_URL=${WS_URL}
    networks:
      - fbautobot-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3

  # PostgreSQL 数据库
  postgres:
    image: postgres:16-alpine
    container_name: fbautobot-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/database/migrations:/docker-entrypoint-initdb.d
      - ./docker/postgres/backup:/backup
    networks:
      - fbautobot-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: fbautobot-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - fbautobot-network
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # RabbitMQ 消息队列
  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: fbautobot-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASS}
      RABBITMQ_DEFAULT_VHOST: /
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - fbautobot-network
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5

  # MinIO 对象存储
  minio:
    image: minio/minio:latest
    container_name: fbautobot-minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    networks:
      - fbautobot-network
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # 监控服务 - Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: fbautobot-prometheus
    restart: unless-stopped
    volumes:
      - prometheus_data:/prometheus
      - ./docker/monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./docker/monitoring/prometheus/rules:/etc/prometheus/rules:ro
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    networks:
      - fbautobot-network
    ports:
      - "9090:9090"

  # 监控服务 - Grafana
  grafana:
    image: grafana/grafana:latest
    container_name: fbautobot-grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
      GF_INSTALL_PLUGINS: grafana-piechart-panel,grafana-clock-panel
    volumes:
      - grafana_data:/var/lib/grafana
      - ./docker/monitoring/grafana/dashboards:/var/lib/grafana/dashboards
      - ./docker/monitoring/grafana/provisioning:/etc/grafana/provisioning
    networks:
      - fbautobot-network
    ports:
      - "3001:3000"
    depends_on:
      - prometheus

  # 日志收集 - Loki
  loki:
    image: grafana/loki:latest
    container_name: fbautobot-loki
    restart: unless-stopped
    volumes:
      - loki_data:/loki
      - ./docker/monitoring/loki/config.yaml:/etc/loki/config.yaml
    networks:
      - fbautobot-network
    command: -config.file=/etc/loki/config.yaml

  # 日志收集 - Promtail
  promtail:
    image: grafana/promtail:latest
    container_name: fbautobot-promtail
    restart: unless-stopped
    volumes:
      - /var/log:/var/log
      - ./docker/monitoring/promtail/config.yaml:/etc/promtail/config.yaml
    networks:
      - fbautobot-network
    command: -config.file=/etc/promtail/config.yaml

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  rabbitmq_data:
    driver: local
  minio_data:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
  loki_data:
    driver: local

networks:
  fbautobot-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

## 3. 环境配置管理

### 3.1 环境变量配置文件

#### 3.1.1 .env.production 模板
```bash
# /workspace/.env.production
# 数据库配置
DB_NAME=fbautobot_production
DB_USER=fbautobot_user
DB_PASSWORD=your_secure_password_here
DB_HOST=postgres
DB_PORT=5432

# Redis 配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here

# RabbitMQ 配置
RABBITMQ_USER=admin
RABBITMQ_PASS=your_rabbitmq_password_here

# MinIO 配置
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key

# JWT 配置
JWT_SECRET=your_super_secure_jwt_secret_here
JWT_EXPIRES_IN=7d

# 应用配置
API_URL=https://api.yourdomain.com
WS_URL=wss://api.yourdomain.com
NODE_ENV=production

# 监控配置
GRAFANA_ADMIN_PASSWORD=admin_password_here

# 部署配置
TAG=v1.0.0
```

#### 3.1.2 环境配置脚本
```bash
#!/bin/bash
# /workspace/deployment-scripts/generate-env.sh

set -e

ENV=$1
TEMPLATE_FILE=".env.${ENV}.template"
OUTPUT_FILE=".env.${ENV}"

if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "Template file $TEMPLATE_FILE not found"
    exit 1
fi

echo "Generating $OUTPUT_FILE from $TEMPLATE_FILE"

# 复制模板
cp "$TEMPLATE_FILE" "$OUTPUT_FILE"

# 替换敏感值（在实际使用中应从密钥管理服务获取）
if [ "$ENV" = "production" ]; then
    # 生成随机密码
    DB_PASSWORD=$(openssl rand -base64 32)
    REDIS_PASSWORD=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 64)
    
    # 替换占位符
    sed -i "s/your_secure_password_here/$DB_PASSWORD/g" "$OUTPUT_FILE"
    sed -i "s/your_redis_password_here/$REDIS_PASSWORD/g" "$OUTPUT_FILE"
    sed -i "s/your_super_secure_jwt_secret_here/$JWT_SECRET/g" "$OUTPUT_FILE"
fi

echo "Environment file generated: $OUTPUT_FILE"
echo "Please review and update any remaining placeholders"
```

## 4. 监控告警系统配置

### 4.1 Prometheus 配置

#### 4.1.1 prometheus.yml
```yaml
# /workspace/docker/monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
