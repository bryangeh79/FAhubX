import { HumanBehaviorOptions } from '../types';

export class HumanBehaviorSimulator {
  private options: HumanBehaviorOptions;

  constructor(options?: Partial<HumanBehaviorOptions>) {
    this.options = {
      minDelay: 100,
      maxDelay: 3000,
      mouseMovement: true,
      randomScroll: true,
      typingSpeed: 'normal',
      ...options
    };
  }

  /**
   * 随机延迟
   */
  async randomDelay(min?: number, max?: number): Promise<void> {
    const minDelay = min || this.options.minDelay;
    const maxDelay = max || this.options.maxDelay;
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 模拟人类鼠标移动
   */
  async simulateMouseMovement(page: any, fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    if (!this.options.mouseMovement) return;

    const steps = 20;
    const stepX = (toX - fromX) / steps;
    const stepY = (toY - fromY) / steps;

    for (let i = 0; i <= steps; i++) {
      const x = fromX + stepX * i;
      const y = fromY + stepY * i;
      
      // 添加随机偏移
      const randomOffset = Math.random() * 10 - 5;
      const finalX = x + randomOffset;
      const finalY = y + randomOffset;

      await page.mouse.move(finalX, finalY);
      await this.randomDelay(10, 50);
    }
  }

  /**
   * 模拟人类点击
   */
  async simulateHumanClick(page: any, selector: string): Promise<void> {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const box = await element.boundingBox();
    if (!box) {
      throw new Error(`Element not visible: ${selector}`);
    }

    // 移动到元素中心
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    await this.simulateMouseMovement(page, 
      await page.mouse.x || centerX - 100,
      await page.mouse.y || centerY - 100,
      centerX,
      centerY
    );

    // 点击前短暂暂停
    await this.randomDelay(50, 200);
    
    // 点击
    await page.mouse.down();
    await this.randomDelay(20, 100);
    await page.mouse.up();
  }

  /**
   * 模拟人类输入
   */
  async simulateHumanTyping(page: any, selector: string, text: string): Promise<void> {
    const typingSpeedMap = {
      slow: { min: 50, max: 150 },
      normal: { min: 30, max: 100 },
      fast: { min: 10, max: 50 }
    };

    const speed = typingSpeedMap[this.options.typingSpeed];
    
    // 聚焦元素
    await page.focus(selector);
    await this.randomDelay(100, 300);

    // 逐个字符输入
    for (const char of text) {
      await page.keyboard.type(char);
      const delay = Math.floor(Math.random() * (speed.max - speed.min + 1)) + speed.min;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 偶尔的输入错误和修正
      if (Math.random() < 0.05) {
        await page.keyboard.press('Backspace');
        await this.randomDelay(50, 150);
        await page.keyboard.type(char);
        await this.randomDelay(50, 150);
      }
    }
  }

  /**
   * 模拟随机滚动
   */
  async simulateRandomScroll(page: any): Promise<void> {
    if (!this.options.randomScroll) return;

    // 随机决定是否滚动
    if (Math.random() < 0.7) {
      const scrollAmount = Math.floor(Math.random() * 500) + 100;
      const scrollDirection = Math.random() > 0.5 ? 1 : -1;
      
      await page.evaluate((amount, direction) => {
        window.scrollBy(0, amount * direction);
      }, scrollAmount, scrollDirection);
      
      await this.randomDelay(500, 2000);
    }
  }

  /**
   * 模拟人类浏览行为
   */
  async simulateBrowsingBehavior(page: any): Promise<void> {
    // 随机滚动
    await this.simulateRandomScroll(page);

    // 随机移动鼠标
    if (this.options.mouseMovement && Math.random() < 0.6) {
      const viewport = page.viewport();
      const randomX = Math.floor(Math.random() * viewport.width);
      const randomY = Math.floor(Math.random() * viewport.height);
      
      await page.mouse.move(randomX, randomY);
      await this.randomDelay(200, 1000);
    }

    // 随机点击空白区域（如果可能）
    if (Math.random() < 0.3) {
      const viewport = page.viewport();
      const clickX = Math.floor(Math.random() * viewport.width);
      const clickY = Math.floor(Math.random() * viewport.height);
      
      await this.simulateMouseMovement(page, 
        await page.mouse.x || clickX - 50,
        await page.mouse.y || clickY - 50,
        clickX,
        clickY
      );
      
      await page.mouse.click(clickX, clickY);
      await this.randomDelay(500, 1500);
    }
  }
}