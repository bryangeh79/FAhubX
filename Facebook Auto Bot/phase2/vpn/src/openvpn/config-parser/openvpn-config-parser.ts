import { OpenVPNConfig } from '../../types/openvpn-config';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * OpenVPN配置解析器
 * 负责解析OpenVPN配置文件并提取关键信息
 */
export class OpenVPNConfigParser {
  private readonly defaultPort = 1194;
  private readonly defaultProtocol = 'udp';
  private readonly defaultDevice = 'tun';

  /**
   * 解析OpenVPN配置文件
   * @param configPath 配置文件路径
   * @returns 解析后的配置对象
   */
  async parseConfig(configPath: string): Promise<OpenVPNConfig> {
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      const lines = configContent.split('\n');
      
      const config: Partial<OpenVPNConfig> = {
        options: {},
        rawConfig: configContent
      };

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }

        await this.parseLine(trimmedLine, config);
      }

      // 设置默认值
      if (!config.remote) {
        throw new Error('Missing remote server configuration');
      }

      if (!config.protocol) {
        config.protocol = this.defaultProtocol;
      }

      if (!config.device) {
        config.device = this.defaultDevice;
      }

      return config as OpenVPNConfig;
    } catch (error) {
      throw new Error(`Failed to parse OpenVPN config: ${error.message}`);
    }
  }

  /**
   * 解析单行配置
   */
  private async parseLine(line: string, config: Partial<OpenVPNConfig>): Promise<void> {
    const parts = line.split(/\s+/);
    const directive = parts[0].toLowerCase();
    const value = parts.slice(1).join(' ');

    switch (directive) {
      case 'remote':
        await this.parseRemote(value, config);
        break;
      case 'proto':
        config.protocol = value.toLowerCase() as 'tcp' | 'udp';
        break;
      case 'dev':
        config.device = value.toLowerCase() as 'tun' | 'tap';
        break;
      case 'cipher':
        config.cipher = value;
        break;
      case 'auth':
        config.auth = value;
        break;
      case 'comp-lzo':
        config.compression = value === 'yes' ? 'lzo' : 'none';
        break;
      case 'tls-auth':
        await this.parseTlsAuth(value, config);
        break;
      case 'ca':
      case 'cert':
      case 'key':
      case 'dh':
        await this.parseCertificate(directive, value, config);
        break;
      case 'auth-user-pass':
        await this.parseAuthUserPass(value, config);
        break;
      default:
        // 存储其他配置选项
        if (directive && value) {
          config.options[directive] = value;
        }
        break;
    }
  }

  /**
   * 解析远程服务器配置
   */
  private async parseRemote(value: string, config: Partial<OpenVPNConfig>): Promise<void> {
    const remoteParts = value.split(/\s+/);
    const host = remoteParts[0];
    let port = this.defaultPort;
    let protocol = config.protocol || this.defaultProtocol;

    // 检查是否包含端口号
    if (remoteParts.length > 1) {
      const portPart = remoteParts[1];
      const portMatch = portPart.match(/^(\d+)$/);
      if (portMatch) {
        port = parseInt(portMatch[1], 10);
      }
    }

    // 检查是否包含协议
    if (remoteParts.length > 2) {
      const protoPart = remoteParts[2].toLowerCase();
      if (protoPart === 'tcp' || protoPart === 'udp') {
        protocol = protoPart;
      }
    }

    config.remote = { host, port };
    config.protocol = protocol as 'tcp' | 'udp';
  }

  /**
   * 解析TLS认证配置
   */
  private async parseTlsAuth(value: string, config: Partial<OpenVPNConfig>): Promise<void> {
    const parts = value.split(/\s+/);
    const keyFile = parts[0];
    const direction = parts.length > 1 ? parseInt(parts[1], 10) : 0;

    try {
      const keyContent = await fs.readFile(keyFile, 'utf-8');
      config.tlsAuth = {
        key: keyContent,
        direction
      };
    } catch (error) {
      console.warn(`Failed to read TLS auth key file: ${keyFile}`);
    }
  }

  /**
   * 解析证书配置
   */
  private async parseCertificate(
    type: string,
    value: string,
    config: Partial<OpenVPNConfig>
  ): Promise<void> {
    if (!config.certificates) {
      config.certificates = {};
    }

    try {
      const certContent = await fs.readFile(value, 'utf-8');
      
      switch (type) {
        case 'ca':
          config.certificates.ca = certContent;
          break;
        case 'cert':
          config.certificates.cert = certContent;
          break;
        case 'key':
          config.certificates.key = certContent;
          break;
        case 'dh':
          config.certificates.dh = certContent;
          break;
      }
    } catch (error) {
      console.warn(`Failed to read certificate file: ${value}`);
    }
  }

  /**
   * 解析用户名密码认证配置
   */
  private async parseAuthUserPass(value: string, config: Partial<OpenVPNConfig>): Promise<void> {
    if (value && value !== '') {
      // 如果是文件路径
      try {
        const content = await fs.readFile(value, 'utf-8');
        const lines = content.split('\n');
        const username = lines[0]?.trim();
        const password = lines[1]?.trim();
        
        config.authUserPass = { username, password, file: value };
      } catch (error) {
        // 如果不是文件，可能是内联配置
        console.warn(`Failed to read auth-user-pass file: ${value}`);
      }
    } else {
      // 使用命令行输入
      config.authUserPass = {};
    }
  }

  /**
   * 验证配置文件
   * @param config 配置对象
   * @returns 验证结果
   */
  validateConfig(config: OpenVPNConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.remote?.host) {
      errors.push('Missing remote host');
    }

    if (!config.remote?.port || config.remote.port < 1 || config.remote.port > 65535) {
      errors.push('Invalid port number');
    }

    if (!['tcp', 'udp'].includes(config.protocol)) {
      errors.push('Invalid protocol');
    }

    if (!['tun', 'tap'].includes(config.device)) {
      errors.push('Invalid device type');
    }

    // 检查证书配置
    if (config.certificates) {
      if (config.certificates.cert && !config.certificates.key) {
        errors.push('Certificate provided without private key');
      }
      if (config.certificates.key && !config.certificates.cert) {
        errors.push('Private key provided without certificate');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}