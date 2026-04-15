/**
 * 基础操作类
 */

import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import {
  OperationType,
  OperationStatus,
  OperationPriority,
  OperationConfig,
  OperationResult,
  OperationContext,
  BaseOperationParams,
  IOperationExecutor
} from '../types';

/**
 * 抽象基础操作类
 */
export abstract class BaseOperation<T extends BaseOperationParams = BaseOperationParams> 
  implements IOperationExecutor<T> {
  
  protected readonly id: string;
  protected readonly type: OperationType;
  protected readonly priority: OperationPriority;
  protected readonly config: OperationConfig;
  protected readonly logger: Logger;
  protected context?: OperationContext;
  
  constructor(params: T) {
    this.id = params.id || uuidv4();
    this.type = params.type;
    this.priority = params.priority || OperationPriority.NORMAL;
    this.context = params.context;
    
    // 合并配置
    const defaultConfig = this.getDefaultConfig();
    this.config = {
      ...defaultConfig,
      ...params.config,
      id: this.id,
      type: this.type,
      priority: this.priority
    };
    
    // 创建日志器
    this.logger = createLogger(`operation:${this.type}:${this.id}`);
  }
  
  /**
   * 获取默认配置
   */
  protected getDefaultConfig(): OperationConfig {
    return {
      id: this.id,
      type: this.type,
      priority: this.priority,
      maxRetries: 3,
      retryDelay: 5000,
      timeout: 30000,
      requireSession: true,
      requireLogin: true,
      metadata: {}
    };
  }
  
  /**
   * 执行操作
   */
  async execute(params: T): Promise<OperationResult> {
    const startTime = new Date();
    let retryCount = 0;
    let lastError: Error | undefined;
    
    this.logger.info(`开始执行操作: ${this.type}`, { 
      operationId: this.id,
      params: this.sanitizeParams(params)
    });
    
    // 验证参数
    try {
      await this.validate(params);
    } catch (error) {
      this.logger.error('参数验证失败', { error });
      return this.createErrorResult(
        'VALIDATION_FAILED',
        error instanceof Error ? error.message : '参数验证失败',
        startTime,
        new Date()
      );
    }
    
    // 重试逻辑
    while (retryCount <= this.config.maxRetries) {
      try {
        const result = await this.executeInternal(params);
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        this.logger.info(`操作执行成功`, {
          operationId: this.id,
          duration,
          retryCount
        });
        
        return {
          id: uuidv4(),
          operationId: this.id,
          type: this.type,
          status: OperationStatus.SUCCESS,
          data: result,
          retryCount,
          startTime,
          endTime,
          duration,
          metadata: {
            priority: this.priority,
            config: this.config
          }
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;
        
        this.logger.warn(`操作执行失败，准备重试`, {
          operationId: this.id,
          error: lastError.message,
          retryCount,
          maxRetries: this.config.maxRetries
        });
        
        if (retryCount <= this.config.maxRetries) {
          // 等待重试延迟
          await this.delay(this.config.retryDelay);
          continue;
        }
      }
    }
    
    // 所有重试都失败
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    this.logger.error(`操作执行失败，已达到最大重试次数`, {
      operationId: this.id,
      error: lastError?.message,
      retryCount,
      duration
    });
    
    return this.createErrorResult(
      'EXECUTION_FAILED',
      lastError?.message || '操作执行失败',
      startTime,
      endTime,
      retryCount
    );
  }
  
  /**
   * 验证参数（子类可以覆盖）
   */
  async validate(params: T): Promise<boolean> {
    // 基础验证
    if (!params.type) {
      throw new Error('操作类型不能为空');
    }
    
    if (this.config.requireSession && !this.context?.sessionId) {
      throw new Error('需要会话ID');
    }
    
    if (this.config.requireLogin && !this.context?.accountId) {
      throw new Error('需要账户ID');
    }
    
    return true;
  }
  
  /**
   * 获取配置
   */
  getConfig(): OperationConfig {
    return { ...this.config };
  }
  
  /**
   * 内部执行方法（子类必须实现）
   */
  protected abstract executeInternal(params: T): Promise<any>;
  
  /**
   * 创建错误结果
   */
  protected createErrorResult(
    errorCode: string,
    errorMessage: string,
    startTime: Date,
    endTime: Date,
    retryCount: number = 0
  ): OperationResult {
    const duration = endTime.getTime() - startTime.getTime();
    
    return {
      id: uuidv4(),
      operationId: this.id,
      type: this.type,
      status: OperationStatus.FAILED,
      error: errorMessage,
      errorCode,
      retryCount,
      startTime,
      endTime,
      duration,
      metadata: {
        priority: this.priority,
        config: this.config,
        lastRetry: retryCount
      }
    };
  }
  
  /**
   * 延迟函数
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 清理参数（移除敏感信息）
   */
  protected sanitizeParams(params: T): Partial<T> {
    const sanitized: Partial<T> = { ...params };
    
    // 移除可能的敏感字段
    delete (sanitized as any).password;
    delete (sanitized as any).token;
    delete (sanitized as any).cookie;
    delete (sanitized as any).session;
    
    return sanitized;
  }
  
  /**
   * 获取页面对象
   */
  protected async getPage(): Promise<any> {
    if (!this.context?.page && this.context?.browserSession) {
      // 从浏览器会话获取页面
      const page = await this.context.browserSession.newPage();
      this.context.page = page;
      return page;
    }
    
    if (!this.context?.page) {
      throw new Error('无法获取页面对象');
    }
    
    return this.context.page;
  }
  
  /**
   * 安全关闭页面
   */
  protected async safeClosePage(page: any): Promise<void> {
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }
    } catch (error) {
      this.logger.warn('关闭页面时发生错误', { error });
    }
  }
  
  /**
   * 等待元素出现
   */
  protected async waitForSelector(
    page: any,
    selector: string,
    timeout: number = 10000
  ): Promise<any> {
    try {
      return await page.waitForSelector(selector, { timeout });
    } catch (error) {
      throw new Error(`等待元素超时: ${selector}`);
    }
  }
  
  /**
   * 等待导航完成
   */
  protected async waitForNavigation(
    page: any,
    options: any = { waitUntil: 'networkidle0', timeout: 30000 }
  ): Promise<void> {
    try {
      await page.waitForNavigation(options);
    } catch (error) {
      this.logger.warn('等待导航时发生错误', { error });
      // 不抛出错误，继续执行
    }
  }
}