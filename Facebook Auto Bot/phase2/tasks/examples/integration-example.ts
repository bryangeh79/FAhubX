/**
 * Phase 2.3 集成示例
 * 演示如何集成Facebook操作库、任务引擎和错误处理系统
 */

import { 
  // Facebook操作库
  executeOperation,
  OperationType,
  OperationPriority,
  PostOperationParams,
  LikeOperationParams,
  CommentOperationParams,
  initializeOperations,
  createOperationFactory
} from '../operations/src/index';

import {
  // 任务引擎
  createTaskEngineManager,
  TaskType,
  TaskPriority,
  SingleTaskExecutor,
  BatchTaskExecutor,
  TaskQueue,
  TaskScheduler,
  initializeTaskEngine
} from '../engine/src/index';

import {
  // 错误处理系统
  createErrorHandlingManager,
  ErrorSeverity,
  ErrorCategory,
  RecoveryAction,
  initializeErrorHandling
} from '../error-handling/src/index';

/**
 * 示例1: 基本操作执行
 */
async function exampleBasicOperations() {
  console.log('=== 示例1: 基本操作执行 ===');
  
  // 初始化操作库
  initializeOperations();
  
  // 创建操作上下文
  const context = {
    sessionId: 'session-123',
    accountId: 'account-456',
    metadata: { example: true }
  };
  
  try {
    // 执行发帖操作
    const postResult = await executeOperation({
      type: OperationType.POST,
      content: 'Hello from Facebook Auto Bot!',
      images: ['/path/to/image1.jpg', '/path/to/image2.jpg'],
      privacy: 'friends',
      priority: OperationPriority.NORMAL,
      context
    } as PostOperationParams);
    
    console.log('发帖结果:', {
      status: postResult.status,
      duration: postResult.duration,
      data: postResult.data
    });
    
    // 执行点赞操作
    const likeResult = await executeOperation({
      type: OperationType.LIKE,
      postUrl: 'https://www.facebook.com/posts/123456789',
      reaction: 'love',
      priority: OperationPriority.LOW,
      context
    } as LikeOperationParams);
    
    console.log('点赞结果:', {
      status: likeResult.status,
      reaction: likeResult.data?.reaction
    });
    
    // 执行评论操作
    const commentResult = await executeOperation({
      type: OperationType.COMMENT,
      postUrl: 'https://www.facebook.com/posts/123456789',
      content: 'Great post! Thanks for sharing.',
      priority: OperationPriority.NORMAL,
      context
    } as CommentOperationParams);
    
    console.log('评论结果:', {
      status: commentResult.status,
      isReply: commentResult.data?.isReply
    });
    
  } catch (error) {
    console.error('操作执行失败:', error);
  }
}

/**
 * 示例2: 任务引擎使用
 */
