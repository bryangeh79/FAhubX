#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { faker } = require('@faker-js/faker');

/**
 * 用户数据生成器
 * 生成测试用户数据
 */

class UserGenerator {
  constructor(options = {}) {
    this.options = {
      count: 10,
      locale: 'zh_CN',
      output: null,
      ...options
    };
    
    // 设置faker语言
    faker.setLocale(this.options.locale);
  }

  /**
   * 生成单个用户
   */
  generateUser(overrides = {}) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName });
    
    const user = {
      id: faker.string.uuid(),
      email: email.toLowerCase(),
      password: 'Test123!', // 默认测试密码
      firstName,
      lastName,
      phone: faker.phone.number(),
      company: faker.company.name(),
      role: faker.helpers.arrayElement(['ADMIN', 'USER']),
      status: faker.helpers.arrayElement(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      lastLogin: faker.helpers.maybe(() => faker.date.recent().toISOString(), { probability: 0.7 }),
      ...overrides
    };

    return user;
  }

  /**
   * 生成管理员用户
   */
  generateAdminUser() {
    return this.generateUser({
      email: 'admin@test.com',
      password: 'Admin123!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      status: 'ACTIVE'
    });
  }

  /**
   * 生成普通用户
   */
  generateRegularUser() {
    return this.generateUser({
      email: 'user@test.com',
      password: 'User123!',
      firstName: 'Regular',
      lastName: 'User',
      role: 'USER',
      status: 'ACTIVE'
    });
  }

  /**
   * 生成测试用户集合
   */
  generateUsers(count = null) {
    const userCount = count || this.options.count;
    const users = [];

    // 添加固定的测试用户
    users.push(this.generateAdminUser());
    users.push(this.generateRegularUser());

    // 生成随机用户
    for (let i = 0; i < userCount - 2; i++) {
      users.push(this.generateUser());
    }

    return users;
  }

  /**
   * 生成用户数据并保存到文件
   */
  generateAndSave() {
    const users = this.generateUsers();
    const data = {
      metadata: {
        generatedAt: new Date().toISOString(),
        count: users.length,
        locale: this.options.locale,
        version: '1.0.0'
      },
      users
    };

    if (this.options.output) {
      const outputPath = path.resolve(process.cwd(), this.options.output);
      const outputDir = path.dirname(outputPath);
      
      // 确保目录存在
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✅ 已生成 ${users.length} 个用户数据到: ${outputPath}`);
    }

    return data;
  }

  /**
   * 验证用户数据
   */
  validateUser(user) {
    const errors = [];

    // 验证必填字段
    const requiredFields = ['email', 'password', 'firstName', 'lastName', 'role', 'status'];
    for (const field of requiredFields) {
      if (!user[field]) {
        errors.push(`缺少必填字段: ${field}`);
      }
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      errors.push(`邮箱格式无效: ${user.email}`);
    }

    // 验证密码强度
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(user.password)) {
      errors.push('密码必须包含大小写字母、数字和特殊字符，且长度至少8位');
    }

    // 验证角色
    const validRoles = ['ADMIN', 'USER'];
    if (!validRoles.includes(user.role)) {
      errors.push(`无效的角色: ${user.role}`);
    }

    // 验证状态
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
    if (!validStatuses.includes(user.status)) {
      errors.push(`无效的状态: ${user.status}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 批量验证用户数据
   */
  validateUsers(users) {
    const results = {
      valid: 0,
      invalid: 0,
      errors: []
    };

    for (const user of users) {
      const validation = this.validateUser(user);
      if (validation.isValid) {
        results.valid++;
      } else {
        results.invalid++;
        results.errors.push({
          user: user.email,
          errors: validation.errors
        });
      }
    }

    return results;
  }
}

// 命令行接口
if (require.main === module) {
  const yargs = require('yargs/yargs');
  const { hideBin } = require('yargs/helpers');
  const argv = yargs(hideBin(process.argv))
    .option('count', {
      alias: 'c',
      type: 'number',
      description: '生成用户数量',
      default: 10
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      description: '输出文件路径',
      default: 'fixtures/users.json'
    })
    .option('locale', {
      alias: 'l',
      type: 'string',
      description: '语言区域',
      default: 'zh_CN'
    })
    .option('validate', {
      alias: 'v',
      type: 'boolean',
      description: '验证生成的数据',
      default: false
    })
    .help()
    .alias('help', 'h')
    .argv;

  const generator = new UserGenerator({
    count: argv.count,
    output: argv.output,
    locale: argv.locale
  });

  const data = generator.generateAndSave();

  if (argv.validate) {
    const validation = generator.validateUsers(data.users);
    console.log(`\n验证结果:`);
    console.log(`✅ 有效用户: ${validation.valid}`);
    console.log(`❌ 无效用户: ${validation.invalid}`);
    
    if (validation.errors.length > 0) {
      console.log('\n错误详情:');
      validation.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.user}:`);
        error.errors.forEach(err => console.log(`   - ${err}`));
      });
    }
  }
}

module.exports = UserGenerator;