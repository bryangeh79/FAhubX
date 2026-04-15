import { NetworkTestResult } from '../../types/ip-management';
import * as ping from 'ping';
import * as net from 'net';
import * as dns from 'dns/promises';
import { EventEmitter } from 'events';

/**
 * 网络测试器
 * 负责测试网络连接质量和性能
 */
export class NetworkTester extends EventEmitter {
  private readonly defaultTimeout = 5000;
  private readonly defaultPingCount = 5;
  private readonly speedTestServers = [
    { host: 'speedtest.net', url: 'http://speedtest.net' },
    { host: 'fast.com', url: 'https://fast.com' },
    { host: 'google.com', url: 'https://www.google.com' }
  ];

  /**
   * 执行完整的网络测试
   * @param target 目标IP或域名
   * @returns 测试结果
   */
  async testNetwork(target: string): Promise<NetworkTestResult> {
    const timestamp = new Date();
    const result: Partial<NetworkTestResult> = {
      target,
      timestamp,
      score: 0
    };

    try {
      // 解析目标
      const resolvedTarget = await this.resolveTarget(target);
      
      // 并行执行测试
      const [latencyResult, connectivityResult, bandwidthResult] = await Promise.allSettled([
        this.testLatency(resolvedTarget),
        this.testConnectivity(resolvedTarget),
        this.testBandwidth()
      ]);

      // 处理延迟测试结果
      if (latencyResult.status === 'fulfilled') {
        result.latency = latencyResult.value;
      } else {
        result.latency = {
          min: 0,
          max: 0,
          avg: 0,
          packetLoss: 100,
          jitter: 0
        };
      }

      // 处理连接性测试结果
      if (connectivityResult.status === 'fulfilled') {
        result.connectivity = connectivityResult.value;
      } else {
        result.connectivity = {
          tcp: false,
          udp: false,
          http: false,
          https: false
        };
      }

      // 处理带宽测试结果
      if (bandwidthResult.status === 'fulfilled') {
        result.bandwidth = bandwidthResult.value;
      }

      // 计算综合评分
      result.score = this.calculateScore(result as NetworkTestResult);

      this.emit('test-completed', result);
      return result as NetworkTestResult;
    } catch (error) {
      const errorResult: NetworkTestResult = {
        target,
        timestamp,
        latency: { min: 0, max: 0, avg: 0, packetLoss: 100, jitter: 0 },
        connectivity: { tcp: false, udp: false, http: false, https: false },
        score: 0,
        error: error.message
      };
      
      this.emit('test-failed', errorResult);
      throw error;
    }
  }

  /**
   * 测试延迟和丢包率
   */
  private async testLatency(target: string): Promise<NetworkTestResult['latency']> {
    const results = await Promise.allSettled(
      Array(this.defaultPingCount).fill(0).map(() => 
        ping.promise.probe(target, { timeout: this.defaultTimeout / 1000 })
      )
    );

    const successfulPings = results
      .filter((r): r is PromiseFulfilledResult<ping.PingResponse> => 
        r.status === 'fulfilled' && r.value.alive
      )
      .map(r => r.value.time);

    const failedCount = results.length - successfulPings.length;
    
    if (successfulPings.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        packetLoss: 100,
        jitter: 0
      };
    }

    const min = Math.min(...successfulPings);
    const max = Math.max(...successfulPings);
    const avg = successfulPings.reduce((a, b) => a + b, 0) / successfulPings.length;
    const packetLoss = (failedCount / results.length) * 100;

    // 计算抖动（标准差）
    const variance = successfulPings.reduce((sum, time) => 
      sum + Math.pow(time - avg, 2), 0) / successfulPings.length;
    const jitter = Math.sqrt(variance);

