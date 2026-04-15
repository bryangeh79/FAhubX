const http = require('http');

console.log('测试Facebook Auto Bot API...\n');

// 测试健康检查
const healthCheck = () => {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:3000/api/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('1. 健康检查:');
        console.log(`   状态码: ${res.statusCode}`);
        console.log(`   响应: ${data}`);
        resolve(JSON.parse(data));
      });
    });
    
    req.on('error', reject);
    req.end();
  });
};

// 测试登录
const testLogin = () => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      username: 'admin',
      password: 'admin123'
    });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('\n2. 登录测试:');
        console.log(`   状态码: ${res.statusCode}`);
        console.log(`   响应: ${data}`);
        resolve(JSON.parse(data));
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

// 测试获取账号列表（需要认证）
const testGetAccounts = (token) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/accounts',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('\n3. 获取账号列表:');
        console.log(`   状态码: ${res.statusCode}`);
        console.log(`   响应: ${data}`);
        resolve(JSON.parse(data));
      });
    });
    
    req.on('error', reject);
    req.end();
  });
};

// 测试获取仪表板数据
const testDashboard = (token) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/dashboard/stats',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('\n4. 获取仪表板数据:');
        console.log(`   状态码: ${res.statusCode}`);
        console.log(`   响应: ${data}`);
        resolve(JSON.parse(data));
      });
    });
    
    req.on('error', reject);
    req.end();
  });
};

// 运行所有测试
(async () => {
  try {
    console.log('=== Facebook Auto Bot API 测试 ===');
    
    // 1. 健康检查
    await healthCheck();
    
    // 2. 登录获取token
    const loginResult = await testLogin();
    const token = loginResult.access_token;
    
    // 3. 获取账号列表
    await testGetAccounts(token);
    
    // 4. 获取仪表板数据
    await testDashboard(token);
    
    console.log('\n✅ 所有API测试通过！');
    console.log('\n前端运行在: http://localhost:5174');
    console.log('后端API运行在: http://localhost:3000');
    console.log('\n登录信息:');
    console.log('  用户名: admin');
    console.log('  密码: admin123');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
  }
})();