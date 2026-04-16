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
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  email_verified BOOLEAN DEFAULT false,
  two_factor_enabled BOOLEAN DEFAULT false,
  full_name VARCHAR(200),
  avatar_url TEXT,
  timezone VARCHAR(50) DEFAULT 'UTC',
  language VARCHAR(10) DEFAULT 'en',
  preferences JSONB DEFAULT '{}',
  total_logins INTEGER DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- 2. 用户会话表
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token VARCHAR(512) NOT NULL,
  refresh_token VARCHAR(512) NOT NULL,
  device_info JSONB NOT NULL DEFAULT '{}',
  user_agent TEXT,
  ip_address INET,
  is_active BOOLEAN DEFAULT true,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_access_token ON user_sessions(access_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at) WHERE is_active = true;

-- 3. Facebook账号表
CREATE TABLE facebook_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  display_name VARCHAR(200),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'banned', 'suspended')),
  last_status_check TIMESTAMPTZ,
  status_reason TEXT,
  session_data BYTEA,
  session_updated_at TIMESTAMPTZ,
  session_hash VARCHAR(64),
  vpn_config JSONB,
  current_ip INET,
  geo_location JSONB,
  last_vpn_check TIMESTAMPTZ,
  tags VARCHAR(50)[] DEFAULT '{}',
  category VARCHAR(50),
  total_tasks INTEGER DEFAULT 0,
  successful_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, username)
);
CREATE INDEX idx_facebook_accounts_user_id ON facebook_accounts(user_id);
CREATE INDEX idx_facebook_accounts_status ON facebook_accounts(status);
CREATE INDEX idx_facebook_accounts_tags ON facebook_accounts USING GIN(tags);
CREATE INDEX idx_facebook_accounts_updated_at ON facebook_accounts(updated_at);

-- 4. 任务配置表
CREATE TABLE task_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('conversation', 'post', 'like', 'share', 'friend', 'group')),
  template_id UUID,
  parameters JSONB NOT NULL DEFAULT '{}',
  source_account_id UUID NOT NULL REFERENCES facebook_accounts(id),
  target_account_ids UUID[] DEFAULT '{}',
  schedule JSONB NOT NULL DEFAULT '{}',
  next_execution TIMESTAMPTZ,
  retry_policy JSONB DEFAULT '{"maxRetries": 3, "retryDelay": 300}',
  failure_handling JSONB DEFAULT '{"notifyOnFailure": true, "autoPause": false}',
  notification_config JSONB DEFAULT '{"notifyOnStart": false, "notifyOnComplete": false}',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'error')),
  last_execution TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_task_configs_user_id ON task_configs(user_id);
CREATE INDEX idx_task_configs_source_account_id ON task_configs(source_account_id);
CREATE INDEX idx_task_configs_status ON task_configs(status);
CREATE INDEX idx_task_configs_next_execution ON task_configs(next_execution) WHERE status = 'active';
CREATE INDEX idx_task_configs_created_at ON task_configs(created_at);

