/**
 * 安全监控配置
 * 配置安全事件监控和告警
 */

module.exports = {
  // 监控配置
  monitoring: {
    // 日志监控
    logs: {
      enabled: true,
      level: 'warn', // 监控warn及以上级别的日志
      patterns: [
        // 安全相关日志模式
        /authentication failed/i,
        /invalid token/i,
        /access denied/i,
        /brute force/i,
        /sql injection/i,
        /xss attack/i,
        /csrf violation/i,
        /rate limit exceeded/i,
        /suspicious activity/i,
        /security violation/i,
      ],
    },

    // 登录监控
    login: {
      enabled: true,
      maxAttempts: 5, // 最大尝试次数
      lockoutDuration: 15 * 60 * 1000, // 锁定15分钟
      suspiciousPatterns: [
        // 可疑登录模式
        'multiple failed logins from same IP',
        'login from unusual location',
        'login at unusual time',
        'login with compromised credentials',
      ],
    },

    // API监控
    api: {
      enabled: true,
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 100, // 最大请求数
      },
      suspiciousEndpoints: [
        // 需要特别监控的端点
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/reset-password',
        '/api/users',
        '/api/accounts',
        '/api/admin',
      ],
    },

    // 文件监控
    files: {
      enabled: true,
      watchPaths: [
        // 监控重要文件
        '/etc/passwd',
        '/etc/shadow',
        '/var/log',
        '/tmp',
        '/uploads',
      ],
      suspiciousPatterns: [
        // 可疑文件操作
        '.php',
        '.sh',
        '.exe',
        'web shell',
        'backdoor',
      ],
    },
  },

  // 告警配置
  alerts: {
    // 邮件告警
    email: {
      enabled: true,
      recipients: ['security@fbautobot.com'],
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      templates: {
        securityAlert: `
          安全告警通知
          
          时间: {{timestamp}}
          级别: {{level}}
          事件: {{event}}
          详情: {{details}}
          
          IP地址: {{ip}}
          用户代理: {{userAgent}}
          
          请立即检查系统安全状态。
        `,
        loginAlert: `
          登录异常告警
          
          时间: {{timestamp}}
          用户: {{username}}
          IP地址: {{ip}}
          位置: {{location}}
          设备: {{device}}
          
          登录状态: {{status}}
          失败次数: {{failedAttempts}}
          
          建议操作:
          1. 检查是否为合法登录
          2. 如非本人操作，立即重置密码
          3. 查看登录历史记录
        `,
      },
    },

    // Slack告警
    slack: {
      enabled: false,
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: '#security-alerts',
      username: 'Security Bot',
      icon_emoji: ':warning:',
    },

    // Webhook告警
    webhook: {
      enabled: false,
      url: process.env.SECURITY_WEBHOOK_URL,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.SECURITY_WEBHOOK_API_KEY,
      },
    },
  },

  // 响应配置
  response: {
    // 自动响应动作
    autoResponse: {
      enabled: true,
      actions: [
        {
          condition: 'failed_logins > 5',
          action: 'block_ip',
          duration: '15m',
        },
        {
          condition: 'suspicious_file_upload',
          action: 'quarantine_file',
        },
        {
          condition: 'sql_injection_attempt',
          action: 'block_ip',
          duration: '1h',
        },
        {
          condition: 'xss_attempt',
          action: 'block_ip',
          duration: '30m',
        },
      ],
    },

    // 手动响应流程
    manualResponse: {
      escalation: [
        {
          level: 1,
          contact: 'security@fbautobot.com',
          timeframe: '15m',
        },
        {
          level: 2,
          contact: 'admin@fbautobot.com',
          timeframe: '30m',
        },
        {
          level: 3,
          contact: 'emergency@fbautobot.com',
          timeframe: '1h',
        },
      ],
      procedures: [
        '确认安全事件',
        '收集证据和日志',
        '隔离受影响系统',
        '修复安全漏洞',
        '恢复系统服务',
        '编写事件报告',
      ],
    },
  },

  // 报告配置
  reports: {
    // 日报
    daily: {
      enabled: true,
      schedule: '0 8 * * *', // 每天8点
      recipients: ['security@fbautobot.com'],
      include: [
        'security_events',
        'failed_logins',
        'blocked_ips',
        'vulnerability_scans',
        'recommendations',
      ],
    },

    // 周报
    weekly: {
      enabled: true,
      schedule: '0 9 * * 1', // 每周一9点
      recipients: ['security@fbautobot.com', 'admin@fbautobot.com'],
      include: [
        'weekly_summary',
        'trend_analysis',
        'compliance_status',
        'improvement_plan',
      ],
    },

    // 月报
    monthly: {
      enabled: true,
      schedule: '0 10 1 * *', // 每月1号10点
      recipients: ['security@fbautobot.com', 'admin@fbautobot.com', 'management@fbautobot.com'],
      include: [
        'monthly_overview',
        'security_metrics',
        'risk_assessment',
        'budget_planning',
      ],
    },
  },

  // 合规配置
  compliance: {
    standards: [
      {
        name: 'OWASP Top 10',
        enabled: true,
        checks: [
          'injection_protection',
          'broken_authentication',
          'sensitive_data_exposure',
          'xxe_protection',
          'broken_access_control',
          'security_misconfiguration',
          'xss_protection',
          'insecure_deserialization',
          'vulnerable_components',
          'insufficient_logging',
        ],
      },
      {
        name: 'GDPR',
        enabled: true,
        checks: [
          'data_encryption',
          'user_consent',
          'data_retention',
          'data_deletion',
          'privacy_policy',
        ],
      },
      {
        name: 'PCI DSS',
        enabled: false,
        checks: [
          'network_security',
          'data_protection',
          'vulnerability_management',
          'access_control',
          'monitoring',
        ],
      },
    ],
  },

  // 集成配置
  integrations: {
    // 漏洞扫描工具
    vulnerabilityScanners: [
      {
        name: 'npm audit',
        enabled: true,
        command: 'npm audit',
        schedule: '0 0 * * 0', // 每周日
      },
      {
        name: 'snyk',
        enabled: false,
        apiKey: process.env.SNYK_API_KEY,
        schedule: '0 1 * * *', // 每天1点
      },
      {
        name: 'sonarqube',
        enabled: false,
        url: process.env.SONARQUBE_URL,
        token: process.env.SONARQUBE_TOKEN,
        schedule: '0 2 * * *', // 每天2点
      },
    ],

    // 安全信息源
    threatIntelligence: [
      {
        name: 'OWASP',
        enabled: true,
        url: 'https://owasp.org',
        updateFrequency: 'daily',
      },
      {
        name: 'CVE',
        enabled: true,
        url: 'https://cve.mitre.org',
        updateFrequency: 'daily',
      },
      {
        name: 'NVD',
        enabled: true,
        url: 'https://nvd.nist.gov',
        updateFrequency: 'daily',
      },
    ],
  },
};