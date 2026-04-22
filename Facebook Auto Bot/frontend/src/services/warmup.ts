import api from './api';

export type PackageMode = 'P1' | 'P2' | 'P1+P2' | 'P3';

export interface WarmupProgress {
  id: string;
  userId: string;
  accountId: string;
  taskId: string | null;
  packageMode: PackageMode;
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
  totalDays: number;
  isMaintenance: boolean;
  shouldTransitionToP3: boolean;
}

export interface WarmupStatus {
  progress: WarmupProgress | null;
  packageInfo: PackageInfo | null;
  nextWindowHour: number | null;
  activeWindowIndex: number | null;
  missedThresholdReached: boolean;
}

export interface WarmupStats {
  activeCount: number;
  maintenanceCount: number;
  retiredCount: number;
}

export interface BatchStartResult {
  started: Array<{ accountId: string; accountNumber: number | null; taskId: string }>;
  skipped: Array<{ accountId: string; accountNumber: number | null; reason: string }>;
}

export const warmupService = {
  async listForUser(): Promise<WarmupProgress[]> {
    const r = await api.get<WarmupProgress[]>('/warmup/progress');
    return r.data;
  },

  async getStats(): Promise<WarmupStats> {
    const r = await api.get<WarmupStats>('/warmup/stats');
    return r.data;
  },

  async getStatus(accountId: string): Promise<WarmupStatus> {
    const r = await api.get<WarmupStatus>(`/warmup/status/${accountId}`);
    return r.data;
  },

  /** 一键启动单账号（默认 P1+P2 完整养号） */
  async start(accountId: string, packageMode: PackageMode = 'P1+P2'): Promise<any> {
    const r = await api.post<any>(`/warmup/start/${accountId}`, { packageMode });
    return r.data;
  },

  /** 批量启动（按账号列表或整组） */
  async batch(params: {
    packageMode: PackageMode;
    accountIds?: string[];
    groupNumber?: number;
  }): Promise<BatchStartResult> {
    const r = await api.post<BatchStartResult>('/warmup/batch', params);
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

// ─── UI helpers ─────────────────────────────────────────────────────

/**
 * 包模式的中文短标签（用于任务名 / 列表 tag）
 */
export function getPackageModeLabel(mode: PackageMode): string {
  switch (mode) {
    case 'P1': return '孵化期';
    case 'P2': return '激活期';
    case 'P1+P2': return '完整养号';
    case 'P3': return '维护模式';
  }
}

/**
 * 包模式的 Ant Design 颜色
 */
export function getPackageModeColor(mode: PackageMode): string {
  switch (mode) {
    case 'P1': return 'blue';
    case 'P2': return 'gold';
    case 'P1+P2': return 'cyan';
    case 'P3': return 'green';
  }
}

/**
 * 根据 WarmupProgress + 当前时间计算进度百分比
 * 前端独立计算，避免每 60s 都调 /status 端点
 */
export function computePackageInfoFromProgress(p: WarmupProgress, now: Date = new Date()): PackageInfo {
  const start = new Date(p.startedAt);
  const msPerDay = 86_400_000;
  const day = Math.floor((now.getTime() - start.getTime()) / msPerDay) + 1;
  const mode = p.packageMode;

  if (mode === 'P3') {
    return {
      packageNumber: 3, packageName: 'operation',
      dayInPackage: day, overallDay: day,
      progressPercent: 100, totalDays: 0,
      isMaintenance: true, shouldTransitionToP3: false,
    };
  }

  if (mode === 'P1') {
    const cap = Math.min(day, 7);
    return {
      packageNumber: 1, packageName: 'incubation',
      dayInPackage: cap, overallDay: day,
      progressPercent: Math.round((cap / 7) * 100),
      totalDays: 7, isMaintenance: false,
      shouldTransitionToP3: day > 7,
    };
  }

  if (mode === 'P2') {
    const cap = Math.min(day, 7);
    return {
      packageNumber: 2, packageName: 'activation',
      dayInPackage: cap, overallDay: day,
      progressPercent: Math.round((cap / 7) * 100),
      totalDays: 7, isMaintenance: false,
      shouldTransitionToP3: day > 7,
    };
  }

  // P1+P2
  if (day <= 7) {
    return {
      packageNumber: 1, packageName: 'incubation',
      dayInPackage: day, overallDay: day,
      progressPercent: Math.round((day / 14) * 100),
      totalDays: 14, isMaintenance: false, shouldTransitionToP3: false,
    };
  }
  if (day <= 14) {
    return {
      packageNumber: 2, packageName: 'activation',
      dayInPackage: day - 7, overallDay: day,
      progressPercent: Math.round((day / 14) * 100),
      totalDays: 14, isMaintenance: false, shouldTransitionToP3: false,
    };
  }
  return {
    packageNumber: 2, packageName: 'activation',
    dayInPackage: 7, overallDay: day,
    progressPercent: 100, totalDays: 14,
    isMaintenance: false, shouldTransitionToP3: true,
  };
}

/**
 * 格式化进度条文案：Day 5/14 · 36%
 * P3 → "∞ 维护中"
 */
export function formatProgressText(p: WarmupProgress): string {
  const info = computePackageInfoFromProgress(p);
  if (info.isMaintenance) return '∞ 维护中';
  return `Day ${info.overallDay}/${info.totalDays} · ${info.progressPercent}%`;
}
