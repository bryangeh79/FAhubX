-- Facebook Auto Bot 数据库迁移脚本
-- 版本: 1.0.0
-- 创建日期: 2026-04-12

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  
  -- 状态信息
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  email_verified BOOLEAN DEFAULT false,
  two_factor_enabled BOOLEAN DEFAULT false,
  
  -- 个人信息
  full_name VARCHAR(200),
  avatar_url TEXT,
  timezone VARCHAR(50) DEFAULT 'UTC',
  language VARCHAR(10) DEFAULT 'en',
  
  -- 偏好设置 (JSONB)
  preferences JSONB DEFAULT '{}',
  
  -- 统计信息
  total_logins INTEGER DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- 索引
  INDEX idx_users_email ON users(email),
  INDEX idx_users_status ON users(status),
  INDEX idx_users_created_at ON users(created_at)
);

-- 2. 用户会话表
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 会话信息
  access_token VARCHAR(512) NOT NULL,
  refresh_token VARCHAR(512) NOT NULL,
  device_info JSONB NOT NULL,
  user_agent TEXT,
  ip_address INET,
  
  -- 状态
  is_active BOOLEAN DEFAULT true,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 过期时间
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  
  -- 索引
  INDEX idx_user_sessions_user_id ON user_sessions(user_id),
  INDEX idx_user_sessions_access_token ON user_sessions(access_token),
  INDEX idx_user_sessions_expires_at ON user_sessions(expires_at) WHERE is_active = true
);

-- 3. Facebook账号表
CREATE TABLE facebook_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 账号信息
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  display_name VARCHAR(200),
  
  -- 状态
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'banned', 'suspended')),
  last_status_check TIMESTAMPTZ,
  status_reason TEXT,
  
  -- 会话数据 (加密存储)
  session_data BYTEA, -- 加密的会话数据
  session_updated_at TIMESTAMPTZ,
  session_hash VARCHAR(64), -- 用于检测会话变化
  
  -- VPN配置
  vpn_config JSONB,
  current_ip INET,
  geo_location JSONB,
  last_vpn_check TIMESTAMPTZ,
  
  -- 标签和分类
  tags VARCHAR(50)[] DEFAULT '{}',
  category VARCHAR(50),
  
  -- 统计信息
  total_tasks INTEGER DEFAULT 0,
  successful_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 约束
  UNIQUE(user_id, username),
  
  -- 索引
  INDEX idx_facebook_accounts_user_id ON facebook_accounts(user_id),
  INDEX idx_facebook_accounts_status ON facebook_accounts(status),
  INDEX idx_facebook_accounts_tags ON facebook_accounts USING GIN(tags),
  INDEX idx_facebook_accounts_updated_at ON facebook_accounts(updated_at)
);

-- 4. 任务配置表
CREATE TABLE task_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 基本信息
  name VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('conversation', 'post', 'like', 'share', 'friend', 'group')),
  
  -- 任务模板
  template_id UUID, -- 引用任务模板
  parameters JSONB NOT NULL DEFAULT '{}',
  
  -- 账号配置
  source_account_id UUID NOT NULL REFERENCES facebook_accounts(id),
  target_account_ids UUID[] DEFAULT '{}',
  
  -- 调度配置
  schedule JSONB NOT NULL,
  next_execution TIMESTAMPTZ,
  
  -- 高级配置
  retry_policy JSONB DEFAULT '{"maxRetries": 3, "retryDelay": 300}',
  failure_handling JSONB DEFAULT '{"notifyOnFailure": true, "autoPause": false}',
  notification_config JSONB DEFAULT '{"notifyOnStart": false, "notifyOnComplete": false}',
  
  -- 状态
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'error')),
  last_execution TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 索引
  INDEX idx_task_configs_user_id ON task_configs(user_id),
  INDEX idx_task_configs_source_account_id ON task_configs(source_account_id),
  INDEX idx_task_configs_status ON task_configs(status),
  INDEX idx_task_configs_next_execution ON task_configs(next_execution) WHERE status = 'active',
  INDEX idx_task_configs_created_at ON task_configs(created_at)
);

