# Phase 2.2 VPN管理器与健康监控系统 - 安装指南

## 系统要求

### 最低要求
- **操作系统**: Linux (Ubuntu 20.04+, CentOS 8+, Debian 11+)
- **CPU**: 2核心
- **内存**: 4GB RAM
- **存储**: 20GB可用空间
- **网络**: 稳定的互联网连接

### 推荐配置
- **操作系统**: Ubuntu 22.04 LTS
- **CPU**: 4核心
- **内存**: 8GB RAM
- **存储**: 50GB SSD
- **网络**: 100Mbps+带宽

### 软件依赖
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Node.js**: 18+ (仅开发需要)
- **Git**: 2.30+

## 快速安装

### 方法一：使用Docker Compose（推荐）

1. **克隆项目**
   ```bash
   git clone https://github.com/your-org/phase2.2-vpn-health-monitoring.git
   cd phase2.2-vpn-health-monitoring
   ```

2. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑.env文件，配置必要的环境变量
   nano .env
   ```

3. **启动服务**
   ```bash
   docker-compose up -d
   ```

4. **验证安装**
   ```bash
   curl http://localhost:3000/health
   # 应该返回 {"status":"healthy","timestamp":"...","service":"phase2.2-vpn-health-monitoring","version":"1.0.0"}
   ```

### 方法二：手动安装

1. **安装系统依赖**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install -y docker.io docker-compose git curl
   sudo systemctl enable --now docker
   
   # CentOS/RHEL
   sudo yum install -y docker docker-compose git curl
   sudo systemctl enable --now docker
   ```

2. **安装Node.js（开发环境）**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

3. **安装PostgreSQL和Redis**
   ```bash
   # 使用Docker安装
   docker run -d --name postgres \
     -e POSTGRES_PASSWORD=yourpassword \
     -p 5432:5432 \
     postgres:15-alpine
   
   docker run -d --name redis \
     -p 6379:6379 \
     redis:7-alpine
   ```

4. **构建和运行应用**
   ```bash
   npm install
   npm run build
   npm start
   ```

## 详细配置

### 环境变量配置

编辑 `.env` 文件，配置以下关键变量：

```bash
# 数据库配置
DATABASE_URL=postgresql://username:password@localhost:5432/vpn_health_db
REDIS_URL=redis://localhost:6379

# 服务器配置
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# VPN配置
OPENVPN_CONFIG_PATH=./config/openvpn
WIREGUARD_CONFIG_PATH=./config/wireguard
VPN_CONNECTION_TIMEOUT=30000
VPN_RETRY_ATTEMPTS=3

# 健康监控
HEALTH_CHECK_INTERVAL=300000
RISK_THRESHOLD_HIGH=0.8
RISK_THRESHOLD_MEDIUM=0.5
AUTO_REPAIR_ENABLED=true

# 安全配置（必须修改！）
JWT_SECRET=your-very-secure-jwt-secret-key-here
ENCRYPTION_KEY=your-very-secure-encryption-key-here

# 外部服务
IP_GEOLOCATION_API_KEY=your-api-key-here
```

### VPN配置文件准备

1. **OpenVPN配置**
   ```bash
   mkdir -p config/openvpn
   # 将你的.ovpn配置文件复制到config/openvpn/
   cp ~/your-vpn-config.ovpn config/openvpn/
   ```

2. **WireGuard配置**
   ```bash
   mkdir -p config/wireguard
   # 生成WireGuard配置
   node scripts/generate-wireguard-config.js
   ```

### 数据库初始化

1. **创建数据库**
   ```sql
   CREATE DATABASE vpn_health_db;
   CREATE USER vpn_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE vpn_health_db TO vpn_user;
   ```

2. **运行迁移**
   ```bash
   # 使用Docker Compose时自动运行
   # 手动运行：
   psql -U vpn_user -d vpn_health_db -f init-db.sql
   ```

## 系统优化

### 性能优化

1. **调整Docker资源限制**
   ```yaml
   # 在docker-compose.yml中添加
   app:
     deploy:
       resources:
         limits:
           cpus: '2'
           memory: 4G
   ```

2. **数据库优化**
   ```sql
   -- 调整PostgreSQL配置
   ALTER SYSTEM SET shared_buffers = '1GB';
   ALTER SYSTEM SET effective_cache_size = '3GB';
   ALTER SYSTEM SET work_mem = '16MB';
   ```

3. **Redis优化**
   ```bash
   # 启用持久化
   redis-cli config set save "900 1 300 10 60 10000"
   ```

### 安全加固

1. **防火墙配置**
   ```bash
   # 只允许必要端口
   sudo ufw allow 22/tcp
   sudo ufw allow 3000/tcp
   sudo ufw allow 5432/tcp
   sudo ufw enable
   ```

