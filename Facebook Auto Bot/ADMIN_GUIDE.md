# Facebook Auto Bot - 管理员运维指南

## 文档版本
- **版本**: 1.0.0
- **更新日期**: 2026-04-13
- **适用系统版本**: Facebook Auto Bot v1.0

---

## 第一章：系统架构

### 1.1 整体架构概述
Facebook Auto Bot采用微服务架构设计，支持高可用、可扩展的多租户SaaS平台。

#### 1.1.1 架构图
```
┌─────────────────────────────────────────────────────────────┐
│                   用户访问层                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Web前端  │  │ 移动端   │  │ API调用  │  │ Webhook  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                   网关层                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                API网关 + 负载均衡器                  │   │
│  │  • 请求路由        • 限流熔断        • 认证授权      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                   业务服务层                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 认证服务 │  │ 账号服务 │  │ 任务服务 │  │ 监控服务 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 剧本服务 │  │ 数据服务 │  │ 通知服务 │  │ 计费服务 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────┐
│                   数据层                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ PostgreSQL │ │  Redis   │ │ MinIO/S3 │ │ Elastic   │   │
│  │  主数据库  │ │  缓存    │ │  对象存储 │ │  搜索     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈详情
#### 1.2.1 后端技术栈
- **运行时**: Node.js 20+ with TypeScript
- **框架**: NestJS 10+
- **ORM**: TypeORM 0.3+
- **消息队列**: BullMQ with Redis
- **API文档**: Swagger/OpenAPI 3.0
- **测试框架**: Jest + Supertest
- **代码质量**: ESLint + Prettier

#### 1.2.2 前端技术栈
- **框架**: React 18+ with TypeScript
- **构建工具**: Vite 5+
- **UI组件**: Ant Design 5+
- **状态管理**: Zustand
- **路由**: React Router 6+
- **HTTP客户端**: Axios
- **PWA支持**: Workbox

#### 1.2.3 基础设施
- **容器化**: Docker 24+
- **编排**: Kubernetes 1.28+
- **CI/CD**: GitHub Actions
- **监控**: Prometheus + Grafana
- **日志**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **告警**: AlertManager
- **服务发现**: Consul

### 1.3 多租户架构
#### 1.3.1 数据隔离策略
- **数据库级别隔离**: 每个租户独立数据库
- **Schema级别隔离**: 同一数据库不同schema
- **行级别隔离**: 使用tenant_id字段区分

#### 1.3.2 资源配额管理
- 账号数量限制
- 任务并发数限制
- 存储空间限制
- API调用频率限制

### 1.4 安全架构
#### 1.4.1 认证授权
- JWT令牌认证
- OAuth 2.0集成
- 双重验证支持
- API密钥管理

#### 1.4.2 数据安全
- 数据传输加密 (TLS 1.3)
- 数据存储加密 (AES-256)
- 敏感信息脱敏
- 审计日志记录

#### 1.4.3 网络安全
- 防火墙配置
- DDoS防护
- WAF规则
- 网络隔离

---

## 第二章：部署指南

### 2.1 环境要求
#### 2.1.1 硬件要求
| 组件 | 开发环境 | 测试环境 | 生产环境 |
|------|----------|----------|----------|
| CPU | 4核 | 8核 | 16核+ |
| 内存 | 8GB | 16GB | 32GB+ |
| 存储 | 50GB | 100GB | 500GB+ |
| 网络 | 100Mbps | 1Gbps | 多线BGP |

#### 2.1.2 软件要求
- **操作系统**: Ubuntu 22.04 LTS / CentOS 8+
- **容器运行时**: Docker 24+ / containerd
- **编排工具**: Kubernetes 1.28+
- **数据库**: PostgreSQL 15+
- **缓存**: Redis 7+
- **对象存储**: MinIO / AWS S3

### 2.2 开发环境部署
#### 2.2.1 本地开发环境
```bash
# 1. 克隆代码库
git clone https://github.com/fbautobot/facebook-auto-bot.git
cd facebook-auto-bot

# 2. 启动后端服务
cd backend
npm install
cp .env.example .env
# 编辑.env文件配置数据库等
npm run dev

# 3. 启动前端服务
cd ../frontend
npm install
npm run dev

# 4. 启动基础设施
cd ..
docker-compose up -d
```

#### 2.2.2 Docker开发环境
```bash
# 使用Docker Compose启动完整环境
docker-compose -f docker-compose.dev.yml up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 2.3 测试环境部署
#### 2.3.1 自动化部署流程
```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging
on:
  push:
    branches: [develop]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and push Docker images
        run: ./scripts/build-and-push.sh
      - name: Deploy to Kubernetes
        run: ./scripts/deploy-staging.sh
```

#### 2.3.2 环境配置
```bash
# 测试环境配置文件
# config/staging/config.yaml
database:
  host: postgres-staging
  port: 5432
  name: fbautobot_staging
  username: ${DB_USER}
  password: ${DB_PASSWORD}

redis:
  host: redis-staging
  port: 6379

s3:
  endpoint: https://s3-staging.example.com
  bucket: fbautobot-staging
```

### 2.4 生产环境部署
#### 2.4.1 部署前检查清单
- [ ] 数据库备份完成
- [ ] 配置文件验证通过
- [ ] SSL证书准备就绪
- [ ] 域名解析配置正确
- [ ] 监控告警配置完成
- [ ] 回滚方案准备就绪

#### 2.4.2 Kubernetes部署配置
```yaml
# k8s/production/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fbautobot-backend
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fbautobot-backend
  template:
    metadata:
      labels:
        app: fbautobot-backend
    spec:
      containers:
      - name: backend
        image: fbautobot/backend:1.0.0
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: backend-config
        - secretRef:
            name: backend-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### 2.4.3 服务暴露配置
```yaml
# k8s/production/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: fbautobot-backend-service
  namespace: production
spec:
  selector:
    app: fbautobot-backend
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fbautobot-ingress
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.fbautobot.com
    secretName: fbautobot-tls
  rules:
  - host: api.fbautobot.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: fbautobot-backend-service
            port:
              number: 80
```

#### 2.4.4 数据库部署
```bash
# PostgreSQL高可用部署
helm install postgresql bitnami/postgresql-ha \
  --namespace production \
  --set postgresql.replicaCount=3 \
  --set postgresql.postgresqlDatabase=fbautobot \
  --set postgresql.postgresqlUsername=fbautobot \
  --set postgresql.postgresqlPassword=${DB_PASSWORD} \
  --set persistence.size=100Gi \
  --set persistence.storageClass=fast-ssd
```

#### 2.4.5 Redis集群部署
```bash
# Redis集群部署
helm install redis bitnami/redis-cluster \
  --namespace production \
  --set cluster.nodes=6 \
  --set persistence.size=50Gi \
  --set password=${REDIS_PASSWORD}
```

### 2.5 蓝绿部署策略
#### 2.5.1 部署流程
1. **准备新版本**
   ```bash
   # 构建新版本镜像
   docker build -t fbautobot/backend:1.0.1 .
   
   # 推送到镜像仓库
   docker push fbautobot/backend:1.0.1
   ```

2. **部署绿色环境**
   ```bash
   # 部署新版本到绿色环境
   kubectl apply -f k8s/production/green-deployment.yaml
   
   # 等待绿色环境就绪
   kubectl rollout status deployment/fbautobot-backend-green
   ```

3. **切换流量**
   ```bash
   # 更新Ingress指向绿色环境
   kubectl apply -f k8s/production/green-ingress.yaml
   
   # 验证新版本
   curl https://api.fbautobot.com/health
   ```

4. **清理蓝色环境**
   ```bash
   # 保留蓝色环境24小时用于回滚
   # 24小时后清理
   kubectl delete deployment/fbautobot-backend-blue
   ```

#### 2.5.2 回滚流程
```bash
# 如果新版本有问题，快速回滚到蓝色环境
kubectl apply -f k8s/production/blue-ingress.yaml

# 验证回滚成功
curl https://api.fbautobot.com/health

