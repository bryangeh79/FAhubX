# OpenVPN配置解析器

## 功能
- 解析OpenVPN配置文件（.ovpn格式）
- 提取服务器地址、端口、协议、加密设置等关键信息
- 验证配置文件的完整性和安全性
- 支持证书、密钥、用户名/密码等多种认证方式
- 生成标准化的配置对象供连接管理器使用

## 文件结构
- `openvpn-config-parser.ts` - 主解析器类
- `openvpn-config-types.ts` - 类型定义
- `openvpn-config-validator.ts` - 配置文件验证器
- `index.ts` - 模块导出

## 使用方法
```typescript
import { OpenVPNConfigParser } from './openvpn-config-parser';

const parser = new OpenVPNConfigParser();
const config = await parser.parseConfig('path/to/config.ovpn');
console.log(config);
```

## 支持的配置选项
- remote: 服务器地址和端口
- proto: 协议 (tcp/udp)
- dev: 设备类型 (tun/tap)
- ca/cert/key: 证书和密钥
- auth-user-pass: 用户名密码认证
- cipher: 加密算法
- auth: 认证算法
- tls-auth: TLS认证密钥
- comp-lzo: 压缩设置