/**
 * 点赞操作
 */

import { BaseOperation } from '../core/base-operation';
import {
  OperationType,
  OperationPriority,
  LikeOperationParams,
  OperationResult
} from '../types';

/**
 * 点赞操作类
 */
export class LikeOperation extends BaseOperation<LikeOperationParams> {
  
  constructor(params: LikeOperationParams) {
    super({
      ...params,
      type: OperationType.LIKE
    });
  }
  
  /**
   * 验证点赞参数
   */
  async validate(params: LikeOperationParams): Promise<boolean> {
    await super.validate(params);
    
    if (!params.postUrl) {
      throw new Error('帖子URL不能为空');
    }
    
    // 验证URL格式
    if (!params.postUrl.includes('facebook.com')) {
      throw new Error('无效的Facebook帖子URL');
    }
    
    return true;
  }
  
  /**
   * 执行点赞操作
   */
  protected async executeInternal(params: LikeOperationParams): Promise<any> {
    const page = await this.getPage();
    
    this.logger.info('开始执行点赞操作', {
      postUrl: params.postUrl,
      reaction: params.reaction || 'like'
    });
    
    // 导航到帖子页面
    await page.goto(params.postUrl, { waitUntil: 'networkidle0' });
    
    // 等待帖子加载完成
    await this.waitForSelector(page, 'div[role="article"]', 15000);
    
    // 查找点赞按钮
    const likeButton = await this.findLikeButton(page);
    
    if (!likeButton) {
      throw new Error('找不到点赞按钮');
    }
    
    // 检查是否已经点赞
    const alreadyLiked = await this.checkIfAlreadyLiked(page);
    
    if (alreadyLiked) {
      this.logger.info('帖子已经点赞过');
      return {
        postUrl: params.postUrl,
        postId: params.postId,
        reaction: params.reaction || 'like',
        alreadyLiked: true,
        timestamp: new Date().toISOString()
      };
    }
    
    // 执行点赞
    if (params.reaction && params.reaction !== 'like') {
      // 需要选择特定反应
      await this.performReaction(page, params.reaction);
    } else {
      // 普通点赞
      await likeButton.click();
    }
    
    // 等待点赞完成
    await page.waitForTimeout(2000);
    
    // 验证点赞成功
    const liked = await this.checkIfAlreadyLiked(page);
    
    if (!liked) {
      throw new Error('点赞失败');
    }
    
    this.logger.info('点赞成功', {
      postUrl: params.postUrl,
      reaction: params.reaction || 'like'
    });
    
    return {
      postUrl: params.postUrl,
      postId: params.postId,
      reaction: params.reaction || 'like',
      success: true,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 查找点赞按钮
   */
  private async findLikeButton(page: any): Promise<any> {
    // 尝试多种选择器
    const selectors = [
      'div[aria-label="赞"]',
      'div[aria-label="Like"]',
      'span[aria-label="赞"]',
      'span[aria-label="Like"]',
      'a[aria-label="赞"]',
      'a[aria-label="Like"]',
      'div[data-testid="fb-ufi-likelink"]',
      'div[role="button"][aria-label*="赞"]',
      'div[role="button"][aria-label*="Like"]'
    ];
    
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          return element;
        }
      } catch (error) {
        // 继续尝试下一个选择器
        continue;
      }
    }
    
    // 如果找不到，尝试通过文本查找
    const buttons = await page.$$('div[role="button"]');
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text && (text.includes('赞') || text.includes('Like'))) {
        return button;
      }
    }
    
    return null;
  }
  
  /**
   * 检查是否已经点赞
   */
  private async checkIfAlreadyLiked(page: any): Promise<boolean> {
    // 尝试多种方式检查
    const checks = [
      // 检查点赞按钮状态
      async () => {
        const likeButton = await this.findLikeButton(page);
        if (!likeButton) return false;
        
        const ariaPressed = await page.evaluate(
          el => el.getAttribute('aria-pressed'),
          likeButton
        );
        return ariaPressed === 'true';
      },
      
      // 检查点赞文本
      async () => {
        const likeTexts = await page.$$eval(
          'span',
          spans => spans.filter(span => 
            span.textContent && (
              span.textContent.includes('已赞') || 
              span.textContent.includes('Liked')
            )
          ).length > 0
        );
        return likeTexts;
      },
      
      // 检查反应区域
      async () => {
        const reactionArea = await page.$('div[aria-label*="反应"]');
        if (!reactionArea) return false;
        
        const hasReaction = await page.evaluate(
          el => el.getAttribute('aria-label')?.includes('你'),
          reactionArea
        );
        return !!hasReaction;
      }
    ];
    
    for (const check of checks) {
      try {
        const result = await check();
        if (result) return true;
      } catch (error) {
        // 继续尝试下一个检查
        continue;
      }
    }
    
    return false;
  }
  
  /**
   * 执行特定反应
   */
  private async performReaction(page: any, reaction: string): Promise<void> {
    this.logger.info('执行特定反应', { reaction });
    
    // 找到点赞按钮并悬停
    const likeButton = await this.findLikeButton(page);
    if (!likeButton) {
      throw new Error('找不到点赞按钮，无法执行反应');
    }
    
    // 悬停显示反应选项
    await likeButton.hover();
    
    // 等待反应面板出现
    await page.waitForSelector('div[role="tooltip"]', { timeout: 5000 });
    
    // 根据反应类型选择
    let reactionSelector = '';
    switch (reaction) {
      case 'love':
        reactionSelector = 'div[aria-label="爱心"]';
        break;
      case 'care':
        reactionSelector = 'div[aria-label="关心"]';
        break;
      case 'haha':
        reactionSelector = 'div[aria-label="哈哈"]';
        break;
      case 'wow':
        reactionSelector = 'div[aria-label="哇"]';
        break;
      case 'sad':
        reactionSelector = 'div[aria-label="伤心"]';
        break;
      case 'angry':
        reactionSelector = 'div[aria-label="怒"]';
        break;
      default:
        throw new Error(`不支持的反应类型: ${reaction}`);
    }
    
    // 点击反应
    const reactionButton = await page.waitForSelector(reactionSelector);
    await reactionButton.click();
    
    // 等待反应完成
    await page.waitForTimeout(1000);
    
    this.logger.info('反应执行完成');
  }
  
  /**
   * 获取默认配置
   */
  protected getDefaultConfig(): any {
    return {
      ...super.getDefaultConfig(),
      maxRetries: 3,
      timeout: 30000,
      requireLogin: true
    };
  }
}