# 清理问题版本
kubectl delete deployment/fbautobot-backend-green
```

### 2.6 部署验证
#### 2.6.1 健康检查
```bash
# API健康检查
curl -f https://api.fbautobot.com/health

# 数据库连接检查
curl -f https://api.fbautobot.com/health/db

# Redis连接检查
curl -f https://api.fbautobot.com/health/redis

# 外部服务检查
curl -f https://api.fbautobot.com/health/external
```

#### 2.6.2 功能验证
```bash
# 用户认证测试
curl -X POST https://api.fbautobot.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# API功能测试
curl -X GET https://api.fbautobot.com/api/accounts \
  -H "Authorization: Bearer ${TOKEN}"

# 性能测试
ab -n 1000 -c 100 https://api.fbautobot.com/health
```

#### 2.6.3 监控验证
1. 访问Grafana监控面板
2. 检查各项指标是否正常
3. 验证告警规则是否生效
4. 检查日志收集是否正常

---

## 第三章：监控运维

### 3.1 监控体系架构
#### 3.1.1 监控层次
- **基础设施监控**: 服务器、网络、存储
- **应用性能监控**: 应用响应时间、错误率
- **业务监控**: 用户行为、业务指标
- **安全监控**: 安全事件、异常访问

#### 3.1.2 监控工具栈
- **指标收集**: Prometheus
- **可视化**: Grafana
- **日志收集**: ELK Stack
- **分布式追踪**: Jaeger
- **告警管理**: AlertManager
- **用户体验监控**: Sentry

### 3.2 Prometheus监控配置
#### 3.2.1 应用指标暴露
```javascript
// backend/src/monitoring/metrics.ts
import { Registry, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

// 自定义业务指标
export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const activeAccountsGauge = new Gauge({
  name: 'active_accounts',
  help: 'Number of active Facebook accounts',
  registers: [register],
});

export const taskDurationHistogram = new Histogram({
  name: 'task_duration_seconds',
  help: 'Task execution duration',
  labelNames: ['task_type', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});
```

#### 3.2.2 Prometheus配置
```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'fbautobot-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
    
  - job_name: 'fbautobot-frontend'
    static_configs:
      - targets: ['frontend:4173']
    metrics_path: '/metrics'
    
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
```

### 3.3 Grafana仪表盘
#### 3.3.1 系统健康仪表盘
**关键指标面板：**
1. **系统概览**
   - 服务可用性 (99.9%+)
   - 请求成功率 (>99%)
   - 平均响应时间 (<200ms)
   - 错误率 (<0.1%)

2. **资源使用**
   - CPU使用率 (<70%)
   - 内存使用率 (<80%)
   - 磁盘使用率 (<85%)
   - 网络流量

3. **业务指标**
   - 活跃用户数
   - 任务执行数
   - 消息处理量
   - 账号在线率

#### 3.3.2 数据库监控
```sql
-- PostgreSQL监控查询
-- 连接数监控
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';

-- 慢查询监控
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- 表大小监控
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;

### 3.4 告警配置
#### 3.4.1 告警规则定义
```yaml
# prometheus/alert-rules.yml
groups:
  - name: fbautobot-alerts
    rules:
      # 服务可用性告警
      - alert: ServiceDown
        expr: up{job="fbautobot-backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "服务 {{ $labels.instance }} 宕机"
          description: "{{ $labels.instance }} 服务已宕机超过1分钟"

      # 高错误率告警
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "高错误率检测"
          description: "5xx错误率超过5%"

      # 高响应时间告警
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高响应时间"
          description: "95%响应时间超过1秒"

      # 数据库连接池告警
      - alert: DatabaseConnectionPoolFull
        expr: pg_stat_database_numbackends{datname="fbautobot"} > 90
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "数据库连接池即将耗尽"
          description: "数据库连接数超过90"

      # 磁盘空间告警
      - alert: LowDiskSpace
        expr: node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"} < 0.2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "磁盘空间不足"
          description: "根分区剩余空间不足20%"
```

#### 3.4.2 AlertManager配置
```yaml
# alertmanager/alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@fbautobot.com'
  smtp_auth_username: 'alerts@fbautobot.com'
  smtp_auth_password: '${SMTP_PASSWORD}'

route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  receiver: 'slack-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
      group_wait: 10s

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}\n{{ end }}'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_KEY}'
        description: '{{ .GroupLabels.alertname }}'
        details:
          severity: '{{ .GroupLabels.severity }}'
          alerts: '{{ .Alerts }}'

  - name: 'email'
    email_configs:
      - to: 'ops@fbautobot.com'
        from: 'alerts@fbautobot.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@fbautobot.com'
        auth_password: '${SMTP_PASSWORD}'
        headers:
          subject: '{{ .GroupLabels.alertname }}'
```

### 3.5 日志管理
#### 3.5.1 日志收集架构
```
应用日志 → Filebeat → Logstash → Elasticsearch → Kibana
                    ↓
                错误日志 → Sentry
```

#### 3.5.2 结构化日志配置
```javascript
// backend/src/utils/logger.ts
import winston from 'winston';
import 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // 控制台输出（开发环境）
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // 按天轮转的文件日志
    new winston.transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
    // 错误日志单独文件
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 30,
    }),
  ],
});

// 使用示例
logger.info('用户登录成功', { userId: 123, email: 'user@example.com' });
logger.error('数据库连接失败', { error: err.message, stack: err.stack });
```

#### 3.5.3 Logstash配置
```ruby
# logstash/pipeline/fbautobot.conf
input {
  beats {
    port => 5044
  }
}

filter {
  # 解析JSON日志
  if [message] =~ /^\{/ {
    json {
      source => "message"
    }
  }
  
  # 添加环境标签
  mutate {
    add_field => { "environment" => "%{[fields][environment]}" }
    add_field => { "service" => "%{[fields][service]}" }
  }
  
  # 时间戳处理
  date {
    match => ["timestamp", "ISO8601"]
  }
}

output {
  # 发送到Elasticsearch
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "fbautobot-%{+YYYY.MM.dd}"
  }
  
  # 错误日志发送到Sentry
  if [level] == "error" {
    http {
      url => "https://sentry.io/api/123456/store/"
      http_method => "post"
      headers => {
        "X-Sentry-Auth" => "Sentry sentry_version=7, sentry_key=abc123"
      }
      format => "json"
      mapping => {
        "event_id" => "%{[@metadata][event_id]}"
        "message" => "%{message}"
        "level" => "%{level}"
        "timestamp" => "%{timestamp}"
        "logger" => "%{logger_name}"
        "extra" => {
          "environment" => "%{environment}"
          "service" => "%{service}"
        }
      }
    }
  }
}
```

### 3.6 性能监控
#### 3.6.1 APM配置
```javascript
// backend/src/main.ts
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app }),
    new Tracing.Integrations.Postgres(),
    new Tracing.Integrations.Redis({ client: redisClient }),
  ],
  tracesSampleRate: 0.1, // 采样率10%
  environment: process.env.NODE_ENV,
});

// 错误边界
app.use(Sentry.Handlers.errorHandler());
```

#### 3.6.2 分布式追踪
```yaml
# jaeger/config.yaml
service_name: fbautobot-backend
sampler:
  type: const
  param: 1
reporter:
  logSpans: false
  localAgentHostPort: jaeger:6831
```

### 3.7 日常运维任务
#### 3.7.1 每日检查清单
```bash
#!/bin/bash
# daily-check.sh

# 1. 检查服务状态
echo "=== 服务状态检查 ==="
kubectl get pods -n production
kubectl get deployments -n production

# 2. 检查资源使用
echo "=== 资源使用检查 ==="
kubectl top pods -n production
kubectl top nodes

# 3. 检查日志错误
echo "=== 错误日志检查 ==="
kubectl logs -n production deployment/fbautobot-backend --tail=100 | grep -i error

# 4. 检查数据库连接
echo "=== 数据库检查 ==="
kubectl exec -n production deployment/postgresql -- psql -U fbautobot -d fbautobot -c "SELECT count(*) FROM pg_stat_activity;"

# 5. 检查备份状态
echo "=== 备份状态检查 ==="
ls -la /backup/latest/

# 6. 发送检查报告
if [ -f /tmp/daily-check-report.txt ]; then
  cat /tmp/daily-check-report.txt | mail -s "Daily Check Report" ops@fbautobot.com
fi
```

#### 3.7.2 每周维护任务
1. **日志清理**
   ```bash
   # 清理30天前的日志
   find /var/log/fbautobot -name "*.log" -mtime +30 -delete
   ```

2. **数据库维护**
   ```sql
   -- 清理过期数据
   DELETE FROM task_logs WHERE created_at < NOW() - INTERVAL '90 days';
   DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '180 days';
   
   -- 重建索引
   REINDEX DATABASE fbautobot;
   ```

3. **监控数据清理**
   ```bash
   # Prometheus数据保留90天
   curl -X POST http://prometheus:9090/api/v1/admin/tsdb/clean_tombstones
   ```

#### 3.7.3 月度维护任务
1. **安全更新**
   ```bash
   # 更新系统包
   apt update && apt upgrade -y
   
   # 更新Docker镜像
   docker pull fbautobot/backend:latest
   docker pull fbautobot/frontend:latest
   ```

2. **性能优化**
   ```sql
   -- 分析表统计信息
   ANALYZE;
   
   -- 更新查询计划缓存
   DISCARD PLANS;
   ```

3. **容量规划**
   ```bash
   # 检查存储使用趋势
   df -h
   
   # 预测未来需求
   ./scripts/capacity-forecast.sh
   ```

---

## 第四章：备份恢复

### 4.1 备份策略
#### 4.1.1 备份类型
- **全量备份**: 每天凌晨2点执行
- **增量备份**: 每小时执行一次
- **差异备份**: 每6小时执行一次
- **事务日志备份**: 每15分钟执行一次

#### 4.1.2 备份保留策略
```yaml
# backup/retention-policy.yaml
retention:
  daily: 30    # 保留30天每日备份
  weekly: 12   # 保留12周每周备份
  monthly: 36  # 保留36月每月备份
  yearly: 5    # 保留5年每年备份

storage:
  local: /backup/local    # 本地存储
  remote: s3://fbautobot-backup/production  # S3远程存储
  archive: glacier://fbautobot-archive  # 长期归档

encryption:
  enabled: true
  algorithm: AES-256-GCM
  key: ${BACKUP_ENCRYPTION_KEY}
```

### 4.2 数据库备份
#### 4.2.1 PostgreSQL备份脚本
```bash
#!/bin/bash
# backup/postgres-backup.sh

set -euo pipefail

# 环境变量
BACKUP_DIR="/backup/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/fbautobot_${DATE}.sql.gz"

# 创建备份目录
mkdir -p "${BACKUP_DIR}"

# 执行备份
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  | gzip > "${BACKUP_FILE}"

# 验证备份文件
if [ -f "${BACKUP_FILE}" ]; then
  echo "备份文件大小: $(du -h ${BACKUP_FILE} | cut -f1)"
  echo "备份完成: ${BACKUP_FILE}"
  
  # 上传到S3
  aws s3 cp "${BACKUP_FILE}" "s3://fbautobot-backup/postgres/"
  
  # 清理旧备份（保留最近30天）
  find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +30 -delete
else
  echo "备份失败!"
  exit 1
fi
```

#### 4.2.2 点时间恢复（PITR）配置
```sql
-- 启用WAL归档
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 'gzip < %p > /var/lib/postgresql/wal_archive/%f.gz';
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET max_wal_senders = 10;
ALTER SYSTEM SET wal_keep_size = 1024; -- 保留1GB WAL文件

-- 重启PostgreSQL生效
SELECT pg_reload_conf();
```

### 4.3 文件系统备份
#### 4.3.1 应用代码备份
```bash
#!/bin/bash
# backup/code-backup.sh

# 备份源代码
rsync -avz --delete \
  --exclude="node_modules" \
  --exclude=".git" \
  --exclude="*.log" \
  /opt/fbautobot/ \
  /backup/code/latest/

# 创建时间戳备份
DATE=$(date +%Y%m%d)
tar -czf "/backup/code/fbautobot_code_${DATE}.tar.gz" \
  -C /backup/code/latest .

# 上传到S3
aws s3 cp "/backup/code/fbautobot_code_${DATE}.tar.gz" \
  "s3://fbautobot-backup/code/"
```

#### 4.3.2 配置文件备份
```bash
#!/bin/bash
# backup/config-backup.sh

# 备份所有配置文件
CONFIG_FILES=(
  "/etc/fbautobot"
  "/opt/fbautobot/.env"
  "/opt/fbautobot/config"
  "/etc/nginx/conf.d/fbautobot.conf"
  "/etc/systemd/system/fbautobot.service"
)

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/config/${DATE}"

mkdir -p "${BACKUP_DIR}"

for config in "${CONFIG_FILES[@]}"; do
  if [ -e "${config}" ]; then
    cp -r "${config}" "${BACKUP_DIR}/"
  fi
done

# 创建压缩包
tar -czf "/backup/config/fbautobot_config_${DATE}.tar.gz" \
  -C "/backup/config/${DATE}" .

# 清理临时文件
rm -rf "${BACKUP_DIR}"

# 上传到S3
aws s3 cp "/backup/config/fbautobot_config_${DATE}.tar.gz" \
  "s3://fbautobot-backup/config/"
```

### 4.4 恢复流程
#### 4.4.1 数据库恢复
```bash
#!/bin/bash
# recovery/postgres-recovery.sh

set -euo pipefail

# 参数检查
if [ $# -ne 1 ]; then
  echo "用法: $0 <备份文件>"
  exit 1
fi

BACKUP_FILE="$1"

# 停止应用服务
systemctl stop fbautobot-backend

# 删除现有数据库
PGPASSWORD="${DB_PASSWORD}" dropdb \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  "${DB_NAME}" || true

# 创建新数据库
PGPASSWORD="${DB_PASSWORD}" createdb \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  "${DB_NAME}"

# 恢复数据
echo "正在恢复数据库..."
gunzip -c "${BACKUP_FILE}" | \
PGPASSWORD="${DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --quiet

echo "数据库恢复完成"

# 启动应用服务
systemctl start fbautobot-backend
```

#### 4.4.2 点时间恢复
```bash
#!/bin/bash
# recovery/postgres-pitr.sh

# 停止数据库
systemctl stop postgresql

# 清理数据目录
rm -rf /var/lib/postgresql/data/*

# 恢复基础备份
tar -xzf /backup/postgres/base_backup.tar.gz \
  -C /var/lib/postgresql/data

# 恢复WAL日志
cp /var/lib/postgresql/wal_archive/* \
  /var/lib/postgresql/data/pg_wal/

# 创建恢复配置
cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'gunzip < /var/lib/postgresql/wal_archive/%f.gz > %p'
recovery_target_time = '2026-04-13 14:30:00'
recovery_target_action = 'promote'
EOF

# 启动数据库
systemctl start postgresql

# 监控恢复进度
tail -f /var/log/postgresql/postgresql-15-main.log
```

### 4.5 恢复测试
#### 4.5.1 定期恢复测试
```bash
#!/bin/bash
# recovery/test-recovery.sh

set -euo pipefail

# 创建测试环境
echo "=== 创建测试环境 ==="
docker-compose -f docker-compose.test.yml up -d

# 等待服务启动
sleep 30

# 执行备份
echo "=== 执行备份 ==="
./backup/postgres-backup.sh

# 模拟数据损坏
echo "=== 模拟数据损坏 ==="
docker exec test-postgres psql -U fbautobot -d fbautobot \
  -c "DROP TABLE IF EXISTS users CASCADE;"

# 执行恢复
echo "=== 执行恢复 ==="
./recovery/postgres-recovery.sh \
  /backup/postgres/fbautobot_$(date +%Y%m%d)*.sql.gz

# 验证恢复结果
echo "=== 验证恢复结果 ==="
docker exec test-postgres psql -U fbautobot -d fbautobot \
  -c "SELECT COUNT(*) FROM users;"

# 清理测试环境
echo "=== 清理测试环境 ==="
docker-compose -f docker-compose.test.yml down -v

# 生成测试报告
echo "恢复测试完成于: $(date)" > /tmp/recovery-test-report.txt
echo "测试结果: $?" >> /tmp/recovery-test-report.txt
```

#### 4.5.2 恢复指标监控
```yaml
# monitoring/recovery-metrics.yaml
metrics:
  - name: backup_success_rate
    query: rate(backup_job_success_total[24h]) / rate(backup_job_total[24h])
    threshold: 0.95
    
  - name: backup_size_growth
    query: rate(backup_size_bytes[7d])
    threshold: 10737418240  # 10GB/周
    
  - name: recovery_time_objective
    query: histogram_quantile(0.95, rate(recovery_duration_seconds_bucket[30d]))
    threshold: 3600  # 1小时
    
  - name: recovery_point_objective
    query: max(recovery_data_loss_seconds)
    threshold: 900  # 15分钟
```

### 4.6 灾难恢复计划
#### 4.6.1 恢复场景
1. **场景一：单节点故障**
   - 影响：单个服务实例故障
   - RTO：< 5分钟
   - RPO：0数据丢失
   - 恢复步骤：
     1. 自动重启失败实例
     2. 负载均衡器移除故障节点
     3. 监控新实例启动状态

2. **场景二：数据库故障**
   - 影响：数据库服务不可用
   - RTO：< 30分钟
   - RPO：< 15分钟数据丢失
   - 恢复步骤：
     1. 切换到备用数据库
     2. 从最新备份恢复
     3. 应用WAL日志恢复

3. **场景三：区域故障**
   - 影响：整个区域服务中断
   - RTO：< 2小时
   - RPO：< 1小时数据丢失
   - 恢复步骤：
     1. 切换到备用区域
     2. DNS流量切换
     3. 从跨区域备份恢复

4. **场景四：数据损坏**
   - 影响：数据逻辑错误
   - RTO：< 4小时
   - RPO：依赖备份时间点
   - 恢复步骤：
     1. 停止应用服务
     2. 从备份恢复数据
     3. 验证数据完整性
     4. 重新启动服务

#### 4.6.2 恢复团队职责
| 角色 | 职责 | 联系方式 |
|------|------|----------|
| 恢复指挥官 | 总体协调和决策 | 电话: +86 138xxxxxxx |
| 数据库管理员 | 数据库恢复操作 | 电话: +86 139xxxxxxx |
| 系统管理员 | 基础设施恢复 | 电话: +86 137xxxxxxx |
| 应用开发 | 应用验证和测试 | 电话: +86 136xxxxxxx |
| 业务代表 | 业务影响评估 | 电话: +86 135xxxxxxx |

#### 4.6.3 恢复通信计划
1. **即时通知**（故障发生5分钟内）
   - 短信通知恢复团队
   - Slack创建紧急频道
   - 电话会议启动

2. **状态更新**（每15分钟）
   - 更新恢复进度
   - 通报预计恢复时间
   - 记录关键决策

3. **恢复完成**
   - 发送恢复完成通知
   - 更新事后分析文档
   - 安排复盘会议

---

## 第五章：性能优化

### 5.1 数据库优化
#### 5.1.1 索引优化
```sql
-- 常用查询索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_accounts_status ON facebook_accounts(status);
CREATE INDEX idx_tasks_scheduled_at ON tasks(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_logs_created_at ON audit_logs(created_at);

-- 复合索引
CREATE INDEX idx_accounts_tenant_status ON facebook_accounts(tenant_id, status);
CREATE INDEX idx_tasks_account_status ON tasks(account_id, status, scheduled_at);

-- 部分索引
CREATE INDEX idx_active_accounts ON facebook_accounts(id) WHERE status = 'active';
CREATE INDEX idx_recent_logs ON audit_logs(created_at) WHERE created_at > NOW() - INTERVAL '30 days';
```

#### 5.1.2 查询优化
```sql
-- 避免SELECT *
-- 不好
SELECT * FROM users WHERE email = 'user@example.com';

-- 好
SELECT id, name, email FROM users WHERE email = 'user@example.com';

-- 使用EXPLAIN分析查询计划
EXPLAIN ANALYZE
SELECT a.*, COUNT(t.id) as task_count
FROM facebook_accounts a
LEFT JOIN tasks t ON t.account_id = a.id
WHERE a.tenant_id = 123
  AND a.status = 'active'
GROUP BY a.id
ORDER BY task_count DESC;

-- 批量操作优化
-- 不好（N+1查询）
FOR account IN (SELECT * FROM facebook_accounts WHERE tenant_id = 123) LOOP
  SELECT COUNT(*) FROM tasks WHERE account_id = account.id;
END LOOP;

-- 好（单次查询）
SELECT a.id, a.name, COUNT(t.id) as task_count
FROM facebook_accounts a
LEFT JOIN tasks t ON t.account_id = a.id
WHERE a.tenant_id = 123
GROUP BY a.id, a.name;
```

#### 5.1.3 连接池配置
```yaml
# backend/src/config/database.config.ts
export default () => ({
  database: {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    cli: {
      migrationsDir: 'src/migrations',
    },
    extra: {
      // 连接池配置
      max: 100,                    // 最大连接数
      min: 10,                     // 最小连接数
      idleTimeoutMillis: 30000,    // 空闲连接超时
      connectionTimeoutMillis: 2000, // 连接超时
      // 语句缓存
      statement_cache_size: 100,
      // 连接健康检查
      healthCheck: {
        enabled: true,
        interval: 30000,           // 30秒检查一次
      },
    },
  },
});
```

### 5.2 缓存优化
#### 5.2.1 Redis缓存策略
```typescript
// backend/src/services/cache.service.ts
import Redis from 'ioredis';

class CacheService {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10),
      password: process.env.REDIS_PASSWORD,
      // 连接池配置
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 1000,
      enableReadyCheck: true,
      // 集群配置
      clusterRetryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });
  }
  
  // 缓存用户信息（TTL: 1小时）
  async cacheUser(userId: number, userData: any): Promise<void> {
    const key = `user:${userId}`;
    await this.redis.setex(key, 3600, JSON.stringify(userData));
  }
  
  // 缓存账号列表（TTL: 5分钟）
  async cacheAccounts(tenantId: number, accounts: any[]): Promise<void> {
    const key = `accounts:${tenantId}`;
    await this.redis.setex(key, 300, JSON.stringify(accounts));
  }
  
  // 缓存任务统计（TTL: 1分钟）
  async cacheTaskStats(accountId: number, stats: any): Promise<void> {
    const key = `task_stats:${accountId}`;
    await this.redis.setex(key, 60, JSON.stringify(stats));
  }
  
  // 批量获取缓存
  async mget(keys: string[]): Promise<any[]> {
    const results = await this.redis.mget(...keys);
    return results.map(result => result ? JSON.parse(result) : null);
  }
  
  // 删除缓存
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

#### 5.2.2 缓存预热
```typescript
// backend/src/jobs/cache-warmup.job.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../services/cache.service';
import { AccountService } from '../services/account.service';

@Injectable()
export class CacheWarmupJob {
  constructor(
    private cacheService: CacheService,
    private accountService: AccountService,
  ) {}
  
  // 每天凌晨3点预热缓存
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async warmupDailyCache() {
    console.log('开始预热每日缓存...');
    
    // 预热活跃用户缓存
    const activeUsers = await this.accountService.getActiveUsers();
    for (const user of activeUsers) {
      await this.cacheService.cacheUser(user.id, user);
    }
    
    // 预热热门数据
    const popularAccounts = await this.accountService.getPopularAccounts();
    for (const account of popularAccounts) {
      await this.cacheService.cacheAccounts(account.tenantId, [account]);
    }
    
    console.log('每日缓存预热完成');
  }
  
  // 每小时预热高频数据
  @Cron(CronExpression.EVERY_HOUR)
  async warmupHourlyCache() {
    console.log('开始预热小时缓存...');
    
    // 预热任务统计
    const recentTasks = await this.accountService.getRecentTaskStats();
    for (const stat of recentTasks) {
      await this.cacheService.cacheTaskStats(stat.accountId, stat);
    }
    
    console.log('小时缓存预热完成');
  }
}
```

### 5.3 应用性能优化
#### 5.3.1 代码优化
```typescript
// 优化前
async function getAccountWithTasks(accountId: number) {
  const account = await accountRepository.findOne(accountId);
  const tasks = await taskRepository.find({ where: { accountId } });
  const logs = await logRepository.find({ 
    where: { accountId },
    order: { createdAt: 'DESC' },
    take: 100 
  });
  
  return { account, tasks, logs };
}

// 优化后：使用Promise.all并行查询
async function getAccountWithTasksOptimized(accountId: number) {
  const [account, tasks, logs] = await Promise.all([
    accountRepository.findOne(accountId),
    taskRepository.find({ where: { accountId } }),
    logRepository.find({ 
      where: { accountId },
      order: { createdAt: 'DESC' },
      take: 100 
    }),
  ]);
  
  return { account, tasks, logs };
}

// 优化后：使用数据加载器避免N+1查询
class AccountDataLoader {
  private batchLoadFn: BatchLoadFn<number, Account>;
  
  constructor() {
    this.batchLoadFn = async (ids: number[]) => {
      const accounts = await accountRepository.findByIds(ids);
      const accountMap = new Map(accounts.map(a => [a.id, a]));
      return ids.map(id => accountMap.get(id) || null);
    };
  }
  
  load(id: number): Promise<Account | null> {
    return this.batchLoadFn([id]).then(results => results[0]);
  }
  
  loadMany(ids: number[]): Promise<(Account | null)[]> {
    return this.batchLoadFn(ids);
  }
}
```

#### 5.3.2 内存优化
```typescript
// 避免内存泄漏
class TaskProcessor {
  private tasks: Map<number, Task> = new Map();
  private listeners: Set<Function> = new Set();
  
  // 正确清理资源
  cleanup() {
    this.tasks.clear();
    this.listeners.clear();
  }
  
  // 使用WeakMap避免强引用
  private cache: WeakMap<object, any> = new WeakMap();
  
  // 流式处理大数据
  async processLargeDataset(dataset: any[]) {
    for (const item of dataset) {
      // 处理单个项目
      await this.processItem(item);
      
      // 定期垃圾回收提示
      if (dataset.indexOf(item) % 1000 === 0) {
        if (global.gc) {
          global.gc();
        }
      }
    }
  }
}
```

#### 5.3.3 响应压缩
```typescript
// backend/src/main.ts
import compression from 'compression';

// 启用Gzip压缩
app.use(compression({
  level: 6,                    // 压缩级别（1-9）
  threshold: 1024,             // 最小压缩大小
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// 静态资源缓存
app.use('/static', express.static('public', {
  maxAge: '1y',                // 缓存1年
  immutable: true,             // 不可变资源
  setHeaders: (res, path) => {
    if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));
```

### 5.4 网络优化
#### 5.4.1 HTTP/2配置
```nginx
# nginx/fbautobot.conf
server {
  listen 443 ssl http2;  # 启用HTTP/2
  server_name api.fbautobot.com;
  
  # SSL配置
  ssl_certificate /etc/ssl/certs/fbautobot.crt;
  ssl_certificate_key /etc/ssl/private/fbautobot.key;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
  
  # HTTP/2优化
  http2_push_preload on;
  http2_max_concurrent_streams 128;
  
  # 连接优化
  keepalive_timeout 75s;
  keepalive_requests 1000;
  
  location / {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # 缓冲区优化
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;
    
    # 超时设置
    proxy_connect_timeout 30s;
    proxy_send_timeout 30s;
    proxy_read_timeout 30s;
  }
}
```

#### 5.4.2 CDN配置
```yaml
# cdn-config.yaml
cache_rules:
  - pattern: "*.js"
    ttl: 31536000  # 1年
    headers:
      Cache-Control: "public, max-age=31536000, immutable"
      
  - pattern: "*.css"
    ttl: 31536000
    headers:
      Cache-Control: "public, max-age=31536000, immutable"
      
  - pattern: "*.png|*.jpg|*.gif|*.svg"
    ttl: 2592000  # 30天
    headers:
      Cache-Control: "public, max-age=2592000"
      
  - pattern: "/api/*"
    ttl: 0  # 不缓存API
    headers:
      Cache-Control: "no-cache, no-store, must-revalidate"
      
optimizations:
  image_compression: true
  minify_js: true
  minify_css: true
  brotli_compression: true
  http2_push: true
```

### 5.5 负载测试和优化
#### 5.5.1 负载测试脚本
```javascript
// tests/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');

// 测试配置
export const options = {
  stages: [
    { duration: '2m', target: 100 },    // 预热
    { duration: '5m', target: 100 },    // 正常负载
    { duration: '2m', target: 200 },    // 压力测试
    { duration: '2m', target: 100 },    // 恢复
    { duration: '1m', target: 0 },      // 冷却
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95%请求<500ms
    errors: ['rate<0.01'],              // 错误率<1%
    http_reqs: ['count>1000'],          // 总请求>1000
  },
};

// 测试数据
export function setup() {
  // 获取测试token
  const loginRes = http.post('https://api.fbautobot.com/auth/login', {
    email: 'test@example.com',
    password: 'test123',
  });
  
  return {
    token: loginRes.json('token'),
  };
}

// 测试场景
export default function (data) {
  const params = {
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  };
  
  // 测试获取账号列表
  const res1 = http.get('https://api.fbautobot.com/api/accounts', params);
  check(res1, {
    '获取账号列表成功': (r) => r.status === 200,
  });
  errorRate.add(res1.status !== 200);
  
  // 测试创建任务
  const taskData = JSON.stringify({
    name: '测试任务',
    type: 'post',
    content: '测试内容',
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
  });
  
  const res2 = http.post('https://api.fbautobot.com/api/tasks', taskData, params);
  check(res2, {
    '创建任务成功': (r) => r.status === 201,
  });
  errorRate.add(res2.status !== 201);
  
  sleep(1);
}
```

#### 5.5.2 性能监控指标
```yaml
# monitoring/performance-metrics.yaml
metrics:
  - name: api_response_time_p95
    query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
    threshold: 0.5  # 500ms
    
  - name: database_query_time_p95
    query: histogram_quantile(0.95, rate(pg_query_duration_seconds_bucket[5m]))
    threshold: 0.1  # 100ms
    
  - name: cache_hit_rate
    query: rate(redis_commands_total{command="get"}[5m]) / rate(redis_commands_total{command="get|set"}[5m])
    threshold: 0.8  # 80%
    
  - name: error_rate
    query: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
    threshold: 0.01  # 1%
    
  - name: throughput
    query: rate(http_requests_total[5m])
    threshold: 1000  # 1000请求/秒
```

---

## 第六章：安全管理

### 6.1 安全架构
#### 6.1.1 安全层次
```
┌─────────────────┐
│   应用安全      │ ← 认证、授权、输入验证
├─────────────────┤
│   数据安全      │ ← 加密、脱敏、访问控制
├─────────────────┤
│   网络安全      │ ← 防火墙、WAF、DDoS防护
├─────────────────┤
│   主机安全      │ ← 系统加固、漏洞管理
├─────────────────┤
│   物理安全      │ ← 机房访问、设备安全
└─────────────────┘
```

#### 6.1.2 安全控制矩阵
| 控制类型 | 控制措施 | 实施位置 |
|----------|----------|----------|
| 预防性控制 | WAF规则、输入验证、访问控制 | 网关层、应用层 |
| 检测性控制 | 入侵检测、日志监控、异常检测 | 网络层、主机层 |
| 纠正性控制 | 自动阻断、漏洞修复、数据恢复 | 所有层次 |
| 恢复性控制 | 备份恢复、灾难恢复、业务连续性 | 数据层、基础设施 |

### 6.2 应用安全
#### 6.2.1 输入验证和过滤
```typescript
// backend/src/utils/validation.ts
import { BadRequestException } from '@nestjs/common';
import validator from 'validator';

class SecurityValidator {
  // SQL注入防护
  static sanitizeSql(input: string): string {
    if (!input) return '';
    
    // 移除SQL关键字
    const sqlKeywords = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'UNION',
      'OR', 'AND', 'WHERE', 'FROM', 'TABLE', 'DATABASE'
    ];
    
    let sanitized = input;
    sqlKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });
    
    return sanitized.trim();
  }
  
  // XSS防护
  static sanitizeHtml(input: string): string {
    return validator.escape(input);
  }
  
  // 路径遍历防护
  static sanitizePath(input: string): string {
    if (!input) return '';
    
    // 移除目录遍历字符
    const dangerous = ['../', '..\\', '/..', '\\..'];
    let sanitized = input;
    dangerous.forEach(pattern => {
      while (sanitized.includes(pattern)) {
        sanitized = sanitized.replace(pattern, '');
      }
    });
    
    return sanitized;
  }
  
  // 邮箱验证
  static validateEmail(email: string): boolean {
    return validator.isEmail(email);
  }
  
  // 密码强度验证
  static validatePassword(password: string): boolean {
    if (password.length < 8) return false;
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return hasUpperCase && hasLowerCase && hasNumbers && hasSpecial;
  }
}
```

#### 6.2.2 认证和授权
```typescript
// backend/src/guards/jwt-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    
    if (!token) {
      throw new UnauthorizedException('未提供认证令牌');
    }
    
    try {
      // 验证JWT令牌
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      
      // 检查令牌是否在黑名单中
      const isBlacklisted = await this.redisService.get(`token:blacklist:${token}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('令牌已失效');
      }
      
      // 将用户信息附加到请求
      request.user = payload;
      
      // 检查角色权限
      const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
      if (requiredRoles) {
        return this.matchRoles(requiredRoles, payload.roles);
      }
      
      return true;
    } catch (error) {
      throw new UnauthorizedException('认证失败');
    }
  }
  
  private extractToken(request: Request): string | null {
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }
  
  private matchRoles(requiredRoles: string[], userRoles: string[]): boolean {
    return requiredRoles.some(role => userRoles.includes(role));
  }
}
```

#### 6.2.3 会话管理
```typescript
// backend/src/services/session.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class SessionService {
  private readonly SESSION_TTL = 3600; // 1小时
  private readonly MAX_SESSIONS = 5;   // 每个用户最大会话数
  
  constructor(private redisService: RedisService) {}
  
  // 创建会话
  async createSession(userId: number, deviceInfo: any): Promise<string> {
    const sessionId = this.generateSessionId();
    const sessionKey = `session:${sessionId}`;
    
    // 检查会话数量限制
    const userSessions = await this.getUserSessions(userId);
    if (userSessions.length >= this.MAX_SESSIONS) {
      // 移除最旧的会话
      const oldestSession = userSessions[0];
      await this.redisService.del(`session:${oldestSession}`);
    }
    
    // 存储会话数据
    const sessionData = {
      userId,
      deviceInfo,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ipAddress: deviceInfo.ip,
      userAgent: deviceInfo.userAgent,
    };
    
    await this.redisService.setex(sessionKey, this.SESSION_TTL, JSON.stringify(sessionData));
    
    // 更新用户会话列表
    await this.redisService.lpush(`user:sessions:${userId}`, sessionId);
    await this.redisService.ltrim(`user:sessions:${userId}`, 0, this.MAX_SESSIONS - 1);
    
    return sessionId;
  }
  
  // 验证会话
  async validateSession(sessionId: string): Promise<boolean> {
    const sessionKey = `session:${sessionId}`;
    const sessionData = await this.redisService.get(sessionKey);
    
    if (!sessionData) {
      return false;
    }
    
    // 更新最后活动时间
    const session = JSON.parse(sessionData);
    session.lastActivity = new Date().toISOString();
    await this.redisService.setex(sessionKey, this.SESSION_TTL, JSON.stringify(session));
    
    return true;
  }
  
  // 获取用户所有会话
  async getUserSessions(userId: number): Promise<string[]> {
    return await this.redisService.lrange(`user:sessions:${userId}`, 0, -1);
  }
  
  // 终止会话
  async terminateSession(sessionId: string): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    const sessionData = await this.redisService.get(sessionKey);
    
    if (sessionData) {
      const session = JSON.parse(sessionData);
      // 从用户会话列表中移除
      await this.redisService.lrem(`user:sessions:${session.userId}`, 0, sessionId);
    }
    
    await this.redisService.del(sessionKey);
  }
  
  // 终止用户所有会话
  async terminateAllUserSessions(userId: number): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    
    for (const sessionId of sessions) {
      await this.redisService.del(`session:${sessionId}`);
    }
    
    await this.redisService.del(`user:sessions:${userId}`);
  }
  
  // 清理过期会话
  async cleanupExpiredSessions(): Promise<void> {
    // Redis会自动清理过期的key
    // 这里可以添加额外的清理逻辑
  }
  
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
```

### 6.3 数据安全
#### 6.3.1 数据加密
```typescript
// backend/src/utils/encryption.ts
import crypto from 'crypto';

class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  
  constructor() {
    // 从环境变量获取密钥
    const keyString = process.env.ENCRYPTION_KEY;
    if (!keyString || keyString.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters');
    }
    this.key = Buffer.from(keyString, 'hex');
  }
  
  // 加密数据
  encrypt(text: string): string {
    const iv = crypto.randomBytes(12); // GCM推荐12字节IV
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // 组合: IV + 加密数据 + 认证标签
    return Buffer.concat([iv, Buffer.from(encrypted, 'hex'), authTag]).toString('base64');
  }
  
  // 解密数据
  decrypt(encryptedData: string): string {
    const buffer = Buffer.from(encryptedData, 'base64');
    
    // 解析组件
    const iv = buffer.slice(0, 12);
    const authTag = buffer.slice(-16);
    const encryptedText = buffer.slice(12, -16);
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  }
  
  // 哈希密码
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
      .toString('hex');
    
    return `${salt}:${hash}`;
  }
  
  // 验证密码
  verifyPassword(password: string, hashedPassword: string): boolean {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
      .toString('hex');
    
    return hash === verifyHash;
  }
}
```

#### 6.3.2 数据脱敏
```typescript
// backend/src/utils/data-masking.ts
class DataMaskingService {
  // 邮箱脱敏
  static maskEmail(email: string): string {
    if (!email) return '';
    
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    
    if (localPart.length <= 2) {
      return `*@${domain}`;
    }
    
    const maskedLocal = localPart[0] + '*'.repeat(localPart.length - 2) + localPart.slice(-1);
    return `${maskedLocal}@${domain}`;
  }
  
  // 手机号脱敏
  static maskPhone(phone: string): string {
    if (!phone) return '';
    
    if (phone.length <= 4) {
      return '*'.repeat(phone.length);
    }
    
    return phone.slice(0, 3) + '*'.repeat(phone.length - 7) + phone.slice(-4);
  }
  
  // IP地址脱敏
  static maskIp(ip: string): string {
    if (!ip) return '';
    
    const parts = ip.split('.');
    if (parts.length !== 4) return ip;
    
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  
  // 信用卡号脱敏
  static maskCreditCard(cardNumber: string): string {
    if (!cardNumber) return '';
    
    if (cardNumber.length <= 4) {
      return '*'.repeat(cardNumber.length);
    }
    
    return '*'.repeat(cardNumber.length - 4) + cardNumber.slice(-4);
  }
  
  // 敏感数据过滤
  static filterSensitiveData(data: any): any {
    if (!data) return data;
    
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'creditCard',
      'ssn', 'passport', 'driverLicense', 'bankAccount'
    ];
    
    const filtered = { ...data };
    
    for (const field of sensitiveFields) {
      if (filtered[field]) {
        filtered[field] = '[FILTERED]';
      }
    }
    
    return filtered;
  }
}
```

### 6.4 网络安全
#### 6.4.1 WAF规则配置
```nginx
# nginx/waf-rules.conf
# SQL注入防护
location ~* "(union.*select|select.*from|insert.*into|update.*set|delete.*from)" {
  deny all;
  return 403;
}

# XSS防护
location ~* "(<script|javascript:|onclick|onload|onerror)" {
  deny all;
  return 403;
}

# 路径遍历防护
location ~* "(\.\./|\.\.\\)" {
  deny all;
  return 403;
}

# 请求限制
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

location /api/ {
  limit_req zone=api burst=20 nodelay;
  proxy_pass http://backend:3000;
}

location /auth/ {
  limit_req zone=auth burst=10 nodelay;
  proxy_pass http://backend:3000;
}

# 文件上传限制
client_max_body_size 10m;

# 隐藏服务器信息
server_tokens off;
more_set_headers 'Server: Unknown';
```

#### 6.4.2 DDoS防护配置
```yaml
# cloudflare/ddos-rules.yaml
rules:
  - name: "API Rate Limiting"
    action: "challenge"
    expression: "(http.request.uri.path contains \"/api/\" and not cf.bot_management.score gt 30) and cf.threat_score gt 10"
    
  - name: "Bot Protection"
    action: "managed_challenge"
    expression: "cf.bot_management.score lt 30 and not cf.client.bot"
    
  - name: "Country Block"
    action: "block"
    expression: "ip.geoip.country in {\"CN\" \"RU\" \"KP\"}"
    
  - name: "Request Flood"
    action: "block"
    expression: "cf.threat_score gt 50 and cf.edge.server_ip in $malicious_ips"

firewall_rules:
  - description: "Block malicious user agents"
    filter: "http.user_agent contains \"sqlmap\" or http.user_agent contains \"nikto\" or http.user_agent contains \"nessus\""
    action: "block"
    
  - description: "Block scan attempts"
    filter: "http.request.uri.path contains \"/phpmyadmin\" or http.request.uri.path contains \"/wp-admin\" or http.request.uri.path contains \"/admin\""
    action: "block"
```

### 6.5 安全监控和审计
#### 6.5.1 安全事件日志
```typescript
// backend/src/services/audit.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}
  
  // 记录安全事件
  async logSecurityEvent(event: {
    userId?: number;
    action: string;
    resource: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      resourceId: event.resourceId,
      details: event.details ? JSON.stringify(event.details) : null,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      severity: event.severity,
      timestamp: new Date(),
    });
    
    await this.auditLogRepository.save(auditLog);
    
    // 如果是高危事件，触发告警
    if (event.severity === 'high' || event.severity === 'critical') {
      await this.triggerSecurityAlert(event);
    }
  }
  
  // 触发安全告警
  private async triggerSecurityAlert(event: any): Promise<void> {
    const alertMessage = `安全告警: ${event.action} - ${event.resource}`;
    
    // 发送到Slack
    await this.sendSlackAlert(alertMessage, event);
    
    // 发送邮件
    await this.sendEmailAlert(alertMessage, event);
    
    // 记录到安全监控系统
    console.warn(`[SECURITY ALERT] ${alertMessage}`, event);
  }
  
  // 查询审计日志
  async searchAuditLogs(filters: {
    userId?: number;
    action?: string;
    resource?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
  }): Promise<AuditLog[]> {
    const query = this.auditLogRepository.createQueryBuilder('log');
    
    if (filters.userId) {
      query.andWhere('log.userId = :userId', { userId: filters.userId });
    }
    
    if (filters.action) {
      query.andWhere('log.action = :action', { action: filters.action });
    }
    
    if (filters.resource) {
      query.andWhere('log.resource = :resource', { resource: filters.resource });
    }
    
    if (filters.severity) {
      query.andWhere('log.severity = :severity', { severity: filters.severity });
    }
    
    if (filters.startDate) {
      query.andWhere('log.timestamp >= :startDate', { startDate: filters.startDate });
    }
    
    if (filters.endDate) {
      query.andWhere('log.timestamp <= :endDate', { endDate: filters.endDate });
    }
    
    if (filters.ipAddress) {
      query.andWhere('log.ipAddress = :ipAddress', { ipAddress: filters.ipAddress });
    }
    
    query.orderBy('log.timestamp', 'DESC');
    
    return query.getMany();
  }
}
```

#### 6.5.2 安全监控规则
```yaml
# security-monitoring/rules.yaml
rules:
  - name: "多次登录失败"
    condition: "count(audit.action = 'LOGIN_FAILED' by user_id) > 5 within 5m"
    severity: "high"
    action: "block_ip"
    
  - name: "异常地理位置登录"
    condition: "audit.action = 'LOGIN_SUCCESS' and geoip.distance > 1000km"
    severity: "medium"
    action: "require_mfa"
    
  - name: "敏感数据访问"
    condition: "audit.resource in ['user.pii', 'payment.card'] and audit.action = 'READ'"
    severity: "high"
    action: "alert_admin"
    
  - name: "批量数据导出"
    condition: "count(audit.action = 'EXPORT' by user_id) > 3 within 1h"
    severity: "medium"
    action: "review_activity"
    
  - name: "API密钥滥用"
    condition: "rate(api.requests by api_key) > 1000/s"
    severity: "critical"
    action: "revoke_key"
```

### 6.6 漏洞管理
#### 6.6.1 漏洞扫描流程
```bash
# 管理员运维指南 - 续篇

## 第七章：故障处理（续）

### 7.6 事后分析和改进
#### 7.6.1 故障分析模板
```markdown
# Facebook Auto Bot 故障分析报告

## 基本信息
- **故障ID**: FBAB-INCIDENT-2026-04-13-001
- **发生时间**: 2026-04-13 14:30:00 GMT+8
- **恢复时间**: 2026-04-13 15:15:00 GMT+8
- **持续时间**: 45分钟
- **影响等级**: P2 - 高
- **影响服务**: 任务调度系统、账号管理API

## 故障描述
数据库连接池耗尽导致任务调度服务不可用，用户无法创建和查看任务，API返回500错误。

## 时间线
| 时间 | 事件 | 负责人 |
|------|------|--------|
| 14:30 | 监控系统检测到数据库连接数异常 | Prometheus |
| 14:32 | AlertManager发送告警到Slack | AlertManager |
| 14:35 | 值班工程师开始故障诊断 | 工程师A |
| 14:40 | 确认数据库连接池耗尽问题 | 工程师A |
| 14:45 | 实施连接清理和优化方案 | 工程师A |
| 14:55 | 验证服务恢复情况 | 工程师A |
| 15:00 | 服务完全恢复，监控指标正常 | 工程师A |
| 15:15 | 发送故障恢复通知给用户 | 系统自动 |

## 根本原因分析
1. **直接原因**: 一个批量任务处理脚本没有正确释放数据库连接
2. **根本原因**: 数据库连接池配置不合理，缺乏连接泄漏检测
3. **促成因素**: 监控告警阈值设置过高，未能及时预警

## 影响评估
- **受影响的用户**: 5,234名活跃用户（占总用户32%）
- **业务影响**: 任务创建失败率100%，45分钟内无新任务创建
- **财务影响**: 预计损失 $1,250（基于平均交易额）
- **声誉影响**: 收到23个用户投诉，社交媒体负面评论增加
- **技术影响**: 数据库性能下降，影响其他服务

## 纠正措施
1. **立即措施**
   - [x] 重启任务调度服务
   - [x] 清理数据库空闲连接
   - [x] 临时增加连接池大小
   - [x] 发送服务恢复通知

2. **短期措施**（1周内）
   - [ ] 修复批量任务脚本的连接泄漏
   - [ ] 优化数据库连接池配置
   - [ ] 调整监控告警阈值
   - [ ] 更新应急预案

3. **长期措施**（1个月内）
   - [ ] 实施连接泄漏自动检测
   - [ ] 数据库读写分离
   - [ ] 增加容量规划监控
   - [ ] 定期进行压力测试

## 经验教训
1. **监控改进**: 需要更细粒度的数据库监控
2. **代码质量**: 加强数据库连接管理的代码审查
3. **容量规划**: 建立基于业务增长的容量预测模型
4. **团队培训**: 定期进行故障处理演练

## 改进计划
| 改进项 | 负责人 | 截止日期 | 状态 | 优先级 |
|--------|--------|----------|------|--------|
| 修复连接泄漏代码 | 张三 | 2026-04-15 | 进行中 | P0 |
| 优化数据库配置 | 李四 | 2026-04-18 | 待开始 | P1 |
| 更新监控告警规则 | 王五 | 2026-04-16 | 计划中 | P1 |
| 实施连接池监控 | 赵六 | 2026-04-20 | 待开始 | P2 |
| 压力测试计划 | 钱七 | 2026-04-25 | 计划中 | P2 |

## 批准
- **编写人**: 工程师A
- **审核人**: 运维经理B
- **批准人**: 技术总监C
- **日期**: 2026-04-13
- **下次评审**: 2026-04-20
```

#### 7.6.2 持续改进流程
1. **定期评审会议**
   - **每日站会**: 检查前一日故障和告警
   - **每周故障评审**: 分析本周所有P1/P2故障
   - **月度运维会议**: 评审运维指标和改进计划
   - **季度改进规划**: 制定下季度运维优化计划

2. **关键运维指标跟踪**
   ```yaml
   # metrics/operations-metrics.yaml
   key_metrics:
     availability:
       target: 99.95%  # 年度目标
       current: 99.92%  # 当前值
       trend: "+0.01%"  # 趋势
     
     mean_time_to_recovery:
       target: "< 30分钟"
       current: "45分钟"
       trend: "-5分钟"  # 改善中
     
     mean_time_to_detect:
       target: "< 2分钟"
       current: "3分钟"
       trend: "稳定"
     
     change_failure_rate:
       target: "< 5%"
       current: "3.2%"
       trend: "-0.5%"
     
     deployment_frequency:
       target: "每天多次"
       current: "每周2次"
       trend: "+1次/周"
   ```

3. **知识管理和培训**
   - **运维知识库**: 持续更新故障处理指南
   - **最佳实践文档**: 分享成功经验和优化方案
   - **新员工培训**: 系统化的运维技能培训
   - **技能认证**: 定期进行运维技能评估

---

## 附录

### A. 紧急联系人列表
| 角色 | 姓名 | 电话 | 邮箱 | 备用联系人 | 值班时间 |
|------|------|------|------|------------|----------|
| 运维值班工程师 | 张三 | +86 13800138000 | zhangsan@fbautobot.com | 李四 | 09:00-18:00 |
| 运维值班工程师 | 李四 | +86 13900139000 | lisi@fbautobot.com | 王五 | 18:00-02:00 |
| 运维值班工程师 | 王五 | +86 13700137000 | wangwu@fbautobot.com | 赵六 | 02:00-09:00 |
| 数据库管理员 | 赵六 | +86 13600136000 | zhaoliu@fbautobot.com | 钱七 | 随时待命 |
| 网络工程师 | 钱七 | +86 13500135000 | qianqi@fbautobot.com | 孙八 | 随时待命 |
| 安全工程师 | 孙八 | +86 13400134000 | sunba@fbautobot.com | 周九 | 随时待命 |
| 技术总监 | 周九 | +86 13300133000 | zhoujiu@fbautobot.com | 吴十 | 工作日 |

### B. 常用命令参考
```bash
# 系统状态检查
systemctl status fbautobot-backend
systemctl status fbautobot-frontend
systemctl status postgresql
systemctl status redis

# 日志查看
tail -f /var/log/fbautobot/application.log
tail -f /var/log/postgresql/postgresql-15-main.log
tail -f /var/log/redis/redis-server.log

# 性能监控
top -b -n 1 | head -20
htop
iotop -o

# 网络诊断
netstat -tlnp | grep :3000
ss -tlnp | grep :3000
lsof -i :3000

# 数据库诊断
psql -U fbautobot -c "SELECT * FROM pg_stat_activity;"
psql -U fbautobot -c "SELECT * FROM pg_stat_database;"
psql -U fbautobot -c "SELECT * FROM pg_locks;"

# 缓存诊断
redis-cli info
redis-cli info memory
redis-cli info clients
redis-cli slowlog get 10
```

### C. 故障代码参考
| 错误代码 | 含义 | 严重等级 | 处理建议 |
|----------|------|----------|----------|
| ERR-DB-001 | 数据库连接失败 | P1 | 检查数据库服务状态和网络连接 |
| ERR-DB-002 | 连接池耗尽 | P2 | 清理空闲连接，优化查询 |
| ERR-DB-003 | 死锁检测 | P2 | 分析锁等待，终止阻塞进程 |
| ERR-REDIS-001 | Redis连接失败 | P2 | 检查Redis服务状态 |
| ERR-REDIS-002 | 内存溢出 | P2 | 清理缓存，调整内存策略 |
| ERR-API-001 | Facebook API失败 | P3 | 检查API状态，启用降级 |
| ERR-API-002 | 第三方服务超时 | P3 | 调整超时设置，重试机制 |
| ERR-AUTH-001 | 认证服务异常 | P2 | 检查JWT服务，验证证书 |
| ERR-TASK-001 | 任务调度失败 | P3 | 检查任务队列，重启调度器 |
| ERR-NET-001 | 网络连接超时 | P2 | 检查防火墙，网络配置 |

### D. 工具和资源
| 工具 | 用途 | 访问地址 | 凭证位置 |
|------|------|----------|----------|
| Grafana | 监控仪表盘 | https://grafana.fbautobot.com | 1Password |
| Kibana | 日志分析 | https://kibana.fbautobot.com | 1Password |
| Prometheus | 指标收集 | https://prometheus.fbautobot.com | 1Password |
| AlertManager | 告警管理 | https://alertmanager.fbautobot.com | 1Password |
| Jaeger | 分布式追踪 | https://jaeger.fbautobot.com | 1Password |
| Sentry | 错误跟踪 | https://sentry.fbautobot.com | 1Password |
| Kubernetes Dashboard | 容器管理 | https://k8s.fbautobot.com | kubeconfig |
| GitHub | 代码仓库 | https://github.com/fbautobot | SSH Key |
| Jira | 问题跟踪 | https://jira.fbautobot.com | LDAP |
| Confluence | 知识库 | https://confluence.fbautobot.com | LDAP |

### E. 版本历史
| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0.0 | 2026-04-13 | 运维团队 | 初始版本发布 |
| 1.0.1 | 2026-04-20 | 张三 | 更新故障处理流程 |
| 1.1.0 | 2026-05-15 | 李四 | 增加安全监控章节 |
| 1.2.0 | 2026-06-30 | 王五 | 优化性能调优指南 |

---

## 文档维护

### 更新频率
- **每周**: 检查并更新故障处理经验
- **每月**: 评审并更新运维流程
- **每季度**: 全面更新文档内容

### 反馈渠道
如果您发现文档有任何问题或有改进建议，请通过以下方式反馈：

1. 在Confluence页面添加评论
2. 发送邮件到 docs-ops@fbautobot.com
3. 在Slack的 #documentation 频道讨论
4. 创建Jira工单（类型：文档改进）

### 文档审核
- **技术审核**: 运维团队负责人
- **安全审核**: 安全团队负责人
- **最终批准**: 技术总监

---

**最后更新**: 2026-04-13  
**文档版本**: 1.0.0  
**适用环境**: 生产环境  
**保密等级**: 内部使用  

*本文档内容会根据系统变更和运维经验持续更新，请确保使用最新版本。*