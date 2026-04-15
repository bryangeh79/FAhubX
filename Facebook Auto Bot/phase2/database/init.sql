-- Facebook Auto Bot Phase 2.2 数据库初始化脚本
-- 会话管理、VPN配置、健康监控相关表结构

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 会话存储表
CREATE TABLE IF NOT EXISTS browser_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL UNIQUE,
    account_id VARCHAR(255) NOT NULL,
    user_id UUID, -- 关联系统用户（如果有多用户系统）
    
    -- 会话数据（加密存储）
    cookies_encrypted BYTEA NOT NULL,
    localStorage_encrypted BYTEA,
    session_data_encrypted BYTEA, -- 其他会话数据
    
    -- 元数据
    user_agent TEXT,
    viewport_width INTEGER,
    viewport_height INTEGER,
    stealth_mode BOOLEAN DEFAULT true,
    human_behavior BOOLEAN DEFAULT true,
    
    -- 状态信息
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'error')),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    error_count INTEGER DEFAULT 0,
    
    -- VPN/IP信息
    vpn_config_id UUID,
    ip_address INET,
    country_code CHAR(2),
    city VARCHAR(100),
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
    
    -- 索引
    INDEX idx_sessions_account_id (account_id),
    INDEX idx_sessions_status (status),
    INDEX idx_sessions_last_activity (last_activity),
    INDEX idx_sessions_expires_at (expires_at),
    INDEX idx_sessions_vpn_config (vpn_config_id)
);

-- VPN配置表
CREATE TABLE IF NOT EXISTS vpn_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    vpn_type VARCHAR(50) NOT NULL CHECK (vpn_type IN ('openvpn', 'wireguard', 'socks5', 'http_proxy')),
    
    -- VPN连接配置（加密存储）
    config_encrypted BYTEA NOT NULL,
    credentials_encrypted BYTEA,
    
    -- 网络信息
    server_host VARCHAR(255) NOT NULL,
    server_port INTEGER NOT NULL,
    protocol VARCHAR(10) DEFAULT 'udp',
    
    -- IP信息
    ip_address INET,
    country_code CHAR(2),
    city VARCHAR(100),
    isp VARCHAR(255),
    
    -- 连接状态
    status VARCHAR(50) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'maintenance')),
    last_connected TIMESTAMP WITH TIME ZONE,
    connection_count INTEGER DEFAULT 0,
    total_uptime BIGINT DEFAULT 0, -- 秒
    
    -- 性能指标
    avg_latency INTEGER,
    avg_download_speed INTEGER, -- KB/s
    avg_upload_speed INTEGER, -- KB/s
    success_rate DECIMAL(5,2) DEFAULT 100.00,
    
    -- 限制和配额
    max_concurrent_connections INTEGER DEFAULT 1,
    daily_data_limit BIGINT, -- 字节
    monthly_data_limit BIGINT, -- 字节
    
    -- 元数据
    tags TEXT[], -- 用于分类和过滤
    notes TEXT,
    is_default BOOLEAN DEFAULT false,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    INDEX idx_vpn_configs_status (status),
    INDEX idx_vpn_configs_country (country_code),
    INDEX idx_vpn_configs_type (vpn_type),
    UNIQUE (name, vpn_type)
);

-- 账号健康监控表
CREATE TABLE IF NOT EXISTS account_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    
    -- 健康状态
    health_status VARCHAR(50) DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'warning', 'critical', 'banned', 'disabled')),
    health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
    
    -- 检测结果
    last_login_status BOOLEAN,
    last_login_time TIMESTAMP WITH TIME ZONE,
    login_success_rate DECIMAL(5,2) DEFAULT 100.00,
    
    -- 风险指标
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    ban_risk_score INTEGER DEFAULT 0,
    restriction_detected BOOLEAN DEFAULT false,
    suspicious_activity_detected BOOLEAN DEFAULT false,
    
    -- 性能指标
    avg_response_time INTEGER, -- 毫秒
    success_rate DECIMAL(5,2) DEFAULT 100.00,
    error_count_24h INTEGER DEFAULT 0,
    
    -- 操作统计
    posts_count_24h INTEGER DEFAULT 0,
    likes_count_24h INTEGER DEFAULT 0,
    comments_count_24h INTEGER DEFAULT 0,
    friends_added_24h INTEGER DEFAULT 0,
    
    -- 检测详情（JSON格式）
    check_results JSONB,
    warnings JSONB,
    errors JSONB,
    
    -- 时间戳
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    INDEX idx_account_health_account_id (account_id),
    INDEX idx_account_health_status (health_status),
    INDEX idx_account_health_risk (risk_level),
    INDEX idx_account_health_checked (checked_at),
    UNIQUE (account_id)
);

