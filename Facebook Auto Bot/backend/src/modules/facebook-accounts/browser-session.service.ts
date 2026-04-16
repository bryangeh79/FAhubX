import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

export interface BrowserSession {
  browser: any; // Puppeteer Browser
  accountId: string;
  userId?: string; // 所属用户，用于按用户隔离并发
  profileDir: string;
  proxyServer: string | null;
  proxyCredentials: { username: string; password: string } | null;
  status: 'launching' | 'ready' | 'closed';
  lastActivity: Date;
}

export interface LaunchOptions {
  proxyServer?: string;
  proxyCredentials?: { username: string; password: string } | null;
  headless?: boolean;
  userId?: string; // 传入用户ID用于并发隔离
  maxUserSessions?: number; // 该用户的最大并发数（默认=maxAccounts）
}

// 全局硬性上限（防止单台服务器 OOM）
const MAX_SESSIONS_GLOBAL = parseInt(process.env.MAX_BROWSER_SESSIONS || '30', 10);

@Injectable()
export class BrowserSessionService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserSessionService.name);
  private readonly sessions = new Map<string, BrowserSession>();
  private readonly launching = new Set<string>(); // guard concurrent launches

  async getOrLaunchSession(accountId: string, options: LaunchOptions = {}): Promise<BrowserSession> {
    // Return existing session if alive
    const existing = this.sessions.get(accountId);
    if (existing && existing.status !== 'closed') {
      try {
        // Quick health check — if browser is disconnected this throws
        await existing.browser.pages();
        existing.lastActivity = new Date();
        this.logger.log(`[${accountId}] Reusing existing browser session`);
        return existing;
      } catch {
        this.logger.warn(`[${accountId}] Existing session is dead, relaunching`);
        this.sessions.delete(accountId);
      }
    }

    // Guard against concurrent launches for same account
    if (this.launching.has(accountId)) {
      // Wait for the other launch to finish (poll every 500ms, up to 60s)
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 500));
        const s = this.sessions.get(accountId);
        if (s && s.status === 'ready') return s;
      }
      throw new Error(`[${accountId}] Browser launch timed out waiting for concurrent launch`);
    }

    // Enforce global hard limit (server protection)
    if (this.sessions.size >= MAX_SESSIONS_GLOBAL) {
      throw new Error(`服务器已达全局最大并发浏览器限制（${MAX_SESSIONS_GLOBAL}个），请稍后再试`);
    }

    // Enforce per-user session limit
    if (options.userId && options.maxUserSessions) {
      const userSessionCount = Array.from(this.sessions.values())
        .filter(s => s.userId === options.userId && s.status !== 'closed').length;
      if (userSessionCount >= options.maxUserSessions) {
        throw new Error(`您的并发浏览器已达上限（${userSessionCount}/${options.maxUserSessions}个），请等待其他任务完成`);
      }
    }

    this.launching.add(accountId);

    const profileDir = this.getProfileDir(accountId);
    this.logger.log(`[${accountId}] Launching browser | profile: ${profileDir} | proxy: ${options.proxyServer || 'none'}`);

    try {
      // Ensure profile dir exists
      fs.mkdirSync(profileDir, { recursive: true });

      // Clear stale lock file (left by crashed Chrome)
      const lockFile = path.join(profileDir, 'SingletonLock');
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
        this.logger.warn(`[${accountId}] Cleared stale SingletonLock`);
      }

      const puppeteer = require('puppeteer-extra');
      const StealthPlugin = require('puppeteer-extra-plugin-stealth');
      puppeteer.use(StealthPlugin());

      const args = this.buildArgs(profileDir, options.proxyServer);
      const headless = options.headless ?? false;

      const browser = await puppeteer.launch({
        headless,
        args,
        defaultViewport: null,
      });

      const session: BrowserSession = {
        browser,
        accountId,
        userId: options.userId || undefined,
        profileDir,
        proxyServer: options.proxyServer || null,
        proxyCredentials: options.proxyCredentials || null,
        status: 'ready',
        lastActivity: new Date(),
      };

      this.sessions.set(accountId, session);
      this.launching.delete(accountId);

      // Clean up when browser disconnects (use 'once' to auto-remove listener)
      browser.once('disconnected', () => {
        this.logger.warn(`[${accountId}] Browser disconnected`);
        const s = this.sessions.get(accountId);
        if (s) s.status = 'closed';
      });

      this.logger.log(`[${accountId}] Browser launched successfully (${this.sessions.size}/${MAX_SESSIONS_GLOBAL} active)`);
      return session;
    } catch (err) {
      this.launching.delete(accountId);
      throw err;
    }
  }

  /**
   * Open a new page on the account's browser session.
   * Automatically applies proxy authentication if credentials are configured.
   */
  async newPage(accountId: string): Promise<any> {
    const session = this.sessions.get(accountId);
    if (!session || session.status === 'closed') {
      throw new Error(`[${accountId}] No active browser session`);
    }

    const page = await session.browser.newPage();

    // Apply proxy authentication
    if (session.proxyCredentials) {
      await page.authenticate(session.proxyCredentials);
    }

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    );

    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    session.lastActivity = new Date();
    return page;
  }

  async closeSession(accountId: string): Promise<void> {
    const session = this.sessions.get(accountId);
    if (session) {
      try {
        session.browser.removeAllListeners('disconnected');
        await session.browser.close();
      } catch (_) {}
      session.status = 'closed';
      this.sessions.delete(accountId);
      this.logger.log(`[${accountId}] Browser session closed`);
    }
  }

  async closeAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    await Promise.all(ids.map(id => this.closeSession(id)));
    this.logger.log('All browser sessions closed');
  }

  getSession(accountId: string): BrowserSession | null {
    return this.sessions.get(accountId) || null;
  }

  getActiveSessions(): { accountId: string; profileDir: string; proxyServer: string | null; lastActivity: Date }[] {
    return Array.from(this.sessions.values())
      .filter(s => s.status !== 'closed')
      .map(s => ({
        accountId: s.accountId,
        profileDir: s.profileDir,
        proxyServer: s.proxyServer,
        lastActivity: s.lastActivity,
      }));
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Module destroying — closing all browser sessions...');
    await this.closeAll();
  }

  private getProfileDir(accountId: string): string {
    return path.resolve(process.cwd(), 'browser-profiles', accountId);
  }

  private buildArgs(profileDir: string, proxyServer?: string): string[] {
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--window-size=1280,800',
      '--disable-blink-features=AutomationControlled',
      `--user-data-dir=${profileDir}`,
    ];

    if (proxyServer) {
      args.push(`--proxy-server=${proxyServer}`);
    }

    return args;
  }
}
