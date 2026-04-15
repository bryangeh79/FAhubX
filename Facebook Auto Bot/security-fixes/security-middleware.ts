import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as helmet from 'helmet';
import * as rateLimit from 'express-rate-limit';
import * as csurf from 'csurf';

/**
 * 安全中间件集合
 * 提供全面的Web应用安全防护
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly helmetMiddleware: any;
  private readonly rateLimiter: any;
  private readonly csrfProtection: any;

  constructor() {
    // 配置 Helmet 安全头
    this.helmetMiddleware = helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        maxAge: 31536000, // 1年
        includeSubDomains: true,
        preload: true,
      },
      frameguard: {
        action: 'deny',
      },
      noSniff: true,
      xssFilter: true,
      hidePoweredBy: true,
      ieNoOpen: true,
      dnsPrefetchControl: {
        allow: false,
      },
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: {
        policy: 'same-origin',
      },
      crossOriginResourcePolicy: {
        policy: 'same-origin',
      },
      originAgentCluster: true,
    });

    // 配置速率限制
    this.rateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100, // 每个IP最多100个请求
      message: {
        status: 'error',
        message: '请求过于频繁，请15分钟后再试',
        code: 'RATE_LIMIT_EXCEEDED',
      },
      standardHeaders: true, // 返回 `RateLimit-*` 头
      legacyHeaders: false, // 禁用 `X-RateLimit-*` 头
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req: Request) => {
        // 使用IP地址作为限制键
        return req.ip || req.connection.remoteAddress || 'unknown';
      },
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          status: 'error',
          message: '请求过于频繁，请稍后再试',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 15 * 60, // 15分钟
        });
      },
    });

    // 配置CSRF保护（仅对非API路由）
    this.csrfProtection = csurf({
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      },
      ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    // 应用安全头
    this.helmetMiddleware(req, res, () => {
      // 应用速率限制（排除健康检查等端点）
      if (!this.shouldSkipRateLimit(req)) {
        this.rateLimiter(req, res, () => {
          // 应用CSRF保护（仅对需要会话的路由）
          if (this.shouldApplyCSRF(req)) {
            this.csrfProtection(req, res, next);
          } else {
            next();
          }
        });
      } else {
        next();
      }
    });
  }

  /**
   * 判断是否应该跳过速率限制
   */
  private shouldSkipRateLimit(req: Request): boolean {
    const skipPaths = [
      '/health',
      '/metrics',
      '/api-docs',
      '/favicon.ico',
    ];
    
    return skipPaths.some(path => req.path.startsWith(path));
  }

  /**
   * 判断是否应该应用CSRF保护
   */
  private shouldApplyCSRF(req: Request): boolean {
    // 仅对需要会话的非API路由应用CSRF
    const csrfPaths = [
      '/auth/login',
      '/auth/register',
      '/auth/logout',
    ];
    
    return csrfPaths.some(path => req.path.startsWith(path)) && 
           !req.path.startsWith('/api/');
  }

  /**
   * 获取CSRF令牌（用于前端）
   */
  static getCSRFToken(req: Request): string {
    return req.csrfToken ? req.csrfToken() : '';
  }

  /**
   * 验证CSRF令牌
   */
  static validateCSRFToken(req: Request): boolean {
    try {
      return req.csrfToken ? true : false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 安全头配置（用于响应头）
   */
  static getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
    };
  }

  /**
   * 输入验证和清理
   */
  static sanitizeInput(input: string): string {
    if (!input) return '';
    
    // 移除危险字符
    return input
      .replace(/[<>]/g, '') // 移除HTML标签
      .replace(/javascript:/gi, '') // 移除JavaScript协议
      .replace(/on\w+=/gi, '') // 移除事件处理器
      .trim();
  }

  /**
   * SQL注入防护
   */
  static sanitizeSQL(input: string): string {
    if (!input) return '';
    
    // 移除SQL关键字和特殊字符
    const sqlKeywords = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'UNION', 'OR', 'AND',
      'WHERE', 'FROM', 'TABLE', 'DATABASE', 'ALTER', 'CREATE', 'EXEC',
      'EXECUTE', 'TRUNCATE', 'BACKUP', 'RESTORE', 'GRANT', 'REVOKE'
    ];
    
    let sanitized = input;
    sqlKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });
    
    return sanitized.replace(/['";\\]/g, '');
  }

  /**
   * XSS防护 - HTML编码
   */
  static encodeHTML(input: string): string {
    if (!input) return '';
    
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * 密码强度验证
   */
  static validatePassword(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (!password) {
      errors.push('密码不能为空');
      return { valid: false, errors };
    }
    
    if (password.length < 8) {
      errors.push('密码长度至少8位');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母');
    }
    
    if (!/\d/.test(password)) {
      errors.push('密码必须包含数字');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('密码必须包含特殊字符');
    }
    
    // 检查常见弱密码
    const weakPasswords = [
      'password', '123456', 'qwerty', 'admin', 'welcome',
      'password123', '12345678', '123456789', '1234567890'
    ];
    
    if (weakPasswords.includes(password.toLowerCase())) {
      errors.push('密码过于简单，请使用更复杂的密码');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
}