# Facebook Auto Bot - Phase 5.0 实时数据同步系统部署指南

## 系统架构概述

Phase 5.0 实时数据同步系统包含以下核心组件：

1. **WebSocket 服务器** (`/workspace/websocket-server`)
2. **实时推送系统** (`/workspace/real-time-push`)
3. **数据同步模块** (`/workspace/data-sync`)
4. **实时监控界面** (`/workspace/real-time-monitor`)

## 环境要求

### 硬件要求
- CPU: 2核以上
- 内存: 4GB以上
- 磁盘: 10GB以上可用空间

### 软件要求
- Node.js: >= 18.0.0
- Redis: >= 6.0.0
- PostgreSQL: >= 13.0 (可选，用于数据持久化)
- Nginx: >= 1.18 (生产环境推荐)

## 部署步骤

### 步骤 1: 环境准备

#### 1.1 安装 Node.js
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version
npm --version
```

#### 1.2 安装 Redis
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# CentOS/RHEL
sudo yum install -y epel-release
sudo yum install -y redis
sudo systemctl enable redis
sudo systemctl start redis

# 验证安装
redis-cli ping
```

#### 1.3 安装 PostgreSQL (可选)
```bash
# Ubuntu/Debian
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# CentOS/RHEL
sudo yum install -y postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 步骤 2: 配置 Redis

#### 2.1 基本配置
编辑 Redis 配置文件 (`/etc/redis/redis.conf`):

```conf
# 绑定地址 (生产环境建议设置具体IP)
bind 127.0.0.1

# 保护模式
protected-mode yes

# 端口
port 6379

# 密码认证 (生产环境必须设置)
requirepass your-strong-password

# 最大内存
maxmemory 1gb
maxmemory-policy allkeys-lru

# 持久化
save 900 1
save 300 10
save 60 10000

# 日志级别
loglevel notice
logfile /var/log/redis/redis-server.log

# 客户端连接数
maxclients 10000
```

#### 2.2 重启 Redis
```bash
sudo systemctl restart redis-server
```

#### 2.3 测试连接
```bash
redis-cli -a your-strong-password ping
```

### 步骤 3: 部署 WebSocket 服务器

#### 3.1 安装依赖
```bash
cd /workspace/websocket-server
npm install --production
```

#### 3.2 环境配置
```bash
cp .env.example .env
```

编辑 `.env` 文件:
```env
# WebSocket Server Configuration
NODE_ENV=production
WS_PORT=3002

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-strong-password
REDIS_DB=0

# JWT Configuration
JWT_SECRET=your-very-secure-jwt-secret-key
JWT_EXPIRY=7d

# CORS Configuration
FRONTEND_URL=https://your-domain.com

# Connection Limits
MAX_CONNECTIONS=1000
MAX_PAYLOAD_SIZE=1048576

# Logging
LOG_LEVEL=info
```

#### 3.3 构建项目
```bash
npm run build
```

#### 3.4 使用 PM2 管理进程
```bash
# 安装 PM2
npm install -g pm2

# 启动 WebSocket 服务器
pm2 start dist/main.js --name "websocket-server" \
  --log /var/log/websocket-server.log \
  --error /var/log/websocket-server-error.log \
  --time

# 设置开机自启
pm2 startup
pm2 save
```

#### 3.5 验证运行状态
```bash
pm2 status websocket-server
pm2 logs websocket-server --lines 50
```

### 步骤 4: 配置 Nginx 反向代理 (生产环境)

#### 4.1 安装 Nginx
```bash
# Ubuntu/Debian
sudo apt-get install -y nginx

# CentOS/RHEL
sudo yum install -y nginx
```

#### 4.2 配置 WebSocket 代理
创建配置文件 `/etc/nginx/sites-available/websocket`:

```nginx
upstream websocket_backend {
    server 127.0.0.1:3002;
    keepalive 64;
}

