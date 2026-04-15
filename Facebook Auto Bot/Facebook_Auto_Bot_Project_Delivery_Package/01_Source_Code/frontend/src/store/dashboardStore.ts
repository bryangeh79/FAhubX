import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DashboardStats {
  totalAccounts: number;
  activeTasks: number;
  todayConversations: number;
  successRate: number;
  systemStatus: 'normal' | 'warning' | 'error';
  lastUpdate: string;
}

interface AccountStatus {
  id: string;
  username: string;
  displayName: string;
  status: 'active' | 'disabled' | 'banned' | 'suspended';
  lastActivityAt: string;
  online: boolean;
}

interface TaskStatus {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  executedAt: string;
  duration: number;
  progress: number;
}

interface DashboardState {
  // 实时数据
  stats: DashboardStats;
  accounts: AccountStatus[];
  recentTasks: TaskStatus[];
  
  // WebSocket连接状态
  wsConnected: boolean;
  lastUpdateTime: number;
  
  // 操作
  updateStats: (stats: Partial<DashboardStats>) => void;
  updateAccount: (account: AccountStatus) => void;
  updateTask: (task: TaskStatus) => void;
  setWsConnected: (connected: boolean) => void;
  reset: () => void;
}

const initialStats: DashboardStats = {
  totalAccounts: 0,
  activeTasks: 0,
  todayConversations: 0,
  successRate: 0,
  systemStatus: 'normal',
  lastUpdate: new Date().toISOString(),
};

const initialState = {
  stats: initialStats,
  accounts: [],
  recentTasks: [],
  wsConnected: false,
  lastUpdateTime: Date.now(),
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      updateStats: (newStats) => {
        set((state) => ({
          stats: { ...state.stats, ...newStats, lastUpdate: new Date().toISOString() },
          lastUpdateTime: Date.now(),
        }));
      },
      
      updateAccount: (account) => {
        set((state) => {
          const existingIndex = state.accounts.findIndex(a => a.id === account.id);
          let newAccounts = [...state.accounts];
          
          if (existingIndex >= 0) {
            newAccounts[existingIndex] = account;
          } else {
            newAccounts.push(account);
            // 保持最多显示10个账号
            if (newAccounts.length > 10) {
              newAccounts = newAccounts.slice(-10);
            }
          }
          
          // 按最后活动时间排序
          newAccounts.sort((a, b) => 
            new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
          );
          
          return {
            accounts: newAccounts,
            lastUpdateTime: Date.now(),
          };
        });
      },
      
      updateTask: (task) => {
        set((state) => {
          const existingIndex = state.recentTasks.findIndex(t => t.id === task.id);
          let newTasks = [...state.recentTasks];
          
          if (existingIndex >= 0) {
            newTasks[existingIndex] = task;
          } else {
            newTasks.unshift(task);
            // 保持最多显示10个任务
            if (newTasks.length > 10) {
              newTasks = newTasks.slice(0, 10);
            }
          }
          
          return {
            recentTasks: newTasks,
            lastUpdateTime: Date.now(),
          };
        });
      },
      
      setWsConnected: (connected) => {
        set({ wsConnected: connected });
      },
      
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'dashboard-storage',
      partialize: (state) => ({
        stats: state.stats,
        accounts: state.accounts,
        recentTasks: state.recentTasks,
      }),
    }
  )
);