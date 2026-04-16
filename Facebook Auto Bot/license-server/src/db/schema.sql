-- FAhubX License Server Database Schema
-- Cloudflare D1 (SQLite-compatible)

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  license_key TEXT UNIQUE NOT NULL,
  tenant_name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'basic',
  max_accounts INTEGER NOT NULL DEFAULT 10,
  max_tasks INTEGER NOT NULL DEFAULT 50,
  machine_id TEXT,
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_heartbeat TEXT,
  last_ip TEXT,
  current_accounts INTEGER DEFAULT 0,
  current_tasks INTEGER DEFAULT 0,
  app_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_license_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_active ON licenses(active);
