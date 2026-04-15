# 统一入站意图分发骨架 - Facebook Auto Bot 项目

## 概述
本文档定义了Facebook Auto Bot项目的统一入站意图分发骨架，实现基于意图（Intent）的请求路由和处理，确保系统能够智能识别请求意图并分发给最合适的处理器。

## 设计原则

### 1. 意图驱动原则
- 所有入站请求都映射到一个或多个意图
- 意图决定请求的处理逻辑和路由目标
- 意图可以组合和嵌套，支持复杂场景

### 2. 智能路由原则
- 基于意图、上下文和优先级智能路由
- 支持动态路由规则和策略
- 路由决策可配置和可监控

### 3. 可扩展原则
- 易于添加新的意图类型
- 易于添加新的处理器
- 支持插件式架构和热更新

## 意图定义

### 基础意图接口
```typescript
// 基础意图定义
interface BaseIntent {
  id: string;                   // 意图唯一ID
  name: string;                 // 意图名称
  description: string;          // 意图描述
  category: IntentCategory;     // 意图类别
  priority: IntentPriority;     // 意图优先级
  confidence: number;           // 意图置信度 (0-1)
  metadata: Record<string, any>; // 元数据
}

// 意图类别
enum IntentCategory {
  AUTHENTICATION = 'authentication',    // 认证相关
  DIALOGUE = 'dialogue',                // 对话相关
  TASK = 'task',                        // 任务相关
  ANALYTICS = 'analytics',              // 分析相关
  SYSTEM = 'system',                    // 系统相关
  USER = 'user',                        // 用户相关
  ADMIN = 'admin',                      // 管理相关
}

// 意图优先级
enum IntentPriority {
  CRITICAL = 100,      // 关键：需要立即处理
  HIGH = 80,           // 高：优先处理
  NORMAL = 50,         // 正常：普通处理
  LOW = 20,            // 低：可以延迟处理
  BACKGROUND = 0,      // 后台：异步处理
}
```

### 意图识别结果
```typescript
// 意图识别结果
interface IntentRecognitionResult {
  requestId: string;            // 请求ID
  primaryIntent: BaseIntent;    // 主要意图
  secondaryIntents: BaseIntent[]; // 次要意图
  confidence: number;           // 总体置信度
  recognitionTime: number;      // 识别时间（毫秒）
  recognitionMethod: string;    // 识别方法
  metadata: Record<string, any>; // 元数据
}

// 意图匹配规则
interface IntentMatchingRule {
  id: string;                   // 规则ID
  name: string;                 // 规则名称
  conditions: MatchingCondition[]; // 匹配条件
  intent: BaseIntent;           // 匹配的意图
  priority: number;             // 规则优先级
  enabled: boolean;             // 是否启用
}

// 匹配条件
interface MatchingCondition {
  field: string;                // 匹配字段
  operator: MatchingOperator;   // 匹配操作符
  value: any;                   // 匹配值
  weight: number;               // 权重 (0-1)
}

// 匹配操作符
enum MatchingOperator {
  EQUALS = 'equals',            // 等于
  CONTAINS = 'contains',        // 包含
  STARTS_WITH = 'starts_with',  // 以...开始
  ENDS_WITH = 'ends_with',      // 以...结束
  MATCHES_REGEX = 'matches_regex', // 正则匹配
  GREATER_THAN = 'greater_than', // 大于
  LESS_THAN = 'less_than',      // 小于
  IN = 'in',                    // 在...中
  NOT_IN = 'not_in',            // 不在...中
}
```

## 意图分发器架构

