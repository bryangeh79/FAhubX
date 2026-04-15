import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');
const responseTimeTrend = new Trend('response_time');

// 测试配置
export const options = {
  stages: [
    // 预热阶段
    { duration: '30s', target: 10 },
    // 正常负载阶段
    { duration: '2m', target: 50 },
    // 峰值负载阶段
    { duration: '1m', target: 100 },
    // 冷却阶段
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // 95%的请求响应时间应小于500ms
    'http_req_duration': ['p(95)<500'],
    // 错误率应小于1%
    'errors': ['rate<0.01'],
    // 检查成功率
    'checks': ['rate>0.99']
  },
  ext: {
    loadimpact: {
      projectID: 123456,
      name: 'Facebook Auto Bot API性能测试'
    }
  }
};

// 测试数据
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'test@example.com',
  password: 'test123'
};

let authToken = '';

// 初始化函数 - 获取认证令牌
export function setup() {
  console.log('🔐 获取认证令牌...');
  
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(TEST_USER), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (loginRes.status === 200) {
    const data = loginRes.json();
    authToken = data.access_token;
    console.log(`✅ 认证成功，令牌: ${authToken.substring(0, 20)}...`);
    return { token: authToken };
  } else {
    console.error('❌ 认证失败:', loginRes.status, loginRes.body);
    throw new Error('认证失败');
  }
}

// 主要测试函数
export default function(data) {
  const token = data.token;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 测试组1: 用户相关API
  group('用户API测试', function() {
    // 获取用户信息
    const userRes = http.get(`${BASE_URL}/api/users/me`, { headers });
    
    check(userRes, {
      '获取用户信息状态码为200': (r) => r.status === 200,
      '获取用户信息响应时间<200ms': (r) => r.timings.duration < 200,
      '响应包含用户信息': (r) => r.json().email !== undefined
    });
    
    errorRate.add(userRes.status !== 200);
    responseTimeTrend.add(userRes.timings.duration);
    
    sleep(0.5);
  });

  // 测试组2: 账号管理API
  group('账号管理API测试', function() {
    // 获取账号列表
    const accountsRes = http.get(`${BASE_URL}/api/accounts`, { headers });
    
    check(accountsRes, {
      '获取账号列表状态码为200': (r) => r.status === 200,
      '获取账号列表响应时间<300ms': (r) => r.timings.duration < 300,
      '响应包含账号数组': (r) => Array.isArray(r.json().data)
    });
    
    errorRate.add(accountsRes.status !== 200);
    responseTimeTrend.add(accountsRes.timings.duration);
    
    // 创建测试账号
    const newAccount = {
      username: `test_user_${__VU}_${__ITER}`,
      email: `test${__VU}_${__ITER}@example.com`,
      password: 'test123',
      status: 'active'
    };
    
    const createRes = http.post(`${BASE_URL}/api/accounts`, JSON.stringify(newAccount), { headers });
    
    check(createRes, {
      '创建账号状态码为201': (r) => r.status === 201,
      '创建账号响应时间<500ms': (r) => r.timings.duration < 500,
      '响应包含新账号ID': (r) => r.json().id !== undefined
    });
    
    errorRate.add(createRes.status !== 201);
    responseTimeTrend.add(createRes.timings.duration);
    
    sleep(0.8);
  });

  // 测试组3: 任务调度API
  group('任务调度API测试', function() {
    // 获取任务列表
    const tasksRes = http.get(`${BASE_URL}/api/tasks`, { headers });
    
    check(tasksRes, {
      '获取任务列表状态码为200': (r) => r.status === 200,
      '获取任务列表响应时间<400ms': (r) => r.timings.duration < 400,
      '响应包含任务数组': (r) => Array.isArray(r.json().data)
    });
    
    errorRate.add(tasksRes.status !== 200);
    responseTimeTrend.add(tasksRes.timings.duration);
    
    // 创建测试任务
    const newTask = {
      name: `测试任务_${__VU}_${__ITER}`,
      type: 'message',
      schedule: 'immediate',
      target_accounts: [1, 2, 3],
      content: '这是一个测试任务'
    };
    
    const createTaskRes = http.post(`${BASE_URL}/api/tasks`, JSON.stringify(newTask), { headers });
    
    check(createTaskRes, {
      '创建任务状态码为201': (r) => r.status === 201,
      '创建任务响应时间<600ms': (r) => r.timings.duration < 600,
      '响应包含新任务ID': (r) => r.json().id !== undefined
    });
    
    errorRate.add(createTaskRes.status !== 201);
    responseTimeTrend.add(createTaskRes.timings.duration);
    
    sleep(1);
  });

  // 测试组4: 实时数据API
  group('实时数据API测试', function() {
    // 获取系统状态
    const statusRes = http.get(`${BASE_URL}/api/system/status`, { headers });
    
    check(statusRes, {
      '获取系统状态状态码为200': (r) => r.status === 200,
      '获取系统状态响应时间<150ms': (r) => r.timings.duration < 150,
      '响应包含系统信息': (r) => r.json().uptime !== undefined
    });
    
    errorRate.add(statusRes.status !== 200);
    responseTimeTrend.add(statusRes.timings.duration);
    
    // 获取监控数据
    const metricsRes = http.get(`${BASE_URL}/api/system/metrics`, { headers });
    
    check(metricsRes, {
      '获取监控数据状态码为200': (r) => r.status === 200,
      '获取监控数据响应时间<250ms': (r) => r.timings.duration < 250,
      '响应包含性能指标': (r) => r.json().cpu !== undefined
    });
    
    errorRate.add(metricsRes.status !== 200);
    responseTimeTrend.add(metricsRes.timings.duration);
    
    sleep(0.3);
  });
}

