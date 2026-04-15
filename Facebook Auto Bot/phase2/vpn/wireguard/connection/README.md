# WireGuard连接管理

## 功能
- 管理WireGuard连接的建立和维护
- 支持快速连接和断开
- 连接状态监控
- 网络接口管理
- 故障转移和重连

## 特性
1. **快速连接**: WireGuard的轻量级特性支持快速连接建立
2. **稳定连接**: 内置保持连接机制
3. **多连接管理**: 支持多个WireGuard接口并发运行
4. **状态监控**: 实时监控连接状态和流量统计
5. **自动恢复**: 网络中断时自动恢复连接

## 连接流程
1. **准备阶段**: 加载配置，准备网络接口
2. **连接阶段**: 建立WireGuard隧道
3. **验证阶段**: 验证连接状态和网络可达性
4. **监控阶段**: 持续监控连接健康度
5. **清理阶段**: 断开连接，清理资源

## 核心组件
- `wireguard-connection-manager.ts` - 主连接管理器
- `wireguard-interface-manager.ts` - 网络接口管理器
- `wireguard-connection-monitor.ts` - 连接监控器
- `wireguard-connection-pool.ts` - 连接池管理
- `wireguard-failover-manager.ts` - 故障转移管理器

## 使用方法
```typescript
import { WireGuardConnectionManager } from './wireguard-connection-manager';

const manager = new WireGuardConnectionManager();
const connection = await manager.connect({
  configPath: '/path/to/wg0.conf',
  interfaceName: 'wg0',
  timeout: 10000
});

// 监控连接状态
manager.on('status-change', (status) => {
  console.log('Connection status:', status);
});

// 断开连接
await manager.disconnect(connection.id);
```