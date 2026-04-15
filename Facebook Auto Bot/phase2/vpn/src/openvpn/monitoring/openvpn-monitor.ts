import { OpenVPNConnectionStatus } from '../../types/openvpn-config';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * OpenVPN监控器
 * 负责监控OpenVPN连接状态和性能
 */
export class OpenVPNMonitor extends EventEmitter {
  private checkInterval: NodeJS.Timeout | null = null;
  private statusHistory: OpenVPNConnectionStatus[] = [];
  private readonly maxHistorySize = 100;
  private metrics: {
    latency: number[];
    bandwidth: { in: number[]; out: number[] };
    uptime: number;
  } = {
    latency: [],
    bandwidth: { in: [], out: [] },
    uptime: 0
  };

  /**
   * 开始监控
   * @param intervalMs 检查间隔（毫秒）
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this.checkInterval) {
      this.stopMonitoring();
    }

    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);

    this.emit('monitoring-started');
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.emit('monitoring-stopped');
    }
  }

  /**
   * 更新连接状态
   * @param status 当前连接状态
   */
  updateStatus(status: OpenVPNConnectionStatus): void {
    // 添加到历史记录
    this.statusHistory.push({ ...status, connectedSince: status.connectedSince ? new Date(status.connectedSince) : undefined });
    
    // 限制历史记录大小
    if (this.statusHistory.length > this.maxHistorySize) {
      this.statusHistory = this.statusHistory.slice(-this.maxHistorySize);
    }

    // 更新运行时间
    if (status.status === 'connected' && status.connectedSince) {
      this.metrics.uptime = Date.now() - status.connectedSince.getTime();
    } else if (status.status !== 'connected') {
      this.metrics.uptime = 0;
    }

    this.emit('status-updated', status);
  }

  /**
   * 获取状态历史
   */
  getStatusHistory(): OpenVPNConnectionStatus[] {
    return [...this.statusHistory];
  }

  /**
   * 获取性能指标
   */
  getMetrics() {
    return {
      latency: this.calculateAverage(this.metrics.latency),
      bandwidth: {
        in: this.calculateAverage(this.metrics.bandwidth.in),
        out: this.calculateAverage(this.metrics.bandwidth.out)
      },
      uptime: this.metrics.uptime,
      statusCounts: this.calculateStatusCounts()
    };
  }

  /**
   * 记录延迟
   */
  recordLatency(latencyMs: number): void {
    this.metrics.latency.push(latencyMs);
    if (this.metrics.latency.length > 50) {
      this.metrics.latency = this.metrics.latency.slice(-50);
    }
    this.emit('latency-recorded', latencyMs);
  }

  /**
   * 记录带宽使用
   */
  recordBandwidth(bytesIn: number, bytesOut: number): void {
    const now = Date.now();
    
    // 计算每秒带宽（如果之前有记录）
    if (this.metrics.bandwidth.in.length > 0) {
      const lastTime = now - 1000; // 假设每秒记录一次
      // 这里可以添加更精确的时间计算
    }
    
    this.metrics.bandwidth.in.push(bytesIn);
    this.metrics.bandwidth.out.push(bytesOut);
    
    // 限制数组大小
    if (this.metrics.bandwidth.in.length > 50) {
      this.metrics.bandwidth.in = this.metrics.bandwidth.in.slice(-50);
      this.metrics.bandwidth.out = this.metrics.bandwidth.out.slice(-50);
    }
    
    this.emit('bandwidth-recorded', { bytesIn, bytesOut });
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const healthStatus = await this.checkHealth();
      this.emit('health-check', healthStatus);
      
      if (!healthStatus.healthy) {
        this.emit('health-alert', healthStatus);
      }
    } catch (error) {
      this.emit('health-check-error', error);
    }
  }

  /**
   * 检查健康状态
   */
  private async checkHealth(): Promise<{
    healthy: boolean;
    checks: Array<{ name: string; passed: boolean; message: string }>;
    score: number;
  }> {
    const checks: Array<{ name: string; passed: boolean; message: string }> = [];
    
    // 检查1: 最近是否有连接状态
    const recentStatus = this.statusHistory[this.statusHistory.length - 1];
    checks.push({
      name: 'connection-status',
      passed: !!recentStatus,
      message: recentStatus ? `Last status: ${recentStatus.status}` : 'No status recorded'
    });
    
    // 检查2: 延迟是否在可接受范围内
    const avgLatency = this.calculateAverage(this.metrics.latency);
    const latencyOk = avgLatency === 0 || avgLatency < 1000; // 1秒内
    checks.push({
      name: 'latency',
      passed: latencyOk,
      message: `Average latency: ${avgLatency.toFixed(2)}ms`
    });
    
    // 检查3: 运行时间（如果已连接）
    const uptimeOk = recentStatus?.status === 'connected' ? this.metrics.uptime > 0 : true;
    checks.push({
      name: 'uptime',
      passed: uptimeOk,
      message: recentStatus?.status === 'connected' ? `Uptime: ${this.formatUptime(this.metrics.uptime)}` : 'Not connected'
    });
    
    // 检查4: 状态稳定性
    const stable = this.checkStatusStability();
    checks.push({
      name: 'stability',
      passed: stable,
      message: stable ? 'Connection is stable' : 'Frequent connection changes detected'
    });
    
    // 计算健康分数
    const passedChecks = checks.filter(c => c.passed).length;
    const score = (passedChecks / checks.length) * 100;
    
    return {
      healthy: score >= 75, // 75%以上为健康
      checks,
      score
    };
  }

  /**
   * 检查状态稳定性
   */
  private checkStatusStability(): boolean {
    if (this.statusHistory.length < 5) {
      return true; // 数据不足，假设稳定
    }
    
    const recentStatuses = this.statusHistory.slice(-10);
    const statusChanges = recentStatuses.filter((status, index) => {
      if (index === 0) return false;
      return status.status !== recentStatuses[index - 1].status;
    }).length;
    
    return statusChanges <= 2; // 10次检查中最多2次状态变化
  }

  /**
   * 计算状态计数
   */
  private calculateStatusCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const status of this.statusHistory) {
      counts[status.status] = (counts[status.status] || 0) + 1;
    }
    
    return counts;
  }

  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  /**
   * 格式化运行时间
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * 生成监控报告
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    const recentStatus = this.statusHistory[this.statusHistory.length - 1];
    
    return `
OpenVPN Monitoring Report
=========================
Generated: ${new Date().toISOString()}

Current Status: ${recentStatus?.status || 'unknown'}
Uptime: ${this.formatUptime(metrics.uptime)}

Performance Metrics:
- Average Latency: ${metrics.latency.toFixed(2)}ms
- Average Bandwidth In: ${metrics.bandwidth.in.toFixed(2)} bytes/s
- Average Bandwidth Out: ${metrics.bandwidth.out.toFixed(2)} bytes/s

Status Distribution:
${Object.entries(metrics.statusCounts).map(([status, count]) => `  ${status}: ${count} times`).join('\n')}

Health Score: ${metrics.score.toFixed(1)}%
${metrics.score >= 75 ? '✅ Healthy' : '⚠️ Needs attention'}
    `.trim();
  }

  /**
   * 保存报告到文件
   */
  async saveReport(filePath: string): Promise<void> {
    const report = this.generateReport();
    await fs.writeFile(filePath, report);
    this.emit('report-saved', filePath);
  }
}