### 核心分发器
```typescript
// 意图分发器配置
interface IntentDispatcherConfig {
  recognition: RecognitionConfig;    // 识别配置
  routing: RoutingConfig;           // 路由配置
  fallback: FallbackConfig;         // 回退配置
  monitoring: MonitoringConfig;     // 监控配置
  caching: CachingConfig;           // 缓存配置
}

// 意图分发器
class IntentDispatcher {
  private recognizer: IntentRecognizer;
  private router: IntentRouter;
  private processorRegistry: ProcessorRegistry;
  private cache: IntentCache;
  private monitor: IntentMonitor;
  
  constructor(config: IntentDispatcherConfig) {
    this.recognizer = new IntentRecognizer(config.recognition);
    this.router = new IntentRouter(config.routing);
    this.processorRegistry = new ProcessorRegistry();
    this.cache = new IntentCache(config.caching);
    this.monitor = new IntentMonitor(config.monitoring);
  }
  
  // 处理请求
  async dispatch(request: BaseRequestContract): Promise<BaseResponseContract> {
    const startTime = Date.now();
    
    try {
      // 1. 监控开始
      this.monitor.recordDispatchStart(request);
      
      // 2. 检查缓存
      const cachedResult = await this.cache.get(request);
      if (cachedResult) {
        this.monitor.recordCacheHit(request);
        return cachedResult;
      }
      
      // 3. 识别意图
      const recognitionResult = await this.recognizer.recognize(request);
      this.monitor.recordRecognition(request, recognitionResult);
      
      // 4. 路由到处理器
      const processor = await this.router.route(recognitionResult);
      this.monitor.recordRouting(request, recognitionResult, processor);
      
      // 5. 执行处理
      const response = await processor.process(request, recognitionResult);
      this.monitor.recordProcessing(request, recognitionResult, response);
      
      // 6. 缓存结果（如果可缓存）
      if (this.shouldCache(response)) {
        await this.cache.set(request, response);
      }
      
      // 7. 监控结束
      const endTime = Date.now();
      this.monitor.recordDispatchEnd(request, endTime - startTime, true);
      
      return response;
      
    } catch (error) {
      // 错误处理
      const endTime = Date.now();
      this.monitor.recordDispatchError(request, error, endTime - startTime);
      
      // 尝试回退处理
      return await this.handleFallback(request, error);
    }
  }
  
  // 批量处理
  async dispatchBatch(
    requests: BaseRequestContract[]
  ): Promise<BaseResponseContract[]> {
    const results: BaseResponseContract[] = [];
    
    // 并行处理，但控制并发数
    const batchSize = 10;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(req => this.dispatch(req))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
  
  // 处理回退
  private async handleFallback(
    request: BaseRequestContract,
    error: Error
  ): Promise<BaseResponseContract> {
    try {
      // 1. 尝试使用回退处理器
      const fallbackProcessor = this.router.getFallbackProcessor();
      if (fallbackProcessor) {
        const response = await fallbackProcessor.process(request, {
          primaryIntent: this.createErrorIntent(error),
          secondaryIntents: [],
          confidence: 0,
          recognitionTime: 0,
          recognitionMethod: 'fallback',
          metadata: { error: error.message }
        });
        
        this.monitor.recordFallbackSuccess(request, error);
        return response;
      }
      
      // 2. 返回错误响应
      return this.createErrorResponse(request, error);
      
    } catch (fallbackError) {
      // 回退也失败，返回最终错误
      this.monitor.recordFallbackFailure(request, error, fallbackError);
      return this.createErrorResponse(request, error);
    }
  }
}
```

