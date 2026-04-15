import { SessionManager } from '../session-manager';
import { Logger } from '../utils/logger';

const logger = new Logger('CleanupScript');

async function runCleanup() {
  try {
    logger.info('Starting session cleanup script');

    // 从环境变量创建SessionManager
    const sessionManager = new SessionManager(SessionManager.createConfigFromEnv());
    await sessionManager.initialize();

    // 执行清理
    const result = await sessionManager.cleanupSessions();
    
    logger.info('Cleanup completed', {
      expiredCount: result.expiredCount,
      deletedCount: result.deletedCount,
      idleCount: result.idleCount
    });

    // 获取清理后的会话概览
    const overview = await sessionManager.getSessionOverview();
    logger.info('Session overview after cleanup', {
      totalSessions: overview.length,
      activeSessions: overview.filter(s => s.status === 'active').length,
      idleSessions: overview.filter(s => s.status === 'idle').length,
      expiredSessions: overview.filter(s => s.status === 'expired').length
    });

    // 销毁SessionManager
    await sessionManager.destroy();
    
    logger.info('Cleanup script completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Cleanup script failed', error as Error);
    process.exit(1);
  }
}

// 运行清理
if (import.meta.url === `file://${process.argv[1]}`) {
  runCleanup();
}

export { runCleanup };