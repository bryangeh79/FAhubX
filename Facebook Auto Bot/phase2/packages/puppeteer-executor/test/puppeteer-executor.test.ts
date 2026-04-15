import { PuppeteerExecutor } from '../src/core/puppeteer-executor';
import { HumanBehaviorSimulator } from '../src/utils/human-behavior';

describe('PuppeteerExecutor', () => {
  let executor: PuppeteerExecutor;

  beforeAll(() => {
    executor = new PuppeteerExecutor({
      headless: 'new', // 测试时使用headless模式
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await executor.destroy();
  });

  describe('Session Management', () => {
    test('should create a new session', async () => {
      const session = await executor.createSession({
        sessionId: 'test-session-1',
        stealthMode: true
      });

      expect(session).toBeDefined();
      expect(session.id).toBe('test-session-1');
      expect(session.status).toBe('idle');
      expect(session.config.stealthMode).toBe(true);

      await executor.closeSession(session.id);
    });

    test('should get existing session', async () => {
      const session = await executor.createSession({
        sessionId: 'test-session-2'
      });

      const retrievedSession = executor.getSession('test-session-2');
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.id).toBe(session.id);

      await executor.closeSession(session.id);
    });

    test('should return undefined for non-existent session', () => {
      const session = executor.getSession('non-existent');
      expect(session).toBeUndefined();
    });

    test('should list active sessions', async () => {
      const session1 = await executor.createSession({
        sessionId: 'test-session-3'
      });
      const session2 = await executor.createSession({
        sessionId: 'test-session-4'
      });

      const activeSessions = executor.getActiveSessions();
      expect(activeSessions.length).toBeGreaterThanOrEqual(2);
      expect(activeSessions.map(s => s.id)).toContain('test-session-3');
      expect(activeSessions.map(s => s.id)).toContain('test-session-4');

      await executor.closeSession(session1.id);
      await executor.closeSession(session2.id);
    });
  });

  describe('Task Execution', () => {
    let sessionId: string;

    beforeEach(async () => {
      const session = await executor.createSession({
        sessionId: 'task-test-session'
      });
      sessionId = session.id;
    });

    afterEach(async () => {
      await executor.closeSession(sessionId);
    });

    test('should execute simple task successfully', async () => {
      const result = await executor.executeTask(
        sessionId,
        async (page) => {
          await page.goto('about:blank');
          return { success: true, message: 'Task completed' };
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true, message: 'Task completed' });
      expect(result.duration).toBeGreaterThan(0);
    });

    test('should handle task timeout', async () => {
      const result = await executor.executeTask(
        sessionId,
        async () => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return 'This should timeout';
        },
        { timeout: 500 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    test('should retry failed tasks', async () => {
      let attemptCount = 0;
      
      const result = await executor.executeTask(
        sessionId,
        async () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Simulated failure');
          }
          return 'Success on attempt 3';
        },
        { retryCount: 3 }
      );

      expect(attemptCount).toBe(3);
      expect(result.success).toBe(true);
      expect(result.data).toBe('Success on attempt 3');
    });

    test('should capture screenshots on failure', async () => {
      const result = await executor.executeTask(
        sessionId,
        async () => {
          throw new Error('Simulated error for screenshot');
        },
        { captureScreenshot: true, retryCount: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.screenshots).toBeDefined();
      expect(result.screenshots?.length).toBeGreaterThan(0);
    });
  });
});

describe('HumanBehaviorSimulator', () => {
  let simulator: HumanBehaviorSimulator;

  beforeEach(() => {
    simulator = new HumanBehaviorSimulator({
      minDelay: 10,
      maxDelay: 100,
      mouseMovement: true,
      randomScroll: true,
      typingSpeed: 'normal'
    });
  });

  test('should generate random delays within range', async () => {
    const startTime = Date.now();
    await simulator.randomDelay(50, 100);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeGreaterThanOrEqual(45); // 允许一些误差
    expect(elapsed).toBeLessThanOrEqual(150); // 允许一些误差
  });

  test('should respect custom delay range', async () => {
    const startTime = Date.now();
    await simulator.randomDelay(200, 300);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeGreaterThanOrEqual(190);
    expect(elapsed).toBeLessThanOrEqual(350);
  });

  test('should have configurable options', () => {
    const customSimulator = new HumanBehaviorSimulator({
      minDelay: 500,
      maxDelay: 1000,
      mouseMovement: false,
      randomScroll: false,
      typingSpeed: 'slow'
    });

    // 检查选项是否正确设置
    expect(customSimulator).toBeDefined();
  });
});