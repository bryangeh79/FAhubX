# WireGuard密钥管理

## 功能
- 生成安全的WireGuard密钥对（公钥/私钥）
- 密钥存储和安全管理
- 密钥轮换和更新
- 密钥验证和完整性检查
- 密钥分发和同步

## 安全特性
1. **安全生成**: 使用系统安全的随机数生成器
2. **安全存储**: 加密存储私钥，保护敏感信息
3. **访问控制**: 基于角色的密钥访问权限
4. **审计日志**: 所有密钥操作的完整审计跟踪
5. **密钥轮换**: 定期自动轮换密钥，增强安全性

## 密钥类型
- **私钥**: 256位Curve25519私钥，必须严格保密
- **公钥**: 对应的Curve25519公钥，可以安全共享
- **预共享密钥**: 可选的额外加密层（PSK）

## 核心组件
- `wireguard-key-manager.ts` - 主密钥管理器
- `wireguard-key-generator.ts` - 密钥生成器
- `wireguard-key-storage.ts` - 密钥存储管理器
- `wireguard-key-validator.ts` - 密钥验证器
- `wireguard-key-rotation.ts` - 密钥轮换管理器

## 使用方法
```typescript
import { WireGuardKeyManager } from './wireguard-key-manager';

const keyManager = new WireGuardKeyManager();
const keyPair = await keyManager.generateKeyPair();
const isValid = await keyManager.validateKeyPair(keyPair);

// 存储密钥
await keyManager.storeKeyPair('client-1', keyPair, {
  encryptPrivateKey: true,
  accessLevel: 'restricted'
});

// 检索密钥
const retrieved = await keyManager.getKeyPair('client-1');
```