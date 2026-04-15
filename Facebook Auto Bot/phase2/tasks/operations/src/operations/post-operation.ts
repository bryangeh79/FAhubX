/**
 * 发帖操作
 */

import { BaseOperation } from '../core/base-operation';
import {
  OperationType,
  OperationPriority,
  PostOperationParams,
  OperationResult
} from '../types';

/**
 * 发帖操作类
 */
export class PostOperation extends BaseOperation<PostOperationParams> {
  
  constructor(params: PostOperationParams) {
    super({
      ...params,
      type: OperationType.POST
    });
  }
  
  /**
   * 验证发帖参数
   */
  async validate(params: PostOperationParams): Promise<boolean> {
    await super.validate(params);
    
    if (!params.content || params.content.trim().length === 0) {
      throw new Error('发帖内容不能为空');
    }
    
    if (params.content.length > 5000) {
      throw new Error('发帖内容过长，最大5000字符');
    }
    
    return true;
  }
  
  /**
   * 执行发帖操作
   */
  protected async executeInternal(params: PostOperationParams): Promise<any> {
    const page = await this.getPage();
    
    this.logger.info('开始执行发帖操作', {
      contentLength: params.content.length,
      hasImages: !!params.images?.length,
      hasVideos: !!params.videos?.length
    });
    
    // 导航到Facebook主页
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle0' });
    
    // 等待发帖框出现
    await this.waitForSelector(page, 'div[role="textbox"][aria-label*="在想什么"]', 10000);
    
    // 点击发帖框
    const postBox = await page.$('div[role="textbox"][aria-label*="在想什么"]');
    await postBox.click();
    
    // 输入内容
    await page.keyboard.type(params.content);
    
    // 处理图片上传
    if (params.images && params.images.length > 0) {
      await this.handleImageUpload(page, params.images);
    }
    
    // 处理视频上传
    if (params.videos && params.videos.length > 0) {
      await this.handleVideoUpload(page, params.videos);
    }
    
    // 设置隐私
    if (params.privacy) {
      await this.setPrivacy(page, params.privacy);
    }
    
    // 添加位置
    if (params.location) {
      await this.addLocation(page, params.location);
    }
    
    // 添加心情
    if (params.feeling) {
      await this.addFeeling(page, params.feeling);
    }
    
    // 添加标签
    if (params.tags && params.tags.length > 0) {
      await this.addTags(page, params.tags);
    }
    
    // 点击发布按钮
    const publishButton = await page.waitForSelector('div[aria-label="发布"]');
    await publishButton.click();
    
    // 等待发布完成
    await page.waitForSelector('div[role="article"]', { timeout: 30000 });
    
    // 获取发布的帖子ID
    const postUrl = page.url();
    const postId = this.extractPostId(postUrl);
    
    this.logger.info('发帖成功', {
      postId,
      postUrl
    });
    
    return {
      postId,
      postUrl,
      content: params.content,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 处理图片上传
   */
  private async handleImageUpload(page: any, images: string[]): Promise<void> {
    this.logger.info('开始上传图片', { count: images.length });
    
    // 点击添加照片/视频按钮
    const addMediaButton = await page.waitForSelector('div[aria-label="照片/视频"]');
    await addMediaButton.click();
    
    // 等待文件选择器出现
    await page.waitForSelector('input[type="file"]');
    
    // 上传图片
    const fileInput = await page.$('input[type="file"]');
    
    // 注意：Puppeteer中文件上传需要本地文件路径
    // 这里假设images是本地文件路径数组
    await fileInput.uploadFile(...images);
    
    // 等待上传完成
    await page.waitForSelector('div[aria-label*="上传"]', { timeout: 60000 });
    
    this.logger.info('图片上传完成');
  }
  
  /**
   * 处理视频上传
   */
  private async handleVideoUpload(page: any, videos: string[]): Promise<void> {
    this.logger.info('开始上传视频', { count: videos.length });
    
    // 点击添加照片/视频按钮
    const addMediaButton = await page.waitForSelector('div[aria-label="照片/视频"]');
    await addMediaButton.click();
    
    // 等待文件选择器出现
    await page.waitForSelector('input[type="file"]');
    
    // 上传视频
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(...videos);
    
    // 等待上传完成（视频上传时间较长）
    await page.waitForSelector('div[aria-label*="上传"]', { timeout: 180000 });
    
    this.logger.info('视频上传完成');
  }
  
  /**
   * 设置隐私
   */
  private async setPrivacy(page: any, privacy: string): Promise<void> {
    this.logger.info('设置隐私', { privacy });
    
    // 点击隐私设置按钮
    const privacyButton = await page.waitForSelector('div[aria-label*="受众选择器"]');
    await privacyButton.click();
    
    // 等待隐私选项出现
    await page.waitForSelector('div[role="menu"]');
    
    // 选择隐私选项
    let privacySelector = '';
    switch (privacy) {
      case 'public':
        privacySelector = 'div[role="menuitem"][aria-label*="公开"]';
        break;
      case 'friends':
        privacySelector = 'div[role="menuitem"][aria-label*="朋友"]';
        break;
      case 'only_me':
        privacySelector = 'div[role="menuitem"][aria-label*="仅自己"]';
        break;
      default:
        return;
    }
    
    const privacyOption = await page.waitForSelector(privacySelector);
    await privacyOption.click();
    
    this.logger.info('隐私设置完成');
  }
  
  /**
   * 添加位置
   */
  private async addLocation(page: any, location: string): Promise<void> {
    this.logger.info('添加位置', { location });
    
    // 点击添加位置按钮
    const locationButton = await page.waitForSelector('div[aria-label="你在哪里？"]');
    await locationButton.click();
    
    // 输入位置
    const locationInput = await page.waitForSelector('input[placeholder*="搜索位置"]');
    await locationInput.type(location);
    
    // 等待位置建议出现并选择第一个
    await page.waitForSelector('div[role="option"]', { timeout: 5000 });
    const firstOption = await page.$('div[role="option"]');
    await firstOption.click();
    
    this.logger.info('位置添加完成');
  }
  
  /**
   * 添加心情
   */
  private async addFeeling(page: any, feeling: string): Promise<void> {
    this.logger.info('添加心情', { feeling });
    
    // 点击添加心情按钮
    const feelingButton = await page.waitForSelector('div[aria-label*="感受/活动"]');
    await feelingButton.click();
    
    // 输入心情
    const feelingInput = await page.waitForSelector('input[placeholder*="搜索感受或活动"]');
    await feelingInput.type(feeling);
    
    // 等待心情建议出现并选择第一个
    await page.waitForSelector('div[role="option"]', { timeout: 5000 });
    const firstOption = await page.$('div[role="option"]');
    await firstOption.click();
    
    this.logger.info('心情添加完成');
  }
  
  /**
   * 添加标签
   */
  private async addTags(page: any, tags: string[]): Promise<void> {
    this.logger.info('添加标签', { tags });
    
    // 点击标记人物按钮
    const tagButton = await page.waitForSelector('div[aria-label*="标记人物"]');
    await tagButton.click();
    
    // 输入标签
    for (const tag of tags) {
      const tagInput = await page.waitForSelector('input[placeholder*="输入姓名"]');
      await tagInput.type(tag);
      
      // 等待建议出现并选择第一个
      await page.waitForSelector('div[role="option"]', { timeout: 3000 });
      const firstOption = await page.$('div[role="option"]');
      await firstOption.click();
      
      // 等待标签添加完成
      await page.waitForTimeout(1000);
    }
    
    this.logger.info('标签添加完成');
  }
  
  /**
   * 从URL提取帖子ID
   */
  private extractPostId(url: string): string | null {
    const match = url.match(/posts\/(\d+)/) || url.match(/permalink\/(\d+)/);
    return match ? match[1] : null;
  }
  
  /**
   * 获取默认配置
   */
  protected getDefaultConfig(): any {
    return {
      ...super.getDefaultConfig(),
      maxRetries: 2,
      timeout: 180000, // 3分钟（考虑上传时间）
      requireLogin: true
    };
  }
}