server {
    listen 80;
    server_name ws.your-domain.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ws.your-domain.com;
    
    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/ws.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ws.your-domain.com/privkey.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # WebSocket 代理配置
    location /ws/ {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        
        # 缓冲区设置
        proxy_buffering off;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
    
    # 健康检查
    location /health {
        proxy_pass http://websocket_backend;
        proxy_set_header Host $host;
        access_log off;
    }
    
    # 访问日志
    access_log /var/log/nginx/websocket-access.log;
    error_log /var/log/nginx/websocket-error.log;
}
```

#### 4.3 启用配置
```bash
sudo ln -s /etc/nginx/sites-available/websocket /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 步骤 5: 部署实时推送系统

#### 5.1 安装依赖
```bash
cd /workspace/real-time-push
npm install --production
```

#### 5.2 环境配置
创建 `.env` 文件:
```env
# Push Service Configuration
NODE_ENV=production
PUSH_SERVICE_PORT=3003

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-strong-password
REDIS_DB=1

# WebSocket Configuration
WEBSOCKET_URL=ws://localhost:3002/ws

# Queue Configuration
ENABLE_QUEUE=true
QUEUE_NAME=push-queue
MAX_RETRIES=3
RETRY_DELAY=1000

# Batch Configuration
BATCH_SIZE=10
BATCH_INTERVAL=5000

# Metrics
ENABLE_METRICS=true
METRICS_INTERVAL=60000
```

#### 5.3 构建和启动
```bash
npm run build
pm2 start dist/index.js --name "real-time-push" \
  --log /var/log/real-time-push.log \
  --error /var/log/real-time-push-error.log
```

### 步骤 6: 配置系统服务

#### 6.1 创建 systemd 服务文件
创建 `/etc/systemd/system/facebook-bot-websocket.service`:

```ini
[Unit]
Description=Facebook Auto Bot WebSocket Server
After=network.target redis.service
Requires=redis.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/workspace/websocket-server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=facebook-bot-websocket

# 安全设置
NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=true
PrivateDevices=true
ProtectHome=true
ReadWritePaths=/workspace/websocket-server/logs

[Install]
WantedBy=multi-user.target
```

#### 6.2 启用服务
```bash
sudo systemctl daemon-reload
sudo systemctl enable facebook-bot-websocket
sudo systemctl start facebook-bot-websocket
sudo systemctl status facebook-bot-websocket
```

### 步骤 7: 监控和日志

#### 7.1 配置日志轮转
创建 `/etc/logrotate.d/facebook-bot`:

```conf
/var/log/websocket-server.log
/var/log/real-time-push.log
/workspace/websocket-server/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
    sharedscripts
    postrotate
        systemctl reload facebook-bot-websocket > /dev/null 2>&1 || true
    endscript
}
```

#### 7.2 安装监控工具
```bash
# 安装 netdata (实时监控)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# 或安装 Prometheus + Grafana
# 参考: https://prometheus.io/docs/introduction/overview/
```

### 步骤 8: 安全加固

#### 8.1 防火墙配置
```bash
# 允许必要端口
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3002/tcp
sudo ufw enable

# 或使用 firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=3002/tcp
sudo firewall-cmd --reload
```

#### 8.2 SSL 证书配置
```bash
# 使用 Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ws.your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

#### 8.3 系统更新
```bash
# 定期更新系统
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get autoremove -y

# 设置自动安全更新
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 步骤 9: 性能优化

#### 9.1 Redis 优化
```conf
# /etc/redis/redis.conf
# 启用 AOF 持久化
appendonly yes
appendfsync everysec

# 内存优化
maxmemory 2gb
maxmemory-policy allkeys-lru

# 连接优化
tcp-keepalive 60
timeout 0
tcp-backlog 511
```

#### 9.2 Node.js 优化
```bash
# 调整 Node.js 内存限制
export NODE_OPTIONS="--max-old-space-size=2048"

# 使用集群模式 (多核CPU)
pm2 start dist/main.js -i max --name "websocket-cluster"
```

#### 9.3 系统优化
```bash
# 调整文件描述符限制
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# 调整内核参数
echo "net.core.somaxconn = 65535" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65535" | sudo tee -a /etc/sysctl.conf
echo "fs.file-max = 2097152" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 步骤 10: 测试部署

#### 10.1 健康检查
```bash
# WebSocket 服务器健康检查
curl -f http://localhost:3002/health || echo "WebSocket server is down"

# Redis 健康检查
redis-cli -a your-strong-password ping

# Nginx 健康检查
curl -f https://ws.your-domain.com/health || echo "Nginx is down"
```

#### 10.2 功能测试
```javascript
// 测试脚本 test-websocket.js
const { io } = require('socket.io-client');

const socket = io('wss://ws.your-domain.com/ws', {
  transports: ['websocket'],
  reconnection: true,
});

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  
  // 测试认证
  socket.emit('auth', { token: 'test-token' });
});