// 清理函数
export function teardown(data) {
  console.log('🧹 测试完成，清理资源...');
  // 这里可以添加清理逻辑，如删除测试数据
}

// 辅助函数：生成测试报告
export function handleSummary(data) {
  const summary = {
    '测试概述': {
      '测试时间': new Date().toISOString(),
      '测试场景': 'Facebook Auto Bot API性能测试',
      '测试工具': 'k6',
      '测试时长': `${data.state.testRunDuration / 1000}秒`
    },
    '性能指标': {
      '总请求数': data.metrics.http_reqs.values.count,
      '请求成功率': `${((1 - data.metrics.http_req_failed.values.rate) * 100).toFixed(2)}%`,
      '平均响应时间': `${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`,
      'P95响应时间': `${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`,
      'P99响应时间': `${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`,
      '请求速率': `${data.metrics.http_reqs.values.rate.toFixed(2)}/s`,
      '数据传输量': {
        '发送': `${(data.metrics.data_sent.values.count / 1024 / 1024).toFixed(2)}MB`,
        '接收': `${(data.metrics.data_received.values.count / 1024 / 1024).toFixed(2)}MB`
      }
    },
    '阈值检查': {
      '响应时间P95<500ms': data.metrics.http_req_duration.values['p(95)'] < 500 ? '✅ 通过' : '❌ 失败',
      '错误率<1%': data.metrics.http_req_failed.values.rate < 0.01 ? '✅ 通过' : '❌ 失败',
      '检查成功率>99%': data.metrics.checks.values.rate > 0.99 ? '✅ 通过' : '❌ 失败'
    },
    '资源使用': {
      '虚拟用户数': data.state.vus,
      '最大虚拟用户数': data.state.vusMax,
      '迭代次数': data.metrics.iterations.values.count
    }
  };
  
  // 保存报告到文件
  const fs = require('fs');
  const path = require('path');
  const reportDir = path.join(__dirname, 'reports');
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `k6-report-${timestamp}.json`);
  
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`📊 测试报告已保存: ${reportPath}`);
  
  return {
    stdout: JSON.stringify(summary, null, 2)
  };
}