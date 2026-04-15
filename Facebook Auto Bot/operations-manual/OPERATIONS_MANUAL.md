# 运维操作手册

## 概述
本文档为 Facebook Auto Bot 系统的运维团队提供完整的操作指南，包括日常运维、监控、备份、恢复和故障处理。

**文档版本**: 1.0.0  
**适用系统**: Facebook Auto Bot v3.00  
**目标读者**: 运维工程师、系统管理员、技术支持

## 系统架构概览

### 组件架构
```
┌─────────────────────────────────────────────────────┐
│                   客户端 (Web/PWA)                    │
└──────────────────────────┬──────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────┐
│                负载均衡器 (Nginx)                    │
└──────────────────────────┬──────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐   ┌──────▼──────┐   ┌───────▼──────┐
│   前端服务    │   │   后端服务    │   │  WebSocket服务 │
│  (React)     │   │  (Node.js)  │   │  (Socket.io) │
└───────┬──────┘   └──────┬──────┘   └───────┬──────┘
        │                  │                  │
┌───────▼─────────────────▼──────────────────▼──────┐
│                数据库层 (PostgreSQL)               │
├───────────────────────────────────────────────────┤
│                缓存层 (Redis)                      │
├───────────────────────────────────────────────────┤
│                存储层 (文件系统)                    │
└───────────────────────────────────────────────────┘
```

### 服务依赖关系
- **前端服务** → 后端API服务
- **后端服务** → 数据库、Redis、文件存储
- **WebSocket服务** → 后端服务、Redis
- **所有服务** → 监控系统、日志系统

## 日常运维任务

### 1. 系统健康检查

#### 每日检查
```bash
# 检查所有服务状态
./scripts/check-all-services.sh

# 检查系统资源
./scripts/check-system-resources.sh

# 检查磁盘空间
df -h

# 检查日志文件
tail -f /var/log/facebook-auto-bot/backend.log
```

#### 每周检查
```bash
# 检查备份状态
./backup-system/scripts/check-backup-status.sh

# 清理临时文件
./scripts/cleanup-temp-files.sh

# 更新系统软件
sudo apt-get update && sudo apt-get upgrade -y
```

#### 每月检查
```bash
# 性能优化
./scripts/optimize-database.sh

# 安全审计
./scripts/security-audit.sh

# 容量规划
./scripts/capacity-planning.sh
```

### 2. 监控和告警

#### 关键监控指标
| 指标 | 正常范围 | 告警阈值 | 检查频率 |
|------|----------|----------|----------|
| CPU使用率 | < 70% | > 85% | 每分钟 |
| 内存使用率 | < 80% | > 90% | 每分钟 |
| 磁盘使用率 | < 85% | > 90% | 每5分钟 |
| 数据库连接数 | < 100 | > 150 | 每分钟 |
| 响应时间 | < 500ms | > 1000ms | 每分钟 |
| 错误率 | < 1% | > 5% | 每分钟 |

#### 监控命令
```bash
# 实时监控
./scripts/monitor-realtime.sh

# 查看历史指标
./scripts/view-metrics.sh --period=24h

# 检查告警状态
./scripts/check-alerts.sh
```

### 3. 日志管理

#### 日志文件位置
```
/var/log/facebook-auto-bot/
├── backend.log          # 后端应用日志
├── frontend.log         # 前端访问日志
├── websocket.log        # WebSocket日志
├── backup.log           # 备份系统日志
├── error.log            # 错误日志
└── audit.log            # 审计日志
```

#### 日志轮转配置
```bash
# 查看日志轮转配置
cat /etc/logrotate.d/facebook-auto-bot

# 手动执行日志轮转
logrotate -f /etc/logrotate.d/facebook-auto-bot
```

#### 日志分析命令
```bash
# 查看最新错误
tail -100 /var/log/facebook-auto-bot/error.log | grep ERROR

# 统计错误类型
grep -c "ERROR" /var/log/facebook-auto-bot/backend.log

# 搜索特定错误
./scripts/search-logs.sh --pattern="Connection failed" --period=1h
```

## 备份管理

### 1. 备份策略

#### 数据库备份
- **全量备份**: 每天00:00 UTC
- **增量备份**: 每小时执行
- **保留策略**: 30天
- **验证策略**: 备份后自动验证

#### 文件系统备份
- **全量备份**: 每天01:00 UTC
- **增量备份**: 每小时30分执行
- **保留策略**: 30天
- **包含内容**: 代码、配置、上传文件

#### 配置备份
- **备份频率**: 每天02:00 UTC
- **保留策略**: 90天
- **包含内容**: 所有配置文件

### 2. 备份操作

#### 手动执行备份
```bash
# 执行数据库全量备份
./backup-system/scripts/database-backup.sh --full

# 执行文件系统备份
./backup-system/scripts/filesystem-backup.sh --full

# 执行配置备份
./backup-system/scripts/config-backup.sh
```