socket.on('auth_success', (data) => {
  console.log('✅ Authentication successful:', data);
  
  // 测试订阅
  socket.emit('subscribe', { channel: 'test-channel' });
});

socket.on('subscribed', (data) => {
  console.log('✅ Subscribed to channel:', data.channel);
  
  // 测试消息发送
  socket.emit('message', {
    type: 'echo',
    data: { message: 'Test message' },
    requestId: 'test-123',
  });
});

socket.on('message_response', (data) => {
  console.log('✅ Message response received:', data);
  
  // 测试完成，断开连接
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

socket.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('ℹ️ Disconnected:', reason);
});

// 超时处理
setTimeout(() => {
  console.error('❌ Test timeout');
  process.exit(1);
}, 10000);
```

运行测试:
```bash
cd /workspace
node test-websocket.js
```

#### 10.3 负载测试
```bash
# 安装 artillery
npm install -g artillery

# 创建负载测试配置 load-test.yml
cat > load-test.yml << 'EOF'
config:
  target: "wss://ws.your-domain.com"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
    - duration: 30
      arrivalRate: 100
      name: "Peak load"
  ws:
    # WebSocket specific configuration
    subprotocols: []
    
scenarios:
  - name: "WebSocket connection test"
    engine: "ws"
    flow:
      - think: 1
      - send: '{"type":"auth","token":"test-token"}'
      - think: 1
      - send: '{"type":"subscribe","channel":"test-channel"}'
      - think: 5
      - send: '{"type":"ping"}'
      - think: 5
EOF

# 运行负载测试
artillery run load-test.yml --output load-test-report.json
artillery report load-test-report.json
```

## 故障排除

### 常见问题

#### 问题 1: WebSocket 连接失败
**症状**: 客户端无法连接到 WebSocket 服务器
**解决方案**:
1. 检查防火墙设置: `sudo ufw status`
2. 检查 Nginx 配置: `sudo nginx -t`
3. 检查 WebSocket 服务器日志: `pm2 logs websocket-server`
4. 验证端口监听: `sudo netstat -tlnp | grep :3002`

#### 问题 2: Redis 连接失败
**症状**: WebSocket 服务器无法连接 Redis
**解决方案**:
1. 检查 Redis 服务状态: `sudo systemctl status redis`
2. 检查 Redis 密码配置
3. 检查网络连接: `redis-cli -h localhost -p 6379 -a your-password ping`
4. 检查 Redis 内存使用: `redis-cli info memory`

#### 问题 3: 高内存使用
**症状**: 服务器内存使用率过高
**解决方案**:
1. 检查内存泄漏: `pm2 monit websocket-server
2. 调整 Node.js 内存限制: `export NODE_OPTIONS="--max-old-space-size=2048"`
3. 优化 Redis 内存策略: 在 redis.conf 中设置 `maxmemory-policy allkeys-lru`
4. 重启服务: `pm2 restart websocket-server`

#### 问题 4: 连接数达到上限
**症状**: 新客户端无法连接，错误提示连接数限制
**解决方案**:
1. 增加最大连接数: 在 .env 中设置 `MAX_CONNECTIONS=2000`
2. 调整系统文件描述符限制
3. 使用负载均衡器分发连接
4. 考虑水平扩展，部署多个 WebSocket 服务器实例

#### 问题 5: 消息延迟过高
**症状**: 实时消息推送延迟超过1秒
**解决方案**:
1. 检查网络延迟: `ping ws.your-domain.com`
2. 优化 Redis 配置，使用更快的持久化策略
3. 减少批处理间隔: 在推送服务配置中调整 `BATCH_INTERVAL`
4. 检查服务器负载，考虑升级硬件或增加节点

### 监控指标

#### 关键性能指标 (KPI)
1. **连接成功率**: > 99.9%
2. **消息延迟**: < 1秒 (95% percentile)
3. **系统可用性**: > 99.9%
4. **错误率**: < 0.1%
5. **并发连接数**: 根据业务需求设定

#### 监控命令
```bash
# 实时连接数
redis-cli -a your-password scard active_clients

# 消息吞吐量
redis-cli -a your-password get push:stats:messages_per_second

# 系统负载
top -b -n 1 | grep -E "(Cpu|Mem)"

# 网络连接
ss -tlnp | grep :3002
```

## 备份和恢复

### 数据备份策略

