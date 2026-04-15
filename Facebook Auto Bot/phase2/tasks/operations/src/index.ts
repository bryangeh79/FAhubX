/**
 * Facebook操作封装库主入口
 */

// 导出核心类
export { BaseOperation } from './core/base-operation';
export { OperationFactory } from './core/operation-factory';

// 导出操作类
export { PostOperation } from './operations/post-operation';
export { LikeOperation } from './operations/like-operation';
export { CommentOperation } from './operations/comment-operation';

// 导出工具类
export { OperationLogger, createLogger } from './utils/logger';

// 导出类型
export * from './types';

// 导出常量
export { OperationType, OperationStatus, OperationPriority } from './types';

/**
 * Facebook操作库版本
 */
export const VERSION = '1.0.0';

/**
 * 初始化操作库
 */
export function initializeOperations(): void {
  console.log(`Facebook操作库 v${VERSION} 已初始化`);
  console.log('支持的操作类型:', Object.values(OperationType).join(', '));
}

/**
 * 创建操作工厂实例
 */
export function createOperationFactory(): OperationFactory {
  return OperationFactory.getInstance();
}

/**
 * 执行单个操作
 */
export async function executeOperation<T extends BaseOperationParams>(
  params: T
): Promise<OperationResult> {
  const factory = OperationFactory.getInstance();
  const operation = factory.createOperation(params);
  return await operation.execute(params);
}

/**
 * 批量执行操作
 */
export async function executeOperations<T extends BaseOperationParams>(
  paramsList: T[],
  concurrency: number = 1
): Promise<OperationResult[]> {
  const factory = OperationFactory.getInstance();
  const operations = factory.createOperations(paramsList);
  const results: OperationResult[] = [];
  
  // 简单的并发控制
  for (let i = 0; i < operations.length; i += concurrency) {
    const batch = operations.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((op, index) => op.execute(paramsList[i + index]))
    );
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * 验证操作参数
 */
export async function validateOperation<T extends BaseOperationParams>(
  params: T
): Promise<boolean> {
  const factory = OperationFactory.getInstance();
  return await factory.validateOperation(params);
}

/**
 * 获取操作配置模板
 */
export function getOperationConfigTemplate(type: OperationType): any {
  const factory = OperationFactory.getInstance();
  return factory.getOperationConfigTemplate(type);
}

/**
 * 检查操作类型是否支持
 */
export function isOperationSupported(type: OperationType): boolean {
  const factory = OperationFactory.getInstance();
  return factory.isOperationSupported(type);
}