/**
 * 健康检查引擎入口文件
 */

export { HealthCheckScheduler } from './HealthCheckScheduler';
export { HealthCheckExecutor } from './HealthCheckExecutor';
export { CheckItems } from './CheckItems';

export * from '../../types';

/**
 * 健康检查引擎工厂
 */
export class HealthCheckEngineFactory {
  /**
   * 创建完整的健康检查引擎
   */
  static createEngine(config?: {
    scheduler?: Partial<import('./HealthCheckScheduler').SchedulerConfig>;
    executor?: Partial<import('../../types').HealthCheckConfig>;
  }) {
    // 创建执行器
    const executor = new HealthCheckExecutor(config?.executor);
    
    // 创建调度器
    const scheduler = new HealthCheckScheduler(executor, config?.scheduler);
    
    return {
      scheduler,
      executor,
      start: async () => {
        await scheduler.start();
        return { scheduler, executor };
      },
      stop: async () => {
        await scheduler.stop();
      }
    };
  }
}

/**
 * 健康检查引擎状态
 */
export interface HealthCheckEngineStatus {
  scheduler: {
    running: boolean;
    queueSize: number;
    runningChecks: number;
    lastCheckTime: Date;
  };
  executor: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgExecutionTime: number;
  };
  checks: {
    enabled: string[];
    disabled: string[];
  };
}

/**
 * 健康检查引擎管理器
 */
export class HealthCheckEngineManager {
  private engines: Map<string, ReturnType<typeof HealthCheckEngineFactory.createEngine>> = new Map();
  
  /**
   * 创建引擎实例
   */
  createEngine(
    instanceId: string = 'default',
    config?: Parameters<typeof HealthCheckEngineFactory.createEngine>[0]
  ) {
    if (this.engines.has(instanceId)) {
      throw new Error(`Engine instance ${instanceId} already exists`);
    }
    
    const engine = HealthCheckEngineFactory.createEngine(config);
    this.engines.set(instanceId, engine);
    
    return engine;
  }
  
  /**
   * 获取引擎实例
   */
  getEngine(instanceId: string = 'default') {
    const engine = this.engines.get(instanceId);
    if (!engine) {
      throw new Error(`Engine instance ${instanceId} not found`);
    }
    
    return engine;
  }
  
  /**
   * 启动引擎
   */
  async startEngine(instanceId: string = 'default') {
    const engine = this.getEngine(instanceId);
    return await engine.start();
  }
  
  /**
   * 停止引擎
   */
  async stopEngine(instanceId: string = 'default') {
    const engine = this.getEngine(instanceId);
    await engine.stop();
  }
  
  /**
   * 获取引擎状态
   */
  getEngineStatus(instanceId: string = 'default'): HealthCheckEngineStatus {
    const engine = this.getEngine(instanceId);
    
    const schedulerStatus = engine.scheduler.getHealthStatus();
    const executorStats = engine.executor.getExecutionStatistics();
    
    // 获取启用的检查类型
    const enabledChecks = ['login', 'session', 'permissions', 'restrictions', 'performance', 'risk', 'network'];
    
    return {
      scheduler: {
        running: schedulerStatus.running,
        queueSize: schedulerStatus.queueSize,
        runningChecks: schedulerStatus.runningChecks,
        lastCheckTime: schedulerStatus.lastCheckTime
      },
      executor: {
        totalExecutions: executorStats.totalExecutions,
        successfulExecutions: executorStats.successfulExecutions,
        failedExecutions: executorStats.failedExecutions,
        avgExecutionTime: executorStats.avgExecutionTime
      },
      checks: {
        enabled: enabledChecks,
        disabled: []
      }
    };
  }
  
  /**
   * 获取所有引擎状态
   */
  getAllEngineStatuses(): Record<string, HealthCheckEngineStatus> {
    const statuses: Record<string, HealthCheckEngineStatus> = {};
    
    for (const [instanceId] of this.engines) {
      statuses[instanceId] = this.getEngineStatus(instanceId);
    }
    
    return statuses;
  }
  
  /**
   * 销毁引擎
   */
  async destroyEngine(instanceId: string = 'default') {
    const engine = this.engines.get(instanceId);
    if (!engine) return;
    
    await engine.stop();
    this.engines.delete(instanceId);
  }
  
  /**
   * 销毁所有引擎
   */
  async destroyAllEngines() {
    const destroyPromises = Array.from(this.engines.keys()).map(instanceId =>
      this.destroyEngine(instanceId).catch(error => {
        console.error(`Error destroying engine ${instanceId}:`, error);
      })
    );
    
    await Promise.all(destroyPromises);
    this.engines.clear();
  }
}