#### 1. Redis 数据备份
```bash
# 创建备份目录
sudo mkdir -p /backup/redis
sudo chown redis:redis /backup/redis

# 手动备份
sudo redis-cli -a your-password save
sudo cp /var/lib/redis/dump.rdb /backup/redis/dump-$(date +%Y%m%d).rdb

# 自动备份脚本 (/usr/local/bin/redis-backup.sh)
#!/bin/bash
BACKUP_DIR="/backup/redis"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/dump-$DATE.rdb"

redis-cli -a your-password save
cp /var/lib/redis/dump.rdb "$BACKUP_FILE"

# 保留最近7天备份
find "$BACKUP_DIR" -name "dump-*.rdb" -mtime +7 -delete

# 设置定时任务
echo "0 2 * * * root /usr/local/bin/redis-backup.sh" | sudo tee -a /etc/crontab
```

#### 2. 配置文件备份
```bash
# 备份所有配置文件
sudo tar -czf /backup/configs/facebook-bot-config-$(date +%Y%m%d).tar.gz \
  /workspace/websocket-server/.env \
  /workspace/real-time-push/.env \
  /etc/nginx/sites-available/websocket \
  /etc/redis/redis.conf
```

#### 3. 日志备份
```bash
# 使用 logrotate 自动管理日志
# 配置已在步骤 7.1 中完成
```

### 灾难恢复

#### 恢复步骤
1. **恢复 Redis 数据**:
```bash
# 停止 Redis
sudo systemctl stop redis

# 恢复备份文件
sudo cp /backup/redis/dump-latest.rdb /var/lib/redis/dump.rdb
sudo chown redis:redis /var/lib/redis/dump.rdb

# 启动 Redis
sudo systemctl start redis
```

2. **恢复配置文件**:
```bash
# 解压备份
sudo tar -xzf /backup/configs/facebook-bot-config-latest.tar.gz -C /

# 重启服务
sudo systemctl restart nginx
pm2 restart all
```

3. **验证恢复**:
```bash
# 运行健康检查
./health-check.sh

# 运行功能测试
node test-websocket.js
```

## 扩展和升级

### 水平扩展

#### 多节点部署架构
```
                    [Load Balancer]
                          |
        ---------------------------------
        |                               |
[WebSocket Node 1]             [WebSocket Node 2]
        |                               |
        ---------------------------------
                          |
                    [Redis Cluster]
```

#### 部署步骤
1. **设置 Redis 集群**:
```bash
# 参考: https://redis.io/docs/management/scaling/
redis-cli --cluster create \
  192.168.1.10:6379 192.168.1.11:6379 192.168.1.12:6379 \
  192.168.1.13:6379 192.168.1.14:6379 192.168.1.15:6379 \
  --cluster-replicas 1
```

2. **部署多个 WebSocket 节点**:
```bash
# 在每个节点上重复部署步骤
# 修改配置使用 Redis 集群
REDIS_HOST=redis-cluster
REDIS_CLUSTER=true
```

3. **配置负载均衡器**:
```nginx
# Nginx 负载均衡配置
upstream websocket_cluster {
    least_conn;
    server 192.168.1.10:3002;
    server 192.168.1.11:3002;
    server 192.168.1.12:3002;
    keepalive 64;
}
```

### 版本升级

#### 升级步骤
1. **准备阶段**:
```bash
# 1. 备份当前版本
git tag v1.0.0-production
tar -czf /backup/facebook-bot-v1.0.0-$(date +%Y%m%d).tar.gz /workspace

# 2. 测试新版本
git checkout v1.1.0
npm install
npm test
npm run build

# 3. 部署到测试环境
# 运行集成测试
```

2. **滚动更新**:
```bash
# 1. 更新第一个节点
pm2 stop websocket-server
git pull origin main
npm install --production
npm run build
pm2 start websocket-server

# 2. 验证节点健康
./health-check.sh

# 3. 逐步更新其他节点
# 重复步骤1-2
```

3. **回滚计划**:
```bash
# 如果升级失败，快速回滚
pm2 stop websocket-server
git checkout v1.0.0
npm install --production
npm run build
pm2 start websocket-server
```

## 维护计划

### 日常维护任务

#### 每日检查
```bash
# 1. 检查服务状态
pm2 status
sudo systemctl status nginx redis

# 2. 检查日志错误
tail -100 /var/log/websocket-server-error.log | grep -i error

# 3. 检查资源使用
free -h
df -h
top -b -n 1 | head -20

# 4. 检查连接数
redis-cli -a your-password scard active_clients
```