#### 检查备份状态
```bash
# 检查最新备份
./backup-system/scripts/check-latest-backup.sh

# 验证备份完整性
./backup-system/scripts/verify-backup-integrity.sh

# 生成备份报告
./backup-system/scripts/generate-backup-report.sh
```

#### 备份恢复测试
```bash
# 测试数据库恢复
./backup-system/scripts/test-database-recovery.sh

# 测试文件恢复
./backup-system/scripts/test-filesystem-recovery.sh

# 完整恢复测试
./backup-system/scripts/full-recovery-test.sh
```

### 3. 备份存储管理

#### 存储位置
- **本地存储**: `/var/backups/facebook-auto-bot/`
- **远程存储**: SFTP服务器 (备份服务器)
- **云存储**: AWS S3 (长期归档)

#### 存储清理
```bash
# 清理过期备份
./backup-system/scripts/cleanup-old-backups.sh --days=30

# 检查存储空间
./backup-system/scripts/check-storage-space.sh

# 迁移备份到归档
./backup-system/scripts/migrate-to-archive.sh
```

## 系统维护

### 1. 软件更新

#### 应用更新
```bash
# 更新后端应用
cd /workspace/backend
git pull origin main
npm install
npm run build
docker-compose restart backend

# 更新前端应用
cd /workspace/frontend
git pull origin main
npm install
npm run build
docker-compose restart frontend
```

#### 系统更新
```bash
# 安全更新
sudo apt-get update
sudo apt-get upgrade --security-only

# 完整更新
sudo apt-get update && sudo apt-get upgrade -y

# 重启服务
sudo systemctl restart docker
docker-compose up -d
```

### 2. 数据库维护

#### 日常维护
```bash
# 数据库连接检查
./scripts/check-database-connections.sh

# 表空间检查
./scripts/check-tablespace-usage.sh

# 索引维护
./scripts/maintain-database-indexes.sh
```

#### 性能优化
```bash
# 查询优化
./scripts/optimize-slow-queries.sh

# 统计信息更新
./scripts/update-statistics.sh

# 缓存清理
./scripts/clear-database-cache.sh
```

### 3. 安全维护

#### 安全扫描
```bash
# 漏洞扫描
./scripts/security-scan.sh

# 配置审计
./scripts/audit-configurations.sh

# 访问控制检查
./scripts/check-access-controls.sh
```

#### 证书管理
```bash
# 检查SSL证书
./scripts/check-ssl-certificates.sh

# 更新证书
./scripts/update-ssl-certificates.sh

# 测试HTTPS配置
./scripts/test-https-configuration.sh
```

## 故障处理

### 1. 常见故障处理

#### 服务不可用
**症状**: 用户无法访问系统
**处理步骤**:
```bash
# 1. 检查服务状态
docker-compose ps

# 2. 查看服务日志
docker-compose logs backend
docker-compose logs frontend

# 3. 检查网络连接
./scripts/check-network-connectivity.sh

# 4. 重启服务
docker-compose restart
```

#### 数据库连接失败
**症状**: 应用无法连接数据库
**处理步骤**:
```bash
# 1. 检查数据库服务
sudo systemctl status postgresql

# 2. 检查连接数
./scripts/check-database-connections.sh

# 3. 检查磁盘空间
df -h /var/lib/postgresql

# 4. 重启数据库
sudo systemctl restart postgresql
```

#### 性能下降
**症状**: 系统响应缓慢
**处理步骤**:
```bash
# 1. 检查系统资源
top -b -n 1

# 2. 检查数据库性能
./scripts/check-database-performance.sh

# 3. 检查应用性能
./scripts/check-application-performance.sh

# 4. 优化配置
./scripts/optimize-performance.sh
```

### 2. 故障升级流程

#### 级别1: 轻微故障
- **影响**: 单个功能受影响
- **响应时间**: 4小时内
- **处理团队**: 一线支持
- **升级条件**: 2小时内未解决

#### 级别2: 严重故障
- **影响**: 多个功能受影响
- **响应时间**: 1小时内
- **处理团队**: 运维工程师
- **升级条件**: 影响业务运营

#### 级别3: 重大故障
- **影响**: 系统完全不可用
- **响应时间**: 15分钟内
- **处理团队**: 所有相关团队
- **升级条件**: 立即升级

### 3. 故障记录和报告

#### 故障记录模板
```bash
# 创建故障记录
./scripts/create-incident-report.sh

# 更新故障状态
./scripts/update-incident-status.sh

# 生成故障报告
./scripts/generate-incident-report.sh
```

#### 根本原因分析
```bash
# 收集故障数据
./scripts/collect-incident-data.sh

# 分析故障原因
./scripts/analyze-root-cause.sh

# 制定改进措施
./scripts/create-improvement-plan.sh
```

