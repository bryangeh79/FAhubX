# IP轮换策略

## 功能
- 实现多种IP轮换策略
- 基于时间、流量、请求等条件触发轮换
- 智能选择最优VPN服务器
- 轮换历史记录和统计
- 轮换失败处理和回退

## 轮换策略类型
1. **时间轮换**: 基于固定时间间隔轮换IP
   - 每小时轮换
   - 每天轮换
   - 自定义时间间隔

2. **流量轮换**: 基于数据使用量轮换IP
   - 每GB数据轮换
   - 每月流量限制
   - 实时流量监控

3. **请求轮换**: 基于请求数量轮换IP
   - 每N个请求轮换
   - 基于API调用频率
   - 防止请求频率限制

4. **智能轮换**: 基于多种因素动态决策
   - 服务器负载
   - 网络延迟
   - 地理位置
   - 历史成功率

## 核心组件
- `ip-rotation-manager.ts` - IP轮换管理器
- `time-based-rotation.ts` - 时间轮换策略
- `traffic-based-rotation.ts` - 流量轮换策略
- `request-based-rotation.ts` - 请求轮换策略
- `smart-rotation-strategy.ts` - 智能轮换策略
- `rotation-history-manager.ts` - 轮换历史管理

## 配置示例
```typescript
const rotationConfig = {
  strategy: 'smart',
  triggers: [
    { type: 'time', interval: 3600 }, // 每小时
    { type: 'traffic', limit: 1024 }, // 每1GB
    { type: 'requests', count: 1000 } // 每1000请求
  ],
  selection: {
    algorithm: 'weighted',
    factors: ['latency', 'successRate', 'load'],
    weights: { latency: 0.4, successRate: 0.4, load: 0.2 }
  }
};
```

## 使用方法
```typescript
import { IPRotationManager } from './ip-rotation-manager';

const rotationManager = new IPRotationManager(config);
await rotationManager.initialize();

// 手动触发轮换
await rotationManager.rotateIP(sessionId);

// 自动轮换（基于配置的触发器）
rotationManager.startAutoRotation();
```