# Facebook Auto Bot 快速部署指南

## 概述
本文档提供 Facebook Auto Bot 项目的快速部署指南，帮助您在 30 分钟内完成生产环境部署。

## 前提条件

### 硬件要求
- CPU: 2核以上
- 内存: 4GB以上
- 磁盘: 20GB以上可用空间

### 软件要求
- Ubuntu 20.04 LTS 或更高版本
- Docker 20.10 或更高版本
- Docker Compose 2.0 或更高版本
- Git

## 快速部署步骤

### 步骤 1: 准备服务器
```bash
# 1.1 更新系统
sudo apt-get update
sudo apt-get upgrade -y

# 1.2 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 1.3 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 1.4 验证安装
docker --version
docker-compose --version
```

### 步骤 2: 获取代码
```bash
# 2.1 克隆代码库
git clone https://github.com/your-repo/fbautobot.git
cd fbautobot

# 2.2 切换到部署目录
cd /opt/fbautobot  # 或您选择的部署目录
```

### 步骤 3: 一键部署
```bash
# 3.1 设置执行权限
chmod +x deployment-scripts/*.sh

# 3.2 运行一键部署脚本
./deployment-scripts/setup-environment.sh all
./deployment-scripts/deploy-production.sh deploy
```

### 步骤 4: 验证部署
```bash
# 4.1 运行健康检查
./deployment-scripts/health-check.sh quick

# 4.2 检查服务状态
docker-compose -f docker-compose.prod.yml ps

# 4.3 查看部署日志
docker-compose -f docker-compose.prod.yml logs -f
```

## 访问服务

### 本地访问
- **前端应用**: http://localhost:80
- **后端API**: http://localhost:3000
- **监控面板**: http://localhost:3001 (用户名: admin, 密码: 查看 .env.production 中的 GRAFANA_ADMIN_PASSWORD)
- **Prometheus**: http://localhost:9090

### 生产环境访问
配置域名解析后访问：
- **前端应用**: https://yourdomain.com
- **后端API**: https://api.yourdomain.com
- **监控面板**: https://monitor.yourdomain.com

## 常用命令

### 服务管理
```bash
# 启动所有服务
./deployment-scripts/deploy-production.sh deploy

# 停止所有服务
./deployment-scripts/deploy-production.sh stop

# 重启所有服务
./deployment-scripts/deploy-production.sh restart

# 查看服务状态
./deployment-scripts/deploy-production.sh status

# 查看服务日志
./deployment-scripts/deploy-production.sh logs
```

### 监控和健康检查
```bash
# 快速健康检查
./deployment-scripts/health-check.sh quick

# 综合健康检查
./deployment-scripts/health-check.sh comprehensive

# 监控系统检查
./deployment-scripts/health-check.sh monitoring
```

### 备份和恢复
```bash
# 完整备份
./deployment-scripts/backup-restore.sh full

# 仅备份数据库
./deployment-scripts/backup-restore.sh database

# 列出所有备份
./deployment-scripts/backup-restore.sh list

# 从备份恢复
./deployment-scripts/backup-restore.sh restore backups/fbautobot_backup_*.tar.gz
```

### 更新和升级
```bash
# 更新环境变量后重新部署
./deployment-scripts/deploy-production.sh deploy

# 滚动更新（不中断服务）
./deployment-scripts/deploy-production.sh update
```

## 故障排除

### 常见问题

#### 1. 端口冲突
```bash
# 检查端口占用
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# 停止占用端口的服务或修改配置
```

#### 2. Docker 容器启动失败
```bash
# 查看容器日志
docker logs fbautobot-backend
docker logs fbautobot-postgres

# 检查容器状态
docker ps -a

# 重新构建镜像
docker-compose -f docker-compose.prod.yml build --no-cache
```

