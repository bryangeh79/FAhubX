# 备份系统

## 概述
Facebook Auto Bot 项目的完整备份恢复系统，支持数据库、文件系统和配置的备份。

## 备份策略

### 1. 数据库备份
- **全量备份**: 每天一次 (00:00 UTC)
- **增量备份**: 每小时一次
- **备份保留**: 30天
- **备份验证**: 自动验证备份完整性

### 2. 文件系统备份
- **配置文件**: 每天备份
- **上传文件**: 实时备份
- **日志文件**: 每周归档
- **备份压缩**: GZIP压缩
- **备份加密**: AES-256加密

### 3. 备份存储
- **本地存储**: `/var/backups/facebook-auto-bot/` (快速恢复)
- **远程存储**: SFTP/SCP到远程服务器 (灾难恢复)
- **云存储**: AWS S3 / Google Cloud Storage (长期归档)

## 目录结构

```
backup-system/
├── README.md                    # 本文档
├── backup-config.yaml           # 备份配置
├── scripts/
│   ├── database-backup.sh      # 数据库备份脚本
│   ├── filesystem-backup.sh    # 文件系统备份脚本
│   ├── backup-verify.sh        # 备份验证脚本
│   ├── backup-cleanup.sh       # 备份清理脚本
│   └── restore-database.sh     # 数据库恢复脚本
├── cron/
│   ├── daily-backup.cron       # 每日备份任务
│   ├── hourly-backup.cron      # 每小时备份任务
│   └── weekly-cleanup.cron     # 每周清理任务
└── docs/
    ├── backup-procedures.md    # 备份操作手册
    └── recovery-guide.md       # 恢复指南
```

## 快速开始

### 1. 安装依赖
```bash
# 安装必要的工具
sudo apt-get update
sudo apt-get install -y postgresql-client awscli gzip openssl
```

### 2. 配置备份
```bash
# 复制配置文件
cp backup-config.example.yaml backup-config.yaml

# 编辑配置文件
vim backup-config.yaml
```

### 3. 测试备份
```bash
# 测试数据库备份
./scripts/database-backup.sh --test

# 测试文件系统备份
./scripts/filesystem-backup.sh --test
```

### 4. 设置定时任务
```bash
# 安装cron任务
sudo cp cron/daily-backup.cron /etc/cron.d/facebook-auto-bot-daily
sudo cp cron/hourly-backup.cron /etc/cron.d/facebook-auto-bot-hourly
```

## 备份配置

### 数据库配置
```yaml
database:
  host: localhost
  port: 5432
  name: facebook_auto_bot
  username: postgres
  password: ${DB_PASSWORD}
  
  backup:
    format: custom        # custom, plain, directory
    compression: gzip     # gzip, none
    encryption: aes256    # aes256, none
    retention_days: 30
```

### 文件系统配置
```yaml
filesystem:
  paths:
    - /workspace/backend/src
    - /workspace/backend/config
    - /workspace/frontend/src
    - /workspace/frontend/public
    - /workspace/docker-compose.yml
    - /workspace/.env
    
  exclude:
    - "**/node_modules"
    - "**/.git"
    - "**/*.log"
    - "**/tmp"
    
  backup:
    compression: gzip
    encryption: aes256
    retention_days: 30
```

### 存储配置
```yaml
storage:
  local:
    path: /var/backups/facebook-auto-bot
    max_size_gb: 100
    
  remote:
    enabled: false
    type: sftp          # sftp, s3, gcs
    host: backup.example.com
    path: /backups/facebook-auto-bot
    username: backupuser
    password: ${REMOTE_PASSWORD}
    
  cloud:
    enabled: false
    provider: aws       # aws, gcp, azure
    bucket: facebook-auto-bot-backups
    region: us-east-1
```

## 备份脚本说明

### 1. 数据库备份脚本 (`database-backup.sh`)
```bash
# 全量备份
./scripts/database-backup.sh --full

# 增量备份
./scripts/database-backup.sh --incremental

# 指定数据库
./scripts/database-backup.sh --database=facebook_auto_bot

# 测试模式
./scripts/database-backup.sh --test
```

