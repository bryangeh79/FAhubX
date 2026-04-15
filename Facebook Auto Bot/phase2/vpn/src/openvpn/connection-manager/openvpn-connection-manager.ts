import { OpenVPNConfig, OpenVPNConnectionStatus, OpenVPNProcessInfo } from '../../types/openvpn-config';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as net from 'net';
import { EventEmitter } from 'events';

/**
 * OpenVPN连接管理器
 * 负责启动、停止和管理OpenVPN连接
 */
export class OpenVPNConnectionManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: OpenVPNConfig | null = null;
  private status: OpenVPNConnectionStatus = { status: 'disconnected' };
  private logFile: string | null = null;
  private managementSocket: net.Socket | null = null;

  /**
   * 启动OpenVPN连接
   * @param config OpenVPN配置
   * @param configPath 配置文件路径
   * @returns 连接状态
   */
  async connect(config: OpenVPNConfig, configPath: string): Promise<OpenVPNConnectionStatus> {
    try {
      this.config = config;
      this.status = { status: 'connecting' };
      
      // 创建临时配置文件
      const tempConfigPath = await this.createTempConfig(config, configPath);
      
      // 设置日志文件
      this.logFile = path.join(path.dirname(tempConfigPath), 'openvpn.log');
      
      // 启动OpenVPN进程
      await this.startOpenVPNProcess(tempConfigPath);
      
      // 连接到管理接口
      await this.connectToManagementInterface();
      
      this.status = {
        status: 'connected',
        connectedSince: new Date()
      };
      
      this.emit('connected', this.status);
      return this.status;
    } catch (error) {
      this.status = {
        status: 'error',
        error: error.message
      };
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 断开OpenVPN连接
   */
  async disconnect(): Promise<void> {
    if (!this.process) {
      return;
    }

    try {
      // 通过管理接口发送信号
      if (this.managementSocket) {
        this.managementSocket.write('signal SIGTERM\n');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 如果进程还在运行，强制终止
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }

      this.process = null;
      this.managementSocket = null;
      this.status = { status: 'disconnected' };
      
      this.emit('disconnected');
    } catch (error) {
      console.error('Error during disconnect:', error);
      throw error;
    }
  }

  /**
   * 获取当前连接状态
   */
  getStatus(): OpenVPNConnectionStatus {
    return { ...this.status };
  }

  /**
   * 获取进程信息
   */
  getProcessInfo(): OpenVPNProcessInfo | null {
    if (!this.process || !this.config) {
      return null;
    }

    return {
      pid: this.process.pid!,
      configPath: this.config.rawConfig ? 'in-memory' : 'unknown',
      logPath: this.logFile || undefined
    };
  }

  /**
   * 创建临时配置文件
   */
  private async createTempConfig(config: OpenVPNConfig, originalPath: string): Promise<string> {
    const tempDir = path.join(path.dirname(originalPath), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempConfigPath = path.join(tempDir, `config_${Date.now()}.ovpn`);
    
    // 写入配置内容
    let configContent = config.rawConfig;
    
    // 如果配置中有证书内容，写入文件并更新路径
    if (config.certificates) {
      const certsDir = path.join(tempDir, 'certs');
      await fs.mkdir(certsDir, { recursive: true });
      
      const certFiles: Record<string, string> = {};
      
      // 写入证书文件
      for (const [type, content] of Object.entries(config.certificates)) {
        if (content) {
          const certPath = path.join(certsDir, `${type}.pem`);
          await fs.writeFile(certPath, content);
          certFiles[type] = certPath;
        }
      }
      
      // 更新配置文件中的证书路径
      configContent = this.updateConfigPaths(configContent, certFiles);
    }
    
    await fs.writeFile(tempConfigPath, configContent);
    return tempConfigPath;
  }

  /**
   * 更新配置文件中的证书路径
   */
  private updateConfigPaths(configContent: string, certFiles: Record<string, string>): string {
    let updatedContent = configContent;
    
    for (const [type, filePath] of Object.entries(certFiles)) {
      const directive = type === 'ca' ? 'ca' : 
                       type === 'cert' ? 'cert' : 
                       type === 'key' ? 'key' : 
                       type === 'dh' ? 'dh' : null;
      
      if (directive) {
        const regex = new RegExp(`^${directive}\\s+.*$`, 'gm');
        updatedContent = updatedContent.replace(regex, `${directive} ${filePath}`);
      }
    }
    
    return updatedContent;
  }

  /**
   * 启动OpenVPN进程
   */
  private async startOpenVPNProcess(configPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '--config', configPath,
        '--management', '127.0.0.1', '7505',
        '--log', this.logFile!,
        '--verb', '3'
      ];

      this.process = spawn('openvpn', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.stdout?.on('data', (data) => {
        const output = data.toString();
        this.handleProcessOutput(output);
        this.emit('stdout', output);
      });

      this.process.stderr?.on('data', (data) => {
        const output = data.toString();
        this.handleProcessOutput(output);
        this.emit('stderr', output);
      });

      this.process.on('close', (code) => {
        this.handleProcessClose(code);
      });

      this.process.on('error', (error) => {
        reject(error);
      });

      // 等待初始连接
      setTimeout(() => {
        if (this.process && this.process.pid) {
          resolve();
        } else {
          reject(new Error('Failed to start OpenVPN process'));
        }
      }, 2000);
    });
  }

  /**
   * 连接到管理接口
   */
  private async connectToManagementInterface(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ port: 7505, host: '127.0.0.1' }, () => {
        this.managementSocket = socket;
        resolve();
      });

      socket.on('error', (error) => {
        reject(error);
      });

      socket.on('data', (data) => {
        this.handleManagementData(data.toString());
      });

      // 设置超时
      setTimeout(() => {
        if (!this.managementSocket) {
          reject(new Error('Timeout connecting to management interface'));
        }
      }, 5000);
    });
  }

  /**
   * 处理进程输出
   */
  private handleProcessOutput(output: string): void {
    console.log('OpenVPN:', output);
    
    // 解析连接状态
    if (output.includes('Initialization Sequence Completed')) {
      this.status.status = 'connected';
      this.status.connectedSince = new Date();
      this.emit('connected', this.status);
    } else if (output.includes('AUTH_FAILED') || output.includes('TLS Error')) {
      this.status.status = 'error';
      this.status.error = output;
      this.emit('error', new Error(output));
    }
  }

  /**
   * 处理进程关闭
   */
  private handleProcessClose(code: number): void {
    console.log(`OpenVPN process exited with code ${code}`);
    
    if (this.status.status === 'connected') {
      this.status.status = 'disconnected';
      this.emit('disconnected');
    }
    
    this.process = null;
    this.managementSocket = null;
  }

  /**
   * 处理管理接口数据
   */
  private handleManagementData(data: string): void {
    // 解析管理接口响应
    const lines = data.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('>INFO:')) {
        // 信息消息
        this.emit('management-info', line.substring(6));
      } else if (line.startsWith('>STATE:')) {
        // 状态更新
        const state = line.substring(7);
        this.updateConnectionState(state);
      } else if (line.startsWith('>BYTECOUNT:')) {
        // 字节计数
        this.updateByteCount(line.substring(11));
      }
    }
  }

  /**
   * 更新连接状态
   */
  private updateConnectionState(state: string): void {
    const parts = state.split(',');
    const stateName = parts[0];
    
    switch (stateName) {
      case 'CONNECTING':
        this.status.status = 'connecting';
        break;
      case 'CONNECTED':
        this.status.status = 'connected';
        this.status.connectedSince = new Date();
        this.status.localIp = parts[3];
        this.status.serverIp = parts[4];
        break;
      case 'RECONNECTING':
        this.status.status = 'connecting';
        break;
      case 'EXITING':
        this.status.status = 'disconnected';
        break;
    }
    
    this.emit('state-change', this.status);
  }

  /**
   * 更新字节计数
   */
  private updateByteCount(byteCount: string): void {
    const parts = byteCount.split(',');
    if (parts.length >= 2) {
      const bytesIn = parseInt(parts[0], 10);
      const bytesOut = parseInt(parts[1], 10);
      
      if (!this.status.statistics) {
        this.status.statistics = {
          bytesIn: 0,
          bytesOut: 0,
          packetsIn: 0,
          packetsOut: 0
        };
      }
      
      this.status.statistics.bytesIn = bytesIn;
      this.status.statistics.bytesOut = bytesOut;
      
      this.emit('statistics-update', this.status.statistics);
    }
  }
}