-- 5. 任务执行表
CREATE TABLE task_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES task_configs(id) ON DELETE CASCADE,
  
  -- 执行信息
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER, -- 秒
  
  -- 执行结果
  result JSONB,
  error JSONB,
  
  -- 资源使用
  account_id UUID REFERENCES facebook_accounts(id),
  vpn_used VARCHAR(100),
  ip_used INET,
  
  -- 日志和监控
  logs JSONB[] DEFAULT '{}',
  metrics JSONB,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 索引
  INDEX idx_task_executions_config_id ON task_executions(config_id),
  INDEX idx_task_executions_status ON task_executions(status),
  INDEX idx_task_executions_start_time ON task_executions(start_time),
  INDEX idx_task_executions_account_id ON task_executions(account_id),
  INDEX idx_task_executions_created_at ON task_executions(created_at)
);

-- 6. 对话剧本表
CREATE TABLE conversation_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本信息
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('casual', 'business', 'hobby', 'current_events')),
  relationship VARCHAR(50) NOT NULL CHECK (relationship IN ('friends', 'colleagues', 'acquaintances')),
  time_of_day VARCHAR(20) CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'any')),
  
  -- 对话流程
  flow JSONB NOT NULL, -- 对话步骤数组
  variations JSONB DEFAULT '{}', -- 变体配置
  
  -- 元数据
  estimated_duration INTEGER NOT NULL, -- 分钟
  difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags VARCHAR(50)[] DEFAULT '{}',
  
  -- 统计信息
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.0,
  average_rating DECIMAL(3,2),
  total_ratings INTEGER DEFAULT 0,
  
  -- 版本控制
  version VARCHAR(20) DEFAULT '1.0.0',
  is_active BOOLEAN DEFAULT true,
  deprecated_at TIMESTAMPTZ,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 索引
  INDEX idx_conversation_scripts_category ON conversation_scripts(category),
  INDEX idx_conversation_scripts_relationship ON conversation_scripts(relationship),
  INDEX idx_conversation_scripts_tags ON conversation_scripts USING GIN(tags),
  INDEX idx_conversation_scripts_is_active ON conversation_scripts(is_active),
  INDEX idx_conversation_scripts_usage_count ON conversation_scripts(usage_count DESC)
);

-- 7. 对话执行表
CREATE TABLE conversation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_execution_id UUID NOT NULL REFERENCES task_executions(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES conversation_scripts(id),
  
  -- 参与账号
  initiator_account_id UUID NOT NULL REFERENCES facebook_accounts(id),
  responder_account_id UUID NOT NULL REFERENCES facebook_accounts(id),
  
  -- 执行状态
  status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled', 'preparing', 'running', 'completed', 'failed', 'cancelled')),
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER NOT NULL,
  
  -- 消息记录
  messages JSONB[] DEFAULT '{}',
  
  -- 时间信息
  scheduled_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration INTEGER, -- 秒
  
  -- 结果
  result JSONB,
  errors JSONB[] DEFAULT '{}',
  
  -- 个性化配置
  personalization JSONB DEFAULT '{}',
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 索引
  INDEX idx_conversation_executions_task_execution_id ON conversation_executions(task_execution_id),
  INDEX idx_conversation_executions_initiator_account_id ON conversation_executions(initiator_account_id),
  INDEX idx_conversation_executions_responder_account_id ON conversation_executions(responder_account_id),
  INDEX idx_conversation_executions_status ON conversation_executions(status),
  INDEX idx_conversation_executions_created_at ON conversation_executions(created_at)
);

-- 8. 通知表
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 通知内容
  type VARCHAR(50) NOT NULL CHECK (type IN ('failure', 'warning', 'info', 'success', 'system')),
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  
  -- 操作
  actions JSONB DEFAULT '[]',
  
  -- 状态
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  
  -- 元数据
  source VARCHAR(100),
  category VARCHAR(50),
  tags VARCHAR(50)[] DEFAULT '{}',
  
  -- 生命周期
  expires_at TIMESTAMPTZ,
  
  -- 自动清理时间（7天后）
  auto_delete_at TIMESTAMPTZ GENERATED ALWAYS AS (
    CASE 
      WHEN is_read = true THEN read_at + INTERVAL '7 days'
      WHEN is_archived = true THEN archived_at + INTERVAL '7 days'
      ELSE NULL
    END
  ) STORED,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 索引
  INDEX idx_notifications_user_id ON notifications(user_id),
  INDEX idx_notifications_is_read ON notifications(is_read) WHERE is_read = false,
  INDEX idx_notifications_type ON notifications(type),
  INDEX idx_notifications_priority ON notifications(priority),
  INDEX idx_notifications_created_at ON notifications(created_at DESC),
  INDEX idx_notifications_auto_delete_at ON notifications(auto_delete_at) WHERE auto_delete_at IS NOT NULL
);

