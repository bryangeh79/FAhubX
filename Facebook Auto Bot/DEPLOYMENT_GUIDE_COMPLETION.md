2 monit websocket-server
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