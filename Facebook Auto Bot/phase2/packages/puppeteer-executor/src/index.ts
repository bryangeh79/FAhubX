export { PuppeteerExecutor } from './core/puppeteer-executor';
export { FacebookLoginModule } from './modules/facebook-login';
export { HumanBehaviorSimulator } from './utils/human-behavior';
export { SessionLogger } from './utils/logger';

export type {
  PuppeteerConfig,
  SessionConfig,
  BrowserSession,
  LoginCredentials,
  LoginResult,
  ExecutionResult,
  HumanBehaviorOptions
} from './types';