#### 3. 数据库连接失败
```bash
# 检查数据库服务
docker-compose -f docker-compose.prod.yml ps postgres

# 检查数据库日志
docker-compose -f docker-compose.prod.yml logs postgres

# 测试数据库连接
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U ${DB_USER}
```

#### 4. 内存不足
```bash
# 查看内存使用
free -h

# 查看 Docker 资源使用
docker stats

# 调整 Docker 资源限制
# 编辑 docker-compose.prod.yml，添加资源限制
```

### 紧急恢复

#### 服务完全不可用
```bash
# 1. 停止所有服务
./deployment-scripts/deploy-production.sh stop

# 2. 备份当前状态
cp -r data/ data_backup_$(date +%Y%m%d_%H%M%S)/

# 3. 清理 Docker
docker system prune -a -f

# 4. 重新部署
./deployment-scripts/deploy-production.sh deploy
```

#### 数据损坏
```bash
# 1. 停止服务
./deployment-scripts/deploy-production.sh stop

# 2. 从备份恢复
./deployment-scripts/backup-restore.sh restore [最新备份文件]

# 3. 启动服务
./deployment-scripts/deploy-production.sh deploy
```

## 安全配置

### 初始安全设置
1. **修改默认密码**: 编辑 `.env.production` 文件，修改所有密码
2. **配置防火墙**: 只开放必要端口 (80, 443, 22)
3. **启用 SSL**: 配置有效的 SSL 证书
4. **限制访问**: 配置 IP 白名单（如需要）

### 定期安全维护
1. **更新系统**: `sudo apt-get update && sudo apt-get upgrade`
2. **更新镜像**: `docker-compose -f docker-compose.prod.yml pull`
3. **安全扫描**: 定期运行安全扫描工具
4. **审计日志**: 定期检查安全日志

## 性能优化

### 基础优化
```bash
# 调整 Docker 资源限制
# 在 docker-compose.prod.yml 中添加：
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G

# 优化 Nginx 配置
# 根据 CPU 核心数调整 worker_processes
worker_processes auto;
```

### 高级优化（可选）
1. **启用 CDN**: 配置 Cloudflare 或其他 CDN 服务
2. **数据库优化**: 根据负载调整数据库配置
3. **缓存优化**: 调整 Redis 缓存策略
4. **负载均衡**: 添加更多后端实例

## 监控和维护

### 日常监控
1. **检查服务状态**: 每天至少一次 `./deployment-scripts/health-check.sh quick`
2. **查看监控面板**: 访问 Grafana 查看系统状态
3. **检查日志**: 查看关键错误日志
4. **备份验证**: 验证备份是否成功

### 定期维护
1. **每周**: 完整健康检查，清理旧日志
2. **每月**: 安全更新，性能评估
3. **每季度**: 系统升级，安全审计

## 获取帮助

### 文档资源
- **详细部署指南**: `PRODUCTION_DEPLOYMENT_CONFIG.md`
- **部署检查清单**: `DEPLOYMENT_CHECKLIST.md`
- **故障排除指南**: 查看 `docs/` 目录

### 技术支持
- **GitHub Issues**: 报告问题和功能请求
- **社区论坛**: 获取社区支持
- **官方文档**: 查看最新文档

### 紧急联系
- **运维团队**: [联系信息]
- **技术支持**: [支持邮箱]
- **安全事件**: [安全团队联系]

## 下一步

### 完成部署后
1. **配置域名**: 将域名指向服务器 IP
2. **配置 SSL**: 申请和配置 SSL 证书
3. **测试功能**: 全面测试所有业务功能
4. **用户培训**: 培训用户使用系统

### 扩展功能
1. **高可用**: 配置多节点集群
2. **自动扩缩容**: 配置自动扩缩容策略
3. **灾难恢复**: 建立跨区域备份
4. **CI/CD**: 配置完整的 CI/CD 流水线

---

**最后更新**: $(date +%Y-%m-%d)
**版本**: v1.0
**适用环境**: 生产环境