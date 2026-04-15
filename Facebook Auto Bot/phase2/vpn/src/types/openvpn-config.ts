/**
 * OpenVPN配置类型定义
 */

export interface OpenVPNConfig {
  /** 服务器地址 */
  remote: {
    host: string;
    port: number;
  };
  
  /** 协议类型 */
  protocol: 'tcp' | 'udp';
  
  /** 设备类型 */
  device: 'tun' | 'tap';
  
  /** 加密设置 */
  cipher?: string;
  
  /** 认证算法 */
  auth?: string;
  
  /** 压缩设置 */
  compression?: 'lzo' | 'lz4' | 'none';
  
  /** TLS认证密钥 */
  tlsAuth?: {
    key: string;
    direction: number;
  };
  
  /** 证书和密钥 */
  certificates?: {
    ca?: string;
    cert?: string;
    key?: string;
    dh?: string;
  };
  
  /** 用户名密码认证 */
  authUserPass?: {
    username?: string;
    password?: string;
    file?: string;
  };
  
  /** 其他配置选项 */
  options: Record<string, string | number | boolean>;
  
  /** 原始配置文件内容 */
  rawConfig: string;
}

export interface OpenVPNConnectionStatus {
  /** 连接状态 */
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  
  /** 连接时间 */
  connectedSince?: Date;
  
  /** 本地IP地址 */
  localIp?: string;
  
  /** 服务器IP地址 */
  serverIp?: string;
  
  /** 数据传输统计 */
  statistics?: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  
  /** 错误信息 */
  error?: string;
}

export interface OpenVPNProcessInfo {
  /** 进程ID */
  pid: number;
  
  /** 配置文件路径 */
  configPath: string;
  
  /** 日志文件路径 */
  logPath?: string;
  
  /** 管理接口信息 */
  management?: {
    host: string;
    port: number;
    password?: string;
  };
}