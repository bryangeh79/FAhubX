import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { getMachineId } from './machine-id.util';

export interface LicenseState {
  valid: boolean;
  licenseKey: string | null;
  machineId: string;
  plan: string;
  maxAccounts: number;
  maxTasks: number;
  expiresAt: string | null;
  lastVerified: string;       // ISO timestamp of last successful heartbeat
  error: string | null;
}

const CACHE_FILE = path.join(process.cwd(), 'license-cache.json');
const OFFLINE_GRACE_HOURS = 24;

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private state: LicenseState;
  private readonly machineId: string;
  private readonly serverUrl: string;
  private readonly isLocalMode: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.isLocalMode = this.configService.get('DEPLOY_MODE') === 'local';
    this.machineId = getMachineId();
    this.serverUrl = this.configService.get('LICENSE_SERVER_URL', 'https://license.starbright-solutions.com');

    // Initialize with invalid state
    this.state = {
      valid: false,
      licenseKey: this.configService.get('LICENSE_KEY', null),
      machineId: this.machineId,
      plan: 'basic',
      maxAccounts: 0,
      maxTasks: 0,
      expiresAt: null,
      lastVerified: '',
      error: 'Not yet verified',
    };
  }

  async onModuleInit() {
    if (!this.isLocalMode) return;

    this.logger.log(`🔑 License module initialized (machine: ${this.machineId.substring(0, 8)}...)`);

    // Try to load cached state
    this.loadCache();

    // If we have a license key, verify immediately
    if (this.state.licenseKey) {
      await this.sendHeartbeat();
    } else {
      this.logger.warn('⚠️ No LICENSE_KEY configured. System needs activation.');
    }
  }

  /** Heartbeat runs every 30 minutes (only in local mode) */
  @Cron('0 */30 * * * *')
  async scheduledHeartbeat() {
    if (!this.isLocalMode) return;
    if (!this.state.licenseKey) return;
    await this.sendHeartbeat();
  }

  /** Activate a license key (called from controller on first setup) */
  async activate(licenseKey: string): Promise<{ success: boolean; error?: string; license?: any }> {
    try {
      const { default: axios } = await import('axios');
      const res = await axios.post(`${this.serverUrl}/activate`, {
        licenseKey,
        machineId: this.machineId,
      }, { timeout: 15000 });

      if (res.data.success) {
        this.state = {
          valid: true,
          licenseKey,
          machineId: this.machineId,
          plan: res.data.license.plan,
          maxAccounts: res.data.license.maxAccounts,
          maxTasks: res.data.license.maxTasks,
          expiresAt: res.data.license.expiresAt,
          lastVerified: new Date().toISOString(),
          error: null,
        };
        this.saveCache();
        this.logger.log(`✅ License activated: ${licenseKey} (${res.data.license.plan}, ${res.data.license.maxAccounts} accounts)`);
        return { success: true, license: res.data.license };
      }

      return { success: false, error: res.data.error || 'Activation failed' };
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message;
      this.logger.error(`❌ Activation failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  /** Send heartbeat to license server */
  private async sendHeartbeat(): Promise<void> {
    if (!this.state.licenseKey) return;

    try {
      // Count current usage
      let currentAccounts = 0;
      let currentTasks = 0;
      try {
        const [accRow] = await this.dataSource.query(`SELECT COUNT(*) as c FROM facebook_accounts WHERE "deletedAt" IS NULL`);
        currentAccounts = parseInt(accRow?.c || '0', 10);
        const [taskRow] = await this.dataSource.query(`SELECT COUNT(*) as c FROM tasks WHERE status NOT IN ('completed','failed','cancelled')`);
        currentTasks = parseInt(taskRow?.c || '0', 10);
      } catch { /* DB might not be ready yet */ }

      const { default: axios } = await import('axios');
      const res = await axios.post(`${this.serverUrl}/heartbeat`, {
        licenseKey: this.state.licenseKey,
        machineId: this.machineId,
        currentAccounts,
        currentTasks,
        version: '1.0.0',
      }, { timeout: 15000 });

      if (res.data.valid) {
        this.state.valid = true;
        this.state.plan = res.data.plan || this.state.plan;
        this.state.maxAccounts = res.data.maxAccounts ?? this.state.maxAccounts;
        this.state.maxTasks = res.data.maxTasks ?? this.state.maxTasks;
        this.state.expiresAt = res.data.expiresAt;
        this.state.lastVerified = new Date().toISOString();
        this.state.error = null;
        this.saveCache();
        this.logger.log(`💓 Heartbeat OK (${this.state.plan}, ${currentAccounts}/${this.state.maxAccounts} accounts)`);
      } else {
        this.state.valid = false;
        this.state.error = res.data.error || 'License invalid';
        this.saveCache();
        this.logger.warn(`⚠️ Heartbeat rejected: ${this.state.error}`);
      }
    } catch (err: any) {
      // Network error — check offline grace period
      const hoursSinceVerified = this.getHoursSinceLastVerified();
      if (hoursSinceVerified < OFFLINE_GRACE_HOURS) {
        this.logger.warn(`⚠️ Heartbeat failed (offline ${hoursSinceVerified.toFixed(1)}h / ${OFFLINE_GRACE_HOURS}h grace), using cache`);
      } else {
        this.state.valid = false;
        this.state.error = `Offline for over ${OFFLINE_GRACE_HOURS} hours. Please check your internet connection.`;
        this.saveCache();
        this.logger.error(`❌ Offline grace period expired — system locked`);
      }
    }
  }

  // ── Public getters (used by guards and services) ────────────────────────

  isValid(): boolean {
    if (!this.isLocalMode) return true; // cloud mode always valid
    if (!this.state.valid) return false;

    // Double-check offline grace period
    const hours = this.getHoursSinceLastVerified();
    if (hours >= OFFLINE_GRACE_HOURS) {
      this.state.valid = false;
      this.state.error = 'Offline grace period expired';
      return false;
    }

    return true;
  }

  isActivated(): boolean {
    return !!this.state.licenseKey;
  }

  getMaxAccounts(): number {
    return this.state.maxAccounts;
  }

  getMaxTasks(): number {
    return this.state.maxTasks;
  }

  getPlan(): string {
    return this.state.plan;
  }

  getState(): LicenseState {
    return { ...this.state };
  }

  getError(): string | null {
    return this.state.error;
  }

  isLocalDeployment(): boolean {
    return this.isLocalMode;
  }

  // ── Cache management ────────────────────────────────────────────────────

  private saveCache(): void {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.state, null, 2));
    } catch (err: any) {
      this.logger.warn(`Failed to save license cache: ${err.message}`);
    }
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        // Restore cached state but check grace period
        this.state = { ...this.state, ...data };
        if (this.state.licenseKey) {
          const hours = this.getHoursSinceLastVerified();
          if (hours < OFFLINE_GRACE_HOURS) {
            this.logger.log(`📦 Loaded license cache (verified ${hours.toFixed(1)}h ago)`);
          } else {
            this.state.valid = false;
            this.state.error = 'Cache expired (offline too long)';
            this.logger.warn(`📦 License cache expired (${hours.toFixed(1)}h since last verify)`);
          }
        }
      }
    } catch {
      this.logger.warn('No license cache found');
    }
  }

  private getHoursSinceLastVerified(): number {
    if (!this.state.lastVerified) return Infinity;
    return (Date.now() - new Date(this.state.lastVerified).getTime()) / (1000 * 60 * 60);
  }
}
