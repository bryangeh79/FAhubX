export type VPNType = 'openvpn' | 'wireguard' | 'socks5' | 'http';
export type VPNStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export interface VPNConfig {
  type: VPNType;
  name: string;
  enabled: boolean;
  priority: number;
}

export interface OpenVPNConfig extends VPNConfig {
  type: 'openvpn';
  configPath: string;
  authFilePath?: string;
  username?: string;
  password?: string;
  caCertPath?: string;
  clientCertPath?: string;
  clientKeyPath?: string;
  tlsAuthPath?: string;
  extraArgs?: string[];
}

export interface WireGuardConfig extends VPNConfig {
  type: 'wireguard';
  configPath: string;
  interfaceName?: string;
  privateKey?: string;
  publicKey?: string;
  endpoint?: string;
  allowedIPs?: string[];
  dns?: string[];
  mtu?: number;
}

export interface ProxyConfig extends VPNConfig {
  type: 'socks5' | 'http';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export type VPNConnectionConfig = OpenVPNConfig | WireGuardConfig | ProxyConfig;

export interface VPNConnection {
  id: string;
  config: VPNConnectionConfig;
  status: VPNStatus;
  pid?: number;
  startTime?: Date;
  lastCheck?: Date;
  errorCount: number;
  lastError?: string;
  ipAddress?: string;
  location?: VPNLocation;
  speedTest?: VPNSpeedTest;
  metadata?: Record<string, any>;
}

export interface VPNLocation {
  country: string;
  countryCode: string;
  city?: string;
  region?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  org?: string;
}

export interface VPNSpeedTest {
  downloadSpeed: number; // Mbps
  uploadSpeed: number; // Mbps
  ping: number; // ms
  jitter: number; // ms
  packetLoss: number; // percentage
  testTime: Date;
}

export interface IPInfo {
  ip: string;
  location: VPNLocation;
  isVPN: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;
  asn?: string;
  organization?: string;
}

export interface IPRotationConfig {
  rotationStrategy: 'round-robin' | 'random' | 'sticky' | 'performance';
  minRotationInterval: number; // 毫秒
  maxSessionsPerIP: number;
  geoRestrictions?: {
    allowedCountries: string[];
    blockedCountries: string[];
  };
  performanceThreshold?: {
    minDownloadSpeed: number; // Mbps
    maxPing: number; // ms
    maxPacketLoss: number; // percentage
  };
}

export interface NetworkConfig {
  vpnConfigs: VPNConnectionConfig[];
  ipRotation: IPRotationConfig;
  dnsServers?: string[];
  mtu?: number;
  timeout?: number;
  retryCount?: number;
  healthCheckInterval?: number;
}

export interface ConnectionResult {
  success: boolean;
  connectionId?: string;
  ipAddress?: string;
  location?: VPNLocation;
  error?: string;
  duration?: number;
}

export interface DisconnectionResult {
  success: boolean;
  error?: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  connectionId: string;
  status: VPNStatus;
  ipAddress?: string;
  location?: VPNLocation;
  speedTest?: VPNSpeedTest;
  errors: string[];
  timestamp: Date;
}

export interface IPRotationResult {
  success: boolean;
  fromConnectionId?: string;
  toConnectionId?: string;
  ipAddress?: string;
  location?: VPNLocation;
  reason?: string;
  error?: string;
}

export interface NetworkTestResult {
  success: boolean;
  connectionId: string;
  ipInfo: IPInfo;
  speedTest: VPNSpeedTest;
  dnsResolution: boolean;
  connectivity: {
    google: boolean;
    facebook: boolean;
    target: boolean;
  };
  timestamp: Date;
}

export interface DockerNetworkConfig {
  networkName: string;
  subnet?: string;
  gateway?: string;
  driver?: string;
  labels?: Record<string, string>;
  enableIPv6?: boolean;
  internal?: boolean;
  attachable?: boolean;
}

export interface ContainerNetworkAssignment {
  containerId: string;
  sessionId: string;
  connectionId: string;
  networkName: string;
  ipAddress?: string;
  macAddress?: string;
  assignedAt: Date;
}

export interface VPMManagerStats {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  totalRotations: number;
  avgConnectionTime: number;
  avgSpeedDownload: number;
  avgSpeedUpload: number;
  byCountry: Record<string, number>;
  byType: Record<VPNType, number>;
}