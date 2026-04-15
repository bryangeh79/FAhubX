# 系统恢复指南

## 概述
本文档提供 Facebook Auto Bot 系统的完整恢复流程，包括数据误删除、系统故障和灾难恢复。

## 恢复目标

### 恢复时间目标 (RTO)
- **数据误删除**: < 1小时
- **系统故障**: < 4小时  
- **灾难恢复**: < 24小时

### 恢复点目标 (RPO)
- **最大数据丢失**: < 1小时
- **关键数据**: 零丢失（通过实时同步）

## 恢复场景分类

### 场景1: 数据误删除恢复
**描述**: 用户误删除重要数据（账号、任务、配置）
**影响**: 数据丢失，系统功能受限
**优先级**: 高

### 场景2: 系统故障恢复  
**描述**: 服务器硬件故障、操作系统崩溃
**影响**: 系统不可用
**优先级**: 高

### 场景3: 灾难性故障恢复
**描述**: 数据中心故障、自然灾害
**影响**: 完全不可用
**优先级**: 最高

### 场景4: 安全事件恢复
**描述**: 安全攻击、数据泄露
**影响**: 系统完整性受损
**优先级**: 最高

## 恢复准备

### 1. 恢复工具包
确保以下工具可用：
- 备份系统访问权限
- 数据库恢复工具 (pg_restore)
- 文件恢复工具 (tar, gzip, openssl)
- 系统监控工具
- 通信工具（通知团队）

### 2. 恢复检查清单
在开始恢复前检查：
- [ ] 确认故障范围和影响
- [ ] 通知相关团队和用户
- [ ] 获取最新的有效备份
- [ ] 验证备份完整性
- [ ] 准备恢复环境

### 3. 恢复团队
**恢复指挥官**: 负责整体恢复决策
**数据库专家**: 负责数据库恢复
**系统管理员**: 负责系统恢复
**应用专家**: 负责应用验证
**通信专员**: 负责状态通知

## 恢复流程

### 阶段1: 评估和准备

#### 步骤1.1: 故障评估
```bash
# 检查系统状态
./scripts/check-system-status.sh

# 确定故障范围
./scripts/assess-damage.sh

# 记录故障详情
echo "故障时间: $(date)" > /tmp/incident-report.txt
echo "故障现象: " >> /tmp/incident-report.txt
echo "影响范围: " >> /tmp/incident-report.txt
```

#### 步骤1.2: 通知和沟通
1. 通知恢复团队
2. 更新状态页面
3. 设置沟通渠道
4. 记录所有操作

#### 步骤1.3: 备份验证
```bash
# 验证最新备份
./backup-system/scripts/backup-verify.sh --latest

# 检查备份完整性
./backup-system/scripts/check-backup-integrity.sh

# 选择恢复点
./backup-system/scripts/select-recovery-point.sh
```

### 阶段2: 执行恢复

#### 场景1: 数据误删除恢复

##### 步骤2.1.1: 停止相关服务
```bash
# 停止应用服务
docker-compose stop backend frontend

# 停止任务调度
docker-compose stop scheduler
```

##### 步骤2.1.2: 数据库恢复
```bash
# 恢复特定表
./backup-system/scripts/restore-database.sh \
  --table=facebook_accounts \
  --backup=最新有效备份

# 或恢复整个数据库
./backup-system/scripts/restore-database.sh --full
```

##### 步骤2.1.3: 验证数据
```bash
# 验证恢复的数据
./scripts/verify-data-recovery.sh

# 检查数据完整性
./scripts/check-data-integrity.sh
```

##### 步骤2.1.4: 重启服务
```bash
# 启动服务
docker-compose start backend frontend scheduler

# 验证服务状态
docker-compose ps
```

#### 场景2: 系统故障恢复

##### 步骤2.2.1: 系统重建
```bash
# 在新服务器上部署
./infrastructure/deploy-new-server.sh

# 恢复系统配置
./backup-system/scripts/restore-config.sh
```

