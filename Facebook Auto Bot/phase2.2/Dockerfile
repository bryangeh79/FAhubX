# Facebook Auto Bot Phase 2.2 - Docker镜像

# 使用多阶段构建减少镜像大小
FROM node:20-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    openssh-client

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./
COPY packages/session-manager/package.json ./packages/session-manager/
COPY packages/vpn-manager/package.json ./packages/vpn-manager/
COPY packages/health-checker/package.json ./packages/health-checker/
COPY packages/monitoring/package.json ./packages/monitoring/
COPY packages/shared/package.json ./packages/shared/
COPY packages/phase2-integration/package.json ./packages/phase2-integration/

# 安装依赖（包括开发依赖）
RUN npm ci --include=dev

# 复制源代码
COPY . .

# 构建TypeScript代码
RUN npm run build

# 生产阶段
FROM node:20-alpine

# 安装运行时依赖
RUN apk add --no-cache \
    # OpenVPN客户端
    openvpn \
    # WireGuard工具
    wireguard-tools \
    # 网络工具
    iproute2 \
    iptables \
    net-tools \
    # DNS工具
    bind-tools \
    # 进程管理
    procps \
    # 文本工具
    bash \
    curl \
    jq \
    # 字体（用于截图）
    ttf-freefont \
    fontconfig \
    # Docker客户端（用于管理容器）
    docker-cli \
    # 其他工具
    ca-certificates

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# 设置工作目录
WORKDIR /app

# 从构建阶段复制node_modules和构建结果
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package*.json ./

# 创建必要的目录
RUN mkdir -p \
    /app/logs \
    /app/data \
    /app/configs \
    /app/certs \
    /app/screenshots && \
    chown -R nodejs:nodejs /app

# 切换到非root用户
USER nodejs

# 创建符号链接以便模块可以相互引用
RUN ln -sf /app/packages/session-manager /app/node_modules/@facebook-bot/session-manager && \
    ln -sf /app/packages/vpn-manager /app/node_modules/@facebook-bot/vpn-manager && \
    ln -sf /app/packages/health-checker /app/node_modules/@facebook-bot/health-checker && \
    ln -sf /app/packages/monitoring /app/node_modules/@facebook-bot/monitoring && \
    ln -sf /app/packages/shared /app/node_modules/@facebook-bot/shared && \
    ln -sf /app/packages/phase2-integration /app/node_modules/@facebook-bot/phase2-integration

# 设置环境变量
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV LOG_CONSOLE=true
ENV LOG_FILE=true
ENV LOG_FILE_PATH=/app/logs/app.log

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 启动命令
CMD ["node", "packages/phase2-integration/dist/index.js"]

# 标签
LABEL maintainer="Facebook Auto Bot Team <team@facebook-auto-bot.com>"
LABEL version="2.2.0"
LABEL description="Facebook Auto Bot Phase 2.2 - Session Management & VPN Integration"
LABEL license="MIT"

# 构建说明:
# 1. 构建镜像: docker build -t facebook-bot-phase2:2.2.0 .
# 2. 运行容器: docker run -d --name phase2 -p 3000:3000 --env-file .env facebook-bot-phase2:2.2.0
# 3. 查看日志: docker logs -f phase2
# 4. 进入容器: docker exec -it phase2 sh

# 生产环境建议:
# 1. 使用特定的用户ID运行
# 2. 配置资源限制
# 3. 使用只读根文件系统
# 4. 配置安全上下文
# 5. 使用密钥管理服务