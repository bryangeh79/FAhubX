# OpenVPN连接管理器

## 功能
- 管理OpenVPN连接的启动、停止和监控
- 支持多连接并发管理
- 自动重连机制
- 连接状态监控和事件通知
- 资源清理和进程管理

## 核心组件
- `openvpn-connection-manager.ts` - 主连接管理器类
- `openvpn-process-manager.ts` - OpenVPN进程管理
- `openvpn-connection-pool.ts` - 连接池管理
- `openvpn-event-emitter.ts` - 事件系统

## 特性
1. **连接池管理**: 支持多个VPN连接并发运行
2. **自动重连**: 网络中断时自动重新连接
3. **状态监控**: 实时监控连接状态和性能指标
4. **事件系统**: 提供连接状态变化的事件通知
5. **资源管理**: 自动清理僵尸进程和临时文件

## 使用方法
```typescript
import { OpenVPNConnectionManager } from './openvpn-connection-manager';

const manager = new OpenVPNConnectionManager();
const connection = await manager.connect(configId, options);
await manager.disconnect(connection.id);
```

## 事件类型
- `connected`: 连接成功建立
- `disconnected`: 连接断开
- `error`: 连接错误
- `reconnecting`: 正在重新连接
- `status-change`: 状态变化
- `log`: 日志输出