##### 步骤2.2.2: 数据库恢复
```bash
# 安装数据库
sudo apt-get install postgresql-15

# 创建数据库
createdb facebook_auto_bot

# 恢复数据库
./backup-system/scripts/restore-database.sh --full
```

##### 步骤2.2.3: 应用恢复
```bash
# 恢复应用代码
./backup-system/scripts/restore-filesystem.sh --path=/workspace

# 恢复配置文件
cp /backup/config/.env /workspace/.env

# 安装依赖
cd /workspace/backend && npm install
cd /workspace/frontend && npm install
```

##### 步骤2.2.4: 服务启动
```bash
# 启动所有服务
docker-compose up -d

# 验证服务
./scripts/verify-all-services.sh
```

#### 场景3: 灾难恢复

##### 步骤2.3.1: 基础设施重建
```bash
# 从云存储恢复
./backup-system/scripts/cloud-restore.sh --provider=aws

# 重建服务器
./infrastructure/build-disaster-recovery-environment.sh
```

##### 步骤2.3.2: 数据恢复
```bash
# 恢复所有数据
./backup-system/scripts/full-system-restore.sh

# 验证数据完整性
./scripts/verify-disaster-recovery.sh
```

##### 步骤2.3.3: 系统验证
```bash
# 全面系统测试
./scripts/run-full-system-test.sh

# 性能测试
./scripts/run-performance-test.sh
```

### 阶段3: 验证和测试

#### 步骤3.1: 功能验证
```bash
# 验证核心功能
./scripts/test-core-functionality.sh

# 验证数据一致性
./scripts/verify-data-consistency.sh

# 验证用户访问
./scripts/test-user-access.sh
```

#### 步骤3.2: 性能验证
```bash
# 性能基准测试
./scripts/run-performance-benchmark.sh

# 负载测试
./scripts/run-load-test.sh

# 响应时间测试
./scripts/test-response-times.sh
```

#### 步骤3.3: 数据验证
```bash
# 数据完整性检查
./scripts/check-all-data-integrity.sh

# 备份验证
./backup-system/scripts/verify-all-backups.sh

# 审计日志检查
./scripts/check-audit-logs.sh
```

### 阶段4: 切换和监控

#### 步骤4.1: 流量切换
```bash
# 逐步切换流量
./scripts/gradual-traffic-switch.sh

# 监控切换过程
./scripts/monitor-traffic-switch.sh
```

#### 步骤4.2: 监控设置
```bash
# 启用监控
./scripts/enable-monitoring.sh

# 设置告警
./scripts/setup-alerts.sh

# 监控关键指标
./scripts/monitor-key-metrics.sh
```

#### 步骤4.3: 用户通知
1. 发送恢复完成通知
2. 更新状态页面
3. 提供用户支持

## 恢复脚本

### 1. 数据库恢复脚本
```bash
#!/bin/bash
# restore-database.sh

# 恢复整个数据库
./backup-system/scripts/restore-database.sh --full

# 恢复特定表
./backup-system/scripts/restore-database.sh --table=users

# 恢复到新数据库
./backup-system/scripts/restore-database.sh --new-database=recovery_db
```

### 2. 文件系统恢复脚本
```bash
#!/bin/bash
# restore-filesystem.sh

# 恢复整个文件系统
./backup-system/scripts/restore-filesystem.sh --full

# 恢复特定目录
./backup-system/scripts/restore-filesystem.sh --path=/workspace/backend

# 恢复配置文件
./backup-system/scripts/restore-filesystem.sh --config-only
```

### 3. 完整系统恢复脚本
```bash
#!/bin/bash
# full-system-restore.sh

# 停止所有服务
docker-compose down

# 恢复数据库
./backup-system/scripts/restore-database.sh --full

# 恢复文件系统
./backup-system/scripts/restore-filesystem.sh --full

# 恢复配置
./backup-system/scripts/restore-config.sh

# 启动服务
docker-compose up -d

# 验证恢复
./scripts/verify-full-recovery.sh
```

## 恢复测试

