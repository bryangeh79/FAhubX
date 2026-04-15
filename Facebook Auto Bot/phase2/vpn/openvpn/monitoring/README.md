# OpenVPN监控模块

## 功能
- 实时监控OpenVPN连接状态
- 性能指标收集（延迟、带宽、丢包率）
- 连接健康度评估
- 异常检测和告警
- 日志分析和统计

## 监控指标
1. **连接状态**: 连接时长、重连次数、稳定性
2. **网络性能**: 延迟、下载速度、上传速度、丢包率
3. **资源使用**: CPU、内存、网络带宽
4. **安全指标**: 加密状态、认证状态、协议版本
5. **业务指标**: 可用性、成功率、响应时间

## 组件
- `openvpn-monitor.ts` - 主监控器
- `openvpn-metrics-collector.ts` - 指标收集器
- `openvpn-health-checker.ts` - 健康检查器
- `openvpn-alert-manager.ts` - 告警管理器
- `openvpn-log-analyzer.ts` - 日志分析器

## 告警规则
- 连接断开超过阈值
- 延迟超过可接受范围
- 带宽使用异常
- 认证失败次数过多
- 安全协议问题

## 使用方法
```typescript
import { OpenVPNMonitor } from './openvpn-monitor';

const monitor = new OpenVPNMonitor();
monitor.startMonitoring(connectionId);
monitor.on('alert', (alert) => {
  console.log('Alert:', alert);
});
```