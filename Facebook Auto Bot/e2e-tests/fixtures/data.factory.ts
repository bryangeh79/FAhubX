import { faker } from '@faker-js/faker';

export class DataFactory {
  /**
   * 创建测试用户数据
   */
  static createUser(overrides = {}) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    return {
      email: faker.internet.email({ firstName, lastName }),
      password: 'Test123!',
      firstName,
      lastName,
      phone: faker.phone.number(),
      company: faker.company.name(),
      role: 'USER',
      ...overrides
    };
  }

  /**
   * 创建Facebook账号数据
   */
  static createFacebookAccount(overrides = {}) {
    const username = faker.internet.userName();
    
    return {
      username,
      email: faker.internet.email(),
      password: 'FacebookTest123!',
      cookies: JSON.stringify({
        session: faker.string.alphanumeric(32),
        token: faker.string.alphanumeric(64)
      }),
      status: 'ACTIVE',
      lastLogin: faker.date.recent().toISOString(),
      proxyType: 'RESIDENTIAL',
      proxyHost: faker.internet.ip(),
      proxyPort: faker.number.int({ min: 1000, max: 9999 }),
      proxyUsername: faker.internet.userName(),
      proxyPassword: faker.internet.password(),
      userAgent: faker.internet.userAgent(),
      notes: faker.lorem.sentence(),
      tags: ['test', 'automation'],
      ...overrides
    };
  }

  /**
   * 创建任务数据
   */
  static createTask(overrides = {}) {
    const taskTypes = ['POST', 'COMMENT', 'LIKE', 'SHARE', 'MESSAGE'];
    const schedules = ['IMMEDIATE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'];
    
    return {
      name: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      type: faker.helpers.arrayElement(taskTypes),
      schedule: faker.helpers.arrayElement(schedules),
      scheduleTime: faker.date.future().toISOString(),
      targetUrl: faker.internet.url(),
      content: faker.lorem.paragraph(),
      accounts: [],
      enabled: true,
      maxRetries: 3,
      retryDelay: 60,
      ...overrides
    };
  }

  /**
   * 创建对话剧本数据
   */
  static createConversationScript(overrides = {}) {
    return {
      name: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      triggerWords: faker.lorem.words(5).split(' '),
      responses: [
        {
          condition: 'CONTAINS_KEYWORD',
          keywords: ['hello', 'hi'],
          response: faker.lorem.sentence(),
          delay: 5
        },
        {
          condition: 'DEFAULT',
          response: faker.lorem.sentence(),
          delay: 10
        }
      ],
      enabled: true,
      priority: faker.number.int({ min: 1, max: 10 }),
      ...overrides
    };
  }

  /**
   * 创建系统配置数据
   */
  static createSystemConfig(overrides = {}) {
    return {
      key: faker.lorem.word(),
      value: faker.lorem.sentence(),
      description: faker.lorem.sentence(),
      category: faker.helpers.arrayElement(['GENERAL', 'SECURITY', 'NOTIFICATION', 'PERFORMANCE']),
      isPublic: faker.datatype.boolean(),
      ...overrides
    };
  }

  /**
   * 创建批量操作数据
   */
  static createBatchOperation(overrides = {}) {
    return {
      operation: faker.helpers.arrayElement(['IMPORT', 'EXPORT', 'UPDATE', 'DELETE']),
      targetType: faker.helpers.arrayElement(['ACCOUNTS', 'TASKS', 'SCRIPTS']),
      fileUrl: faker.internet.url(),
      totalItems: faker.number.int({ min: 10, max: 100 }),
      processedItems: 0,
      status: 'PENDING',
      ...overrides
    };
  }

  /**
   * 生成测试文件内容
   */
  static generateTestFileContent(type: 'accounts' | 'tasks' | 'scripts', count = 10) {
    const items = [];
    
    for (let i = 0; i < count; i++) {
      switch (type) {
        case 'accounts':
          items.push(this.createFacebookAccount({ id: i + 1 }));
          break;
        case 'tasks':
          items.push(this.createTask({ id: i + 1 }));
          break;
        case 'scripts':
          items.push(this.createConversationScript({ id: i + 1 }));
          break;
      }
    }
    
    return JSON.stringify(items, null, 2);
  }
}

// 导出faker以便在测试中直接使用
export { faker };