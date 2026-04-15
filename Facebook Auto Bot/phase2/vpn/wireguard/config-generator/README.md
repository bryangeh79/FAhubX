# WireGuard配置生成器

## 功能
- 生成WireGuard配置文件（.conf格式）
- 支持服务端和客户端配置生成
- 自动密钥对生成和管理
- 配置模板和预设
- 配置验证和优化

## 支持的配置类型
1. **客户端配置**: 连接到WireGuard服务器的配置
2. **服务端配置**: WireGuard服务器配置
3. **对等配置**: 点对点连接配置
4. **路由配置**: 复杂网络路由配置

## 核心组件
- `wireguard-config-generator.ts` - 主配置生成器
- `wireguard-key-generator.ts` - 密钥对生成器
- `wireguard-template-manager.ts` - 模板管理器
- `wireguard-config-validator.ts` - 配置验证器

## 配置选项
- `[Interface]`: 本地接口配置
  - PrivateKey: 私钥
  - Address: IP地址
  - DNS: DNS服务器
  - MTU: 最大传输单元
  
- `[Peer]`: 对等节点配置
  - PublicKey: 对端公钥
  - Endpoint: 服务器地址和端口
  - AllowedIPs: 允许的IP范围
  - PersistentKeepalive: 保持连接

## 使用方法
```typescript
import { WireGuardConfigGenerator } from './wireguard-config-generator';

const generator = new WireGuardConfigGenerator();
const config = await generator.generateClientConfig({
  serverPublicKey: '...',
  serverEndpoint: 'vpn.example.com:51820',
  clientPrivateKey: '...',
  clientAddress: '10.0.0.2/32',
  dns: ['1.1.1.1', '8.8.8.8']
});
```