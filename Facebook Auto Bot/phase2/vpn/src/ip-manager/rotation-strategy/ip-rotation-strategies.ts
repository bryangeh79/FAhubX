import { IPInfo, IPRotationStrategy, RotationRequirements } from '../../types/ip-management';

/**
 * 基础轮换策略
 */
export abstract class BaseRotationStrategy implements IPRotationStrategy {
  constructor(
    public name: string,
    public description: string
  ) {}

  abstract selectNextIP(currentIPs: IPInfo[], usedIPs: string[]): IPInfo | null;
  
  evaluateIP(ipInfo: IPInfo, requirements?: RotationRequirements): number {
    let score = 100;
    
    // 检查地理位置要求
    if (requirements?.geoRequirements) {
      const geo = requirements.geoRequirements;
      
      if (geo.excludeCountries?.includes(ipInfo.geo.countryCode)) {
        return 0;
      }
      
      if (geo.countries && !geo.countries.includes(ipInfo.geo.countryCode)) {
        score -= 30;
      }
    }
    
    // 检查质量要求
    if (requirements?.qualityRequirements) {
      const quality = requirements.qualityRequirements;
      const ipQuality = ipInfo.quality;
      
      if (quality.maxLatency && ipQuality.latency > quality.maxLatency) {
        score -= 40;
      }
      
      if (quality.maxPacketLoss && ipQuality.packetLoss > quality.maxPacketLoss) {
        score -= 30;
      }
      
      if (quality.minBandwidth && ipQuality.bandwidth < quality.minBandwidth) {
        score -= 20;
      }
      
      if (quality.minScore && ipQuality.score < quality.minScore) {
        score -= 50;
      }
    }
    
    // 检查使用要求
    if (requirements?.usageRequirements) {
      const usage = requirements.usageRequirements;
      const ipUsage = ipInfo.usage;
      
      if (usage.minSuccessRate && ipUsage.successRate < usage.minSuccessRate) {
        score -= 25;
      }
      
      // 检查冷却时间
      if (usage.cooldownPeriod) {
        const timeSinceLastUse = Date.now() - ipUsage.lastUsed.getTime();
        if (timeSinceLastUse < usage.cooldownPeriod) {
          score -= Math.max(0, 50 * (1 - timeSinceLastUse / usage.cooldownPeriod));
        }
      }
    }
    
    // 检查其他要求
    if (requirements?.otherRequirements) {
      const other = requirements.otherRequirements;
      
      if (other.excludeProviders?.includes(ipInfo.metadata.provider || '')) {
        return 0;
      }
      
      if (other.requireTags && other.requireTags.length > 0) {
        const hasAllTags = other.requireTags.every(tag => ipInfo.metadata.tags.includes(tag));
        if (!hasAllTags) {
          score -= 40;
        }
      }
      
      if (other.excludeTags && other.excludeTags.length > 0) {
        const hasExcludedTag = other.excludeTags.some(tag => ipInfo.metadata.tags.includes(tag));
        if (hasExcludedTag) {
          score -= 60;
        }
      }
    }
    
    // 黑名单检查
    if (ipInfo.metadata.isBlacklisted) {
      return 0;
    }
    
    return Math.max(0, Math.min(100, score));
  }
}

/**
 * 随机轮换策略
 * 从可用IP中随机选择一个
 */
export class RandomRotationStrategy extends BaseRotationStrategy {
  constructor() {
    super('random', '随机选择可用IP');
  }

  selectNextIP(currentIPs: IPInfo[], usedIPs: string[]): IPInfo | null {
    const availableIPs = currentIPs.filter(ip => 
      !usedIPs.includes(ip.ip) && 
      !ip.metadata.isBlacklisted &&
      ip.quality.score >= 60
    );
    
    if (availableIPs.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * availableIPs.length);
    return availableIPs[randomIndex];
  }
}

/**
 * 质量优先轮换策略
 * 选择质量评分最高的IP
 */
export class QualityFirstRotationStrategy extends BaseRotationStrategy {
  constructor() {
    super('quality-first', '选择质量评分最高的IP');
  }

  selectNextIP(currentIPs: IPInfo[], usedIPs: string[]): IPInfo | null {
    const availableIPs = currentIPs.filter(ip => 
      !usedIPs.includes(ip.ip) && 
      !ip.metadata.isBlacklisted
    );
    
    if (availableIPs.length === 0) {
      return null;
    }
    
    // 按质量评分排序（降序）
    availableIPs.sort((a, b) => b.quality.score - a.quality.score);
    
    // 选择前3个中随机一个，避免总是用同一个
    const topCount = Math.min(3, availableIPs.length);
    const topIPs = availableIPs.slice(0, topCount);
    const randomIndex = Math.floor(Math.random() * topCount);
    
    return topIPs[randomIndex];
  }
}

/**
 * 轮询轮换策略
 * 按顺序轮流使用IP
 */
export class RoundRobinRotationStrategy extends BaseRotationStrategy {
  private lastIndex: number = -1;

  constructor() {
    super('round-robin', '按顺序轮流使用IP');
  }

