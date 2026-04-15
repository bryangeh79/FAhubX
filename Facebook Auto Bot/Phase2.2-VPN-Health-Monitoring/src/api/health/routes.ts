import { Router } from 'express';
import { HealthCheckEngine } from '../../health/engine/HealthCheckEngine';
import { logger } from '../../shared/utils/logger';

export function setupHealthRoutes(): Router {
  const router = Router();
  const healthEngine = new HealthCheckEngine();

  // Start health monitoring
  router.post('/start', (req, res) => {
    try {
      healthEngine.start();
      
      res.json({
        success: true,
        message: 'Health monitoring started',
      });
    } catch (error) {
      logger.error('Failed to start health monitoring', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to start health monitoring',
        message: (error as Error).message,
      });
    }
  });

  // Stop health monitoring
  router.post('/stop', (req, res) => {
    try {
      healthEngine.stop();
      
      res.json({
        success: true,
        message: 'Health monitoring stopped',
      });
    } catch (error) {
      logger.error('Failed to stop health monitoring', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop health monitoring',
        message: (error as Error).message,
      });
    }
  });

  // Run health checks now
  router.post('/run', async (req, res) => {
    try {
      const { accountId } = req.body;
      const results = await healthEngine.runAllChecks(accountId);
      
      res.json({
        success: true,
        data: results,
        count: results.length,
        message: 'Health checks completed',
      });
    } catch (error) {
      logger.error('Failed to run health checks', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to run health checks',
        message: (error as Error).message,
      });
    }
  });

  // Get health status
  router.get('/status', (req, res) => {
    try {
      const { accountId } = req.query;
      const isRunning = healthEngine.isEngineRunning();
      const stats = healthEngine.getHealthStatistics(accountId as string);
      const config = healthEngine.getConfig();
      
      res.json({
        success: true,
        data: {
          isRunning,
          statistics: stats,
          configuration: config,
        },
      });
    } catch (error) {
      logger.error('Failed to get health status', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get health status',
        message: (error as Error).message,
      });
    }
  });

  // Get health history
  router.get('/history', (req, res) => {
    try {
      const { accountId, limit } = req.query;
      const history = healthEngine.getHealthHistory(
        accountId as string,
        parseInt(limit as string) || 100
      );
      
      res.json({
        success: true,
        data: history,
        count: history.length,
      });
    } catch (error) {
      logger.error('Failed to get health history', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get health history',
        message: (error as Error).message,
      });
    }
  });

  // Update health check configuration
  router.put('/config', (req, res) => {
    try {
      const config = req.body;
      
      if (!config) {
        return res.status(400).json({
          success: false,
          error: 'Missing configuration data',
        });
      }

      healthEngine.updateConfig(config);
      
      res.json({
        success: true,
        message: 'Health check configuration updated',
        data: healthEngine.getConfig(),
      });
    } catch (error) {
      logger.error('Failed to update health configuration', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update health configuration',
        message: (error as Error).message,
      });
    }
  });

  // Get health check configuration
  router.get('/config', (req, res) => {
    try {
      const config = healthEngine.getConfig();
      
      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      logger.error('Failed to get health configuration', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get health configuration',
        message: (error as Error).message,
      });
    }
  });

  // Add custom health check
  router.post('/checks/custom', (req, res) => {
    try {
      const { name, checkFunction } = req.body;
      
      if (!name || !checkFunction) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: name, checkFunction',
        });
      }

      // TODO: Implement custom check registration
      // This would require eval or a more sophisticated approach
      
      res.json({
        success: true,
        message: `Custom health check '${name}' added (implementation pending)`,
      });
    } catch (error) {
      logger.error('Failed to add custom health check', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to add custom health check',
        message: (error as Error).message,
      });
    }
  });

  // Get available health checks
  router.get('/checks', (req, res) => {
    try {
      const config = healthEngine.getConfig();
      
      res.json({
        success: true,
        data: {
          availableChecks: [
            'login',
            'apiAccess', 
            'rateLimit',
            'sessionValid',
            'ipReputation',
          ],
          enabledChecks: config.enabledChecks,
        },
      });
    } catch (error) {
      logger.error('Failed to get available health checks', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get available health checks',
        message: (error as Error).message,
      });
    }
  });

  // Clean up health engine
  router.post('/cleanup', (req, res) => {
    try {
      healthEngine.cleanup();
      
      res.json({
        success: true,
        message: 'Health engine cleaned up',
      });
    } catch (error) {
      logger.error('Failed to cleanup health engine', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup health engine',
        message: (error as Error).message,
      });
    }
  });

  return router;
}