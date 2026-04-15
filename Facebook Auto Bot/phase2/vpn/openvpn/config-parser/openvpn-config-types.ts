/**
 * OpenVPN配置类型定义
 */

export interface OpenVPNConfig {
  // 基本连接设置
  remote: {
    host: string;
    port: number;
    protocol: 'tcp' | 'udp' | 'tcp-client' | 'udp-client';
  }[];
  
  // 设备设置
  dev: 'tun' | 'tap';
  devNode?: string;
  
  // 协议设置
  proto: 'tcp' | 'udp';
  protoForce?: boolean;
  
  // 认证设置
  auth?: {
    type: 'cert' | 'user-pass' | 'cert-user-pass';
    ca?: string;          // CA证书内容
    cert?: string;        // 客户端证书内容
    key?: string;         // 私钥内容
    tlsAuth?: string;     // TLS认证密钥内容
    tlsCrypt?: string;    // TLS加密密钥内容
    username?: string;    // 用户名
    password?: string;    // 密码
  };
  
  // 加密设置
  cipher?: string;
  authAlgorithm?: string;
  dataCiphers?: string[];
  
  // 压缩设置
  compress?: 'lzo' | 'lz4' | 'lz4-v2' | 'none';
  compLzo?: boolean;
  
  // 路由设置
  redirectGateway?: boolean;
  route?: {
    network: string;
    netmask: string;
    gateway?: string;
  }[];
  
  // DNS设置
  dns?: string[];
  dnsSearch?: string[];
  
  // 连接设置
  keepalive?: {
    interval: number;
    timeout: number;
  };
  
  renegSec?: number;
  handshakeWindow?: number;
  
  // 高级设置
  tunMtu?: number;
  fragment?: number;
  mssfix?: number;
  
  // 日志设置
  verb?: number;
  mute?: number;
  
  // 元数据
  metadata?: {
    filename: string;
    parsedAt: Date;
    isValid: boolean;
    warnings: string[];
    errors: string[];
  };
}

export interface ParsedOpenVPNConfig extends OpenVPNConfig {
  // 解析后的附加信息
  id: string;
  name: string;
  isValid: boolean;
  warnings: string[];
  errors: string[];
  rawConfig: string;
}

export interface OpenVPNConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  securityIssues: string[];
}

export interface OpenVPNConnectionOptions {
  configId: string;
  timeout?: number;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  logLevel?: number;
  additionalArgs?: string[];
  environment?: Record<string, string>;
}

export interface OpenVPNProcessInfo {
  pid: number;
  configId: string;
  startTime: Date;
  interfaceName?: string;
  localIp?: string;
  publicIp?: string;
  status: 'starting' | 'connected' | 'disconnected' | 'error';
  error?: string;
  logs: string[];
}