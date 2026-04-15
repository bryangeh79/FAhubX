# Phase 2.2 - VPN管理器与健康监控系统

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

一个完整的VPN/IP集成系统和账号健康监控系统，为企业级VPN管理和账号健康监控提供全面解决方案。

## ✨ 特性

### 🔒 VPN管理
- **多协议支持**: OpenVPN和WireGuard双协议
- **智能IP管理**: 基于策略的IP轮换和黑名单
- **网络隔离**: Linux网络命名空间隔离
- **自动重连**: 智能连接恢复机制
- **性能监控**: 实时网络性能测试

### 🏥 健康监控
- **全面检查**: 登录状态、API访问、会话有效性等
- **风险评分**: 基于多因素的智能风险评分
- **自动修复**: 常见问题的自动检测和修复
- **历史追踪**: 完整的健康检查历史记录

### 📊 监控告警
- **实时告警**: 多级别告警系统
- **多通道通知**: 应用内、邮件、Webhook通知
- **仪表板**: 实时状态可视化和数据分析
- **事件流**: 服务器发送事件(SSE)实时更新

## 🚀 快速开始

### 使用Docker Compose（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/your-org/phase2.2-vpn-health-monitoring.git
cd phase2.2-vpn-health-monitoring

# 2. 配置环境变量
cp .env.example .env
# 编辑.env文件配置必要的环境变量

# 3. 启动服务
docker-compose up -d

# 4. 验证安装
curl http://localhost:3000/health
```

### 手动安装

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 启动服务
npm start
```

## 📁 项目结构

```
src/
├── vpn/                    # VPN管理器模块
│   ├── openvpn/           # OpenVPN客户端集成
│   ├── wireguard/         # WireGuard备选方案
│   ├── ip-manager/        # IP管理功能
│   └── network-isolation/ # 网络隔离系统
├── health/                # 健康监控系统
│   ├── engine/           # 健康检查引擎
│   ├── risk-detection/   # 风险检测算法
│   └── auto-repair/      # 自动修复流程
├── monitoring/           # 监控告警系统
│   ├── alerts/          # 实时告警引擎
│   ├── dashboard/       # 仪表板集成
│   └── notifications/   # 多通道通知
├── api/                 # API扩展
│   ├── vpn/            # VPN管理接口
│   ├── health/         # 健康状态接口
│   └── monitoring/     # 监控数据接口
└── shared/             # 共享模块
    ├── types/          # TypeScript类型定义
    ├── utils/          # 工具函数
    └── config/         # 配置管理
```

## 🔧 配置

### 环境变量

创建 `.env` 文件并配置以下变量：

```bash
# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/vpn_health_db
REDIS_URL=redis://localhost:6379

# 服务器配置
PORT=3000
NODE_ENV=production

# VPN配置
OPENVPN_CONFIG_PATH=./config/openvpn
WIREGUARD_CONFIG_PATH=./config/wireguard

# 安全配置（必须修改！）
JWT_SECRET=your-secure-jwt-secret
ENCRYPTION_KEY=your-secure-encryption-key
```

### VPN配置文件

1. **OpenVPN配置**
   ```bash
   mkdir -p config/openvpn
   cp your-config.ovpn config/openvpn/
   ```

2. **WireGuard配置**
   ```bash
   mkdir -p config/wireguard
   # 使用内置工具生成配置
   ```

## 📚 API文档

### VPN管理接口
- `GET /api/vpn/status` - 获取VPN状态
- `POST /api/vpn/openvpn/connect` - 连接OpenVPN
- `POST /api/vpn/wireguard/connect` - 连接WireGuard
- `POST /api/vpn/:id/disconnect` - 断开VPN连接
- `POST /api/vpn/rotate-ip` - 轮换IP地址

### 健康监控接口
- `POST /api/health/start` - 启动健康监控
- `POST /api/health/stop` - 停止健康监控
- `POST /api/health/run` - 立即运行健康检查
- `GET /api/health/status` - 获取健康状态

### 监控告警接口
- `GET /api/monitoring/status` - 获取监控状态
- `GET /api/monitoring/alerts` - 获取告警列表
- `GET /api/monitoring/dashboard` - 获取仪表板数据
- `GET /api/monitoring/updates` - 实时更新流

## 🧪 测试

```bash
# 运行单元测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行集成测试
npm run test:integration
```

## 🐳 Docker部署

### 构建镜像
```bash
docker build -t phase2.2-vpn-health .
```

### 运行容器
```bash
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host/db \
  -e REDIS_URL=redis://host:6379 \
  phase2.2-vpn-health
```

### Docker Compose
```bash
# 使用docker-compose.yml启动完整环境
docker-compose up -d
```

## 📈 监控和日志

### 日志位置
- 应用日志: `logs/combined.log`
- 错误日志: `logs/error.log`
- VPN日志: `config/openvpn/*.log`

### 健康检查
```bash
curl http://localhost:3000/health
```

### 性能指标
```bash
curl http://localhost:3000/api/monitoring/metrics
```

## 🔒 安全考虑

### 数据安全
- 敏感配置和凭据加密存储
- 所有API通信使用HTTPS
- JWT令牌认证和授权

### 网络安全
- Linux网络命名空间隔离VPN流量
- 自动配置iptables防火墙规则
- IP黑名单管理

### 应用安全
- 所有API输入严格验证
- 安全的错误信息处理
- 敏感信息不记录在日志中

## 🤝 贡献

欢迎贡献！请阅读[贡献指南](CONTRIBUTING.md)。

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开Pull Request

## 📄 许可证

本项目基于MIT许可证 - 查看[LICENSE](LICENSE)文件了解详情。

## 📞 支持

- **文档**: [完整文档](./docs/)
- **问题**: [GitHub Issues](https://github.com/your-org/phase2.2-vpn-health-monitoring/issues)
- **讨论**: [GitHub Discussions](https://github.com/your-org/phase2.2-vpn-health-monitoring/discussions)
- **邮件**: support@your-org.com

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和测试人员。

---

**Phase 2.2 VPN管理器与健康监控系统** - 为企业提供可靠的VPN管理和账号健康监控解决方案。

**状态**: 生产就绪 ✅  
**版本**: 1.0.0  
**最后更新**: 2024年4月12日