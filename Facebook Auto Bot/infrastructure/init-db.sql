-- Initialize Facebook Auto Bot Database
-- This script runs when PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schema for better organization (optional)
-- CREATE SCHEMA IF NOT EXISTS fab;

-- Set timezone
SET timezone = 'UTC';

-- Create super admin user (for initial setup)
-- Password will be set by application on first run
INSERT INTO users (id, email, password_hash, full_name, is_super_admin, created_at)
VALUES (
  uuid_generate_v4(),
  'admin@facebookautobot.com',
  crypt('changeme123', gen_salt('bf')), -- Will be changed on first login
  'System Administrator',
  true,
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create default tenant for testing
INSERT INTO tenants (id, slug, name, plan, status, created_at)
VALUES (
  uuid_generate_v4(),
  'demo',
  'Demo Tenant',
  'pro',
  'active',
  NOW()
) ON CONFLICT (slug) DO NOTHING;