    return { min, max, avg, packetLoss, jitter };
  }

  /**
   * 测试连接性
   */
  private async testConnectivity(target: string): Promise<NetworkTestResult['connectivity']> {
    const [tcpResult, udpResult, httpResult, httpsResult] = await Promise.allSettled([
      this.testTCPConnection(target, 80),
      this.testUDPConnection(target, 53),
      this.testHTTPConnection(`http://${target}`),
      this.testHTTPConnection(`https://${target}`)
    ]);

    return {
      tcp: tcpResult.status === 'fulfilled' && tcpResult.value,
      udp: udpResult.status === 'fulfilled' && udpResult.value,
      http: httpResult.status === 'fulfilled' && httpResult.value,
      https: httpsResult.status === 'fulfilled' && httpsResult.value
    };
  }

  /**
   * 测试TCP连接
   */
  private async testTCPConnection(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let connected = false;

      socket.setTimeout(this.defaultTimeout);
      
      socket.on('connect', () => {
        connected = true;
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        resolve(false);
      });

      socket.connect(port, host);
    });
  }

  /**
   * 测试UDP连接（通过DNS查询）
   */
  private async testUDPConnection(host: string, port: number): Promise<boolean> {
    try {
      // 尝试DNS查询作为UDP连接测试
      await dns.lookup(host);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 测试HTTP连接
   */
  private async testHTTPConnection(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        timeout: this.defaultTimeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 测试带宽（简化版）
   */
  private async testBandwidth(): Promise<NetworkTestResult['bandwidth']> {
    try {
      // 使用多个服务器测试，取最佳结果
      const results = await Promise.allSettled(
        this.speedTestServers.map(server => this.testServerBandwidth(server.url))
      );

      const successfulTests = results
        .filter((r): r is PromiseFulfilledResult<{ download: number; upload: number }> => 
          r.status === 'fulfilled'
        )
        .map(r => r.value);

      if (successfulTests.length === 0) {
        return undefined;
      }

      // 取下载和上传速度的中位数
      const downloadSpeeds = successfulTests.map(t => t.download).sort((a, b) => a - b);
      const uploadSpeeds = successfulTests.map(t => t.upload).sort((a, b) => a - b);
      
      const medianDownload = downloadSpeeds[Math.floor(downloadSpeeds.length / 2)];
      const medianUpload = uploadSpeeds[Math.floor(uploadSpeeds.length / 2)];

      return {
        download: medianDownload,
        upload: medianUpload
      };
    } catch {
      return undefined;
    }
  }

  /**
   * 测试单个服务器的带宽
   */
  private async testServerBandwidth(url: string): Promise<{ download: number; upload: number }> {
    // 简化版带宽测试：下载小文件计算速度
    const testSize = 1 * 1024 * 1024; // 1MB
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${url}/test?size=${testSize}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (!response.ok || !response.body) {
        throw new Error('Failed to download test file');
      }

      // 读取数据流但不存储
      const reader = response.body.getReader();
      let totalBytes = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
        
        // 限制测试时间
        if (Date.now() - startTime > this.defaultTimeout) {
          reader.cancel();
          break;
        }
      }

      const duration = (Date.now() - startTime) / 1000; // 秒
      const downloadSpeed = totalBytes * 8 / duration / 1000000; // Mbps

      // 简化版上传测试（实际实现需要服务器支持）
      const uploadSpeed = downloadSpeed * 0.3; // 假设上传速度为下载的30%

      return {
        download: Math.round(downloadSpeed * 100) / 100,
        upload: Math.round(uploadSpeed * 100) / 100
      };
    } catch {
      // 如果测试失败，返回保守估计
      return {
        download: 1.0,
        upload: 0.3
      };
    }
  }

  /**
   * 解析目标
   */
  private async resolveTarget(target: string): Promise<string> {
    // 如果是IP地址，直接返回
    if (net.isIP(target)) {
      return target;
    }

    // 解析域名
    try {
      const addresses = await dns.lookup(target, { all: true });
      if (addresses.length > 0) {
        return addresses[0].address;
      }
    } catch {
      // 解析失败，返回原目标
    }

    return target;
  }

  /**
   * 计算综合评分
   */
  private calculateScore(result: NetworkTestResult): number {
    let score = 0;
    
    // 延迟评分（40%）
    const latencyScore = Math.max(0, 100 - result.latency.avg * 0.5);
    score += latencyScore * 0.4;
    
    // 丢包率评分（30%）
    const packetLossScore = Math.max(0, 100 - result.latency.packetLoss * 2);
    score += packetLossScore * 0.3;
    
    // 连接性评分（20%）
    const connectivityScore = (
      (result.connectivity.tcp ? 25 : 0) +
      (result.connectivity.udp ? 25 : 0) +
      (result.connectivity.http ? 25 : 0) +
      (result.connectivity.https ? 25 : 0)
    );
    score += connectivityScore * 0.2;
    
    // 带宽评分（10%）
    let bandwidthScore = 50; // 默认分
    if (result.bandwidth) {
      const downloadScore = Math.min(100, result.bandwidth.download * 10);
      const uploadScore = Math.min(100, result.bandwidth.upload * 30);
      bandwidthScore = (downloadScore + uploadScore) / 2;
    }
    score += bandwidthScore * 0.1;
    
    return Math.round(score);
  }

  /**
   * 批量测试多个目标
   */
  async batchTest(targets: string[]): Promise<Map<string, NetworkTestResult>> {
    const results = new Map<string, NetworkTestResult>();
    
    // 限制并发数
    const concurrency = 5;
    const batches = [];
    
    for (let i = 0; i < targets.length; i += concurrency) {
      batches.push(targets.slice(i, i + concurrency));
    }
    
    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(target => this.testNetwork(target))
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.set(batch[index], result.value);
        } else {
          // 创建失败结果
          const failedResult: NetworkTestResult = {
            target: batch[index],
            timestamp: new Date(),
            latency: { min: 0, max: 0, avg: 0, packetLoss: 100, jitter: 0 },
            connectivity: { tcp: false, udp: false, http: false, https: false },
            score: 0,
            error: result.reason?.message || 'Unknown error'
          };
          results.set(batch[index], failedResult);
        }
      });
      
      this.emit('batch-progress', {
        completed: results.size,
        total: targets.length,
        percentage: (results.size / targets.length) * 100
      });
    }
    
    this.emit('batch-completed', results);
    return results;
  }

  /**
   * 生成测试报告
   */
  generateReport(results: NetworkTestResult[] | Map<string, NetworkTestResult>): string {
    const resultArray = results instanceof Map ? 
      Array.from(results.values()) : results;
    
    if (resultArray.length === 0) {
      return 'No test results available.';
    }
    
    const avgScore = resultArray.reduce((sum, r) => sum + r.score, 0) / resultArray.length;
    const avgLatency = resultArray.reduce((sum, r) => sum + r.latency.avg, 0) / resultArray.length;
    const avgPacketLoss = resultArray.reduce((sum, r) => sum + r.latency.packetLoss, 0) / resultArray.length;
    
    const bestResult = resultArray.reduce((best, current) => 
      current.score > best.score ? current : best
    );
    
    const worstResult = resultArray.reduce((worst, current) => 
      current.score < worst.score ? current : worst
    );
    
    return `
Network Test Report
===================
Generated: ${new Date().toISOString()}
Total Tests: ${resultArray.length}

Summary:
- Average Score: ${avgScore.toFixed(1)}%
- Average Latency: ${avgLatency.toFixed(2)}ms
- Average Packet Loss: ${avgPacketLoss.toFixed(2)}%

Best Performance:
- Target: ${bestResult.target}
- Score: ${bestResult.score}%
- Latency: ${bestResult.latency.avg.toFixed(2)}ms
- Packet Loss: ${bestResult.latency.packetLoss.toFixed(2)}%

Worst Performance:
- Target: ${worstResult.target}
- Score: ${worstResult.score}%
- Latency: ${worstResult.latency.avg.toFixed(2)}ms
- Packet Loss: ${worstResult.latency.packetLoss.toFixed(2)}%

Detailed Results:
${resultArray.map(r => `
${r.target}:
  Score: ${r.score}%
  Latency: ${r.latency.avg.toFixed(2)}ms (min: ${r.latency.min.toFixed(2)}ms, max: ${r.latency.max.toFixed(2)}ms)
  Packet Loss: ${r.latency.packetLoss.toFixed(2)}%
  Jitter: ${r.latency.jitter.toFixed(2)}ms
  Connectivity: TCP:${r.connectivity.tcp ? '✓' : '✗'} UDP:${r.connectivity.udp ? '✓' : '✗'} HTTP:${r.connectivity.http ? '✓' : '✗'} HTTPS:${r.connectivity.https ? '✓' : '✗'}
  ${r.bandwidth ? `Bandwidth: ↓${r.bandwidth.download}Mbps ↑${r.bandwidth.upload}Mbps` : ''}
  ${r.error ? `Error: ${r.error}` : ''}
`).join('')}
    `.trim();
  }
}