2. **SSL/TLS配置**
   ```bash
   # 使用Let's Encrypt获取证书
   sudo apt install certbot
   sudo certbot certonly --standalone -d your-domain.com
   
   # 配置Nginx反向代理
   # 参考: config/nginx/ssl.conf
   ```

3. **定期备份**
   ```bash
   # 创建备份脚本
   cp scripts/backup.sh /usr/local/bin/vpn-backup
   chmod +x /usr/local/bin/vpn-backup
   
   # 设置定时任务
   echo "0 2 * * * /usr/local/bin/vpn-backup" | sudo crontab -
   ```

## 故障排除

### 常见问题

1. **Docker容器启动失败**
   ```bash
   # 查看日志
   docker-compose logs app
   
   # 常见原因：端口冲突
   netstat -tulpn | grep :3000
   ```

2. **数据库连接失败**
   ```bash
   # 测试数据库连接
   docker-compose exec postgres psql -U vpn_user -d vpn_health_db
   
   # 检查环境变量
   echo $DATABASE_URL
   ```

3. **VPN连接失败**
   ```bash
   # 检查OpenVPN/WireGuard安装
   which openvpn
   which wg
   
   # 查看VPN日志
   tail -f logs/vpn.log
   ```

4. **内存不足**
   ```bash
   # 查看内存使用
   free -h
   
   # 调整Docker内存限制
   docker update --memory=4g phase2.2-vpn-health-monitoring_app_1
   ```

### 日志位置

- **应用日志**: `logs/combined.log`
- **错误日志**: `logs/error.log`
- **VPN日志**: `config/openvpn/*.log`
- **Docker日志**: `docker-compose logs [service]`

### 监控和调试

1. **健康检查**
   ```bash
   curl http://localhost:3000/health
   ```

2. **API测试**
   ```bash
   # 获取VPN状态
   curl http://localhost:3000/api/vpn/status
   
   # 运行健康检查
   curl -X POST http://localhost:3000/api/health/run
   ```

3. **性能监控**
   ```bash
   # 查看系统资源
   docker stats
   
   # 查看应用指标
   curl http://localhost:3000/api/monitoring/metrics
   ```

## 升级指南

### 从旧版本升级

1. **备份当前数据**
   ```bash
   ./scripts/backup.sh
   ```

2. **停止服务**
   ```bash
   docker-compose down
   ```

3. **更新代码**
   ```bash
   git pull origin main
   ```

4. **重建镜像**
   ```bash
   docker-compose build --no-cache
   ```

5. **启动服务**
   ```bash
   docker-compose up -d
   ```

6. **运行迁移**
   ```bash
   docker-compose exec app npm run migrate
   ```

### 版本兼容性

| 版本 | Node.js | PostgreSQL | Redis | Docker |
|------|---------|------------|-------|--------|
| 1.0.0 | 18+ | 15+ | 7+ | 20.10+ |
| 0.9.0 | 16+ | 13+ | 6+ | 19.03+ |

## 卸载指南

### 完全卸载

1. **停止并删除容器**
   ```bash
   docker-compose down -v
   ```

2. **删除镜像**
   ```bash
   docker rmi phase2.2-vpn-health-monitoring_app
   ```

3. **删除数据卷**
   ```bash
   docker volume rm phase2.2-vpn-health-monitoring_postgres_data
   docker volume rm phase2.2-vpn-health-monitoring_redis_data
   ```

4. **删除项目文件**
   ```bash
   cd ..
   rm -rf phase2.2-vpn-health-monitoring
   ```

### 保留数据卸载

1. **备份数据**
   ```bash
   ./scripts/backup.sh
   ```

2. **停止服务**
   ```bash
   docker-compose down
   ```

3. **保留数据卷**
   ```bash
   # 数据卷会自动保留
   # 重新安装时数据会恢复
   ```

## 获取帮助

### 文档资源
- [API文档](http://localhost:3000/api-docs) (运行后访问)
- [配置指南](./CONFIGURATION.md)
- [故障排除](./TROUBLESHOOTING.md)

### 支持渠道
- **GitHub Issues**: 报告bug和功能请求
- **Discord社区**: 实时技术支持
- **电子邮件支持**: support@your-org.com

### 紧急联系
- **安全漏洞**: security@your-org.com
- **生产问题**: ops@your-org.com

---

**安装完成！** 系统现在应该运行在 http://localhost:3000

下一步：
1. 访问管理界面: http://localhost:3000
2. 配置第一个VPN连接
3. 设置健康监控规则
4. 配置告警通知

如有问题，请参考故障排除章节或联系支持团队。