-- 9. 失败记录表
CREATE TABLE failure_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 失败信息
  failure_type VARCHAR(50) NOT NULL CHECK (failure_type IN ('account', 'network', 'content', 'system')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- 关联数据
  config_id UUID REFERENCES task_configs(id),
  execution_id UUID REFERENCES task_executions(id),
  account_id UUID REFERENCES facebook_accounts(id),
  
  -- 失败详情
  error_code VARCHAR(100),
  error_message TEXT NOT NULL,
  technical_details JSONB,
  stack_trace TEXT,
  
  -- 用户友好信息
  user_message TEXT NOT NULL,
  suggested_actions JSONB DEFAULT '[]',
  
  -- 状态
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'read', 'acknowledged', 'resolved')),
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- 自动清理时间
  auto_delete_at TIMESTAMPTZ GENERATED ALWAYS AS (
    CASE 
      WHEN status = 'read' THEN read_at + INTERVAL '7 days'
      WHEN status = 'resolved' THEN resolved_at + INTERVAL '7 days'
      ELSE NULL
    END
  ) STORED,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 索引
  INDEX idx_failure_records_user_id ON failure_records(user_id),
  INDEX idx_failure_records_failure_type ON failure_records(failure_type),
  INDEX idx_failure_records_status ON failure_records(status),
  INDEX idx_failure_records_created_at ON failure_records(created_at DESC),
  INDEX idx_failure_records_auto_delete_at ON failure_records(auto_delete_at) WHERE auto_delete_at IS NOT NULL
);

-- 10. 系统配置表
CREATE TABLE system_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 配置信息
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  
  -- 作用域
  scope VARCHAR(50) DEFAULT 'global' CHECK (scope IN ('global', 'user', 'account', 'task')),
  
  -- 版本控制
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  
  -- 索引
  INDEX idx_system_configs_key ON system_configs(key),
  INDEX idx_system_configs_scope ON system_configs(scope),
  INDEX idx_system_configs_is_active ON system_configs(is_active)
);

-- 创建分区表（按月分区）
-- 任务执行表分区
CREATE TABLE task_executions_2026_04 PARTITION OF task_executions
FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- 创建复合索引
CREATE INDEX idx_user_task_status ON task_configs(user_id, status, next_execution);
CREATE INDEX idx_account_status_user ON facebook_accounts(user_id, status, updated_at);
CREATE INDEX idx_notification_user_status ON notifications(user_id, is_read, created_at DESC);

-- 插入初始系统配置
INSERT INTO system_configs (key, value, description, scope) VALUES
  ('system.version', '"1.0.0"', '系统版本号', 'global'),
  ('system.maintenance', 'false', '系统维护模式', 'global'),
  ('task.max_concurrent', '10', '最大并发任务数', 'global'),
  ('account.max_per_user', '10', '每个用户最大账号数', 'global'),
  ('retry.max_attempts', '3', '最大重试次数', 'global'),
  ('retry.delay_seconds', '300', '重试延迟秒数', 'global'),
  ('notification.retention_days', '7', '通知保留天数', 'global'),
  ('failure.retention_days', '7', '失败记录保留天数', 'global');

-- 创建更新触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表添加更新触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_facebook_accounts_updated_at BEFORE UPDATE ON facebook_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_configs_updated_at BEFORE UPDATE ON task_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversation_scripts_updated_at BEFORE UPDATE ON conversation_scripts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversation_executions_updated_at BEFORE UPDATE ON conversation_executions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_failure_records_updated_at BEFORE UPDATE ON failure_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建审计日志表
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 操作信息
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  
  -- 变更详情
  old_value JSONB,
  new_value JSONB,
  changes JSONB,
  
  -- 上下文信息
  ip_address INET,
  user_agent TEXT,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 索引
  INDEX idx_audit_logs_user_id ON audit_logs(user_id),
  INDEX idx_audit_logs_action ON audit_logs(action),
  INDEX idx_audit_logs_resource_type ON audit_logs(resource_type),
  INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC)
);

-- 创建分区表（按月分区）
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- 完成迁移
COMMENT ON DATABASE current_database IS 'Facebook Auto Bot 数据库';

-- 输出完成信息
DO $$
BEGIN
  RAISE NOTICE '数据库迁移完成！创建了10个核心表和相应的索引、触发器。';
  RAISE NOTICE '表列表: users, user_sessions, facebook_accounts, task_configs, task_executions, conversation_scripts, conversation_executions, notifications, failure_records, system_configs, audit_logs';
END $$;