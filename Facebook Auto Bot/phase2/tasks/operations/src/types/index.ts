/**
 * Facebook操作类型定义
 */

import { BrowserSession } from '@facebook-bot/puppeteer-executor';

/**
 * 操作结果状态
 */
export enum OperationStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
  SKIPPED = 'skipped',
  TIMEOUT = 'timeout'
}

/**
 * 操作类型
 */
export enum OperationType {
  POST = 'post',
  LIKE = 'like',
  COMMENT = 'comment',
  SHARE = 'share',
  FRIEND_REQUEST = 'friend_request',
  FRIEND_ACCEPT = 'friend_accept',
  GROUP_JOIN = 'group_join',
  GROUP_POST = 'group_post',
  MESSAGE_SEND = 'message_send',
  PROFILE_UPDATE = 'profile_update'
}

/**
 * 操作优先级
 */
export enum OperationPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

/**
 * 操作结果
 */
export interface OperationResult<T = any> {
  id: string;
  operationId: string;
  type: OperationType;
  status: OperationStatus;
  data?: T;
  error?: string;
  errorCode?: string;
  retryCount: number;
  startTime: Date;
  endTime: Date;
  duration: number;
  metadata?: Record<string, any>;
}

/**
 * 操作配置
 */
export interface OperationConfig {
  id: string;
  type: OperationType;
  priority: OperationPriority;
  maxRetries: number;
  retryDelay: number; // 毫秒
  timeout: number; // 毫秒
  requireSession: boolean;
  requireLogin: boolean;
  metadata?: Record<string, any>;
}

/**
 * 操作上下文
 */
export interface OperationContext {
  sessionId?: string;
  accountId?: string;
  browserSession?: BrowserSession;
  page?: any; // Puppeteer Page对象
  metadata?: Record<string, any>;
}

/**
 * 基础操作参数
 */
export interface BaseOperationParams {
  id?: string;
  type: OperationType;
  priority?: OperationPriority;
  config?: Partial<OperationConfig>;
  context?: OperationContext;
  metadata?: Record<string, any>;
}

/**
 * 发帖操作参数
 */
export interface PostOperationParams extends BaseOperationParams {
  content: string;
  images?: string[];
  videos?: string[];
  privacy?: 'public' | 'friends' | 'only_me';
  location?: string;
  feeling?: string;
  tags?: string[];
}

/**
 * 点赞操作参数
 */
export interface LikeOperationParams extends BaseOperationParams {
  postUrl: string;
  postId?: string;
  reaction?: 'like' | 'love' | 'care' | 'haha' | 'wow' | 'sad' | 'angry';
}

/**
 * 评论操作参数
 */
export interface CommentOperationParams extends BaseOperationParams {
  postUrl: string;
  postId?: string;
  content: string;
  images?: string[];
  replyTo?: string;
}

/**
 * 分享操作参数
 */
export interface ShareOperationParams extends BaseOperationParams {
  postUrl: string;
  postId?: string;
  content?: string;
  privacy?: 'public' | 'friends' | 'only_me';
  shareTo?: 'timeline' | 'group' | 'friend';
  targetId?: string;
}

/**
 * 好友请求操作参数
 */
export interface FriendRequestOperationParams extends BaseOperationParams {
  profileUrl: string;
  userId?: string;
  message?: string;
}

/**
 * 群组操作参数
 */
export interface GroupOperationParams extends BaseOperationParams {
  groupUrl: string;
  groupId?: string;
  action: 'join' | 'leave' | 'post' | 'comment';
  content?: string;
  images?: string[];
}

/**
 * 消息发送操作参数
 */
export interface MessageOperationParams extends BaseOperationParams {
  recipientUrl: string;
  recipientId?: string;
  message: string;
  images?: string[];
  isGroup?: boolean;
}

/**
 * 操作执行器接口
 */
export interface IOperationExecutor<T extends BaseOperationParams = BaseOperationParams> {
  execute(params: T): Promise<OperationResult>;
  validate(params: T): Promise<boolean>;
  getConfig(): OperationConfig;
}

/**
 * 操作工厂接口
 */
export interface IOperationFactory {
  createOperation(type: OperationType): IOperationExecutor;
  getSupportedOperations(): OperationType[];
}