#### 每周维护
```bash
# 1. 清理旧日志
sudo logrotate -f /etc/logrotate.d/facebook-bot

# 2. 更新系统包
sudo apt-get update && sudo apt-get upgrade -y

# 3. 重启服务（滚动重启）
pm2 restart websocket-server --update-env

# 4. 运行完整测试
npm test
./integration-test.sh
```

#### 每月维护
```bash
# 1. 安全审计
sudo lynis audit system

# 2. 性能分析
node --prof dist/main.js
# 分析生成的分析文件

# 3. 备份验证
# 测试恢复流程

# 4. 容量规划
# 分析增长趋势，规划扩容
```

### 监控告警配置

#### 关键告警指标
1. **服务不可用**: WebSocket 服务宕机超过5分钟
2. **高错误率**: 错误率超过1%持续10分钟
3. **高延迟**: 消息延迟超过2秒持续5分钟
4. **高内存使用**: 内存使用率超过80%
5. **连接数激增**: 连接数超过阈值的80%

#### 告警通知渠道
- Email 通知
- Slack/Teams Webhook
- SMS 通知（关键告警）
- 电话呼叫（紧急告警）

## 安全最佳实践

### 1. 网络安全
```bash
# 使用防火墙限制访问
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24 to any port 22
sudo ufw allow from 0.0.0.0/0 to any port 443
sudo ufw enable

# 使用 VPN 访问管理接口
# 配置 SSH 密钥认证，禁用密码登录
```

### 2. 应用安全
```bash
# 定期更新依赖
npm audit
npm audit fix

# 使用安全 Headers
# 在 Nginx 配置中添加:
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
```

### 3. 数据安全
```bash
# 加密敏感数据
# 使用环境变量存储密钥
# 定期轮换 JWT 密钥和 Redis 密码

# 数据脱敏
# 日志中不记录敏感信息
```

### 4. 访问控制
```bash
# 最小权限原则
# 为每个服务创建专用用户
sudo useradd -r -s /bin/false websocket-user
sudo chown -R websocket-user:websocket-user /workspace/websocket-server

# API 速率限制
# 在 Nginx 中配置:
limit_req_zone $binary_remote_addr zone=wslimit:10m rate=10r/s;
limit_req zone=wslimit burst=20 nodelay;
```

## 性能调优

### 1. WebSocket 服务器调优
```javascript
// 在 WebSocket 网关配置中调整
@WebSocketGateway({
  pingInterval: 25000,  // 减少心跳间隔
  pingTimeout: 50000,   // 减少超时时间
  maxHttpBufferSize: 2e6, // 增加缓冲区大小
  transports: ['websocket'], // 仅使用 WebSocket
  allowEIO3: true,      // 兼容旧客户端
})
```

### 2. Redis 调优
```conf
# redis.conf
# 启用管道
repl-disable-tcp-nodelay no

# 优化内存
hash-max-ziplist-entries 512
hash-max-ziplist-value 64

# 连接池
maxclients 10000
timeout 300
```

### 3. 操作系统调优
```bash
# 调整 TCP 参数
echo "net.ipv4.tcp_fin_timeout = 30" >> /etc/sysctl.conf
echo "net.ipv4.tcp_tw_reuse = 1" >> /etc/sysctl.conf
echo "net.ipv4.tcp_tw_recycle = 1" >> /etc/sysctl.conf
echo "net.ipv4.tcp_keepalive_time = 1200" >> /etc/sysctl.conf
sudo sysctl -p
```

## 文档和培训

### 1. 操作手册
- 创建详细的操作手册
- 记录所有维护步骤
- 提供故障排除指南

### 2. 培训材料
- 系统架构培训
- 日常操作培训
- 应急响应培训

### 3. 知识库
- 常见问题解答
- 最佳实践文档
- 变更记录

## 支持联系方式

### 技术支持
- **紧急支持**: support@your-company.com (24/7)
- **一般问题**: help@your-company.com
- **电话**: +1-800-XXX-XXXX

### 文档资源
- **用户手册**: https://docs.your-company.com
- **API 文档**: https://api.your-company.com/docs
- **状态页面**: https://status.your-company.com

### 社区支持
- **GitHub Issues**: https://github.com/your-company/facebook-auto-bot/issues
- **Discord 社区**: https://discord.gg/your-community
- **Stack Overflow**: tag: facebook-auto-bot

---

*最后更新: 2024-01-01*
*版本: 1.0*
*作者: Facebook Auto Bot 运维团队*