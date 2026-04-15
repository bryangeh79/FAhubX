#!/usr/bin/env node

/**
 * API结构验证脚本
 * 验证前后端API结构一致性
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// 验证结果
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

function addResult(name, status, message, details = null) {
  results.total++;
  if (status === 'PASSED') results.passed++;
  if (status === 'FAILED') results.failed++;
  if (status === 'WARNING') results.warnings++;
  
  results.details.push({ name, status, message, details });
}

// 读取文件内容
function readFileIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

// 解析前端API服务
function parseFrontendAPI(apiContent) {
  const apis = {
    auth: [],
    accounts: [],
    tasks: [],
    conversation: [],
    dashboard: []
  };
  
  // 简单解析API方法
  const lines = apiContent.split('\n');
  let currentSection = null;
  
  for (const line of lines) {
    if (line.includes('export const authAPI =')) currentSection = 'auth';
    else if (line.includes('export const accountsAPI =')) currentSection = 'accounts';
    else if (line.includes('export const tasksAPI =')) currentSection = 'tasks';
    else if (line.includes('export const conversationAPI =')) currentSection = 'conversation';
    else if (line.includes('export const dashboardAPI =')) currentSection = 'dashboard';
    
    if (currentSection && line.includes(':')) {
      const match = line.match(/\s+(\w+):/);
      if (match) {
        apis[currentSection].push(match[1]);
      }
    }
  }
  
  return apis;
}

// 检查后端控制器
function checkBackendController(controllerPath, apiType) {
  const content = readFileIfExists(controllerPath);
  if (!content) return [];
  
  const endpoints = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    // 查找装饰器定义的方法
    if (line.includes('@Get(') || line.includes('@Post(') || 
        line.includes('@Put(') || line.includes('@Patch(') || 
        line.includes('@Delete(')) {
      const nextLine = lines[lines.indexOf(line) + 1];
      if (nextLine && nextLine.includes('async')) {
        const methodMatch = nextLine.match(/async\s+(\w+)/);
        if (methodMatch) {
          endpoints.push(methodMatch[1]);
        }
      }
    }
  }
  
  return endpoints;
}

// 主验证函数
async function validateAPIStructure() {
  console.log(colorize('🔍 Facebook Auto Bot API结构验证', 'cyan'));
  console.log(colorize('='.repeat(50), 'cyan'));
  
  // 1. 检查前端API服务文件
  const frontendApiPath = '/workspace/frontend/src/services/api.ts';
  const frontendApiContent = readFileIfExists(frontendApiPath);
  
  if (!frontendApiContent) {
    addResult('前端API服务文件', 'FAILED', '文件不存在');
  } else {
    addResult('前端API服务文件', 'PASSED', '文件存在且可读');
    
    // 解析前端API
    const frontendAPIs = parseFrontendAPI(frontendApiContent);
    
    console.log('\n📱 前端API定义:');
    console.log(colorize('  🔐 认证API:', 'blue'), frontendAPIs.auth.length, '个方法');
    console.log(colorize('  📱 账号API:', 'blue'), frontendAPIs.accounts.length, '个方法');
    console.log(colorize('  ⚡ 任务API:', 'blue'), frontendAPIs.tasks.length, '个方法');
    console.log(colorize('  💬 对话API:', 'blue'), frontendAPIs.conversation.length, '个方法');
    console.log(colorize('  📊 仪表板API:', 'blue'), frontendAPIs.dashboard.length, '个方法');
  }
  
  // 2. 检查后端控制器
  console.log('\n🔧 后端控制器检查:');
  
  const backendControllers = [
    { path: '/workspace/backend/src/modules/auth/auth.controller.ts', type: 'auth' },
    { path: '/workspace/backend/src/modules/facebook-accounts/facebook-accounts.controller.ts', type: 'accounts' }
  ];
  
  const backendEndpoints = {
    auth: [],
    accounts: [],
    tasks: [],
    conversation: [],
    dashboard: []
  };
  
  for (const controller of backendControllers) {
    const endpoints = checkBackendController(controller.path, controller.type);
    backendEndpoints[controller.type] = endpoints;
    
    if (endpoints.length > 0) {
      addResult(`${controller.type}控制器`, 'PASSED', `找到${endpoints.length}个端点`);
      console.log(colorize(`  ✅ ${controller.type}:`, 'green'), endpoints.length, '个端点');
    } else {
      addResult(`${controller.type}控制器`, 'FAILED', '未找到端点或文件不存在');
      console.log(colorize(`  ❌ ${controller.type}:`, 'red'), '未找到端点');
    }
  }
  
  // 3. 检查缺失的控制器
  const missingControllers = [
    { type: 'tasks', path: '/workspace/backend/src/modules/tasks/tasks.controller.ts' },
    { type: 'conversation', path: '/workspace/backend/src/modules/conversation/conversation.controller.ts' },
    { type: 'dashboard', path: '/workspace/backend/src/modules/dashboard/dashboard.controller.ts' }
  ];
  
  for (const controller of missingControllers) {
    const exists = fs.existsSync(controller.path);
    if (!exists) {
      addResult(`${controller.type}控制器`, 'FAILED', '控制器文件不存在');
      console.log(colorize(`  ❌ ${controller.type}:`, 'red'), '控制器文件不存在');
    } else {
      const endpoints = checkBackendController(controller.path, controller.type);
      backendEndpoints[controller.type] = endpoints;
      addResult(`${controller.type}控制器`, 'PASSED', `找到${endpoints.length}个端点`);
      console.log(colorize(`  ✅ ${controller.type}:`, 'green'), endpoints.length, '个端点');
    }
  }
  
  // 4. API兼容性分析
  console.log('\n🔗 API兼容性分析:');
  
  if (frontendApiContent) {
    const frontendAPIs = parseFrontendAPI(frontendApiContent);
    
    // 认证API兼容性
    console.log(colorize('\n  🔐 认证API兼容性:', 'yellow'));
    const authMethods = ['login', 'register', 'refresh', 'logout', 'getProfile', 'changePassword'];
    for (const method of authMethods) {
      const hasFrontend = frontendAPIs.auth.includes(method);
      const hasBackend = backendEndpoints.auth.some(e => e.toLowerCase().includes(method.toLowerCase()));
      
      if (hasFrontend && hasBackend) {
        console.log(colorize(`    ✅ ${method}:`, 'green'), '前后端匹配');
      } else if (hasFrontend && !hasBackend) {
        console.log(colorize(`    ❌ ${method}:`, 'red'), '前端有定义，后端未实现');
        addResult(`认证API-${method}`, 'FAILED', '后端未实现');
      } else if (!hasFrontend && hasBackend) {
        console.log(colorize(`    ⚠️ ${method}:`, 'yellow'), '后端有实现，前端未调用');
        addResult(`认证API-${method}`, 'WARNING', '前端未调用');
      }
    }
    
    // 账号API兼容性
    console.log(colorize('\n  📱 账号API兼容性:', 'yellow'));
    const accountMethods = ['getAccounts', 'getAccount', 'createAccount', 'updateAccount', 'deleteAccount', 'getAccountStats', 'getExpiringAccounts'];
    for (const method of accountMethods) {
      const hasFrontend = frontendAPIs.accounts.includes(method);
      const hasBackend = backendEndpoints.accounts.some(e => {
        const endpointName = e.toLowerCase();
        const methodName = method.toLowerCase();
        return endpointName.includes(methodName) || 
               (methodName === 'getaccounts' && endpointName.includes('findall')) ||
               (methodName === 'getaccount' && endpointName.includes('findone'));
      });
      
      if (hasFrontend && hasBackend) {
        console.log(colorize(`    ✅ ${method}:`, 'green'), '前后端匹配');
      } else if (hasFrontend && !hasBackend) {
        console.log(colorize(`    ❌ ${method}:`, 'red'), '前端有定义，后端未实现');
        addResult(`账号API-${method}`, 'FAILED', '后端未实现');
      }
    }
    
    // 检查缺失模块
    console.log(colorize('\n  ⚠️ 缺失模块检查:', 'yellow'));
    const missingModules = ['tasks', 'conversation', 'dashboard'];
    for (const module of missingModules) {
      const hasFrontendMethods = frontendAPIs[module].length > 0;
      const hasBackendEndpoints = backendEndpoints[module].length > 0;
      
      if (hasFrontendMethods && !hasBackendEndpoints) {
        console.log(colorize(`    ❌ ${module}模块:`, 'red'), '前端有API定义，后端未实现');
        addResult(`${module}模块`, 'FAILED', '后端未实现');
      } else if (!hasFrontendMethods && !hasBackendEndpoints) {
        console.log(colorize(`    ⚠️ ${module}模块:`, 'yellow'), '前后端均未实现');
        addResult(`${module}模块`, 'WARNING', '前后端均未实现');
      }
    }
  }
  
  // 5. TypeScript配置检查
  console.log(colorize('\n📝 TypeScript配置检查:', 'cyan'));
  
  const tsConfigPaths = [
    '/workspace/frontend/tsconfig.json',
    '/workspace/backend/tsconfig.json'
  ];
  
  for (const tsConfigPath of tsConfigPaths) {
    const exists = fs.existsSync(tsConfigPath);
    if (exists) {
      const content = readFileIfExists(tsConfigPath);
      if (content && content.includes('"strict": true')) {
        addResult(path.basename(tsConfigPath), 'PASSED', 'TypeScript严格模式已启用');
        console.log(colorize(`  ✅ ${path.basename(tsConfigPath)}:`, 'green'), '严格模式已启用');
      } else {
        addResult(path.basename(tsConfigPath), 'WARNING', 'TypeScript严格模式未启用');
        console.log(colorize(`  ⚠️ ${path.basename(tsConfigPath)}:`, 'yellow'), '严格模式未启用');
      }
    } else {
      addResult(path.basename(tsConfigPath), 'FAILED', '文件不存在');
      console.log(colorize(`  ❌ ${path.basename(tsConfigPath)}:`, 'red'), '文件不存在');
    }
  }
  
  // 6. 环境配置检查
  console.log(colorize('\n🌐 环境配置检查:', 'cyan'));
  
  const envFiles = [
    '/workspace/backend/.env',
    '/workspace/backend/.env.example'
  ];
  
  for (const envFile of envFiles) {
    const exists = fs.existsSync(envFile);
    if (exists) {
      const content = readFileIfExists(envFile);
      const hasJwtSecret = content && content.includes('JWT_SECRET');
      const hasDbConfig = content && (content.includes('DB_HOST') || content.includes('DATABASE_URL'));
      
      if (hasJwtSecret && hasDbConfig) {
        addResult(path.basename(envFile), 'PASSED', '关键配置存在');
        console.log(colorize(`  ✅ ${path.basename(envFile)}:`, 'green'), '关键配置完整');
      } else {
        addResult(path.basename(envFile), 'WARNING', '缺少关键配置');
        console.log(colorize(`  ⚠️ ${path.basename(envFile)}:`, 'yellow'), '缺少关键配置');
      }
    } else {
      addResult(path.basename(envFile), 'FAILED', '文件不存在');
      console.log(colorize(`  ❌ ${path.basename(envFile)}:`, 'red'), '文件不存在');
    }
  }
  
  // 输出总结
  console.log(colorize('\n📊 验证结果汇总:', 'cyan'));
  console.log(colorize('='.repeat(50), 'cyan'));
  console.log(`总检查项: ${results.total}`);
  console.log(colorize(`通过: ${results.passed}`, 'green'));
  console.log(colorize(`失败: ${results.failed}`, results.failed > 0 ? 'red' : 'green'));
  console.log(colorize(`警告: ${results.warnings}`, results.warnings > 0 ? 'yellow' : 'green'));
  
  const passRate = ((results.passed / results.total) * 100).toFixed(1);
  console.log(`通过率: ${passRate}%`);
  
  if (results.failed > 0) {
    console.log(colorize('\n❌ 失败项目详情:', 'red'));
    results.details
      .filter(r => r.status === 'FAILED')
      .forEach(r => {
        console.log(colorize(`  ${r.name}:`, 'red'), r.message);
      });
  }
  
  if (results.warnings > 0) {
    console.log(colorize('\n⚠️ 警告项目详情:', 'yellow'));
    results.details
      .filter(r => r.status === 'WARNING')
      .forEach(r => {
        console.log(colorize(`  ${r.name}:`, 'yellow'), r.message);
      });
  }
  
  console.log(colorize('\n💡 建议:', 'cyan'));
  console.log('1. 优先修复失败的API兼容性问题');
  console.log('2. 实现缺失的任务、对话剧本、仪表板模块');
  console.log('3. 完善TypeScript类型定义');
  console.log('4. 添加API集成测试');
  
  return results;
}

// 运行验证
if (require.main === module) {
  validateAPIStructure().catch(error => {
    console.error('验证过程出错:', error);
    process.exit(1);
  });
}

module.exports = { validateAPIStructure };