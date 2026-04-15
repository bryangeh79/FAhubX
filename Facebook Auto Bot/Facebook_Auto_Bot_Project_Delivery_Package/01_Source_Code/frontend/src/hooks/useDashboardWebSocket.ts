import { useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

interface DashboardUpdate {
  type: 'stats' | 'account' | 'task' | 'system';
  data: any;
}

export const useDashboardWebSocket = (onUpdate: (update: DashboardUpdate) => void) => {
  const handleMessage = useCallback((data: any) => {
    if (data.type && data.data) {
      onUpdate(data as DashboardUpdate);
    }
  }, [onUpdate]);

  const { isConnected, send } = useWebSocket({
    url: `ws://${window.location.hostname}:3000/ws/dashboard`,
    onMessage: handleMessage,
    onOpen: () => {
      console.log('Dashboard WebSocket connected');
      // 订阅更新
      send({ type: 'subscribe', channel: 'dashboard' });
    },
    onClose: () => {
      console.log('Dashboard WebSocket disconnected');
    },
    reconnectInterval: 3000,
    maxReconnectAttempts: 20,
  });

  const subscribeToAccount = useCallback((accountId: string) => {
    send({ type: 'subscribe', channel: `account:${accountId}` });
  }, [send]);

  const unsubscribeFromAccount = useCallback((accountId: string) => {
    send({ type: 'unsubscribe', channel: `account:${accountId}` });
  }, [send]);

  const subscribeToTask = useCallback((taskId: string) => {
    send({ type: 'subscribe', channel: `task:${taskId}` });
  }, [send]);

  const unsubscribeFromTask = useCallback((taskId: string) => {
    send({ type: 'unsubscribe', channel: `task:${taskId}` });
  }, [send]);

  return {
    isConnected,
    subscribeToAccount,
    unsubscribeFromAccount,
    subscribeToTask,
    unsubscribeFromTask,
  };
};