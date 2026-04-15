#!/usr/bin/env node

/**
 * 快速安全检查
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

console.log(`${colors.bold}${colors.cyan}=== Facebook Auto Bot 快速安全检查 ===${colors.reset}\n`);

// 检查硬编码密码
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
    console.log(`${colors.red}✗ 发现硬编码密码:${colors.reset}`);
    hardcodedPasswords.forEach(item => {
      console.log(`  ${colors.red}✗${colors.reset} 第${item.line}行: ${item.content}`);
    });
  } else {
    console.log(`${colors.green}✓ 未发现硬编码密码${colors.reset}`);
  }
} else {
  console.log(`${colors.yellow}⚠ .env文件不存在${colors.reset}`);
}

// 检查.gitignore
console.log(`\n${colors.blue}[2] 检查.gitignore配置${colors.reset}`);
const gitignorePath = path.join(__dirname, '../.gitignore');
if (fs.existsSync(gitignorePath)) {
  const content = fs.readFileSync(gitignorePath, 'utf8');
  
  const requiredPatterns = [
    '.env',
    '.env.local',
    'node_modules/',
    'logs/',
    '*.log',
  ];
  
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
  } else {
    console.log(`${colors.green}✓ .gitignore配置正确${colors.reset}`);
  }
} else {
  console.log(`${colors.yellow}⚠ .gitignore文件不存在${colors.reset}`);
}

// 检查安全头配置
console.log(`\n${colors.blue}[3] 检查安全头配置${colors.reset}`);
const mainTsPath = path.join(__dirname, '../backend/src/main.ts');
if (fs.existsSync(mainTsPath)) {
  const content = fs.readFileSync(mainTsPath, 'utf8');
  
  if (content.includes('helmet(')) {
    console.log(`${colors.green}✓ 已配置helmet安全头${colors.reset}`);
    
    // 检查详细配置
    if (content.includes('contentSecurityPolicy')) {
      console.log(`  ${colors.green}✓${colors.reset} 已配置内容安全策略`);
    } else {
      console.log(`  ${colors.yellow}⚠${colors.reset} 未配置内容安全策略`);
    }
    
    if (content.includes('hsts')) {
      console.log(`  ${colors.green}✓${colors.reset} 已配置HSTS`);
    } else {
      console.log(`  ${colors.yellow}⚠${colors.reset} 未配置HSTS`);
    }
  } else {
    console.log(`${colors.red}✗ 未配置helmet安全头${colors.reset}`);
  }
} else {
  console.log(`${colors.yellow}⚠ main.ts文件不存在${colors.reset}`);
}

// 检查CORS配置
console.log(`\n${colors.blue}[4] 检查CORS配置${colors.reset}`);
if (fs.existsSync(mainTsPath)) {
  const content = fs.readFileSync(mainTsPath, 'utf8');
  
  if (content.includes('enableCors')) {
    console.log(`${colors.green}✓ 已配置CORS${colors.reset}`);
    
    // 检查是否限制来源
    if (content.includes('origin:') && !content.includes('*')) {
      console.log(`  ${colors.green}✓${colors.reset} CORS来源已限制`);
    } else {
      console.log(`  ${colors.yellow}⚠${colors.reset} CORS来源未明确限制`);
    }
  } else {
    console.log(`${colors.red}✗ 未配置CORS${colors.reset}`);
  }
}

// 检查依赖漏洞
console.log(`\n${colors.blue}[5] 检查已知依赖漏洞${colors.reset}`);

// 已知有漏洞的包
const vulnerablePackages = {
  'serialize-javascript': '<3.1.0',
  'minimatch': '<9.0.7',
  'path-to-regexp': '<8.4.0',
  'tar': '<6.2.1',
  'tmp': '<0.2.4',
  'webpack': '<5.105.0',
};

function checkPackage(packagePath) {
  if (!fs.existsSync(packagePath)) {
    console.log(`  ${colors.yellow}⚠${colors.reset} ${packagePath} 不存在`);
    return;
  }
  
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    const foundVulns = [];
    Object.keys(vulnerablePackages).forEach(pkgName => {
      if (allDeps[pkgName]) {
        foundVulns.push(`${pkgName} (${allDeps[pkgName]}) - 建议版本: ${vulnerablePackages[pkgName]}`);
      }
    });
    
    if (foundVulns.length > 0) {
      console.log(`  ${colors.red}✗${colors.reset} 发现可能有漏洞的包:`);
      foundVulns.forEach(vuln => {
        console.log(`    ${colors.red}✗${colors.reset} ${vuln}`);
      });
    } else {
      console.log(`  ${colors.green}✓${colors.reset} 未发现已知漏洞包`);
    }
  } catch (error) {
    console.log(`  ${colors.yellow}⚠${colors.reset} 解析失败: ${error.message}`);
  }
}

console.log('  检查后端依赖...');
checkPackage(path.join(__dirname, '../backend/package.json'));

console.log('  检查前端依赖...');
checkPackage(path.join(__dirname, '../frontend/package.json'));

// 总结
console.log(`\n${colors.bold}${colors.cyan}=== 安全检查总结 ===${colors.reset}`);

console.log(`${colors.bold}关键问题:${colors.reset}`);
console.log(`  1. 硬编码密码 - ${hardcodedPasswords && hardcodedPasswords.length > 0 ? colors.red + '需要立即修复' + colors.reset : colors.green + '通过' + colors.reset}`);
console.log(`  2. 安全头配置 - ${fs.existsSync(mainTsPath) && content.includes('helmet(') ? colors.green + '通过' + colors.reset : colors.red + '需要修复' + colors.reset}`);
console.log(`  3. CORS配置 - ${fs.existsSync(mainTsPath) && content.includes('enableCors') ? colors.green + '通过' + colors.reset : colors.red + '需要修复' + colors.reset}`);
console.log(`  4. 依赖漏洞 - 需要运行完整扫描`);

console.log(`\n${colors.bold}建议操作:${colors.reset}`);
console.log(`  1. 移除所有硬编码密码，使用环境变量`);
console.log(`  2. 确保.gitignore包含敏感文件`);
console.log(`  3. 启用完整的安全头配置`);
console.log(`  4. 限制CORS来源`);
console.log(`  5. 更新有漏洞的依赖包`);

console.log(`\n${colors.cyan}安全是持续的过程，建议定期进行安全审计。${colors.reset}`);