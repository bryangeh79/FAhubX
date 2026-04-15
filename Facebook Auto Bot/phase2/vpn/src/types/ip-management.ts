/**
 * IP管理类型定义
 */

export interface IPInfo {
  /** IP地址 */
  ip: string;
  
  /** 地理位置信息 */
  geo: {
    country: string;
    countryCode: string;
    region: string;
    regionName: string;
    city: string;
    zip: string;
    lat: number;
    lon: number;
    timezone: string;
    isp: string;
    org: string;
    as: string;
  };
  
  /** 网络质量指标 */
  quality: {
    latency: number; // 延迟（毫秒）
    jitter: number; // 抖动（毫秒）
    packetLoss: number; // 丢包率（百分比）
    bandwidth: number; // 带宽（Mbps）
    score: number; // 综合评分（0-100）
  };
  
  /** 使用统计 */
  usage: {
    lastUsed: Date;
    totalUptime: number; // 总运行时间（毫秒）
    connectionCount: number; // 连接次数
    successRate: number; // 成功率（百分比）
  };
  
  /** 元数据 */
  metadata: {
    source: 'vpn' | 'proxy' | 'direct';
    provider?: string;
    isBlacklisted: boolean;
    blacklistReason?: string;
    tags: string[];
  };
}

export interface NetworkTestResult {
  /** 目标IP或域名 */
  target: string;
  
  /** 测试时间 */
  timestamp: Date;
  
  /** 延迟测试结果 */
  latency: {
    min: number;
    max: number;
    avg: number;
    packetLoss: number;
    jitter: number;
  };
  
  /** 带宽测试结果 */
  bandwidth?: {
    download: number; // Mbps
    upload: number; // Mbps
  };
  
  /** 连接测试结果 */
  connectivity: {
    tcp: boolean;
    udp: boolean;
    http: boolean;
    https: boolean;
  };
  
  /** 综合评分 */
  score: number;
  
  /** 错误信息 */
  error?: string;
}

export interface IPRotationStrategy {
  /** 策略名称 */
  name: string;
  
  /** 策略描述 */
  description: string;
  
  /** 选择下一个IP的方法 */
  selectNextIP(currentIPs: IPInfo[], usedIPs: string[]): IPInfo | null;
  
  /** 评估IP适用性 */
  evaluateIP(ipInfo: IPInfo, requirements?: RotationRequirements): number;
}

export interface RotationRequirements {
  /** 地理位置要求 */
  geoRequirements?: {
    countries?: string[];
    excludeCountries?: string[];
    regions?: string[];
  };
  
  /** 质量要求 */
  qualityRequirements?: {
    minLatency?: number;
    maxLatency?: number;
    maxPacketLoss?: number;
    minBandwidth?: number;
    minScore?: number;
  };
  
  /** 使用要求 */
  usageRequirements?: {
    minUptime?: number;
    minSuccessRate?: number;
    cooldownPeriod?: number; // 冷却时间（毫秒）
  };
  
  /** 其他要求 */
  otherRequirements?: {
    excludeProviders?: string[];
    requireTags?: string[];
    excludeTags?: string[];
  };
}

export interface GeoDetectionResult {
  /** IP地址 */
  ip: string;
  
  /** 检测时间 */
  timestamp: Date;
  
  /** 地理位置信息 */
  location: {
    continent: string;
    continentCode: string;
    country: string;
    countryCode: string;
    region: string;
    regionName: string;
    city: string;
    district: string;
    zip: string;
    lat: number;
    lon: number;
    timezone: string;
    offset: number;
    currency: string;
    isp: string;
    org: string;
    as: string;
    asname: string;
    reverse: string;
    mobile: boolean;
    proxy: boolean;
    hosting: boolean;
  };
  
  /** 检测来源 */
  source: string;
  
  /** 置信度 */
  confidence: number;
}

export interface IPPool {
  /** 池名称 */
  name: string;
  
  /** IP列表 */
  ips: IPInfo[];
  
  /** 池统计 */
  stats: {
    totalIPs: number;
    availableIPs: number;
    blacklistedIPs: number;
    averageScore: number;
    lastUpdated: Date;
  };
  
  /** 池配置 */
  config: {
    autoRefresh: boolean;
    refreshInterval: number;
    maxIPs: number;
    minQualityScore: number;
  };
}