async function exampleTaskEngine() {
  console.log('\n=== 示例2: 任务引擎使用 ===');
  
  // 初始化任务引擎
  initializeTaskEngine();
  
  // 创建任务引擎管理器
  const taskManager = createTaskEngineManager();
  
  // 1. 使用单任务执行器
  const singleExecutor = taskManager.getSingleExecutor();
  
  const singleTask = SingleTaskExecutor.createTask(
    '示例发帖任务',
    OperationType.POST,
    {
      content: '这是通过任务引擎发布的帖子',
      privacy: 'public'
    },
    'account-123',
    'session-456',
    TaskPriority.NORMAL
  );
  
  console.log('创建单任务:', {
    id: singleTask.id,
    name: singleTask.name,
    type: singleTask.type
  });
  
  // 执行单任务
  const singleResult = await singleExecutor.execute(singleTask);
  console.log('单任务执行结果:', {
    status: singleResult.status,
    operationCount: singleResult.operationResults.length,
    duration: singleResult.duration
  });
  
  // 2. 使用批量任务执行器
  const batchExecutor = taskManager.getBatchExecutor();
  
  const batchTask = BatchTaskExecutor.createBatchTask(
    '批量互动任务',
    [
      {
        type: OperationType.LIKE,
        params: { postUrl: 'https://facebook.com/posts/1' }
      },
      {
        type: OperationType.LIKE,
        params: { postUrl: 'https://facebook.com/posts/2' }
      },
      {
        type: OperationType.COMMENT,
        params: { 
          postUrl: 'https://facebook.com/posts/1',
          content: '第一个评论'
        }
      }
    ],
    'account-123',
    'session-456',
    TaskPriority.NORMAL,
    2 // 并发数
  );
  
  console.log('创建批量任务:', {
    id: batchTask.id,
    operationCount: batchTask.data.operationParams.length,
    concurrency: batchTask.config.concurrency
  });
  
  // 执行批量任务
  const batchResult = await batchExecutor.execute(batchTask);
  console.log('批量任务执行结果:', {
    status: batchResult.status,
    successCount: batchResult.operationResults.filter(r => r.status === 'success').length,
    totalCount: batchResult.operationResults.length
  });
  
  // 3. 使用任务队列
  const queue = taskManager.createQueue('example-queue');
  
  // 创建更多任务
  const tasks = [
    SingleTaskExecutor.createTask(
      '队列任务1',
      OperationType.POST,
      { content: '队列任务1内容' },
      'account-123',
      'session-456'
    ),
    SingleTaskExecutor.createTask(
      '队列任务2',
      OperationType.LIKE,
      { postUrl: 'https://facebook.com/posts/3' },
      'account-123',
      'session-456'
    )
  ];
  
  // 入队任务
  for (const task of tasks) {
    const jobId = await queue.enqueue(task);
    console.log('任务已入队:', { taskId: task.id, jobId });
  }
  
  // 获取队列统计
  const queueStats = await queue.getStats();
  console.log('队列统计:', queueStats);
  
  // 4. 使用任务调度器
  const scheduler = taskManager.getScheduler();
  
  const scheduledTask = TaskScheduler.createScheduledTask(
    '定时发帖任务',
    OperationType.POST,
    { content: '定时发布的帖子' },
    {
      cronExpression: '*/30 * * * *', // 每30分钟
      startAt: new Date(Date.now() + 60000) // 1分钟后开始
    },
    'account-123',
    'session-456'
  );
  
  const scheduleId = await scheduler.schedule(scheduledTask);
  console.log('任务已调度:', { taskId: scheduledTask.id, scheduleId });
  
  // 获取所有调度任务
  const scheduledTasks = await scheduler.getScheduledTasks();
  console.log('当前调度任务数:', scheduledTasks.length);
  
  // 获取引擎状态
  const engineStatus = taskManager.getEngineStatus();
  console.log('任务引擎状态:', engineStatus);
}

/**
 * 示例3: 错误处理集成
 */
async function exampleErrorHandling() {
  console.log('\n=== 示例3: 错误处理集成 ===');
  
  // 初始化错误处理系统
  initializeErrorHandling();
  
  // 创建错误处理管理器
  const errorManager = createErrorHandlingManager();
  
  // 模拟各种错误场景
  const errorScenarios = [
    {
      name: '网络超时错误',
      error: new Error('Request timed out after 30000ms'),
      context: {
        operationType: OperationType.POST,
        accountId: 'account-123',
        sessionId: 'session-456',
        retryCount: 1
      }
    },
    {
      name: 'Facebook验证错误',
      error: new Error('Facebook authentication failed'),
      context: {
        operationType: OperationType.LIKE,
        accountId: 'account-123',
        source: 'facebook'
      }
    },
    {
      name: '频率限制错误',
      error: new Error('Rate limit exceeded. Please try again later.'),
      context: {
        operationType: OperationType.COMMENT,
        accountId: 'account-123',
        sessionId: 'session-456'
      }
    },
    {
      name: '元素未找到错误',
      error: new Error('Element not found: div[aria-label="赞"]'),
      context: {
        operationType: OperationType.LIKE,
        accountId: 'account-123',
        source: 'puppeteer'
      }
    }
  ];
  
  // 处理每个错误场景
  for (const scenario of errorScenarios) {
    console.log(`\n处理错误场景: ${scenario.name}`);
    
    try {
      const result = await errorManager.handleError(scenario.error, scenario.context);
      
      console.log('错误处理结果:', {
        handled: result.handled,
        recoveryActions: result.recoveryActions,
        retryScheduled: result.retryScheduled,
        retryDelay: result.retryDelay,
        escalated: result.escalated,
        message: result.message
      });
      
      // 如果是Facebook特定错误，显示更多信息
      if (scenario.context.source === 'facebook') {
        const handler = errorManager.getFacebookHandler();
        const facebookStats = handler.getFacebookErrorStats();
        console.log('Facebook错误统计:', facebookStats);
      }
      
    } catch (error) {
      console.error('错误处理失败:', error);
    }
  }
  
  // 获取错误统计
  const errorStats = errorManager.getErrorStats();
  console.log('\n错误统计总览:', {
    totalErrors: errorStats.totalErrors,
    bySeverity: errorStats.facebookErrors.bySeverity,
    recentErrors: errorStats.recentErrors.length
  });
  
  // 获取系统状态
  const systemStatus = errorManager.getSystemStatus();
  console.log('错误处理系统状态:', systemStatus);
  
  // 清理旧错误
  errorManager.cleanupOldErrors(1); // 清理1小时前的错误
}

