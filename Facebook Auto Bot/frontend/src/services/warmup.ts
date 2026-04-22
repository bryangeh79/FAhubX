import api from './api';

export interface WarmupProgress {
  id: string;
  userId: string;
  accountId: string;
  startedAt: string;
  status: 'active' | 'retired';
  lastFiredWindow: string | null;
  lastCheckedAt: string | null;
  missedToday: number;
  missedDateKey: string | null;
  missedTotal: number;
  firedTotal: number;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PackageInfo {
  packageNumber: 1 | 2 | 3;
  packageName: 'incubation' | 'activation' | 'operation';
  dayInPackage: number;
  overallDay: number;
  progressPercent: number;
  isMaintenance: boolean;
}

export interface WarmupStatus {
  progress: WarmupProgress | null;
  packageInfo: PackageInfo | null;
  nextWindowHour: number | null;
  activeWindowIndex: number | null;
  missedThresholdReached: boolean;
}

export const warmupService = {
  async listForUser(): Promise<WarmupProgress[]> {
    const r = await api.get<WarmupProgress[]>('/warmup/progress');
    return r.data;
  },

  async getStatus(accountId: string): Promise<WarmupStatus> {
    const r = await api.get<WarmupStatus>(`/warmup/status/${accountId}`);
    return r.data;
  },

  async start(accountId: string): Promise<WarmupProgress> {
    const r = await api.post<WarmupProgress>(`/warmup/start/${accountId}`);
    return r.data;
  },

  async retire(accountId: string): Promise<WarmupProgress> {
    const r = await api.post<WarmupProgress>(`/warmup/retire/${accountId}`);
    return r.data;
  },

  async resume(accountId: string): Promise<WarmupProgress> {
    const r = await api.post<WarmupProgress>(`/warmup/resume/${accountId}`);
    return r.data;
  },
};

/**
 * 根据 PackageInfo 返回展示标签：P1 D3 · 42% 或 P3 · 维护中
 */
export function formatPackageBadge(info: PackageInfo | null): string {
  if (!info) return '-';
  if (info.isMaintenance) return `P3 · 维护中`;
  return `P${info.packageNumber} D${info.dayInPackage} · ${info.progressPercent}%`;
}

/**
 * 包的显示色
 */
export function getPackageColor(info: PackageInfo | null): string {
  if (!info) return 'default';
  if (info.packageNumber === 1) return 'blue';
  if (info.packageNumber === 2) return 'gold';
  return 'green'; // P3 maintenance
}

/**
 * 包名本地化 key（用于 i18n lookup）
 */
export function getPackageI18nKey(info: PackageInfo | null): string {
  if (!info) return 'warmup.package.none';
  return `warmup.package.${info.packageName}`;
}

/**
 * 前端复算 PackageInfo（避免每 60 秒都打 /status 端点查 N 次）
 * 逻辑和后端 getPackageInfo 一致
 */
export function computePackageInfoFromStart(startedAt: string | Date): PackageInfo {
  const start = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  const now = new Date();
  const msPerDay = 86_400_000;
  const days = Math.floor((now.getTime() - start.getTime()) / msPerDay) + 1;
  if (days <= 7) {
    return {
      packageNumber: 1, packageName: 'incubation',
      dayInPackage: days, overallDay: days,
      progressPercent: Math.round((days / 7) * 100),
      isMaintenance: false,
    };
  }
  if (days <= 14) {
    const d = days - 7;
    return {
      packageNumber: 2, packageName: 'activation',
      dayInPackage: d, overallDay: days,
      progressPercent: Math.round((d / 7) * 100),
      isMaintenance: false,
    };
  }
  return {
    packageNumber: 3, packageName: 'operation',
    dayInPackage: days - 14, overallDay: days,
    progressPercent: 100, isMaintenance: true,
  };
}
