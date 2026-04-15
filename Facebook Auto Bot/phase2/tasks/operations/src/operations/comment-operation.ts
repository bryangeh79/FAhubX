/**
 * 评论操作
 */

import { BaseOperation } from '../core/base-operation';
import {
  OperationType,
  OperationPriority,
  CommentOperationParams,
  OperationResult
} from '../types';

/**
 * 评论操作类
 */
export class CommentOperation extends BaseOperation<CommentOperationParams> {
  
  constructor(params: CommentOperationParams) {
    super({
      ...params,
      type: OperationType.COMMENT
    });
  }
  
  /**
   * 验证评论参数
   */
  async validate(params: CommentOperationParams): Promise<boolean> {
    await super.validate(params);
    
    if (!params.postUrl) {
      throw new Error('帖子URL不能为空');
    }
    
    if (!params.content || params.content.trim().length === 0) {
      throw new Error('评论内容不能为空');
    }
    
    if (params.content.length > 1000) {
      throw new Error('评论内容过长，最大1000字符');
    }
    
    // 验证URL格式
    if (!params.postUrl.includes('facebook.com')) {
      throw new Error('无效的Facebook帖子URL');
    }
    
    return true;
  }
  
  /**
   * 执行评论操作
   */
  protected async executeInternal(params: CommentOperationParams): Promise<any> {
    const page = await this.getPage();
    
    this.logger.info('开始执行评论操作', {
      postUrl: params.postUrl,
      contentLength: params.content.length,
      hasImages: !!params.images?.length,
      isReply: !!params.replyTo
    });
    
    // 导航到帖子页面
    await page.goto(params.postUrl, { waitUntil: 'networkidle0' });
    
    // 等待帖子加载完成
    await this.waitForSelector(page, 'div[role="article"]', 15000);
    
    // 如果是回复评论，先找到目标评论
    if (params.replyTo) {
      await this.findAndClickReply(params.replyTo, page);
    }
    
    // 查找评论框
    const commentBox = await this.findCommentBox(page);
    
    if (!commentBox) {
      throw new Error('找不到评论框');
    }
    
    // 点击评论框
    await commentBox.click();
    
    // 等待评论输入框出现
    await page.waitForSelector('div[role="textbox"][aria-label*="评论"]', { timeout: 5000 });
    
    // 输入评论内容
    await page.keyboard.type(params.content);
    
    // 处理图片上传
    if (params.images && params.images.length > 0) {
      await this.handleImageUpload(page, params.images);
    }
    
    // 提交评论
    await this.submitComment(page);
    
    // 等待评论发布
    await this.waitForCommentToAppear(page, params.content);
    
    this.logger.info('评论成功', {
      postUrl: params.postUrl,
      contentPreview: params.content.substring(0, 50) + '...'
    });
    
    return {
      postUrl: params.postUrl,
      postId: params.postId,
      content: params.content,
      isReply: !!params.replyTo,
      replyTo: params.replyTo,
      success: true,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 查找并点击回复按钮
   */
  private async findAndClickReply(commentId: string, page: any): Promise<void> {
    this.logger.info('查找目标评论进行回复', { commentId });
    
    // 尝试通过评论ID查找
    let targetComment = null;
    
    // 方法1: 通过data-commentid属性
    try {
      targetComment = await page.$(`div[data-commentid="${commentId}"]`);
    } catch (error) {
      // 继续尝试其他方法
    }
    
    // 方法2: 通过包含评论ID的div
    if (!targetComment) {
      const allComments = await page.$$('div[role="article"] div');
      for (const comment of allComments) {
        const commentHtml = await page.evaluate(el => el.outerHTML, comment);
        if (commentHtml.includes(commentId)) {
          targetComment = comment;
          break;
        }
      }
    }
    
    if (!targetComment) {
      throw new Error(`找不到评论ID: ${commentId}`);
    }
    
    // 在目标评论中查找回复按钮
    const replyButton = await targetComment.$('div[aria-label="回复"]') ||
                       await targetComment.$('div[aria-label="Reply"]') ||
                       await targetComment.$('a[aria-label*="回复"]') ||
                       await targetComment.$('a[aria-label*="Reply"]');
    
    if (!replyButton) {
      throw new Error('找不到回复按钮');
    }
    
    // 点击回复按钮
    await replyButton.click();
    
    // 等待回复输入框出现
    await page.waitForTimeout(1000);
    
    this.logger.info('已找到并点击回复按钮');
  }
  
  /**
   * 查找评论框
   */
  private async findCommentBox(page: any): Promise<any> {
    // 尝试多种选择器
    const selectors = [
      'div[aria-label*="写评论"]',
      'div[aria-label*="Write a comment"]',
      'textarea[placeholder*="写评论"]',
      'textarea[placeholder*="Write a comment"]',
      'div[role="textbox"][aria-label*="评论"]',
      'div[role="textbox"][aria-label*="Comment"]',
      'div[data-testid="fb-ufi-composer"]'
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
    const textareas = await page.$$('textarea');
    for (const textarea of textareas) {
      const placeholder = await page.evaluate(el => el.getAttribute('placeholder'), textarea);
      if (placeholder && (placeholder.includes('评论') || placeholder.includes('comment'))) {
        return textarea;
      }
    }
    
    return null;
  }
  
  /**
   * 处理图片上传
   */
  private async handleImageUpload(page: any, images: string[]): Promise<void> {
    this.logger.info('上传评论图片', { count: images.length });
    
    // 查找图片上传按钮
    const imageButton = await page.waitForSelector('div[aria-label*="照片"]') ||
                       await page.waitForSelector('div[aria-label*="Photo"]');
    
    if (!imageButton) {
      throw new Error('找不到图片上传按钮');
    }
    
    await imageButton.click();
    
    // 等待文件选择器出现
    await page.waitForSelector('input[type="file"]', { timeout: 5000 });
    
    // 上传图片
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(...images);
    
    // 等待上传完成
    await page.waitForSelector('img[src*="facebook.com"]', { timeout: 30000 });
    
    this.logger.info('评论图片上传完成');
  }
  
  /**
   * 提交评论
   */
  private async submitComment(page: any): Promise<void> {
    // 方法1: 按Enter键
    await page.keyboard.press('Enter');
    
    // 方法2: 查找并点击发送按钮（备用）
    await page.waitForTimeout(1000);
    
    const sendButtons = await page.$$('div[aria-label="发送"]') ||
                       await page.$$('div[aria-label="Send"]');
    
    if (sendButtons && sendButtons.length > 0) {
      await sendButtons[0].click();
    }
    
    this.logger.info('已提交评论');
  }
  
  /**
   * 等待评论出现
   */
  private async waitForCommentToAppear(page: any, content: string): Promise<void> {
    const maxAttempts = 10;
    const contentSnippet = content.substring(0, 30).toLowerCase();
    
    for (let i = 0; i < maxAttempts; i++) {
      await page.waitForTimeout(1000);
      
      // 检查页面中是否包含评论内容
      const pageContent = await page.content();
      if (pageContent.toLowerCase().includes(contentSnippet)) {
        this.logger.info('评论已出现在页面中');
        return;
      }
      
      // 检查评论区域
      const comments = await page.$$('div[role="article"] div');
      for (const comment of comments) {
        const commentText = await page.evaluate(el => el.textContent, comment);
        if (commentText && commentText.toLowerCase().includes(contentSnippet)) {
          this.logger.info('评论已找到');
          return;
        }
      }
    }
    
    this.logger.warn('未能在页面中找到评论，但可能已发布成功');
  }
  
  /**
   * 获取默认配置
   */
  protected getDefaultConfig(): any {
    return {
      ...super.getDefaultConfig(),
      maxRetries: 2,
      timeout: 45000,
      requireLogin: true
    };
  }
}