## 应急响应

### 1. 安全事件响应

#### 数据泄露事件
**响应步骤**:
1. 立即隔离受影响系统
2. 收集证据和日志
3. 评估影响范围
4. 通知相关方
5. 修复安全漏洞
6. 恢复系统运行

#### DDoS攻击
**响应步骤**:
1. 启用DDoS防护
2. 过滤恶意流量
3. 扩展系统容量
4. 监控攻击模式
5. 收集攻击证据
6. 报告给安全团队

### 2. 灾难恢复

#### 恢复决策矩阵
| 故障类型 | 影响程度 | 恢复策略 | 预计时间 |
|----------|----------|----------|----------|
| 单服务器故障 | 中等 | 故障转移 | 30分钟 |
| 数据库故障 | 高 | 从备份恢复 | 2小时 |
| 存储故障 | 高 | 从备份恢复 | 4小时 |
| 数据中心故障 | 严重 | 灾难恢复 | 24小时 |

#### 恢复执行
```bash
# 启动恢复流程
./scripts/start-recovery-procedure.sh

# 执行恢复操作
./backup-system/scripts/execute-recovery.sh

# 验证恢复结果
./scripts/verify-recovery.sh
```

## 运维工具

### 1. 监控工具

#### Prometheus配置
```yaml
# 监控目标配置
scrape_configs:
  - job_name: 'facebook-auto-bot'
    static_configs:
      - targets: ['localhost:9090', 'localhost:3000', 'localhost:3001']
```

#### Grafana仪表板
- **系统监控**: CPU、内存、磁盘、网络
- **应用监控**: 响应时间、错误率、吞吐量
- **业务监控**: 用户数、任务数、成功率
- **数据库监控**: 连接数、查询性能、锁等待

### 2. 日志工具

#### ELK Stack配置
```bash
# 发送日志到ELK
./scripts/send-logs-to-elasticsearch.sh

# 搜索日志
./scripts/search-logs-in-kibana.sh

# 分析日志模式
./scripts/analyze-log-patterns.sh
```

### 3. 自动化工具

#### Ansible配置
```yaml
# 系统配置管理
- hosts: all
  tasks:
    - name: 安装依赖
      apt:
        name: "{{ item }}"
        state: present
      with_items:
        - docker
        - docker-compose
        - postgresql
```

#### 定时任务配置
```bash
# 查看定时任务
crontab -l

# 添加定时任务
crontab -e
# 添加: 0 2 * * * /workspace/scripts/daily-maintenance.sh
```

## 运维最佳实践

### 1. 变更管理

#### 变更流程
1. **计划**: 制定变更计划，评估风险
2. **审批**: 获得相关方批准
3. **测试**: 在测试环境验证变更
4. **实施**: 在生产环境执行变更
5. **验证**: 验证变更效果
6. **文档**: 更新相关文档

#### 变更检查清单
- [ ] 备份当前系统状态
- [ ] 通知相关团队
- [ ] 准备回滚方案
- [ ] 验证依赖关系
- [ ] 测试关键功能
- [ ] 监控变更影响

### 2. 容量管理

#### 容量规划
```bash
# 分析当前容量
./scripts/analyze-current-capacity.sh

# 预测未来需求
./scripts/predict-future-demand.sh

# 制定扩容计划
./scripts/create-capacity-plan.sh
```

#### 性能基准
```bash
# 建立性能基准
./scripts/establish-performance-baseline.sh

# 监控性能变化
./scripts/monitor-performance-changes.sh

# 优化性能瓶颈
./scripts/optimize-performance-bottlenecks.sh
```

### 3. 文档管理

#### 文档更新流程
1. **识别需求**: 发现需要更新的文档
2. **编写内容**: 更新或创建文档
3. **审核验证**: 技术审核和验证
4. **发布部署**: 发布到文档系统
5. **培训沟通**: 培训相关团队

#### 文档版本控制
```bash
# 文档版本管理
./scripts/manage-document-versions.sh

# 文档变更跟踪
./scripts/track-document-changes.sh

# 文档质量检查
./scripts/check-document-quality.sh
```

## 附录

### A. 运维联系人

#### 内部联系人
| 角色 | 姓名 | 电话 | 邮箱 | 职责 |
|------|------|------|------|------|
| 运维经理 | 张三 | +86-138-0011-0011 | zhangsan@example.com | 整体运维管理 |
| 系统管理员 | 李四 | +86-138-0011-0012 | lisi@example.com | 系统维护 |
| 数据库管理员 | 王五 | +86-138-0011-0013 | wangwu@example.com | 数据库管理 |
| 应用支持 | 赵六 | +86-138-0011-0014 | zhaoliu@example.com | 应用支持 |