  selectNextIP(currentIPs: IPInfo[], usedIPs: string[]): IPInfo | null {
    const availableIPs = currentIPs.filter(ip => 
      !ip.metadata.isBlacklisted &&
      ip.quality.score >= 50
    );
    
    if (availableIPs.length === 0) {
      return null;
    }
    
    // 按IP地址排序以确保一致性
    availableIPs.sort((a, b) => a.ip.localeCompare(b.ip));
    
    // 找到下一个可用的IP
    for (let i = 1; i <= availableIPs.length; i++) {
      const index = (this.lastIndex + i) % availableIPs.length;
      const ip = availableIPs[index];
      
      if (!usedIPs.includes(ip.ip)) {
        this.lastIndex = index;
        return ip;
      }
    }
    
    return null;
  }
}

/**
 * 地理位置轮换策略
 * 优先选择特定地理位置的IP
 */
export class GeoRotationStrategy extends BaseRotationStrategy {
  constructor(
    private preferredCountries: string[] = [],
    private excludedCountries: string[] = []
  ) {
    super('geo-based', '基于地理位置的轮换策略');
  }

  selectNextIP(currentIPs: IPInfo[], usedIPs: string[]): IPInfo | null {
    // 过滤可用IP
    let availableIPs = currentIPs.filter(ip => 
      !usedIPs.includes(ip.ip) && 
      !ip.metadata.isBlacklisted &&
      ip.quality.score >= 60
    );
    
    if (availableIPs.length === 0) {
      return null;
    }
    
    // 排除被禁止的国家
    if (this.excludedCountries.length > 0) {
      availableIPs = availableIPs.filter(ip => 
        !this.excludedCountries.includes(ip.geo.countryCode)
      );
    }
    
    if (availableIPs.length === 0) {
      return null;
    }
    
    // 分组：首选国家 > 其他
    const preferredIPs = availableIPs.filter(ip => 
      this.preferredCountries.includes(ip.geo.countryCode)
    );
    
    const otherIPs = availableIPs.filter(ip => 
      !this.preferredCountries.includes(ip.geo.countryCode)
    );
    
    // 优先从首选国家选择
    const candidates = preferredIPs.length > 0 ? preferredIPs : otherIPs;
    
    // 按质量评分排序
    candidates.sort((a, b) => b.quality.score - a.quality.score);
    
    // 选择前3个中随机一个
    const topCount = Math.min(3, candidates.length);
    const topIPs = candidates.slice(0, topCount);
    const randomIndex = Math.floor(Math.random() * topCount);
    
    return topIPs[randomIndex];
  }
}

/**
 * 智能轮换策略
 * 结合多种因素选择最佳IP
 */
export class SmartRotationStrategy extends BaseRotationStrategy {
  constructor() {
    super('smart', '智能轮换策略（结合质量、使用频率、地理位置）');
  }

  selectNextIP(currentIPs: IPInfo[], usedIPs: string[]): IPInfo | null {
    const availableIPs = currentIPs.filter(ip => 
      !usedIPs.includes(ip.ip) && 
      !ip.metadata.isBlacklisted
    );
    
    if (availableIPs.length === 0) {
      return null;
    }
    
    // 计算每个IP的综合评分
    const scoredIPs = availableIPs.map(ip => {
      const score = this.calculateCompositeScore(ip, usedIPs);
      return { ip, score };
    });
    
    // 按综合评分排序
    scoredIPs.sort((a, b) => b.score - a.score);
    
    // 选择评分最高的IP
    return scoredIPs[0].ip;
  }

  private calculateCompositeScore(ipInfo: IPInfo, usedIPs: string[]): number {
    let score = 0;
    
    // 质量评分权重：40%
    score += ipInfo.quality.score * 0.4;
    
    // 使用成功率权重：30%
    score += ipInfo.usage.successRate * 0.3;
    
    // 新鲜度权重：20%
    // 最近使用过的IP得分较低
    const hoursSinceLastUse = (Date.now() - ipInfo.usage.lastUsed.getTime()) / (1000 * 60 * 60);
    const freshnessScore = Math.min(100, hoursSinceLastUse * 10);
    score += freshnessScore * 0.2;
    
    // 连接稳定性权重：10%
    const stabilityScore = Math.min(100, ipInfo.usage.totalUptime / (1000 * 60 * 60)); // 每小时1分
    score += stabilityScore * 0.1;
    
    return score;
  }
}

/**
 * 策略工厂
 */
export class RotationStrategyFactory {
  static createStrategy(strategyName: string, options?: any): IPRotationStrategy {
    switch (strategyName.toLowerCase()) {
      case 'random':
        return new RandomRotationStrategy();
      case 'quality-first':
        return new QualityFirstRotationStrategy();
      case 'round-robin':
        return new RoundRobinRotationStrategy();
      case 'geo-based':
        return new GeoRotationStrategy(
          options?.preferredCountries,
          options?.excludedCountries
        );
      case 'smart':
        return new SmartRotationStrategy();
      default:
        throw new Error(`Unknown rotation strategy: ${strategyName}`);
    }
  }

  static getAvailableStrategies(): Array<{name: string; description: string}> {
    return [
      { name: 'random', description: '随机选择可用IP' },
      { name: 'quality-first', description: '选择质量评分最高的IP' },
      { name: 'round-robin', description: '按顺序轮流使用IP' },
      { name: 'geo-based', description: '基于地理位置的轮换策略' },
      { name: 'smart', description: '智能轮换策略（结合多种因素）' }
    ];
  }
}