-- 监控指标表
CREATE TABLE IF NOT EXISTS monitoring_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255), -- 会话ID、账号ID、VPN配置ID等
    resource_type VARCHAR(50), -- 'session', 'account', 'vpn', 'system'
    
    -- 指标值
    value_numeric DOUBLE PRECISION,
    value_string TEXT,
    value_json JSONB,
    
    -- 标签（用于过滤和分组）
    tags JSONB,
    
    -- 时间戳
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    INDEX idx_monitoring_metric_type (metric_type),
    INDEX idx_monitoring_resource (resource_type, resource_id),
    INDEX idx_monitoring_collected (collected_at)
);

-- 告警规则表
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- 规则配置
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('threshold', 'pattern', 'anomaly')),
    resource_type VARCHAR(50) NOT NULL, -- 监控的资源类型
    metric_name VARCHAR(100) NOT NULL,
    
    -- 条件配置（JSON格式）
    conditions JSONB NOT NULL,
    
    -- 告警配置
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    cooldown_period INTEGER DEFAULT 300, -- 冷却时间（秒）
    enabled BOOLEAN DEFAULT true,
    
    -- 通知配置
    notification_channels TEXT[], -- 'email', 'slack', 'webhook', 'sms'
    notification_template TEXT,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    INDEX idx_alert_rules_enabled (enabled),
    INDEX idx_alert_rules_resource (resource_type),
    UNIQUE (name)
);