### 意图识别器
```typescript
// 意图识别器
class IntentRecognizer {
  private rules: IntentMatchingRule[] = [];
  private mlModel?: MLModel;
  private cache: RecognitionCache;
  
  constructor(config: RecognitionConfig) {
    this.loadRules(config.rules);
    if (config.mlModel) {
      this.mlModel = new MLModel(config.mlModel);
    }
    this.cache = new RecognitionCache(config.caching);
  }
  
  // 识别意图
  async recognize(request: BaseRequestContract): Promise<IntentRecognitionResult> {
    const startTime = Date.now();
    
    // 1. 检查缓存
    const cached = await this.cache.get(request);
    if (cached) {
      return {
        ...cached,
        recognitionTime: Date.now() - startTime,
        recognitionMethod: 'cache'
      };
    }
    
    // 2. 基于规则匹配
    const ruleBasedIntents = this.matchByRules(request);
    
    // 3. 基于机器学习匹配（如果可用）
    let mlBasedIntents: BaseIntent[] = [];
    if (this.mlModel) {
      mlBasedIntents = await this.matchByML(request);
    }
    
    // 4. 合并和排序意图
    const allIntents = this.mergeAndSortIntents(ruleBasedIntents, mlBasedIntents);
    
    // 5. 选择主要意图
    const primaryIntent = this.selectPrimaryIntent(allIntents);
    const secondaryIntents = allIntents.filter(i => i.id !== primaryIntent.id);
    
    // 6. 计算总体置信度
    const confidence = this.calculateOverallConfidence(primaryIntent, secondaryIntents);
    
    // 7. 构建结果
    const result: IntentRecognitionResult = {
      requestId: request.requestId,
      primaryIntent,
      secondaryIntents,
      confidence,
      recognitionTime: Date.now() - startTime,
      recognitionMethod: this.mlModel ? 'hybrid' : 'rule_based',
      metadata: {
        ruleMatches: ruleBasedIntents.length,
        mlMatches: mlBasedIntents.length,
        totalIntents: allIntents.length
      }
    };
    
    // 8. 缓存结果
    await this.cache.set(request, result);
    
    return result;
  }
  
  // 基于规则匹配
  private matchByRules(request: BaseRequestContract): BaseIntent[] {
    const matchedIntents: BaseIntent[] = [];
    
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      
      const matchScore = this.evaluateRule(rule, request);
      if (matchScore > 0) {
        const intent = { ...rule.intent, confidence: matchScore };
        matchedIntents.push(intent);
      }
    }
    
    return matchedIntents;
  }
  
  // 基于机器学习匹配
  private async matchByML(request: BaseRequestContract): Promise<BaseIntent[]> {
    if (!this.mlModel) return [];
    
    try {
      const predictions = await this.mlModel.predict(request);
      return predictions.map(pred => ({
        id: pred.intentId,
        name: pred.intentName,
        description: pred.description || '',
        category: pred.category as IntentCategory,
        priority: IntentPriority.NORMAL,
        confidence: pred.confidence,
        metadata: pred.metadata || {}
      }));
    } catch (error) {
      console.warn('ML prediction failed:', error);
      return [];
    }
  }
  
  // 评估规则
  private evaluateRule(rule: IntentMatchingRule, request: BaseRequestContract): number {
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const condition of rule.conditions) {
      const fieldValue = this.getFieldValue(request, condition.field);
      const conditionScore = this.evaluateCondition(fieldValue, condition);
      
      totalScore += conditionScore * condition.weight;
      totalWeight += condition.weight;
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }
  
  // 评估条件
  private evaluateCondition(value: any, condition: MatchingCondition): number {
    switch (condition.operator) {
      case MatchingOperator.EQUALS:
        return value === condition.value ? 1 : 0;
      case MatchingOperator.CONTAINS:
        return String(value).includes(String(condition.value)) ? 1 : 0;
      case MatchingOperator.STARTS_WITH:
        return String(value).startsWith(String(condition.value)) ? 1 : 0;
      case MatchingOperator.ENDS_WITH:
        return String(value).endsWith(String(condition.value)) ? 1 : 0;
      case MatchingOperator.MATCHES_REGEX:
        return new RegExp(condition.value).test(String(value)) ? 1 : 0;
      case MatchingOperator.GREATER_THAN:
        return Number(value) > Number(condition.value) ? 1 : 0;
      case MatchingOperator.LESS_THAN:
        return Number(value) < Number(condition.value) ? 1 : 0;
      case MatchingOperator.IN:
        return Array.isArray(condition.value) && 
               condition.value.includes(value) ? 1 : 0;
      case MatchingOperator.NOT_IN:
        return Array.isArray(condition.value) && 
               !condition.value.includes(value) ? 1 : 0;
      default:
        return 0;
    }
  }
}
```

