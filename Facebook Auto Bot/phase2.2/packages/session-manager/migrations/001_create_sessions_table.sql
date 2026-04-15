-- 创建会话表
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- 加密字段
    encrypted_cookies TEXT NOT NULL,
    encrypted_local_storage TEXT,
    encryption_iv VARCHAR(64) NOT NULL,
    encryption_tag VARCHAR(64) NOT NULL,
    
    -- 元数据
    user_agent TEXT,
    viewport_width INTEGER,
    viewport_height INTEGER,
    stealth_mode BOOLEAN DEFAULT true,
    human_behavior BOOLEAN DEFAULT true,
    
    -- 状态信息
    status VARCHAR(50) DEFAULT 'active',
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    error_count INTEGER DEFAULT 0,
    
    -- 会话信息
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- 索引
    INDEX idx_account_id (account_id),
    INDEX idx_session_id (session_id),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at),
    INDEX idx_last_activity (last_activity)
);

-- 创建会话活动日志表
CREATE TABLE IF NOT EXISTS session_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    
    -- 活动信息
    activity_type VARCHAR(50) NOT NULL, -- 'login', 'task', 'error', 'cleanup'
    activity_data JSONB,
    
    -- 性能指标
    duration_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    INDEX idx_session_id (session_id),
    INDEX idx_account_id (account_id),
    INDEX idx_activity_type (activity_type),
    INDEX idx_created_at (created_at)
);

-- 创建会话统计表
CREATE TABLE IF NOT EXISTS session_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(255) NOT NULL,
    
    -- 统计信息
    total_sessions INTEGER DEFAULT 0,
    active_sessions INTEGER DEFAULT 0,
    failed_sessions INTEGER DEFAULT 0,
    total_duration_ms BIGINT DEFAULT 0,
    avg_duration_ms INTEGER DEFAULT 0,
    
    -- 时间窗口
    stat_date DATE NOT NULL,
    stat_hour INTEGER,
    
    -- 更新时间
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 唯一约束
    UNIQUE(account_id, stat_date, stat_hour),
    
    -- 索引
    INDEX idx_account_id (account_id),
    INDEX idx_stat_date (stat_date)
);

-- 创建函数：更新会话最后活动时间
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.last_activity = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：自动更新会话活动时间
CREATE TRIGGER update_session_activity_trigger
BEFORE UPDATE ON sessions
FOR EACH ROW
EXECUTE FUNCTION update_session_activity();

-- 创建函数：清理过期会话
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions 
    WHERE expires_at IS NOT NULL 
      AND expires_at < CURRENT_TIMESTAMP
      AND status != 'deleted';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- 记录清理活动
    INSERT INTO session_activities (
        session_id,
        account_id,
        activity_type,
        activity_data,
        success,
        created_at
    ) VALUES (
        'system',
        'system',
        'cleanup',
        jsonb_build_object('deleted_count', deleted_count),
        true,
        CURRENT_TIMESTAMP
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：更新会话统计
CREATE OR REPLACE FUNCTION update_session_stats()
RETURNS TRIGGER AS $$
DECLARE
    current_hour INTEGER;
    current_date DATE;
BEGIN
    current_date := CURRENT_DATE;
    current_hour := EXTRACT(HOUR FROM CURRENT_TIMESTAMP);
    
    -- 更新会话统计
    INSERT INTO session_stats (
        account_id,
        stat_date,
        stat_hour,
        total_sessions,
        active_sessions,
        failed_sessions,
        total_duration_ms,
        avg_duration_ms,
        updated_at
    ) VALUES (
        NEW.account_id,
        current_date,
        current_hour,
        1,
        CASE WHEN NEW.status = 'active' THEN 1 ELSE 0 END,
        CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
        0,
        0,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (account_id, stat_date, stat_hour) 
    DO UPDATE SET
        total_sessions = session_stats.total_sessions + 1,
        active_sessions = session_stats.active_sessions + 
            CASE WHEN NEW.status = 'active' THEN 1 ELSE 0 END,
        failed_sessions = session_stats.failed_sessions + 
            CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：自动更新会话统计
CREATE TRIGGER update_session_stats_trigger
AFTER INSERT ON sessions
FOR EACH ROW
EXECUTE FUNCTION update_session_stats();

-- 创建视图：会话概览
CREATE OR REPLACE VIEW session_overview AS
SELECT 
    s.id,
    s.account_id,
    s.session_id,
    s.status,
    s.last_activity,
    s.error_count,
    s.created_at,
    s.expires_at,
    s.updated_at,
    
    -- 计算会话年龄（分钟）
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.created_at)) / 60 AS age_minutes,
    
    -- 计算空闲时间（分钟）
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.last_activity)) / 60 AS idle_minutes,
    
    -- 统计活动数量
    COALESCE(a.activity_count, 0) AS activity_count,
    
    -- 最近活动类型
    a.recent_activity_type
    
FROM sessions s
LEFT JOIN (
    SELECT 
        session_id,
        COUNT(*) AS activity_count,
        MAX(activity_type) AS recent_activity_type
    FROM session_activities
    GROUP BY session_id
) a ON s.session_id = a.session_id
WHERE s.status != 'deleted';

-- 创建索引优化
CREATE INDEX IF NOT EXISTS idx_sessions_composite ON sessions (account_id, status, last_activity);
CREATE INDEX IF NOT EXISTS idx_session_activities_composite ON session_activities (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_stats_composite ON session_stats (account_id, stat_date DESC, stat_hour DESC);

-- 添加注释
COMMENT ON TABLE sessions IS '加密的会话存储表';
COMMENT ON COLUMN sessions.encrypted_cookies IS 'AES-256-GCM加密的cookies数据';
COMMENT ON COLUMN sessions.encryption_iv IS '加密初始化向量';
COMMENT ON COLUMN sessions.encryption_tag IS 'GCM认证标签';

COMMENT ON TABLE session_activities IS '会话活动日志表';
COMMENT ON TABLE session_stats IS '会话统计表';
COMMENT ON VIEW session_overview IS '会话概览视图';