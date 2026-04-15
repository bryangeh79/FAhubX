-- Phase 2.2 VPN Health Monitoring Database Schema
-- This script initializes the database with required tables and indexes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- VPN Connections Table
CREATE TABLE vpn_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('openvpn', 'wireguard')),
    name VARCHAR(255) NOT NULL,
    config_path TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'disconnected' 
        CHECK (status IN ('connected', 'disconnected', 'connecting', 'error')),
    local_ip INET,
    remote_ip INET,
    connected_at TIMESTAMP WITH TIME ZONE,
    disconnected_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- VPN Connection Stats Table
CREATE TABLE vpn_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES vpn_connections(id) ON DELETE CASCADE,
    bytes_in BIGINT NOT NULL DEFAULT 0,
    bytes_out BIGINT NOT NULL DEFAULT 0,
    packets_in BIGINT NOT NULL DEFAULT 0,
    packets_out BIGINT NOT NULL DEFAULT 0,
    latency INTEGER,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- IP Pool Table
CREATE TABLE ip_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address INET NOT NULL UNIQUE,
    vpn_connection_id UUID REFERENCES vpn_connections(id) ON DELETE SET NULL,
    country_code CHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    isp VARCHAR(255),
    is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
    blacklist_reason TEXT,
    last_used TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    total_bytes BIGINT NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Health Check Results Table
CREATE TABLE health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id VARCHAR(255),
    check_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL 
        CHECK (status IN ('healthy', 'warning', 'critical')),
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    details JSONB DEFAULT '{}',
    recommendations TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days')
);

-- Risk Assessments Table
CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id VARCHAR(255) NOT NULL,
    risk_level VARCHAR(20) NOT NULL 
        CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_score DECIMAL(3,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
    factors JSONB NOT NULL DEFAULT '[]',
    actions TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

-- Alerts Table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50) NOT NULL 
        CHECK (alert_type IN ('health', 'risk', 'vpn', 'system')),
    alert_level VARCHAR(20) NOT NULL 
        CHECK (alert_level IN ('info', 'warning', 'error', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Network Namespaces Table
CREATE TABLE network_namespaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    vpn_connection_id UUID REFERENCES vpn_connections(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Audit Log Table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_vpn_connections_status ON vpn_connections(status);
CREATE INDEX idx_vpn_connections_created_at ON vpn_connections(created_at);
CREATE INDEX idx_vpn_stats_connection_id ON vpn_stats(connection_id);
CREATE INDEX idx_vpn_stats_collected_at ON vpn_stats(collected_at);
CREATE INDEX idx_ip_pool_ip_address ON ip_pool(ip_address);
CREATE INDEX idx_ip_pool_is_blacklisted ON ip_pool(is_blacklisted);
CREATE INDEX idx_health_checks_account_id ON health_checks(account_id);
CREATE INDEX idx_health_checks_created_at ON health_checks(created_at);
CREATE INDEX idx_risk_assessments_account_id ON risk_assessments(account_id);
CREATE INDEX idx_risk_assessments_risk_level ON risk_assessments(risk_level);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_alerts_alert_level ON alerts(alert_level);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_vpn_connections_updated_at 
    BEFORE UPDATE ON vpn_connections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ip_pool_updated_at 
    BEFORE UPDATE ON ip_pool 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE VIEW vpn_connection_summary AS
SELECT 
    vc.id,
    vc.name,
    vc.type,
    vc.status,
    vc.local_ip,
    vc.remote_ip,
    vc.connected_at,
    COALESCE(vs.bytes_in, 0) as total_bytes_in,
    COALESCE(vs.bytes_out, 0) as total_bytes_out,
    vc.created_at,
    vc.updated_at
FROM vpn_connections vc
LEFT JOIN (
    SELECT 
        connection_id,
        SUM(bytes_in) as bytes_in,
        SUM(bytes_out) as bytes_out
    FROM vpn_stats
    GROUP BY connection_id
) vs ON vc.id = vs.connection_id;

CREATE VIEW health_check_summary AS
SELECT 
    account_id,
    COUNT(*) as total_checks,
    SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy_count,
    SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_count,
    SUM(CASE WHEN status = 'critical' THEN 1 ELSE 0 END) as critical_count,
    AVG(score) as average_score,
    MAX(created_at) as last_check
FROM health_checks
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY account_id;

-- Insert initial configuration data
INSERT INTO alerts (alert_type, alert_level, title, message, data) VALUES
('system', 'info', 'System Initialized', 'Phase 2.2 VPN Health Monitoring system has been initialized', '{"version": "1.0.0"}');

-- Create default admin user (password should be changed in production)
INSERT INTO audit_log (user_id, action, resource_type, resource_id, details) VALUES
('system', 'INITIALIZE_DATABASE', 'system', 'database', '{"message": "Database schema initialized successfully"}');