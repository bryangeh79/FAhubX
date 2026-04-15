#!/usr/bin/env node

/**
 * Puppeteer执行器主入口文件
 * 提供命令行界面和HTTP API服务
 */

import { PuppeteerExecutor } from './core/puppeteer-executor';
import { SessionLogger } from './utils/logger';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';

// 加载环境变量
config();

const logger = new SessionLogger('MAIN');
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 创建执行器实例
const executor = new PuppeteerExecutor({
  headless: process.env.NODE_ENV === 'production' ? 'new' : false,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1920,1080'
  ]
});

// 健康检查端点
app.get('/health', (req, res) => {
  const activeSessions = executor.getActiveSessions();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: activeSessions.length,
    uptime: process.uptime()
  });
});

// 创建会话端点
app.post('/sessions', async (req, res) => {
  try {
    const { sessionId, accountId, stealthMode = true, humanBehavior = true } = req.body;
    
    const session = await executor.createSession({
      sessionId: sessionId || `session-${Date.now()}`,
      accountId,
      stealthMode,
      humanBehavior
    });

    logger.info(`Session created: ${session.id}`);
    
    res.status(201).json({
      success: true,
      sessionId: session.id,
      status: session.status,
      config: session.config
    });
  } catch (error) {
    logger.error('Failed to create session', error as Error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// 获取会话信息端点
app.get('/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = executor.getSession(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: `Session not found: ${sessionId}`
    });
  }

  res.json({
    success: true,
    session: {
      id: session.id,
      status: session.status,
      config: session.config,
      lastActivity: session.lastActivity,
      errorCount: session.errorCount
    }
  });
});

// 关闭会话端点
app.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await executor.closeSession(sessionId);
    
    logger.info(`Session closed: ${sessionId}`);
    
    res.json({
      success: true,
      message: `Session ${sessionId} closed successfully`
    });
  } catch (error) {
    logger.error('Failed to close session', error as Error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// 执行任务端点
app.post('/sessions/:sessionId/execute', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { task, options } = req.body;

    if (!task) {
      return res.status(400).json({
        success: false,
        error: 'Task function is required'
      });
    }

    // 注意：这里需要安全地执行用户提供的代码
    // 在生产环境中应该使用沙箱或限制可执行的操作
    const taskFunction = eval(`(${task})`); // 简化示例，生产环境需要更安全的方法

    const result = await executor.executeTask(
      sessionId,
      taskFunction,
      options
    );

    res.json(result);
  } catch (error) {
    logger.error('Failed to execute task', error as Error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// 获取活动会话列表
app.get('/sessions', (req, res) => {
  const activeSessions = executor.getActiveSessions();
  
  res.json({
    success: true,
    count: activeSessions.length,
    sessions: activeSessions.map(session => ({
      id: session.id,
      status: session.status,
      accountId: session.config.accountId,
      lastActivity: session.lastActivity,
      errorCount: session.errorCount
    }))
  });
});

// 清理空闲会话端点
app.post('/cleanup', async (req, res) => {
  try {
    const { maxIdleTime = 1800000 } = req.body; // 默认30分钟
    
    await executor.cleanupIdleSessions(maxIdleTime);
    
    const activeSessions = executor.getActiveSessions();
    
    res.json({
      success: true,
      message: 'Idle sessions cleaned up',
      activeSessions: activeSessions.length
    });
  } catch (error) {
    logger.error('Failed to cleanup sessions', error as Error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// 错误处理中间件
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
const server = app.listen(PORT, () => {
  logger.info(`Puppeteer Executor API server started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Headless mode: ${process.env.NODE_ENV === 'production' ? 'new' : false}`);
});

// 优雅关闭
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, starting graceful shutdown...');
  
  try {
    // 关闭HTTP服务器
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // 清理所有浏览器会话
    await executor.destroy();
    logger.info('All browser sessions destroyed');

    // 退出进程
    setTimeout(() => {
      logger.info('Graceful shutdown completed');
      process.exit(0);
    }, 1000);
  } catch (error) {
    logger.error('Error during graceful shutdown', error as Error);
    process.exit(1);
  }
};

// 注册关闭信号处理
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// 未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown();
});

export default app;