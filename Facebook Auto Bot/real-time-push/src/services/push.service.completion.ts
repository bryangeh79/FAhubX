  private async storeMetrics(): Promise<void> {
    try {
      const metricsKey = `push:metrics:${new Date().toISOString().split('T')[0]}`;
      const metrics = {
        timestamp: new Date().toISOString(),
        stats: this.stats,
        isConnected: this.isConnected,
        subscriptionCount: this.subscriptions.size,
      };
      
      await this.redis.lpush(metricsKey, JSON.stringify(metrics));
      await this.redis.ltrim(metricsKey, 0, 1439); // 保留24小时的数据（每分钟一条）
      await this.redis.expire(metricsKey, 172800); // 48小时过期
      
    } catch (error) {
      this.logger.error(`Failed to store metrics: ${error.message}`, { error });
    }
  }
  
  private updateAverageLatency(newLatency: number): void {
    if (this.stats.messagesSent === 1) {
      this.stats.averageLatency = newLatency;
    } else {
      // 指数移动平均
      const alpha = 0.1;
      this.stats.averageLatency = alpha * newLatency + (1 - alpha) * this.stats.averageLatency;
    }
  }
  
  private getMessagePriorityValue(priority: MessagePriority): number {
    switch (priority) {
      case MessagePriority.CRITICAL: return 1;
      case MessagePriority.HIGH: return 2;
      case MessagePriority.NORMAL: return 3;
      case MessagePriority.LOW: return 4;
      default: return 3;
    }
  }
  
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}