### 定期恢复演练
```bash
# 每月恢复测试
./scripts/monthly-recovery-test.sh

# 灾难恢复演练
./scripts/disaster-recovery-drill.sh

# 数据恢复测试
./scripts/data-recovery-test.sh
```

### 恢复测试检查清单
- [ ] 备份可用性测试
- [ ] 恢复时间测量
- [ ] 数据完整性验证
- [ ] 系统功能验证
- [ ] 性能基准测试
- [ ] 文档更新

## 故障排除

### 常见问题

#### 问题1: 备份文件损坏
**症状**: 恢复时出现校验错误
**解决**:
```bash
# 检查备份完整性
./backup-system/scripts/verify-backup-integrity.sh

# 使用备用备份
./backup-system/scripts/use-alternate-backup.sh

# 手动修复（如可能）
./backup-system/scripts/manual-backup-repair.sh
```

#### 问题2: 数据库恢复失败
**症状**: pg_restore 错误
**解决**:
```bash
# 检查数据库版本
psql --version
pg_restore --version

# 检查权限
sudo -u postgres psql -l

# 尝试不同恢复选项
pg_restore --clean --if-exists --no-owner --no-privileges backup.dump
```

#### 问题3: 文件权限问题
**症状**: 文件无法访问
**解决**:
```bash
# 修复文件权限
sudo chown -R appuser:appgroup /workspace
sudo chmod -R 755 /workspace

# 修复特定文件
sudo chmod 600 /workspace/.env
sudo chmod 644 /workspace/docker-compose.yml
```

#### 问题4: 服务启动失败
**症状**: Docker容器无法启动
**解决**:
```bash
# 检查Docker日志
docker-compose logs

# 检查资源限制
docker system df
docker system prune -a

# 重新构建镜像
docker-compose build --no-cache
```

## 恢复后操作

### 1. 系统优化
```bash
# 优化数据库
./scripts/optimize-database.sh

# 清理临时文件
./scripts/cleanup-temp-files.sh

# 更新系统
sudo apt-get update && sudo apt-get upgrade
```

### 2. 监控增强
```bash
# 增强监控
./scripts/enhance-monitoring.sh

# 设置备份监控
./scripts/monitor-backups.sh

# 配置自动恢复
./scripts/setup-auto-recovery.sh
```

### 3. 文档更新
1. 更新恢复经验
2. 记录问题和解决方案
3. 更新恢复检查清单
4. 培训团队

### 4. 根本原因分析
1. 分析故障原因
2. 制定预防措施
3. 更新应急预案
4. 改进系统架构

## 附录

### A. 恢复联系人
- **恢复指挥官**: John Doe (john@example.com, +1-555-0101)
- **数据库专家**: Jane Smith (jane@example.com, +1-555-0102)
- **系统管理员**: Bob Johnson (bob@example.com, +1-555-0103)
- **应用专家**: Alice Brown (alice@example.com, +1-555-0104)

### B. 关键文件位置
- **备份目录**: `/var/backups/facebook-auto-bot/`
- **配置文件**: `/workspace/.env`
- **数据库配置**: `/workspace/backend/.env`
- **恢复脚本**: `/workspace/backup-system/scripts/`
- **监控配置**: `/workspace/infrastructure/monitoring/`

### C. 恢复时间线模板
```
故障发生: YYYY-MM-DD HH:MM
发现时间: YYYY-MM-DD HH:MM
响应时间: YYYY-MM-DD HH:MM
恢复开始: YYYY-MM-DD HH:MM
数据库恢复: YYYY-MM-DD HH:MM
应用恢复: YYYY-MM-DD HH:MM
验证完成: YYYY-MM-DD HH:MM
系统上线: YYYY-MM-DD HH:MM
用户通知: YYYY-MM-DD HH:MM
```

### D. 恢复成功标准
1. 所有核心功能正常
2. 数据完整性100%
3. 性能在可接受范围内
4. 用户访问正常
5. 监控系统正常
6. 备份系统正常

---

**文档版本**: 1.0.0  
**最后更新**: 2026-04-13  
**维护团队**: 运维团队  
**审核周期**: 每季度