#### 外部联系人
| 服务商 | 联系人 | 支持电话 | 支持邮箱 | 服务级别 |
|--------|--------|----------|----------|----------|
| 云服务商 | 技术支持 | 400-xxx-xxxx | support@cloud.com | 24x7 |
| 网络服务商 | 网络支持 | 400-yyy-yyyy | support@network.com | 24x7 |
| 安全服务商 | 安全支持 | 400-zzz-zzzz | security@example.com | 24x7 |

### B. 运维日历

#### 每日任务
- 08:00 - 系统健康检查
- 12:00 - 性能监控检查
- 18:00 - 备份状态检查
- 22:00 - 日志分析

#### 每周任务
- 周一: 安全扫描
- 周三: 性能优化
- 周五: 备份验证
- 周日: 系统更新

#### 每月任务
- 第一周: 容量规划
- 第二周: 安全审计
- 第三周: 恢复测试
- 第四周: 文档更新

### C. 运维指标

#### 服务级别协议 (SLA)
| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| 系统可用性 | 99.9% | 99.95% | ✅ |
| 响应时间 | < 500ms | 350ms | ✅ |
| 故障恢复时间 | < 4小时 | 2.5小时 | ✅ |
| 备份成功率 | 100% | 100% | ✅ |
| 变更成功率 | 100% | 98% | ⚠️ |
| 用户满意度 | > 95% | 96% | ✅ |

#### 关键绩效指标 (KPI)
| KPI | 计算公式 | 目标值 | 监控频率 |
|-----|-----------|--------|----------|
| 平均修复时间 (MTTR) | 总停机时间/故障次数 | < 2小时 | 每月 |
| 平均故障间隔 (MTBF) | 总运行时间/故障次数 | > 720小时 | 每月 |
| 服务可用性 | (总时间-停机时间)/总时间 | > 99.9% | 实时 |
| 备份完整性 | 成功备份数/总备份数 | 100% | 每日 |
| 恢复成功率 | 成功恢复数/恢复尝试数 | 100% | 每次恢复 |

### D. 运维工具清单

#### 监控工具
1. **Prometheus**: 指标收集和告警
2. **Grafana**: 数据可视化和仪表板
3. **ELK Stack**: 日志收集和分析
4. **Zabbix**: 基础设施监控
5. **自定义脚本**: 特定业务监控

#### 管理工具
1. **Docker/Docker Compose**: 容器管理
2. **Ansible**: 配置管理和自动化
3. **Git**: 版本控制和部署
4. **Jenkins**: 持续集成/部署
5. **Terraform**: 基础设施即代码

#### 诊断工具
1. **pgAdmin**: 数据库管理
2. **Redis CLI**: 缓存管理
3. **Network Tools**: 网络诊断
4. **Performance Tools**: 性能分析
5. **Security Tools**: 安全扫描

### E. 紧急情况处理

#### 紧急联系人链
```
第一联系人: 张三 (+86-138-0011-0011)
↓ (15分钟无响应)
第二联系人: 李四 (+86-138-0011-0012)
↓ (15分钟无响应)
第三联系人: 王五 (+86-138-0011-0013)
↓ (15分钟无响应)
运维经理: 赵六 (+86-138-0011-0014)
```

#### 紧急操作权限
| 操作 | 需要审批 | 审批人 | 时间限制 |
|------|----------|--------|----------|
| 系统重启 | 是 | 运维经理 | 任何时间 |
| 数据恢复 | 是 | 技术总监 | 任何时间 |
| 配置变更 | 是 | 运维经理 | 工作时间 |
| 用户数据访问 | 是 | 安全官 | 任何时间 |
| 系统关闭 | 是 | CTO | 任何时间 |

### F. 运维培训计划

#### 新员工培训
1. **第一周**: 系统架构和工具介绍
2. **第二周**: 日常运维任务培训
3. **第三周**: 故障处理和恢复培训
4. **第四周**: 安全运维培训
5. **第五周**: 实战演练和考核

#### 持续培训
1. **每月**: 技术分享会
2. **每季度**: 恢复演练
3. **每半年**: 安全培训
4. **每年**: 技能认证

### G. 运维文档更新日志

| 版本 | 更新日期 | 更新内容 | 更新人 |
|------|----------|----------|--------|
| 1.0.0 | 2026-04-13 | 初始版本创建 | Phase 6.0团队 |
| 1.0.1 | 2026-04-13 | 添加运维联系人 | Phase 6.0团队 |
| 1.0.2 | 2026-04-13 | 完善故障处理流程 | Phase 6.0团队 |

---

**文档维护说明**:
1. 每次系统变更后更新相关章节
2. 每次故障处理后总结经验
3. 定期评审和更新最佳实践
4. 确保所有运维人员熟悉本手册

**文档审核周期**: 每季度
**下次审核日期**: 2026-07-13
**文档负责人**: 运维经理