-- 告警历史表
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    alert_name VARCHAR(255) NOT NULL,
    
    -- 告警详情
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    severity VARCHAR(20) NOT NULL,
    
    -- 触发数据
    triggered_value TEXT,
    threshold_value TEXT,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 状态
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'suppressed')),
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- 详情
    message TEXT NOT NULL,
    details JSONB,
    
    -- 索引
    INDEX idx_alert_history_status (status),
    INDEX idx_alert_history_severity (severity),
    INDEX idx_alert_history_triggered (triggered_at),
    INDEX idx_alert_history_resource (resource_type, resource_id)
);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有表添加更新时间触发器
CREATE TRIGGER update_browser_sessions_updated_at 
    BEFORE UPDATE ON browser_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vpn_configs_updated_at 
    BEFORE UPDATE ON vpn_configs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_health_updated_at 
    BEFORE UPDATE ON account_health 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at 
    BEFORE UPDATE ON alert_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建会话清理函数
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM browser_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP 
       OR (status = 'inactive' AND last_activity < CURRENT_TIMESTAMP - INTERVAL '7 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 创建健康状态更新函数
CREATE OR REPLACE FUNCTION update_account_health_score()
RETURNS TRIGGER AS $$
BEGIN
    -- 根据各种指标计算健康分数
    NEW.health_score := 
        CASE 
            WHEN NEW.login_success_rate IS NULL THEN 100
            WHEN NEW.login_success_rate < 50 THEN 20
            WHEN NEW.login_success_rate < 80 THEN 60
            WHEN NEW.login_success_rate < 95 THEN 80
            ELSE 100
        END -
        CASE 
            WHEN NEW.ban_risk_score > 80 THEN 50
            WHEN NEW.ban_risk_score > 60 THEN 30
            WHEN NEW.ban_risk_score > 40 THEN 15
            WHEN NEW.ban_risk_score > 20 THEN 5
            ELSE 0
        END -
        CASE 
            WHEN NEW.error_count_24h > 100 THEN 30
            WHEN NEW.error_count_24h > 50 THEN 20
            WHEN NEW.error_count_24h > 20 THEN 10
            WHEN NEW.error_count_24h > 5 THEN 5
            ELSE 0
        END;
    
    -- 根据健康分数更新健康状态
    NEW.health_status := 
        CASE 
            WHEN NEW.health_score >= 80 THEN 'healthy'
            WHEN NEW.health_score >= 60 THEN 'warning'
            WHEN NEW.health_score >= 30 THEN 'critical'
            ELSE 'disabled'
        END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为account_health表添加触发器
CREATE TRIGGER update_health_score_trigger
    BEFORE INSERT OR UPDATE ON account_health
    FOR EACH ROW EXECUTE FUNCTION update_account_health_score();

-- 插入默认告警规则
INSERT INTO alert_rules (name, description, rule_type, resource_type, metric_name, conditions, severity, notification_channels) VALUES
('高错误率告警', '会话错误率超过阈值', 'threshold', 'session', 'error_rate', '{"operator": ">", "value": 0.1}', 'error', ARRAY['email', 'slack']),
('登录失败告警', '连续登录失败', 'pattern', 'account', 'login_failures', '{"pattern": "consecutive_failures", "count": 3}', 'warning', ARRAY['slack']),
('账号封禁风险', '账号封禁风险分数过高', 'threshold', 'account', 'ban_risk_score', '{"operator": ">", "value": 70}', 'critical', ARRAY['email', 'slack', 'sms']),
('VPN连接失败', 'VPN连接状态异常', 'anomaly', 'vpn', 'connection_status', '{"anomaly_type": "status_change", "expected": "active"}', 'error', ARRAY['slack']),
('系统资源不足', '系统内存或CPU使用率过高', 'threshold', 'system', 'resource_usage', '{"operator": ">", "value": 0.9}', 'critical', ARRAY['email', 'slack']);

-- 创建只读用户（如果需要在应用中分离权限）
-- CREATE USER monitor_user WITH PASSWORD 'monitor_password';
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitor_user;

-- 创建数据统计视图
CREATE VIEW session_statistics AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as error_sessions,
    AVG(error_count) as avg_errors_per_session
FROM browser_sessions
GROUP BY DATE(created_at);

CREATE VIEW vpn_performance AS
SELECT 
    vpn_type,
    COUNT(*) as total_configs,
    AVG(avg_latency) as avg_latency,
    AVG(avg_download_speed) as avg_download,
    AVG(avg_upload_speed) as avg_upload,
    AVG(success_rate) as avg_success_rate
FROM vpn_configs
WHERE status = 'active'
GROUP BY vpn_type;

CREATE VIEW account_health_summary AS
SELECT 
    health_status,
    COUNT(*) as account_count,
    AVG(health_score) as avg_health_score,
    AVG(ban_risk_score) as avg_risk_score,
    AVG(login_success_rate) as avg_login_success
FROM account_health
GROUP BY health_status;

-- 注释
COMMENT ON TABLE browser_sessions IS '浏览器会话存储，包含加密的cookies和会话数据';
COMMENT ON TABLE vpn_configs IS 'VPN配置管理，支持多种VPN类型';
COMMENT ON TABLE account_health IS '账号健康状态监控和风险评估';
COMMENT ON TABLE monitoring_metrics IS '监控指标收集，用于分析和告警';
COMMENT ON TABLE alert_rules IS '告警规则定义';
COMMENT ON TABLE alert_history IS '告警历史记录';

-- 输出完成信息
DO $$
BEGIN
    RAISE NOTICE '数据库初始化完成！';
    RAISE NOTICE '创建的表:';
    RAISE NOTICE '  - browser_sessions (浏览器会话)';
    RAISE NOTICE '  - vpn_configs (VPN配置)';
    RAISE NOTICE '  - account_health (账号健康)';
    RAISE NOTICE '  - monitoring_metrics (监控指标)';
    RAISE NOTICE '  - alert_rules (告警规则)';
    RAISE NOTICE '  - alert_history (告警历史)';
    RAISE NOTICE '创建的视图:';
    RAISE NOTICE '  - session_statistics (会话统计)';
    RAISE NOTICE '  - vpn_performance (VPN性能)';
    RAISE NOTICE '  - account_health_summary (账号健康摘要)';
END $$;