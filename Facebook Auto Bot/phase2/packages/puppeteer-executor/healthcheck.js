#!/usr/bin/env node

/**
 * Puppeteer执行器健康检查脚本
 * 用于Docker健康检查和系统状态监控
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

// 健康检查配置
const HEALTH_CHECK_CONFIG = {
  maxMemoryUsage: 0.9, // 90%内存使用率阈值
  maxCpuUsage: 0.8,    // 80%CPU使用率阈值
  minDiskSpace: 1024 * 1024 * 100, // 100MB最小磁盘空间
  checkPorts: [3000],  // 需要检查的端口
  logFile: '/app/data/logs/healthcheck.log',
  pidFile: '/tmp/puppeteer-executor.pid'
};

class HealthChecker {
  constructor() {
    this.startTime = Date.now();
    this.checkResults = [];
  }

  async runAllChecks() {
    console.log('🔍 Running Puppeteer Executor health checks...');

    try {
      // 运行所有健康检查
      await this.checkSystemResources();
      await this.checkProcessStatus();
      await this.checkNetworkConnectivity();
      await this.checkDiskSpace();
      await this.checkLogFiles();
      await this.checkSessionStatus();

      // 输出检查结果
      this.printResults();

      // 根据检查结果返回退出码
      const hasCriticalErrors = this.checkResults.some(r => r.status === 'ERROR' && r.critical);
      const hasWarnings = this.checkResults.some(r => r.status === 'WARNING');

      if (hasCriticalErrors) {
        console.error('❌ Health check failed with critical errors');
        process.exit(1);
      } else if (hasWarnings) {
        console.warn('⚠️  Health check passed with warnings');
        process.exit(0);
      } else {
        console.log('✅ All health checks passed');
        process.exit(0);
      }

    } catch (error) {
      console.error('💥 Health check execution failed:', error.message);
      process.exit(1);
    }
  }

  async checkSystemResources() {
    try {
      // 检查内存使用
      const memoryInfo = await this.getMemoryInfo();
      const memoryUsage = memoryInfo.used / memoryInfo.total;
      
      if (memoryUsage > HEALTH_CHECK_CONFIG.maxMemoryUsage) {
        this.addResult('MEMORY', 'ERROR', true, 
          `High memory usage: ${(memoryUsage * 100).toFixed(1)}% (threshold: ${HEALTH_CHECK_CONFIG.maxMemoryUsage * 100}%)`);
      } else if (memoryUsage > HEALTH_CHECK_CONFIG.maxMemoryUsage * 0.8) {
        this.addResult('MEMORY', 'WARNING', false,
          `Moderate memory usage: ${(memoryUsage * 100).toFixed(1)}%`);
      } else {
        this.addResult('MEMORY', 'OK', false,
          `Memory usage: ${(memoryUsage * 100).toFixed(1)}%`);
      }

      // 检查CPU使用（简化版本）
      const loadAvg = await this.getLoadAverage();
      const cpuUsage = loadAvg[0]; // 1分钟平均负载
      
      if (cpuUsage > HEALTH_CHECK_CONFIG.maxCpuUsage * 10) { // 调整阈值
        this.addResult('CPU', 'ERROR', true,
          `High CPU load: ${cpuUsage.toFixed(2)} (threshold: ${HEALTH_CHECK_CONFIG.maxCpuUsage * 10})`);
      } else if (cpuUsage > HEALTH_CHECK_CONFIG.maxCpuUsage * 5) {
        this.addResult('CPU', 'WARNING', false,
          `Moderate CPU load: ${cpuUsage.toFixed(2)}`);
      } else {
        this.addResult('CPU', 'OK', false,
          `CPU load: ${cpuUsage.toFixed(2)}`);
      }

    } catch (error) {
      this.addResult('SYSTEM_RESOURCES', 'ERROR', true,
        `Failed to check system resources: ${error.message}`);
    }
  }

  async checkProcessStatus() {
    try {
      // 检查主进程是否运行
      if (fs.existsSync(HEALTH_CHECK_CONFIG.pidFile)) {
        const pid = parseInt(fs.readFileSync(HEALTH_CHECK_CONFIG.pidFile, 'utf8').trim());
        
        try {
          process.kill(pid, 0); // 发送信号0检查进程是否存在
          this.addResult('PROCESS', 'OK', false, `Main process running (PID: ${pid})`);
        } catch (err) {
          this.addResult('PROCESS', 'ERROR', true, `Main process not running (PID: ${pid})`);
        }
      } else {
        this.addResult('PROCESS', 'WARNING', false, 'PID file not found, process status unknown');
      }

      // 检查Chrome进程
      const { stdout } = await execAsync('pgrep -f chrome || true');
      const chromePids = stdout.trim().split('\n').filter(pid => pid);
      
      if (chromePids.length > 0) {
        this.addResult('CHROME', 'OK', false, `Chrome processes running: ${chromePids.length}`);
      } else {
        this.addResult('CHROME', 'WARNING', false, 'No Chrome processes found');
      }

    } catch (error) {
      this.addResult('PROCESS', 'ERROR', true,
        `Failed to check process status: ${error.message}`);
    }
  }

  async checkNetworkConnectivity() {
    try {
      // 检查本地端口
      for (const port of HEALTH_CHECK_CONFIG.checkPorts) {
        const { stdout } = await execAsync(`netstat -tuln | grep :${port} || true`);
        
        if (stdout.includes(`:${port}`)) {
          this.addResult(`PORT_${port}`, 'OK', false, `Port ${port} is listening`);
        } else {
          this.addResult(`PORT_${port}`, 'ERROR', true, `Port ${port} is not listening`);
        }
      }

      // 检查外部网络连接
      const testUrls = [
        'https://www.facebook.com',
        'https://www.google.com',
        'https://api.ipify.org'
      ];

      for (const url of testUrls) {
        try {
          await execAsync(`curl -s --max-time 5 ${url} > /dev/null && echo "OK" || echo "FAIL"`);
          this.addResult(`NETWORK_${new URL(url).hostname}`, 'OK', false, `Can reach ${url}`);
        } catch (error) {
          this.addResult(`NETWORK_${new URL(url).hostname}`, 'WARNING', false, `Cannot reach ${url}`);
        }
      }

    } catch (error) {
      this.addResult('NETWORK', 'ERROR', true,
        `Failed to check network connectivity: ${error.message}`);
    }
  }

  async checkDiskSpace() {
    try {
      const { stdout } = await execAsync('df /app --output=avail | tail -1');
      const availableSpace = parseInt(stdout.trim()) * 1024; // 转换为字节
      
      if (availableSpace < HEALTH_CHECK_CONFIG.minDiskSpace) {
        this.addResult('DISK', 'ERROR', true,
          `Low disk space: ${this.formatBytes(availableSpace)} available (minimum: ${this.formatBytes(HEALTH_CHECK_CONFIG.minDiskSpace)})`);
      } else if (availableSpace < HEALTH_CHECK_CONFIG.minDiskSpace * 2) {
        this.addResult('DISK', 'WARNING', false,
          `Moderate disk space: ${this.formatBytes(availableSpace)} available`);
      } else {
        this.addResult('DISK', 'OK', false,
          `Disk space: ${this.formatBytes(availableSpace)} available`);
      }

    } catch (error) {
      this.addResult('DISK', 'ERROR', true,
        `Failed to check disk space: ${error.message}`);
    }
  }

  async checkLogFiles() {
    try {
      // 检查日志目录是否存在
      const logDir = path.dirname(HEALTH_CHECK_CONFIG.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
        this.addResult('LOGS', 'WARNING', false, 'Log directory created');
        return;
      }

      // 检查最近的错误日志
      const errorLogPattern = path.join(logDir, 'error.log*');
      const { stdout } = await execAsync(`tail -n 10 ${errorLogPattern} 2>/dev/null || echo "No error logs found"`);
      
      if (stdout.includes('ERROR') && !stdout.includes('No error logs found')) {
        const errorCount = (stdout.match(/ERROR/g) || []).length;
        this.addResult('LOGS', 'WARNING', false, `Found ${errorCount} error(s) in recent logs`);
      } else {
        this.addResult('LOGS', 'OK', false, 'No recent errors in logs');
      }

      // 检查日志文件大小
      if (fs.existsSync(HEALTH_CHECK_CONFIG.logFile)) {
        const stats = fs.statSync(HEALTH_CHECK_CONFIG.logFile);
        const fileSize = stats.size;
        
        if (fileSize > 1024 * 1024 * 100) { // 100MB
          this.addResult('LOG_SIZE', 'WARNING', false,
            `Large log file: ${this.formatBytes(fileSize)}`);
        }
      }

    } catch (error) {
      this.addResult('LOGS', 'ERROR', true,
        `Failed to check log files: ${error.message}`);
    }
  }

  async checkSessionStatus() {
    try {
      // 检查会话数据目录
      const sessionDir = '/app/data/sessions';
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
        this.addResult('SESSIONS', 'INFO', false, 'Session directory created');
        return;
      }

      // 统计会话文件
      const sessionFiles = fs.readdirSync(sessionDir).filter(file => file.endsWith('.json'));
      const sessionCount = sessionFiles.length;
      
      if (sessionCount > 0) {
        this.addResult('SESSIONS', 'OK', false, `${sessionCount} session file(s) found`);
        
        // 检查最近修改的会话
        const now = Date.now();
        const recentSessions = sessionFiles.filter(file => {
          const stats = fs.statSync(path.join(sessionDir, file));
          return now - stats.mtimeMs < 3600000; // 1小时内
        });
        
        if (recentSessions.length > 0) {
          this.addResult('SESSION_ACTIVITY', 'OK', false,
            `${recentSessions.length} active session(s) in last hour`);
        }
      } else {
        this.addResult('SESSIONS', 'INFO', false, 'No session files found');
      }

    } catch (error) {
      this.addResult('SESSIONS', 'ERROR', true,
        `Failed to check session status: ${error.message}`);
    }
  }

  // 辅助方法
  async getMemoryInfo() {
    const { stdout } = await execAsync('free -b | grep Mem');
    const [, total, used] = stdout.match(/Mem:\s+(\d+)\s+(\d+)/);
    return {
      total: parseInt(total),
      used: parseInt(used)
    };
  }

  async getLoadAverage() {
    const { stdout } = await execAsync('cat /proc/loadavg');
    return stdout.split(' ').slice(0, 3).map(parseFloat);
  }

  addResult(category, status, critical, message) {
    this.checkResults.push({
      category,
      status,
      critical,
      message,
      timestamp: new Date().toISOString()
    });
  }

  printResults() {
    console.log('\n📊 Health Check Results:');
    console.log('=' .repeat(60));
    
    const groupedResults = {};
    this.checkResults.forEach(result => {
      if (!groupedResults[result.status]) {
        groupedResults[result.status] = [];
      }
      groupedResults[result.status].push(result);
    });

    // 按状态顺序显示：ERROR -> WARNING -> OK -> INFO
    const statusOrder = ['ERROR', 'WARNING', 'OK', 'INFO'];
    
    statusOrder.forEach(status => {
      if (groupedResults[status]) {
        const icon = {
          'ERROR': '❌',
          'WARNING': '⚠️ ',
          'OK': '✅',
          'INFO': 'ℹ️ '
        }[status];
        
        console.log(`\n${icon} ${status}:`);
        groupedResults[status].forEach(result => {
          const criticalMarker = result.critical ? ' [CRITICAL]' : '';
          console.log(`  ${result.category}: ${result.message}${criticalMarker}`);
        });
      }
    });

    const totalTime = Date.now() - this.startTime;
    console.log('\n' + '=' .repeat(60));
    console.log(`Total checks: ${this.checkResults.length}`);
    console.log(`Execution time: ${totalTime}ms`);
  }

  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }
}

// 运行健康检查
if (require.main === module) {
  const healthChecker = new HealthChecker();
  healthChecker.runAllChecks();
}

module.exports = HealthChecker;