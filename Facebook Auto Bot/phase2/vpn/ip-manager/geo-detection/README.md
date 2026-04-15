# 地理位置检测

## 功能
- IP地址地理位置识别
- 代理和VPN检测
- 网络类型识别（数据中心、住宅、移动）
- ASN（自治系统号）信息获取
- 时区和语言检测

## 数据源
1. **本地数据库**: MaxMind GeoLite2数据库
2. **在线API**: ip-api.com, ipinfo.io等
3. **混合模式**: 本地缓存 + 在线更新
4. **自定义数据源**: 用户提供的IP数据库

## 检测能力
- **国家/地区**: 精确到国家级别
- **城市**: 精确到城市级别（部分IP）
- **经纬度**: 地理位置坐标
- **时区**: 当地时区信息
- **ISP**: 互联网服务提供商
- **ASN**: 自治系统信息
- **网络类型**: 数据中心、住宅、商业、教育等
- **代理检测**: VPN、TOR、代理服务器识别

## 核心组件
- `geo-detection-manager.ts` - 地理位置检测管理器
- `ip-geolocation-service.ts` - IP地理位置服务
- `proxy-detection-service.ts` - 代理检测服务
- `geo-database-manager.ts` - 地理数据库管理器
- `geo-cache-manager.ts` - 地理位置缓存管理器

## 性能优化
1. **缓存机制**: 减少重复查询
2. **批量查询**: 支持批量IP查询
3. **离线模式**: 本地数据库支持
4. **异步处理**: 非阻塞查询
5. **失败回退**: 多数据源回退机制

## 使用方法
```typescript
import { GeoDetectionManager } from './geo-detection-manager';

const geoManager = new GeoDetectionManager({
  useLocalDatabase: true,
  cacheTTL: 3600,
  fallbackToAPI: true
});

// 单个IP查询
const location = await geoManager.getLocation('8.8.8.8');
console.log(location.country, location.city);

// 批量查询
const locations = await geoManager.batchGetLocations(['8.8.8.8', '1.1.1.1']);

// 代理检测
const proxyInfo = await geoManager.detectProxy('8.8.8.8');
if (proxyInfo.isProxy) {
  console.log('Detected proxy type:', proxyInfo.proxyType);
}
```