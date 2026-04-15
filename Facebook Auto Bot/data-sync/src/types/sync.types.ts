export interface SyncEntity {
  id: string;
  type: EntityType;
  version: number;
  data: any;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  checksum: string;
  metadata?: Record<string, any>;
}

export enum EntityType {
  TASK = 'task',
  ACCOUNT = 'account',
  USER = 'user',
  SETTING = 'setting',
  NOTIFICATION = 'notification',
  LOG = 'log',
}

export interface SyncOperation {
  id: string;
  type: OperationType;
  entityId: string;
  entityType: EntityType;
  version: number;
  data: any;
  timestamp: Date;
  source: string;
  conflict?: boolean;
  resolved?: boolean;
  metadata?: Record<string, any>;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SYNC = 'sync',
  CONFLICT = 'conflict',
  RESOLVE = 'resolve',
}

export interface SyncState {
  lastSyncTime: Date;
  pendingOperations: number;
  conflicts: number;
  syncStatus: SyncStatus;
  entities: Record<string, EntitySyncState>;
}

export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  ERROR = 'error',
  OFFLINE = 'offline',
  CONFLICT = 'conflict',
}

export interface EntitySyncState {
  entityId: string;
  entityType: EntityType;
  localVersion: number;
  remoteVersion: number;
  lastSynced: Date;
  status: EntitySyncStatus;
  pendingChanges: number;
}

export enum EntitySyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  CONFLICT = 'conflict',
  ERROR = 'error',
}

export interface Conflict {
  id: string;
  entityId: string;
  entityType: EntityType;
  localOperation: SyncOperation;
  remoteOperation: SyncOperation;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: ConflictResolution;
}

export interface ConflictResolution {
  type: ResolutionType;
  data: any;
  resolvedBy: string;
  resolvedAt: Date;
}

export enum ResolutionType {
  KEEP_LOCAL = 'keep_local',
  KEEP_REMOTE = 'keep_remote',
  MERGE = 'merge',
  CUSTOM = 'custom',
}

export interface SyncConfig {
  serverUrl: string;
  syncInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  batchSize: number;
  conflictDetection: boolean;
  autoResolve: boolean;
  offlineQueue: boolean;
  queueSize: number;
  checksumAlgorithm: ChecksumAlgorithm;
}

export enum ChecksumAlgorithm {
  CRC32 = 'crc32',
  SHA256 = 'sha256',
  MD5 = 'md5',
}

export interface SyncStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  conflictsDetected: number;
  conflictsResolved: number;
  averageSyncTime: number;
  lastSyncTime?: Date;
  lastError?: string;
}

export interface BatchSyncRequest {
  operations: SyncOperation[];
  clientId: string;
  timestamp: Date;
  checksum: string;
}

export interface BatchSyncResponse {
  accepted: SyncOperation[];
  rejected: SyncOperation[];
  conflicts: Conflict[];
  serverTime: Date;
  nextSyncTime?: Date;
}

export interface OfflineQueueItem {
  id: string;
  operation: SyncOperation;
  createdAt: Date;
  attempts: number;
  lastAttempt?: Date;
  status: QueueItemStatus;
}

export enum QueueItemStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRY = 'retry',
}

export interface SyncEvent {
  type: SyncEventType;
  data: any;
  timestamp: Date;
}

export enum SyncEventType {
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  CONFLICT_DETECTED = 'conflict_detected',
  CONFLICT_RESOLVED = 'conflict_resolved',
  OFFLINE_QUEUE_UPDATED = 'offline_queue_updated',
  ENTITY_SYNCED = 'entity_synced',
}