### 2. 文件系统备份脚本 (`filesystem-backup.sh`)
```bash
# 完整备份
./scripts/filesystem-backup.sh --full

# 增量备份
./scripts/filesystem-backup.sh --incremental

# 指定路径
./scripts/filesystem-backup.sh --path=/workspace/backend

# 测试模式
./scripts/filesystem-backup.sh --test
```

### 3. 备份验证脚本 (`backup-verify.sh`)
```bash
# 验证最新备份
./scripts/backup-verify.sh

# 验证指定备份
./scripts/backup-verify.sh --backup=2026-04-13_00-00-00

# 详细验证
./scripts/backup-verify.sh --verbose
```

### 4. 备份清理脚本 (`backup-cleanup.sh`)
```bash
# 清理过期备份
./scripts/backup-cleanup.sh

# 清理指定天数前的备份
./scripts/backup-cleanup.sh --days=30

# 模拟清理（不实际删除）
./scripts/backup-cleanup.sh --dry-run
```

### 5. 数据库恢复脚本 (`restore-database.sh`)
```bash
# 恢复最新备份
./scripts/restore-database.sh

# 恢复指定备份
./scripts/restore-database.sh --backup=2026-04-13_00-00-00

# 恢复到新数据库
./scripts/restore-database.sh --new-database=facebook_auto_bot_restored
```

## 监控和告警

### 备份状态监控
```bash
# 检查备份状态
./scripts/check-backup-status.sh

# 生成备份报告
./scripts/generate-backup-report.sh
```

### 告警配置
- **备份失败**: 立即通知
- **备份延迟**: 超过1小时通知
- **存储空间不足**: 低于10%通知
- **备份验证失败**: 立即通知

## 恢复流程

### 1. 数据误删除恢复
```bash
# 步骤1: 停止应用
docker-compose down

# 步骤2: 恢复数据库
./scripts/restore-database.sh --backup=最近的成功备份

# 步骤3: 启动应用
docker-compose up -d

# 步骤4: 验证恢复
./scripts/verify-recovery.sh
```

### 2. 系统故障恢复
```bash
# 步骤1: 在新服务器上恢复
./scripts/full-system-restore.sh

# 步骤2: 配置环境
cp .env.example .env
vim .env

# 步骤3: 启动服务
docker-compose up -d
```

### 3. 灾难恢复
```bash
# 步骤1: 从云存储恢复
./scripts/cloud-restore.sh --provider=aws --bucket=backups

# 步骤2: 重建基础设施
./scripts/infrastructure-setup.sh

# 步骤3: 恢复数据
./scripts/full-system-restore.sh
```

## 最佳实践

### 1. 定期测试恢复
```bash
# 每月测试恢复流程
./scripts/test-recovery.sh
```

### 2. 监控备份状态
```bash
# 每日检查备份状态
crontab -e
# 添加: 0 2 * * * /workspace/backup-system/scripts/check-backup-status.sh
```

### 3. 安全存储备份
- 加密所有备份
- 使用强密码
- 定期轮换加密密钥
- 限制备份访问权限

### 4. 文档和培训
- 维护最新的恢复文档
- 定期培训运维团队
- 进行恢复演练

## 故障排除

### 常见问题

#### 1. 备份失败
```bash
# 检查日志
tail -f /var/log/backup.log

# 检查磁盘空间
df -h

# 检查数据库连接
pg_isready -h localhost -p 5432
```

#### 2. 恢复失败
```bash
# 检查备份文件完整性
./scripts/backup-verify.sh --verbose

# 检查数据库版本兼容性
psql --version
pg_restore --version

# 检查权限
ls -la /var/backups/
```

#### 3. 存储空间不足
```bash
# 清理旧备份
./scripts/backup-cleanup.sh --days=7

# 增加存储空间
# 或配置远程存储
```

## 支持

如有问题，请参考：
1. [恢复指南](docs/recovery-guide.md)
2. [备份操作手册](docs/backup-procedures.md)
3. 联系系统管理员