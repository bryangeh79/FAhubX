export interface PuppeteerConfig {
  headless: boolean | 'new';
  args: string[];
  defaultViewport: {
    width: number;
    height: number;
  };
  ignoreHTTPSErrors: boolean;
  executablePath?: string;
  userDataDir?: string;
  slowMo?: number;
}

export interface SessionConfig {
  sessionId: string;
  accountId: string;
  cookies?: any[];
  localStorage?: Record<string, string>;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  stealthMode: boolean;
  humanBehavior: boolean;
}

export interface BrowserSession {
  id: string;
  browser: any; // puppeteer.Browser
  page: any; // puppeteer.Page
  config: SessionConfig;
  status: 'idle' | 'busy' | 'error' | 'closed';
  lastActivity: Date;
  errorCount: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface LoginResult {
  success: boolean;
  sessionId?: string;
  cookies?: any[];
  error?: string;
  requiresTwoFactor?: boolean;
  requiresCaptcha?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  screenshots?: string[];
}

export interface HumanBehaviorOptions {
  minDelay: number;
  maxDelay: number;
  mouseMovement: boolean;
  randomScroll: boolean;
  typingSpeed: 'slow' | 'normal' | 'fast';
}