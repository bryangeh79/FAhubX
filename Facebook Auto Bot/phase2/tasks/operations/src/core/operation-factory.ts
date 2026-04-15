/**
 * 操作工厂
 */

import { 
  OperationType,
  BaseOperationParams,
  IOperationExecutor,
  IOperationFactory
} from '../types';
import { PostOperation } from '../operations/post-operation';
import { LikeOperation } from '../operations/like-operation';
import { CommentOperation } from '../operations/comment-operation';
import { OperationLogger } from '../utils/logger';

/**
 * 操作工厂类
 */
export class OperationFactory implements IOperationFactory {
  private static instance: OperationFactory;
  
  private constructor() {
    // 私有构造函数，确保单例
  }
  
  /**
   * 获取工厂实例
   */
  static getInstance(): OperationFactory {
    if (!OperationFactory.instance) {
      OperationFactory.instance = new OperationFactory();
    }
    return OperationFactory.instance;
  }
  
  /**
   * 创建操作实例
   */
  createOperation<T extends BaseOperationParams>(params: T): IOperationExecutor<T> {
    const { type } = params;
    
    OperationLogger.info('创建操作实例', { type });
    
    switch (type) {
      case OperationType.POST:
        return new PostOperation(params as any) as IOperationExecutor<T>;
        
      case OperationType.LIKE:
        return new LikeOperation(params as any) as IOperationExecutor<T>;
        
      case OperationType.COMMENT:
        return new CommentOperation(params as any) as IOperationExecutor<T>;
        
      case OperationType.SHARE:
        // TODO: 实现分享操作
        throw new Error(`操作类型暂未实现: ${type}`);
        
      case OperationType.FRIEND_REQUEST:
        // TODO: 实现好友请求操作
        throw new Error(`操作类型暂未实现: ${type}`);
        
      case OperationType.FRIEND_ACCEPT:
        // TODO: 实现好友接受操作
        throw new Error(`操作类型暂未实现: ${type}`);
        
      case OperationType.GROUP_JOIN:
        // TODO: 实现群组加入操作
        throw new Error(`操作类型暂未实现: ${type}`);
        
      case OperationType.GROUP_POST:
        // TODO: 实现群组发帖操作
        throw new Error(`操作类型暂未实现: ${type}`);
        
      case OperationType.MESSAGE_SEND:
        // TODO: 实现消息发送操作
        throw new Error(`操作类型暂未实现: ${type}`);
        
      case OperationType.PROFILE_UPDATE:
        // TODO: 实现资料更新操作
        throw new Error(`操作类型暂未实现: ${type}`);
        
      default:
        throw new Error(`不支持的操作类型: ${type}`);
    }
  }
  
  /**
   * 获取支持的操作类型
   */
  getSupportedOperations(): OperationType[] {
    return [
      OperationType.POST,
      OperationType.LIKE,
      OperationType.COMMENT,
      OperationType.SHARE,
      OperationType.FRIEND_REQUEST,
      OperationType.FRIEND_ACCEPT,
      OperationType.GROUP_JOIN,
      OperationType.GROUP_POST,
      OperationType.MESSAGE_SEND,
      OperationType.PROFILE_UPDATE
    ];
  }
  
  /**
   * 检查操作类型是否支持
   */
  isOperationSupported(type: OperationType): boolean {
    return this.getSupportedOperations().includes(type);
  }
  
  /**
   * 批量创建操作
   */
  createOperations<T extends BaseOperationParams>(paramsList: T[]): IOperationExecutor<T>[] {
    return paramsList.map(params => this.createOperation(params));
  }
  
  /**
   * 验证操作参数
   */
  async validateOperation<T extends BaseOperationParams>(params: T): Promise<boolean> {
    try {
      const operation = this.createOperation(params);
      return await operation.validate(params);
    } catch (error) {
      OperationLogger.error('操作参数验证失败', { 
        type: params.type,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  
  /**
   * 获取操作配置模板
   */
  getOperationConfigTemplate(type: OperationType): any {
    const dummyParams = { type } as BaseOperationParams;
    
    try {
      const operation = this.createOperation(dummyParams);
      return operation.getConfig();
    } catch (error) {
      // 返回基础配置模板
      return {
        id: 'template',
        type,
        priority: 2,
        maxRetries: 3,
        retryDelay: 5000,
        timeout: 30000,
        requireSession: true,
        requireLogin: true,
        metadata: {}
      };
    }
  }
}