# Puppeteer执行器Docker镜像
FROM node:20-slim

# 安装必要的系统依赖
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 创建工作目录
WORKDIR /app

# 复制package.json文件
COPY package*.json ./

# 安装Node.js依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建非root用户
RUN groupadd -r puppeteer && useradd -r -g puppeteer -G audio,video puppeteer \
    && mkdir -p /home/puppeteer/Downloads \
    && chown -R puppeteer:puppeteer /home/puppeteer \
    && chown -R puppeteer:puppeteer /app

# 切换到非root用户
USER puppeteer

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js || exit 1

# 启动命令
CMD ["node", "dist/main.js"]