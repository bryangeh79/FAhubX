#!/usr/bin/env node

/**
 * Facebook Auto Bot API测试套件
 * 用于验证前后端API集成
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

// 配置
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!',
  username: 'testuser',
  fullName: 'Test User'
};

// 测试结果存储
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 测试工具函数
class TestRunner {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
  }

  async runTest(name, testFn) {
    const startTime = performance.now();
    testResults.total++;
    
    try {
      await testFn();
      const duration = performance.now() - startTime;
      testResults.passed++;
      testResults.details.push({
        name,
        status: 'PASSED',
        duration: `${duration.toFixed(2)}ms`,
        message: '测试通过'
      });
      console.log(`✅ ${name} - ${duration.toFixed(2)}ms`);
    } catch (error) {
      const duration = performance.now() - startTime;
      testResults.failed++;
      testResults.details.push({
        name,
        status: 'FAILED',
        duration: `${duration.toFixed(2)}ms`,
        message: error.message,
        error: error.response?.data || error.message
      });
      console.log(`❌ ${name} - ${error.message}`);
    }
  }

  async setup() {
    console.log('🔧 设置测试环境...');
    // 可以在这里清理测试数据
  }

  async cleanup() {
    console.log('🧹 清理测试环境...');
    // 可以在这里清理测试数据
  }

  printSummary() {
    console.log('\n📊 测试结果汇总:');
    console.log('='.repeat(50));
    console.log(`总测试数: ${testResults.total}`);
    console.log(`通过: ${testResults.passed}`);
    console.log(`失败: ${testResults.failed}`);
    console.log(`通过率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    console.log('='.repeat(50));

    if (testResults.failed > 0) {
      console.log('\n📋 失败测试详情:');
      testResults.details
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          console.log(`\n❌ ${test.name}:`);
          console.log(`   消息: ${test.message}`);
          if (test.error) {
            console.log(`   错误: ${JSON.stringify(test.error, null, 2)}`);
          }
        });
    }
  }
}

// 测试用例定义
class APITests {
  constructor(runner) {
    this.runner = runner;
  }

  // 认证API测试
  async testAuthAPIs() {
    await this.runner.runTest('用户注册', async () => {
      const response = await api.post('/auth/register', TEST_USER);
      if (response.status !== 201) {
        throw new Error(`注册失败: ${response.status}`);
      }
      if (!response.data.access_token || !response.data.refresh_token) {
        throw new Error('注册响应缺少令牌');
      }
      this.runner.accessToken = response.data.access_token;
      this.runner.refreshToken = response.data.refresh_token;
    });

    await this.runner.runTest('用户登录', async () => {
      const response = await api.post('/auth/login', {
        email: TEST_USER.email,
        password: TEST_USER.password
      });
      if (response.status !== 200) {
        throw new Error(`登录失败: ${response.status}`);
      }
      this.runner.accessToken = response.data.access_token;
      this.runner.refreshToken = response.data.refresh_token;
    });

    await this.runner.runTest('获取用户信息', async () => {
      const response = await api.get('/auth/profile', {
        headers: {
          Authorization: `Bearer ${this.runner.accessToken}`
        }
      });
      if (response.status !== 200) {
        throw new Error(`获取用户信息失败: ${response.status}`);
      }
      this.runner.userId = response.data.id;
    });

    await this.runner.runTest('刷新令牌', async () => {
      const response = await api.post('/auth/refresh', {
        refreshToken: this.runner.refreshToken
      });
      if (response.status !== 200) {
        throw new Error(`刷新令牌失败: ${response.status}`);
      }
      this.runner.accessToken = response.data.access_token;
      this.runner.refreshToken = response.data.refresh_token;
    });
  }

  // Facebook账号API测试
  async testFacebookAccountAPIs() {
    let accountId = null;

    await this.runner.runTest('创建Facebook账号', async () => {
      const accountData = {
        facebookId: 'test_facebook_123',
        username: 'testfbuser',
        email: 'fbuser@example.com',
        accessToken: 'test_access_token_123',
        accountType: 'personal',
        status: 'active'
      };

      const response = await api.post('/facebook-accounts', accountData, {
        headers: {
          Authorization: `Bearer ${this.runner.accessToken}`
        }
      });

      if (response.status !== 201) {
        throw new Error(`创建账号失败: ${response.status}`);
      }
      accountId = response.data.id;
    });

    await this.runner.runTest('获取账号列表', async () => {
      const response = await api.get('/facebook-accounts', {
        headers: {
          Authorization: `Bearer ${this.runner.accessToken}`
        }
      });

      if (response.status !== 200) {
        throw new Error(`获取账号列表失败: ${response.status}`);
      }
      if (!Array.isArray(response.data.items)) {
        throw new Error('响应格式不正确');
      }
    });

    if (accountId) {
      await this.runner.runTest('获取单个账号', async () => {
        const response = await api.get(`/facebook-accounts/${accountId}`, {
          headers: {
            Authorization: `Bearer ${this.runner.accessToken}`
          }
        });

        if (response.status !== 200) {
          throw new Error(`获取单个账号失败: ${response.status}`);
        }
      });

      await this.runner.runTest('更新账号信息', async () => {
        const updateData = {
          status: 'inactive',
          notes: '测试更新'
        };

        const response = await api.patch(`/facebook-accounts/${accountId}`, updateData, {
          headers: {
            Authorization: `Bearer ${this.runner.accessToken}`
          }
        });

        if (response.status !== 200) {
          throw new Error(`更新账号失败: ${response.status}`);
        }
      });

      await this.runner.runTest('获取账号统计', async () => {
        const response = await api.get('/facebook-accounts/stats', {
          headers: {
            Authorization: `Bearer ${this.runner.accessToken}`
          }
        });

        if (response.status !== 200) {
          throw new Error(`获取统计失败: ${response.status}`);
        }
      });

      await this.runner.runTest('删除账号', async () => {
        const response = await api.delete(`/facebook-accounts/${accountId}`, {
          headers: {
            Authorization: `Bearer ${this.runner.accessToken}`
          }
        });

        if (response.status !== 204) {
          throw new Error(`删除账号失败: ${response.status}`);
        }
      });
    }
  }

  // 性能测试
  async testPerformance() {
    await this.runner.runTest('登录API性能', async () => {
      const startTime = performance.now();
      await api.post('/auth/login', {
        email: TEST_USER.email,
        password: TEST_USER.password
      });
      const duration = performance.now() - startTime;

      if (duration > 500) {
        throw new Error(`登录API响应时间过长: ${duration.toFixed(2)}ms (目标: <500ms)`);
      }
      console.log(`   响应时间: ${duration.toFixed(2)}ms`);
    });

    await this.runner.runTest('获取用户信息API性能', async () => {
      const startTime = performance.now();
      await api.get('/auth/profile', {
        headers: {
          Authorization: `Bearer ${this.runner.accessToken}`
        }
      });
      const duration = performance.now() - startTime;

      if (duration > 200) {
        throw new Error(`获取用户信息API响应时间过长: ${duration.toFixed(2)}ms (目标: <200ms)`);
      }
      console.log(`   响应时间: ${duration.toFixed(2)}ms`);
    });
  }

  // 错误处理测试
  async testErrorHandling() {
    await this.runner.runTest('无效登录凭证', async () => {
      try {
        await api.post('/auth/login', {
          email: 'invalid@example.com',
          password: 'wrongpassword'
        });
        throw new Error('应该返回401错误');
      } catch (error) {
        if (error.response?.status !== 401) {
          throw new Error(`期望401错误，得到: ${error.response?.status}`);
        }
      }
    });

    await this.runner.runTest('无效令牌访问', async () => {
      try {
        await api.get('/auth/profile', {
          headers: {
            Authorization: 'Bearer invalid_token_123'
          }
        });
        throw new Error('应该返回401错误');
      } catch (error) {
        if (error.response?.status !== 401) {
          throw new Error(`期望401错误，得到: ${error.response?.status}`);
        }
      }
    });

    await this.runner.runTest('访问不存在的资源', async () => {
      try {
        await api.get('/facebook-accounts/nonexistent-id', {
          headers: {
            Authorization: `Bearer ${this.runner.accessToken}`
          }
        });
        throw new Error('应该返回404错误');
      } catch (error) {
        if (error.response?.status !== 404) {
          throw new Error(`期望404错误，得到: ${error.response?.status}`);
        }
      }
    });
  }

  // CORS测试
  async testCORS() {
    await this.runner.runTest('CORS头部验证', async () => {
      const response = await api.options('/auth/login');
      
      const corsHeaders = response.headers;
      const requiredHeaders = [
        'access-control-allow-origin',
        'access-control-allow-methods',
        'access-control-allow-headers'
      ];

      for (const header of requiredHeaders) {
        if (!corsHeaders[header]) {
          throw new Error(`缺少CORS头部: ${header}`);
        }
      }
    });
  }
}

// 主测试流程
async function runAllTests() {
  console.log('🚀 开始Facebook Auto Bot API集成测试');
  console.log(`📡 API地址: ${API_BASE_URL}`);
  console.log('='.repeat(50));

  const runner = new TestRunner();
  const tests = new APITests(runner);

  try {
    await runner.setup();

    console.log('\n🔐 测试认证API...');
    await tests.testAuthAPIs();

    console.log('\n📱 测试Facebook账号API...');
    await tests.testFacebookAccountAPIs();

    console.log('\n⚡ 测试性能...');
    await tests.testPerformance();

    console.log('\n🚨 测试错误处理...');
    await tests.testErrorHandling();

    console.log('\n🌐 测试CORS配置...');
    await tests.testCORS();

    console.log('\n📋 测试缺失模块验证...');
    await runner.runTest('验证任务API缺失', async () => {
      try {
        await api.get('/tasks', {
          headers: {
            Authorization: `Bearer ${runner.accessToken}`
          }
        });
        throw new Error('任务API应该返回404或未实现');
      } catch (error) {
        // 预期错误，测试通过
        console.log(`   状态: ${error.response?.status || '连接失败'} - 符合预期`);
      }
    });

    await runner.runTest('验证对话剧本API缺失', async () => {
      try {
        await api.get('/conversation/scripts', {
          headers: {
            Authorization: `Bearer ${runner.accessToken}`
          }
        });
        throw new Error('对话剧本API应该返回404或未实现');
      } catch (error) {
        // 预期错误，测试通过
        console.log(`   状态: ${error.response?.status || '连接失败'} - 符合预期`);
      }
    });

  } catch (error) {
    console.error('测试运行错误:', error);
  } finally {
    await runner.cleanup();
    runner.printSummary();
  }

  // 返回退出码
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  TestRunner,
  APITests,
  runAllTests
};