import { Module, Global } from '@nestjs/common';
import { SecurityService } from './security.service';
import { SecurityMiddleware } from './security-middleware';

/**
 * 安全配置模块
 * 提供全局安全服务和中间件
 */
@Global()
@Module({
  providers: [SecurityService, SecurityMiddleware],
  exports: [SecurityService, SecurityMiddleware],
})
export class SecurityConfigModule {}

/**
 * 安全服务
 */
@Injectable()
export class SecurityService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  /**
   * 初始化安全配置
   */
  initializeSecurity(app: INestApplication) {
    this.logger.log('初始化安全配置...', 'SecurityService');
    
    // 应用安全中间件
    app.use(new SecurityMiddleware().use.bind(new SecurityMiddleware()));
    
    // 配置全局管道
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        exceptionFactory: (errors) => {
          const messages = errors.map((error) => {
            const constraints = error.constraints;
            return constraints
              ? Object.values(constraints).join(', ')
              : '验证错误';
          });
          throw new BadRequestException({
            status: 'error',
            message: '输入验证失败',
            errors: messages,
            code: 'VALIDATION_FAILED',
          });
        },
      }),
    );

    // 配置全局过滤器
    app.useGlobalFilters(
      new HttpExceptionFilter(),
      new AllExceptionsFilter(),
    );

    // 配置全局拦截器
    app.useGlobalInterceptors(
      new TransformInterceptor(),
      new TimeoutInterceptor(10000), // 10秒超时
      new LoggingInterceptor(),
    );

    // 配置CORS
    this.configureCORS(app);

    // 配置Swagger安全
    this.configureSwaggerSecurity(app);

    this.logger.log('安全配置初始化完成', 'SecurityService');
  }

  /**
   * 配置CORS
   */
  private configureCORS(app: INestApplication) {
    const allowedOrigins = this.configService.get<string[]>('CORS_ALLOWED_ORIGINS', [
      'http://localhost:8080',
    ]);

    app.enableCors({
      origin: (origin, callback) => {
        // 允许没有origin的请求（如移动应用、curl等）
        if (!origin) {
          callback(null, true);
          return;
        }

        // 检查origin是否在允许列表中
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          this.logger.warn(`CORS阻止了来自 ${origin} 的请求`, 'SecurityService');
          callback(new Error('不允许的CORS请求'), false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers',
        'X-CSRF-Token',
      ],
      exposedHeaders: [
        'Content-Range',
        'X-Content-Range',
        'X-Total-Count',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ],
      maxAge: 86400, // 24小时
    });
  }

  /**
   * 配置Swagger安全
   */
  private configureSwaggerSecurity(app: INestApplication) {
    if (!this.configService.get('SWAGGER_ENABLED', true)) {
      return;
    }

    const config = new DocumentBuilder()
      .setTitle('Facebook Auto Bot API')
      .setDescription('Facebook自动化机器人SaaS平台API文档')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: '输入JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'API密钥认证',
        },
        'API-Key',
      )
      .addSecurityRequirements('JWT-auth')
      .addSecurityRequirements('API-Key')
      .addTag('认证', '用户认证相关接口')
      .addTag('用户', '用户管理接口')
      .addTag('账号', 'Facebook账号管理接口')
      .addTag('任务', '自动化任务管理接口')
      .addTag('监控', '系统监控接口')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    
    // 添加安全响应头
    const swaggerPath = this.configService.get('SWAGGER_PATH', 'api-docs');
    app.use(`/${swaggerPath}`, (req, res, next) => {
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });

    SwaggerModule.setup(swaggerPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
        tryItOutEnabled: true,
        displayOperationId: true,
      },
      customSiteTitle: 'Facebook Auto Bot API文档',
      customfavIcon: '/favicon.ico',
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .information-container { display: none }
        .swagger-ui .scheme-container { padding: 10px 0 }
      `,
    });
  }

  /**
   * 检查依赖漏洞
   */
  async checkDependencies(): Promise<{
    vulnerabilities: any[];
    needsUpdate: boolean;
  }> {
    try {
      // 这里可以集成Snyk或其他漏洞扫描工具
      // 目前返回模拟数据
      return {
        vulnerabilities: [],
        needsUpdate: false,
      };
    } catch (error) {
      this.logger.error('检查依赖漏洞失败', error.stack, 'SecurityService');
      return {
        vulnerabilities: [],
        needsUpdate: false,
      };
    }
  }

  /**
   * 生成安全报告
   */
  async generateSecurityReport(): Promise<any> {
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.configService.get('NODE_ENV', 'development'),
      security: {
        headers: SecurityMiddleware.getSecurityHeaders(),
        cors: {
          enabled: true,
          allowedOrigins: this.configService.get<string[]>('CORS_ALLOWED_ORIGINS', []),
        },
        rateLimit: {
          enabled: true,
          windowMs: 15 * 60 * 1000,
          max: 100,
        },
        csrf: {
          enabled: this.configService.get('CSRF_ENABLED', true),
        },
        helmet: {
          enabled: true,
        },
      },
      dependencies: await this.checkDependencies(),
      recommendations: [
        '定期更新依赖包',
        '使用强密码策略',
        '启用双因素认证',
        '定期进行安全审计',
        '监控异常登录行为',
      ],
    };

    return report;
  }

  /**
   * 验证JWT令牌
   */
  validateJWT(token: string): boolean {
    try {
      // 这里应该使用实际的JWT验证逻辑
      // 目前返回模拟验证
      return !!token && token.length > 10;
    } catch (error) {
      this.logger.error('JWT验证失败', error.stack, 'SecurityService');
      return false;
    }
  }

  /**
   * 生成安全日志
   */
  logSecurityEvent(event: string, details: any) {
    this.logger.log(`安全事件: ${event}`, 'SecurityService', {
      ...details,
      timestamp: new Date().toISOString(),
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
    });
  }
}