### 意图路由器
```typescript
// 意图路由器
class IntentRouter {
  private routingRules: RoutingRule[] = [];
  private processorMap: Map<string, IntentProcessor> = new Map();
  private fallbackProcessor?: IntentProcessor;
  private loadBalancer: LoadBalancer;
  
  constructor(config: RoutingConfig) {
    this.loadRoutingRules(config.rules);
    this.loadBalancer = new LoadBalancer(config.loadBalancing);
  }
  
  // 路由到处理器
  async route(recognitionResult: IntentRecognitionResult): Promise<IntentProcessor> {
    const { primaryIntent, secondaryIntents } = recognitionResult;
    
    // 1. 查找匹配的路由规则
    const matchingRules = this.findMatchingRules(primaryIntent, secondaryIntents);
    
    // 2. 选择最佳规则
    const bestRule = this.selectBestRule(matchingRules, recognitionResult);
    
    // 3. 获取处理器
    let processor: IntentProcessor;
    if (bestRule.processorId) {
      processor = this.getProcessor(bestRule.processorId);
    } else if (bestRule.processorGroup) {
      processor = await this.selectFromGroup(bestRule.processorGroup);
    } else {
      throw new Error('No processor specified in routing rule');
    }
    
    // 4. 验证处理器可用性
    if (!processor.isAvailable()) {
      throw new Error(`Processor ${processor.id} is not available`);
    }
    
    return processor;
  }
  
  // 查找匹配规则
  private findMatchingRules(
    primaryIntent: BaseIntent,
    secondaryIntents: BaseIntent[]
  ): RoutingRule[] {
    return this.routingRules.filter(rule => {
      // 检查主要意图匹配
      const primaryMatch = this.matchesIntent(rule, primaryIntent);
      
      // 检查次要意图匹配（如果规则要求）
      const secondaryMatch = rule.requireAllSecondaryIntents
        ? secondaryIntents.every(intent => this.matchesIntent(rule, intent))
        : secondaryIntents.some(intent => this.matchesIntent(rule, intent));
      
      return primaryMatch && secondaryMatch;
    });
  }
  
  // 匹配意图
  private matchesIntent(rule: RoutingRule, intent: BaseIntent): boolean {
    // 检查意图ID匹配
    if (rule.intentIds && rule.intentIds.includes(intent.id)) {
      return true;
    }
    
    // 检查意图名称匹配
    if (rule.intentNames && rule.intentNames.includes(intent.name)) {
      return true;
    }
    
    // 检查意图类别匹配
    if (rule.intentCategories && rule.intentCategories.includes(intent.category)) {
      return true;
    }
    
    // 检查置信度阈值
    if (rule.minConfidence && intent.confidence < rule.minConfidence) {
      return false;
    }
    
    // 检查优先级阈值
    if (rule.minPriority && intent.priority < rule.minPriority) {
      return false;
    }
    
    return false;
  }
  
  // 选择最佳规则
  private selectBestRule(
    rules: RoutingRule[],
    recognitionResult: IntentRecognitionResult
  ): RoutingRule {
    if (rules.length === 0) {
      throw new Error('No matching routing rules found');
    }
    
    // 按优先级排序
    rules.sort((a, b) => {
      // 首先按规则优先级
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // 然后按匹配的意图置信度
      const aConfidence = this.calculateRuleConfidence(a, recognitionResult);
      const bConfidence = this.calculateRuleConfidence(b, recognitionResult);
      
      return bConfidence - aConfidence;
    });
    
    return rules[0];
  }
  
  // 从处理器组中选择
  private async selectFromGroup(groupId: string): Promise<IntentProcessor> {
    const group = this.getProcessorGroup(groupId);
    if (!group) {
      throw new Error(`Processor group not found: ${groupId}`);
    }
    
    // 使用负载均衡器选择处理器
    const processorId = await this.loadBalancer.select(group.processorIds);
    return this.getProcessor(processorId);
  }
  
  // 获取回退处理器
  getFallbackProcessor(): IntentProcessor | undefined {
    return this.fallbackProcessor;
  }
}
```

## 处理器注册表

### 处理器接口
```typescript
// 意图处理器接口
interface IntentProcessor {
  id: string;                     // 处理器ID
  name: string;                   //