/**
 * 示例4: 完整集成流程
 */
async function exampleFullIntegration() {
  console.log('\n=== 示例4: 完整集成流程 ===');
  
  // 初始化所有系统
  initializeOperations();
  initializeTaskEngine();
  initializeErrorHandling();
  
  // 创建管理器
  const taskManager = createTaskEngineManager();
  const errorManager = createErrorHandlingManager();
  
  // 创建复杂的批量任务
  const complexTask = BatchTaskExecutor.createBatchTask(
    '完整集成示例任务',
    [
      {
        type: OperationType.POST,
        params: {
          content: '集成测试帖子 #1',
          privacy: 'friends',
          tags: ['测试', '集成']
        }
      },
      {
        type: OperationType.LIKE,
        params: {
          postUrl: 'https://facebook.com/posts/example1',
          reaction: 'love'
        }
      },
      {
        type: OperationType.COMMENT,
        params: {
          postUrl: 'https://facebook.com/posts/example1',
          content: '自动化评论测试'
        }
      },
      {
        type: OperationType.POST,
        params: {
          content: '集成测试帖子 #2',
          images: ['/path/to/test.jpg']
        }
      }
    ],
    'integration-account',
    'integration-session',
    TaskPriority.HIGH,
    2 // 并发数
  );
  
  console.log('创建复杂任务:', {
    id: complexTask.id,
    name: complexTask.name,
    operationCount: complexTask.data.operationParams.length,
    priority: complexTask.priority
  });
  
  // 使用错误处理包装任务执行
  try {
    const batchExecutor = taskManager.getBatchExecutor();
    const taskResult = await batchExecutor.execute(complexTask);
    
    console.log('任务执行完成:', {
      status: taskResult.status,
      totalOperations: taskResult.operationResults.length,
      successCount: taskResult.operationResults.filter(r => r.status === 'success').length,
      duration: taskResult.duration
    });
    
    // 检查并处理任务中的错误
    const failedOperations = taskResult.operationResults.filter(r => r.status === 'failed');
    
    if (failedOperations.length > 0) {
      console.log(`发现 ${failedOperations.length} 个失败操作，开始错误处理...`);
      
      for (const operation of failedOperations) {
        const errorResult = await errorManager.handleOperationError(operation);
        
        console.log('操作错误处理结果:', {
          operationId: operation.operationId,
          error: operation.error,
          handled: errorResult.handled,
          actions: errorResult.recoveryActions
        });
      }
    }
    
  } catch (taskError) {
    console.error('任务执行失败:', taskError);
    
    // 处理任务级错误
    const errorResult = await errorManager.handleError(
      taskError instanceof Error ? taskError : new Error(String(taskError)),
      {
        taskId: complexTask.id,
        taskName: complexTask.name,
        critical: true
      }
    );
    
    console.log('任务级错误处理结果:', {
      handled: errorResult.handled,
      escalated: errorResult.escalated,
      message: errorResult.message
    });
  }
  
  // 显示最终状态
  console.log('\n=== 最终状态报告 ===');
  
  const taskStatus = taskManager.getEngineStatus();
  const errorStatus = errorManager.getSystemStatus();
  
  console.log('任务引擎状态:', {
    totalTasks: taskStatus.singleExecutor.totalTasks + taskStatus.batchExecutor.totalTasks,
    queueCount: taskStatus.queues.count,
    scheduledTasks: taskStatus.scheduler.scheduledTasks
  });
  
  console.log('错误处理状态:', {
    totalErrors: errorStatus.stats.totalErrors,
    handlers: Object.keys(errorStatus.handlers)
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('Phase 2.3 集成示例开始\n');
  
  try {
    // 运行各个示例
    await exampleBasicOperations();
    await exampleTaskEngine();
    await exampleErrorHandling();
    await exampleFullIntegration();
    
    console.log('\n所有示例执行完成！');
    
  } catch (error) {
    console.error('示例执行失败:', error);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

export {
  exampleBasicOperations,
  exampleTaskEngine,
  exampleErrorHandling,
  exampleFullIntegration
};