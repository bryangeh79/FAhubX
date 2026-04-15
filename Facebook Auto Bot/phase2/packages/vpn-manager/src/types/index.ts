export interface VPNConfig {
  id: string;
  name: string;
  vpnType: 'openvpn' | 'wireguard' | 'socks5' | 'http_proxy';
  config: {
    serverHost: string;
    serverPort: number;
    protocol?: string;
    username?: string;
    password?: string;
    privateKey?: string;
    publicKey?: string;
    dns?: string[];
    routes?: string[];
  };
  encryption?: {
    configEncrypted: string;
    credentialsEncrypted?: string;
  };
  networkInfo?: {
    ipAddress?: string;
    countryCode?: string;
    city?: string;
    isp?: string;
    latitude?: number;
    longitude?: number;
  };
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  performance?: {
    avgLatency?: number;
    avgDownloadSpeed?: number;
    avgUploadSpeed?: number;
    successRate?: number;
    lastConnected?: Date;
    connectionCount?: number;
    totalUptime?: number;
  };
  limits?: {
    maxConcurrentConnections?: number;
    dailyDataLimit?: number;
    monthlyDataLimit?: number;
  };
  metadata?: {
    tags?: string[];
    notes?: string;
    isDefault?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  };
}

export interface IPInfo {
  ip: string;
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
  query: string;
}

export interface NetworkMetrics {
  latency: number; // 毫秒
  downloadSpeed: number; // KB/s
  uploadSpeed: number; // KB/s
  packetLoss: number; // 百分比
  jitter: number; // 毫秒
  timestamp: Date;
}

export interface VPNConnection {
  id: string;
  vpnConfigId: string;
  sessionId?: string;
  status: 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error';
  localIp?: string;
  publicIp?: string;
  interfaceName?: string;
  startTime?: Date;
  endTime?: Date;
  bytesSent: number;
  bytesReceived: number;
  metrics?: NetworkMetrics;
  error?: string;
}

export interface IPRotationRule {
  id: string;
  name: string;
  trigger: 'time' | 'data' | 'request' | 'error';
  condition: {
    type: string;
    value: any;
  };
  action: {
    type: 'switch_vpn' | 'reconnect' | 'pause';
    vpnConfigId?: string;
    delay?: number;
  };
  enabled: boolean;
}

export interface DNSConfig {
  servers: string[];
  searchDomains?: string[];
  options?: string[];
}

export interface NetworkNamespaceConfig {
  name: string;
  vpnConfigId?: string;
  dns?: DNSConfig;
  firewallRules?: FirewallRule[];
  isolationLevel: 'full' | 'partial' | 'minimal';
}

export interface FirewallRule {
  direction: 'in' | 'out';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  port?: number;
  portRange?: [number, number];
  ip?: string;
  cidr?: string;
  action: 'allow' | 'deny';
  description?: string;
}