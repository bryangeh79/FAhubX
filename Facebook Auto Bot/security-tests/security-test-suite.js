#!/usr/bin/env node

/**
 * 安全测试套件
 * 执行全面的安全测试
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// 测试结果
const testResults = {
  passed: [],
  failed: [],
  warnings: [],
  skipped: [],
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

/**
 * 运行测试
 */
async function runTests() {
  console.log(`${colors.bold}${colors.cyan}=== Facebook Auto Bot 安全测试套件 ===${colors.reset}\n`);
  
  try {
    // 1. 依赖漏洞扫描
    await testDependencyVulnerabilities();
    
    // 2. 代码安全检查
    await testCodeSecurity();
    
    // 3. 配置安全检查
    await testConfigSecurity();
    
    // 4. 敏感信息检查
    await testSensitiveInformation();
    
    // 5. 安全头检查
    await testSecurityHeaders();
    
    // 6. CORS配置检查
    await testCORSConfig();
    
    // 7. 密码策略检查
    await testPasswordPolicy();
    
    // 8. 会话安全检查
    await testSessionSecurity();
    
    // 输出测试结果
    printTestResults();
    
  } catch (error) {
    console.error(`${colors.red}测试执行失败:${colors.reset}`, error);
    process.exit(1);
  }
}

/**
 * 测试1: 依赖漏洞扫描
 */
async function testDependencyVulnerabilities() {
  console.log(`${colors.blue}[测试1] 依赖漏洞扫描${colors.reset}`);
  
  try {
    // 检查后端依赖
    console.log('  检查后端依赖...');
    const backendResult = execSync('cd backend && npm audit --json', { encoding: 'utf8' });
    const backendAudit = JSON.parse(backendResult);
    
    if (backendAudit.metadata && backendAudit.metadata.vulnerabilities) {
      const vulns = backendAudit.metadata.vulnerabilities;
      const total = (vulns.info || 0) + (vulns.low || 0) + (vulns.moderate || 0) + (vulns.high || 0) + (vulns.critical || 0);
      
      if (total > 0) {
        testResults.failed.push(`后端依赖存在 ${total} 个漏洞 (高危: ${vulns.high || 0}, 严重: ${vulns.critical || 0})`);
      } else {
        testResults.passed.push('后端依赖漏洞扫描通过');
      }
    }
    
    // 检查前端依赖
    console.log('  检查前端依赖...');
    const frontendResult = execSync('cd frontend && npm audit --json', { encoding: 'utf8' });
    const frontendAudit = JSON.parse(frontendResult);
    
    if (frontendAudit.metadata && frontendAudit.metadata.vulnerabilities) {
      const vulns = frontendAudit.metadata.vulnerabilities;
      const total = (vulns.info || 0) + (vulns.low || 0) + (vulns.moderate || 0) + (vulns.high || 0) + (vulns.critical || 0);
      
      if (total > 0) {
        testResults.failed.push(`前端依赖存在 ${total} 个漏洞 (高危: ${vulns.high || 0}, 严重: ${vulns.critical || 0})`);
      } else {
        testResults.passed.push('前端依赖漏洞扫描通过');
      }
    }
    
  } catch (error) {
    testResults.warnings.push(`依赖漏洞扫描失败: ${error.message}`);
  }
}

/**
 * 测试2: 代码安全检查
 */
async function testCodeSecurity() {
  console.log(`${colors.blue}[测试2] 代码安全检查${colors.reset}`);
  
  const securityPatterns = [
    {
      pattern: /eval\s*\(/g,
      issue: '使用 eval() 函数',
      severity: 'high'
    },
    {
      pattern: /new Function\s*\(/g,
      issue: '使用 Function 构造函数',
      severity: 'high'
    },
    {
      pattern: /child_process\.exec\s*\(/g,
      issue: '使用 exec() 执行系统命令',
      severity: 'high'
    },
    {
      pattern: /\.innerHTML\s*=/g,
      issue: '直接设置 innerHTML',
      severity: 'medium'
    },
    {
      pattern: /localStorage\.setItem\s*\(.*password.*\)/gi,
      issue: '在 localStorage 中存储密码',
      severity: 'high'
    },
    {
      pattern: /console\.log\s*\(.*password.*\)/gi,
      issue: '在日志中输出密码',
      severity: 'medium'
    },
    {
      pattern: /SELECT.*FROM.*WHERE.*\$\{/gi,
      issue: '可能的SQL注入漏洞',
      severity: 'high'
    },
    {
      pattern: /res\.send\s*\(.*req\.body/gi,
      issue: '直接输出用户输入',
      severity: 'medium'
    },
  ];
  
  let foundIssues = false;
  
  // 检查后端代码
  const backendFiles = findFiles(path.join(__dirname, '../backend/src'), ['.js', '.ts']);
  backendFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    securityPatterns.forEach(pattern => {
      const matches = content.match(pattern.pattern);
      if (matches) {
        foundIssues = true;
        testResults.warnings.push(`代码安全问题: ${file} - ${pattern.issue} (${pattern.severity})`);
      }
    });
  });
  
  // 检查前端代码
  const frontendFiles = findFiles(path.join(__dirname, '../frontend/src'), ['.js', '.ts', '.jsx', '.tsx']);
  frontendFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    securityPatterns.forEach(pattern => {
      const matches = content.match(pattern.pattern);
      if (matches) {
        foundIssues = true;
        testResults.warnings.push(`代码安全问题: ${file} - ${pattern.issue} (${pattern.severity})`);
      }
    });
  });
  
  if (!foundIssues) {
    testResults.passed.push('代码安全检查通过');
  }
}

/**
 * 测试3: 配置安全检查
 */
async function testConfigSecurity() {
  console.log(`${colors.blue}[测试3] 配置安全检查${colors.reset}`);
  
  const issues = [];
  
  // 检查环境变量文件
  const envFiles = [
    path.join(__dirname, '../backend/.env'),
    path.join(__dirname, '../backend/.env.example'),
  ];
  
  envFiles.forEach(envFile => {
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (line.includes('password') || line.includes('secret') || line.includes('key')) {
          if (line.includes('=')) {
            const value = line.split('=')[1]?.trim();
            if (value && value !== '' && 
                !value.includes('your-') && 
                !value.includes('change-in-production') &&
                !value.includes('example')) {
              issues.push(`${envFile}:${index + 1} - 硬编码的密码/密钥: ${line.trim()}`);
            }
          }
        }
      });
    }
  });
  
  if (issues.length > 0) {
    issues.forEach(issue => {
      testResults.failed.push(issue);
    });
  } else {
    testResults.passed.push('配置安全检查通过');
  }
}