-- 5. 任务执行表
CREATE TABLE task_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES task_configs(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration INTEGER,
  result JSONB,
  error JSONB,
  account_id UUID REFERENCES facebook_accounts(id),
  vpn_used VARCHAR(100),
  ip_used INET,
  logs JSONB[] DEFAULT '{}',
  metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_task_executions_config_id ON task_executions(config_id);
CREATE INDEX idx_task_executions_status ON task_executions(status);
CREATE INDEX idx_task_executions_start_time ON task_executions(start_time);
CREATE INDEX idx_task_executions_account_id ON task_executions(account_id);
CREATE INDEX idx_task_executions_created_at ON task_executions(created_at);

-- 6. 对话剧本表
CREATE TABLE conversation_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('casual', 'business', 'hobby', 'current_events')),
  relationship VARCHAR(50) NOT NULL CHECK (relationship IN ('friends', 'colleagues', 'acquaintances')),
  time_of_day VARCHAR(20) CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'any')),
  flow JSONB NOT NULL,
  variations JSONB DEFAULT '{}',
  estimated_duration INTEGER NOT NULL,
  difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags VARCHAR(50)[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.0,
  average_rating DECIMAL(3,2),
  total_ratings INTEGER DEFAULT 0,
  version VARCHAR(20) DEFAULT '1.0.0',
  is_active BOOLEAN DEFAULT true,
  deprecated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_conversation_scripts_category ON conversation_scripts(category);
CREATE INDEX idx_conversation_scripts_relationship ON conversation_scripts(relationship);
CREATE INDEX idx_conversation_scripts_tags ON conversation_scripts USING GIN(tags);
CREATE INDEX idx_conversation_scripts_is_active ON conversation_scripts(is_active);
CREATE INDEX idx_conversation_scripts_usage_count ON conversation_scripts(usage_count DESC);

-- 7. 对话执行表
CREATE TABLE conversation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_execution_id UUID NOT NULL REFERENCES task_executions(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES conversation_scripts(id),
  initiator_account_id UUID NOT NULL REFERENCES facebook_accounts(id),
  responder_account_id UUID NOT NULL REFERENCES facebook_accounts(id),
  status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled', 'preparing', 'running', 'completed', 'failed', 'cancelled')),
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER NOT NULL,
  messages JSONB[] DEFAULT '{}',
  scheduled_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration INTEGER,
  result JSONB,
  errors JSONB[] DEFAULT '{}',
  personalization JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_conversation_executions_task_execution_id ON conversation_executions(task_execution_id);
CREATE INDEX idx_conversation_executions_initiator ON conversation_executions(initiator_account_id);
CREATE INDEX idx_conversation_executions_responder ON conversation_executions(responder_account_id);
CREATE INDEX idx_conversation_executions_status ON conversation_executions(status);
CREATE INDEX idx_conversation_executions_created_at ON conversation_executions(created_at);

-- 8. 通知表
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('failure', 'warning', 'info', 'success', 'system')),
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  actions JSONB DEFAULT '[]',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  source VARCHAR(100),
  category VARCHAR(50),
  tags VARCHAR(50)[] DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- 9. 失败记录表
CREATE TABLE failure_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  failure_type VARCHAR(50) NOT NULL CHECK (failure_type IN ('account', 'network', 'content', 'system')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  config_id UUID REFERENCES task_configs(id),
  execution_id UUID REFERENCES task_executions(id),
  account_id UUID REFERENCES facebook_accounts(id),
  error_code VARCHAR(100),
  error_message TEXT NOT NULL,
  technical_details JSONB,
  stack_trace TEXT,
  user_message TEXT NOT NULL,
  suggested_actions JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'read', 'acknowledged', 'resolved')),
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_failure_records_user_id ON failure_records(user_id);
CREATE INDEX idx_failure_records_failure_type ON failure_records(failure_type);
CREATE INDEX idx_failure_records_status ON failure_records(status);
CREATE INDEX idx_failure_records_created_at ON failure_records(created_at DESC);

-- 10. 系统配置表
CREATE TABLE system_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  scope VARCHAR(50) DEFAULT 'global' CHECK (scope IN ('global', 'user', 'account', 'task')),
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);
CREATE INDEX idx_system_configs_key ON system_configs(key);
CREATE INDEX idx_system_configs_scope ON system_configs(scope);
CREATE INDEX idx_system_configs_is_active ON system_configs(is_active);

-- 11. 审计日志表
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 复合索引
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

-- 更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_facebook_accounts_updated_at BEFORE UPDATE ON facebook_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_configs_updated_at BEFORE UPDATE ON task_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversation_scripts_updated_at BEFORE UPDATE ON conversation_scripts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversation_executions_updated_at BEFORE UPDATE ON conversation_executions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_failure_records_updated_at BEFORE UPDATE ON failure_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
  RAISE NOTICE 'Database migration complete! Created 11 tables with indexes and triggers.';
END $$;
