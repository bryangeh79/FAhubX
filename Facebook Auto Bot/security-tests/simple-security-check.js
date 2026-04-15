#!/usr/bin/env node

/**
 * 简单安全检查
 * 检查最关键的安全问题
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
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

console.log(`${colors.bold}${colors.cyan}=== Facebook Auto Bot 安全检查 ===${colors.reset}\n`);

let hasCriticalIssues = false;
let hasWarnings = false;

// 1. 检查硬编码密码
console.log(`${colors.blue}[1] 检查硬编码密码${colors.reset}`);
const envPath = path.join(__dirname, '../backend/.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  
  const hardcodedPasswords = [];
  lines.forEach((line, index) => {
    if ((line.includes('password') || line.includes('secret')) && line.includes('=')) {
      const value = line.split('=')[1]?.trim();
      if (value && value !== '' && 
          !value.includes('your-') && 
          !value.includes('change-in-production')) {
        hardcodedPasswords.push({
          line: index + 1,
          content: line.trim()
        });
      }
    }
  });
  
  if (hardcodedPasswords.length > 0) {
    console.log(`${colors.red}✗ 发现硬编码密码 (严重问题):${colors.reset}`);
    hardcodedPasswords.forEach(item => {
      console.log(`  ${colors.red}✗${colors.reset} 第${item.line}行: ${item.content}`);
    });
    hasCriticalIssues = true;
  } else {
    console.log(`${colors.green}✓ 未发现硬编码密码${colors.reset}`);
  }
} else {
  console.log(`${colors.yellow}⚠ .env文件不存在${colors.reset}`);
  hasWarnings = true;
}

// 2. 检查安全头配置
console.log(`\n${colors.blue}[2] 检查安全头配置${colors.reset}`);
const mainTsPath = path.join(__dirname, '../backend/src/main.ts');
if (fs.existsSync(mainTsPath)) {
  const content = fs.readFileSync(mainTsPath, 'utf8');
  
  if (content.includes('helmet(')) {
    console.log(`${colors.green}✓ 已配置helmet安全头${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ 未配置helmet安全头 (严重问题)${colors.reset}`);
    hasCriticalIssues = true;
  }
} else {
  console.log(`${colors.yellow}⚠ main.ts文件不存在${colors.reset}`);
  hasWarnings = true;
}

// 3. 检查CORS配置
console.log(`\n${colors.blue}[3] 检查CORS配置${colors.reset}`);
if (fs.existsSync(mainTsPath)) {
  const content = fs.readFileSync(mainTsPath, 'utf8');
  
  if (content.includes('enableCors')) {
    console.log(`${colors.green}✓ 已配置CORS${colors.reset}`);
    
    // 检查是否限制来源
    if (content.includes('origin:') && !content.includes('*')) {
      console.log(`  ${colors.green}✓${colors.reset} CORS来源已限制`);
    } else {
      console.log(`  ${colors.yellow}⚠${colors.reset} CORS来源未明确限制`);
      hasWarnings = true;
    }
  } else {
    console.log(`${colors.red}✗ 未配置CORS (严重问题)${colors.reset}`);
    hasCriticalIssues = true;
  }
}

// 4. 检查.gitignore
console.log(`\n${colors.blue}[4] 检查.gitignore配置${colors.reset}`);
const gitignorePath = path.join(__dirname, '../.gitignore');
if (fs.existsSync(gitignorePath)) {
  const content = fs.readFileSync(gitignorePath, 'utf8');
  
  const requiredPatterns = ['.env', '.env.local', 'node_modules/', 'logs/'];
  const missingPatterns = [];
  
  requiredPatterns.forEach(pattern => {
    if (!content.includes(pattern)) {
      missingPatterns.push(pattern);
    }
  });
  
  if (missingPatterns.length > 0) {
    console.log(`${colors.yellow}⚠ .gitignore缺少必要模式:${colors.reset}`);
    missingPatterns.forEach(pattern => {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${pattern}`);
    });
    hasWarnings = true;
  } else {
    console.log(`${colors.green}✓ .gitignore配置正确${colors.reset}`);
  }
} else {
  console.log(`${colors.yellow}⚠ .gitignore文件不存在${colors.reset}`);
  hasWarnings = true;
}

// 5. 检查依赖管理
console.log(`\n${colors.blue}[5] 检查依赖管理${colors.reset}`);
const backendPackagePath = path.join(__dirname, '../backend/package.json');
const frontendPackagePath = path.join(__dirname, '../frontend/package.json');

if (fs.existsSync(backendPackagePath) && fs.existsSync(frontendPackagePath)) {
  console.log(`${colors.green}✓ 依赖文件存在${colors.reset}`);
  
  // 检查是否有package-lock.json
  if (fs.existsSync(path.join(__dirname, '../backend/package-lock.json')) &&
      fs.existsSync(path.join(__dirname, '../frontend/package-lock.json'))) {
    console.log(`  ${colors.green}✓${colors.reset} 已锁定依赖版本`);
  } else {
    console.log(`  ${colors.yellow}⚠${colors.reset} 建议使用package-lock.json锁定依赖版本`);
    hasWarnings = true;
  }
} else {
  console.log(`${colors.yellow}⚠ 依赖文件不完整${colors.reset}`);
  hasWarnings = true;
}

// 总结
console.log(`\n${colors.bold}${colors.cyan}=== 安全检查总结 ===${colors.reset}`);

if (hasCriticalIssues) {
  console.log(`${colors.red}✗ 存在严重安全问题，需要立即修复！${colors.reset}`);
  console.log(`\n${colors.bold}紧急修复措施:${colors.reset}`);
  console.log('  1. 移除所有硬编码密码，使用环境变量');
  console.log('  2. 配置helmet安全头（如果缺失）');
  console.log('  3. 配置CORS（如果缺失）');
  console.log('  4. 创建.env.local.example文件作为模板');
} else if (hasWarnings) {
  console.log(`${colors.yellow}⚠ 存在安全警告，建议修复${colors.reset}`);
  console.log(`\n${colors.bold}建议修复措施:${colors.reset}`);
  console.log('  1. 检查并修复所有警告');
  console.log('  2. 限制CORS来源到特定域名');
  console.log('  3. 确保.gitignore包含所有敏感文件');
  console.log('  4. 使用package-lock.json锁定依赖');
} else {
  console.log(`${colors.green}✓ 安全检查通过，未发现严重问题${colors.reset}`);
  console.log(`\n${colors.bold}保持安全的建议:${colors.reset}`);
  console.log('  1. 定期更新依赖包');
  console.log('  2. 定期进行安全审计');
  console.log('  3. 监控安全威胁情报');
  console.log('  4. 实施持续安全测试');
}

console.log(`\n${colors.cyan}安全是持续的过程，不是一次性的任务。${colors.reset}`);