/**
 * 测试4: 敏感信息检查
 */
async function testSensitiveInformation() {
  console.log(`${colors.blue}[测试4] 敏感信息检查${colors.reset}`);
  
  const sensitivePatterns = [
    /password\s*=\s*['"][^'"]{1,20}['"]/gi,
    /secret\s*=\s*['"][^'"]{1,50}['"]/gi,
    /key\s*=\s*['"][^'"]{1,50}['"]/gi,
    /token\s*=\s*['"][^'"]{1,100}['"]/gi,
    /api[_-]?key\s*=\s*['"][^'"]{1,100}['"]/gi,
    /aws[_-]?access[_-]?key\s*=\s*['"][^'"]{1,100}['"]/gi,
    /aws[_-]?secret[_-]?key\s*=\s*['"][^'"]{1,100}['"]/gi,
  ];
  
  let foundSensitive = false;
  
  // 检查所有源代码文件
  const sourceFiles = [
    ...findFiles(path.join(__dirname, '../backend/src'), ['.js', '.ts']),
    ...findFiles(path.join(__dirname, '../frontend/src'), ['.js', '.ts', '.jsx', '.tsx']),
  ];
  
  sourceFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    sensitivePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        foundSensitive = true;
        testResults.failed.push(`敏感信息泄露: ${file} - 找到 ${matches.length} 处敏感信息`);
      }
    });
  });
  
  if (!foundSensitive) {
    testResults.passed.push('敏感信息检查通过');
  }
}

/**
 * 测试5: 安全头检查
 */
async function testSecurityHeaders() {
  console.log(`${colors.blue}[测试5] 安全头检查${colors.reset}`);
  
  // 这里应该检查实际运行的应用
  // 目前只检查配置
  const requiredHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-XSS-Protection',
    'Strict-Transport-Security',
    'Content-Security-Policy',
    'Referrer-Policy',
  ];
  
  // 检查main.ts中的helmet配置
  const mainTsPath = path.join(__dirname, '../backend/src/main.ts');
  if (fs.existsSync(mainTsPath)) {
    const content = fs.readFileSync(mainTsPath, 'utf8');
    
    if (content.includes('helmet(') && content.includes('contentSecurityPolicy')) {
      testResults.passed.push('安全头配置检查通过');
    } else {
      testResults.warnings.push('安全头配置不完整，建议启用helmet中间件');
    }
  } else {
    testResults.skipped.push('main.ts文件不存在，跳过安全头检查');
  }
}

/**
 * 测试6: CORS配置检查
 */
async function testCORSConfig() {
  console.log(`${colors.blue}[测试6] CORS配置检查${colors.reset}`);
  
  const mainTsPath = path.join(__dirname, '../backend/src/main.ts');
  if (fs.existsSync(mainTsPath)) {
    const content = fs.readFileSync(mainTsPath, 'utf8');
    
    if (content.includes('enableCors') && content.includes('origin')) {
      testResults.passed.push('CORS配置检查通过');
    } else {
      testResults.warnings.push('CORS配置不完整，建议明确指定允许的源');
    }
  } else {
    testResults.skipped.push('main.ts文件不存在，跳过CORS检查');
  }
}

/**
 * 测试7: 密码策略检查
 */
