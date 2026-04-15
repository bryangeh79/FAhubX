import { Router } from 'express';
import { VPNManager } from '../../vpn/VPNManager';
import { logger } from '../../shared/utils/logger';

export function setupVPNRoutes(): Router {
  const router = Router();
  const vpnManager = new VPNManager();

  // Get VPN status
  router.get('/status', (req, res) => {
    try {
      const status = vpnManager.getStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Failed to get VPN status', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get VPN status',
        message: (error as Error).message,
      });
    }
  });

  // Connect via OpenVPN
  router.post('/openvpn/connect', async (req, res) => {
    try {
      const { configPath, connectionName, authFile } = req.body;

      if (!configPath) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: configPath',
        });
      }

      const connection = await vpnManager.connectOpenVPN(configPath, connectionName, authFile);
      
      res.json({
        success: true,
        data: connection,
        message: 'OpenVPN connection established',
      });
    } catch (error) {
      logger.error('Failed to connect via OpenVPN', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to establish OpenVPN connection',
        message: (error as Error).message,
      });
    }
  });

  // Connect via WireGuard
  router.post('/wireguard/connect', async (req, res) => {
    try {
      const { interfaceConfig, peers, connectionName } = req.body;

      if (!interfaceConfig || !peers) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: interfaceConfig, peers',
        });
      }

      const connection = await vpnManager.connectWireGuard(interfaceConfig, peers, connectionName);
      
      res.json({
        success: true,
        data: connection,
        message: 'WireGuard connection established',
      });
    } catch (error) {
      logger.error('Failed to connect via WireGuard', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to establish WireGuard connection',
        message: (error as Error).message,
      });
    }
  });

  // Disconnect VPN
  router.post('/:connectionId/disconnect', async (req, res) => {
    try {
      const { connectionId } = req.params;

      await vpnManager.disconnect(connectionId);
      
      res.json({
        success: true,
        message: `VPN connection ${connectionId} disconnected`,
      });
    } catch (error) {
      logger.error('Failed to disconnect VPN', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect VPN',
        message: (error as Error).message,
      });
    }
  });

  // Disconnect all VPNs
  router.post('/disconnect-all', async (req, res) => {
    try {
      await vpnManager.disconnectAll();
      
      res.json({
        success: true,
        message: 'All VPN connections disconnected',
      });
    } catch (error) {
      logger.error('Failed to disconnect all VPNs', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect all VPNs',
        message: (error as Error).message,
      });
    }
  });

  // Get connection details
  router.get('/:connectionId', (req, res) => {
    try {
      const { connectionId } = req.params;
      const connection = vpnManager.getConnectionStatus(connectionId);

      if (!connection) {
        return res.status(404).json({
          success: false,
          error: 'Connection not found',
        });
      }

      res.json({
        success: true,
        data: connection,
      });
    } catch (error) {
      logger.error('Failed to get connection details', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get connection details',
        message: (error as Error).message,
      });
    }
  });

  // List all connections
  router.get('/', (req, res) => {
    try {
      const connections = vpnManager.getAllConnections();
      
      res.json({
        success: true,
        data: connections,
        count: connections.length,
      });
    } catch (error) {
      logger.error('Failed to list connections', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to list connections',
        message: (error as Error).message,
      });
    }
  });

  // Rotate IP
  router.post('/rotate-ip', async (req, res) => {
    try {
      const newIP = await vpnManager.rotateIP();
      
      if (!newIP) {
        return res.status(400).json({
          success: false,
          error: 'No IP available for rotation',
        });
      }

      res.json({
        success: true,
        data: { newIP },
        message: 'IP rotated successfully',
      });
    } catch (error) {
      logger.error('Failed to rotate IP', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to rotate IP',
        message: (error as Error).message,
      });
    }
  });

  // Test network performance
  router.get('/test/performance', async (req, res) => {
    try {
      const { ip } = req.query;
      const result = await vpnManager.testNetworkPerformance(ip as string);
      
      if (!result) {
        return res.status(400).json({
          success: false,
          error: 'No IP available for testing',
        });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to test network performance', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to test network performance',
        message: (error as Error).message,
      });
    }
  });

  // Get IP information
  router.get('/ip/info', async (req, res) => {
    try {
      const { ip } = req.query;
      const info = await vpnManager.getIPInfo(ip as string);
      
      if (!info) {
        return res.status(400).json({
          success: false,
          error: 'Failed to get IP information',
        });
      }

      res.json({
        success: true,
        data: info,
      });
    } catch (error) {
      logger.error('Failed to get IP information', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to get IP information',
        message: (error as Error).message,
      });
    }
  });

  // Create isolated namespace
  router.post('/namespace/create', async (req, res) => {
    try {
      const { name, dns } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: name',
        });
      }

      const namespaceId = await vpnManager.createIsolatedNamespace(name, dns);
      
      res.json({
        success: true,
        data: { namespaceId, name },
        message: 'Isolated namespace created',
      });
    } catch (error) {
      logger.error('Failed to create isolated namespace', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to create isolated namespace',
        message: (error as Error).message,
      });
    }
  });

  // Update IP rotation policy
  router.put('/ip/policy', (req, res) => {
    try {
      const policy = req.body;

      if (!policy || !policy.strategy) {
        return res.status(400).json({
          success: false,
          error: 'Invalid policy configuration',
        });
      }

      vpnManager.updateIPRotationPolicy(policy);
      
      res.json({
        success: true,
        message: 'IP rotation policy updated',
        data: policy,
      });
    } catch (error) {
      logger.error('Failed to update IP rotation policy', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to update IP rotation policy',
        message: (error as Error).message,
      });
    }
  });

  // Clean up all resources
  router.post('/cleanup', async (req, res) => {
    try {
      await vpnManager.cleanup();
      
      res.json({
        success: true,
        message: 'All VPN resources cleaned up',
      });
    } catch (error) {
      logger.error('Failed to cleanup VPN resources', error as Error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup VPN resources',
        message: (error as Error).message,
      });
    }
  });

  return router;
}