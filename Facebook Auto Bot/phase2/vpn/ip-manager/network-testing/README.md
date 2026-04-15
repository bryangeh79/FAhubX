# 网络质量测试

## 功能
- 网络延迟和带宽测试
- 连接稳定性和丢包率测试
- DNS解析速度测试
- 网络路径追踪
- 服务质量（QoS）评估

## 测试类型
1. **延迟测试**: Ping测试，测量往返时间
2. **带宽测试**: 下载和上传速度测试
3. **稳定性测试**: 长时间连接稳定性
4. **丢包测试**: 数据包丢失率
5. **DNS测试**: DNS解析速度和准确性
6. **路由测试**: 网络路径和跳数

## 测试工具集成
- **ping**: 基本延迟测试
- **speedtest-cli**: 带宽测试
- **iperf3**: 专业带宽测试
- **mtr**: 网络路径诊断
- **dig/nslookup**: DNS测试
- **curl/wget**: HTTP连接测试

## 核心组件
- `network-test-manager.ts` - 网络测试管理器
- `latency-tester.ts` - 延迟测试器
- `bandwidth-tester.ts` - 带宽测试器
- `stability-tester.ts` - 稳定性测试器
- `dns-tester.ts` - DNS测试器
- `network-path-analyzer.ts` - 网络路径分析器

## 测试指标
- **延迟**: 平均、最小、最大、标准差
- **带宽**: 下载速度、上传速度
- **丢包率**: 数据包丢失百分比
- **抖动**: 延迟变化程度
- **可用性**: 连接成功率
- **DNS延迟**: 解析时间
- **路由跳数**: 网络路径复杂度

## 使用方法
```typescript
import { NetworkTestManager } from './network-test-manager';

const testManager = new NetworkTestManager();

// 综合网络测试
const results = await testManager.runComprehensiveTest({
  target: '8.8.8.8',
  tests: ['latency', 'bandwidth', 'dns', 'stability'],
  duration: 30000 // 30秒测试
});

console.log('Latency:', results.latency.avg, 'ms');
console.log('Download speed:', results.bandwidth.download, 'Mbps');
console.log('Packet loss:', results.stability.packetLoss, '%');

// 定期监控
testManager.startPeriodicMonitoring({
  interval: 300000, // 每5分钟
  targets: ['8.8.8.8', '1.1.1.1'],
  callback: (results) => {
    console.log('Monitoring results:', results);
  }
});
```