async function testPasswordPolicy() {
  console.log(`${colors.blue}[测试7] 密码策略检查${colors.reset}`);
  
  // 检查是否有密码策略配置
  const envPath = path.join(__dirname, '../backend/.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    
    const hasPasswordPolicy = 
      content.includes('PASSWORD_MIN_LENGTH') ||
      content.includes('PASSWORD_REQUIRE_');
    
    if (hasPasswordPolicy) {
      testResults.passed.push('密码策略配置检查通过');
    } else {
      testResults.warnings.push('未找到密码策略配置，建议添加密码复杂度要求');
    }
  } else {
    testResults.skipped.push('.env文件不存在，跳过密码策略检查');
  }
}

/**
 * 测试8: 会话安全检查
 */
async function testSessionSecurity() {
  console.log(`${colors.blue}[测试8] 会话安全检查${colors.reset}`);
  
  // 检查会话配置
  const envPath = path.join(__dirname, '../backend/.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    
    const hasSessionSecurity = 
      content.includes('SESSION_TIMEOUT') ||
      content.includes('JWT_EXPIRES_IN');
    
    if (hasSessionSecurity) {
      testResults.passed.push('会话安全配置检查通过');
    } else {
      testResults.warnings.push('未找到会话超时配置，建议添加会话过期时间');
    }
  } else {
    testResults.skipped.push('.env文件不存在，跳开会话安全检查');
  }
}

/**
 * 辅助函数: 查找文件
 */
function findFiles(dir, extensions) {
  let results = [];
  
  if (!fs.existsSync(dir)) {
    return results;
  }
  
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  files.forEach(file => {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      // 跳过node_modules和.git目录
      if (file.name !== 'node_modules' && file.name !== '.git') {
        results = results.concat(findFiles(fullPath, extensions));
      }
    } else if (file.isFile()) {
      const ext = path.extname(file.name).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  });
  
  return results;
}

/**
 * 输出测试结果
 */
function printTestResults() {
  console.log(`\n${colors.bold}${colors.cyan}=== 测试结果汇总 ===${colors.reset}\n`);
  
  // 统计
  const total = testResults.passed.length + testResults.failed.length + 
                testResults.warnings.length + testResults.skipped.length;
  
  console.log(`${colors.bold}测试统计:${colors.reset}`);
  console.log(`  总计: ${total} 项测试`);
  console.log(`  ${colors.green}通过: ${testResults.passed.length}${colors.reset}`);
  console.log(`  ${colors.red}失败: ${testResults.failed.length}${colors.reset}`);
  console.log(`  ${colors.yellow}警告: ${testResults.warnings.length}${colors.reset}`);
  console.log(`  ${colors.blue}跳过: ${testResults.skipped.length}${colors.reset}`);
  
  // 输出通过的项目
  if (testResults.passed.length > 0) {
    console.log(`\n${colors.green}✓ 通过的项目:${colors.reset}`);
    testResults.passed.forEach(item => {
      console.log(`  ${colors.green}✓${colors.reset} ${item}`);
    });
  }
  
  // 输出失败的项目
  if (testResults.failed.length > 0) {
    console.log(`\n${colors.red}✗ 失败的项目:${colors.reset}`);
    testResults.failed.forEach(item => {
      console.log(`  ${colors.red}✗${colors.reset} ${item}`);
    });
  }
  
  // 输出警告
  if (testResults.warnings.length > 0) {
    console.log(`\n${colors.yellow}⚠ 警告:${colors.reset}`);
    testResults.warnings.forEach(item => {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${item}`);
    });
  }
  
  // 输出跳过的项目
  if (testResults.skipped.length > 0) {
    console.log(`\n${colors.blue}⏭ 跳过的项目:${colors.reset}`);
    testResults.skipped.forEach(item => {
      console.log(`  ${colors.blue}⏭${colors.reset} ${item}`);
    });
  }
  
  // 总结和建议
  console.log(`\n${colors.bold}${colors.cyan}=== 总结和建议 ===${colors.reset}`);
  
  if (testResults.failed.length > 0) {
    console.log(`${colors.red}存在严重安全问题，需要立即修复！${colors.reset}`);
    console.log(`${colors.yellow}建议:${colors.reset}`);
    console.log('  1. 修复所有失败的安全测试');
    console.log('  2. 检查并修复依赖漏洞');
    console.log('  3. 移除硬编码的密码和密钥');
    console.log('  4. 重新运行安全测试验证修复');
    process.exit(1);
  } else if (testResults.warnings.length > 0) {
    console.log(`${colors.yellow}存在安全警告，建议尽快修复。${colors.reset}`);
    console.log(`${colors.yellow}建议:${colors.reset}`);
    console.log('  1. 修复所有安全警告');
    console.log('  2. 增强安全配置');
    console.log('  3. 定期进行安全审计');
    process.exit(0);
  } else {
    console.log(`${colors.green}所有安全测试通过！系统安全性良好。${colors.reset}`);
    console.log(`${colors.green}建议:${colors.reset}`);
    console.log('  1. 继续保持安全最佳实践');
    console.log('  2. 定期更新依赖包');
    console.log('  3. 监控安全威胁情报');
    process.exit(0);
  }
}

// 运行测试
runTests().catch(error => {
  console.error(`${colors.red}测试套件执行失败:${colors.reset}`, error);
  process.exit(1);
});