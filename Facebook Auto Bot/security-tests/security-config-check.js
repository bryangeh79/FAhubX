#!/usr/bin/env node

/**
 * 安全配置检查脚本
 * 检查项目中的安全配置问题
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
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

// 安全检查结果
const results = {
  passed: [],
  warnings: [],
  errors: []
};

// 检查函数
function checkEnvFile(envPath) {
  console.log(`${colors.cyan}检查环境变量文件: ${envPath}${colors.reset}`);
  
  if (!fs.existsSync(envPath)) {
    results.warnings.push(`环境变量文件不存在: ${envPath}`);
    return;
  }
  
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  
  // 检查硬编码的密码和密钥
  const hardcodedSecrets = [];
  lines.forEach((line, index) => {
    if (line.includes('password') || line.includes('secret') || line.includes('key')) {
      if (line.includes('password') && line.includes('=')) {
        const value = line.split('=')[1]?.trim();
        if (value && value !== '' && !value.includes('your-') && !value.includes('change-in-production')) {
          hardcodedSecrets.push({
            line: index + 1,
            content: line.trim(),
            issue: '硬编码的密码/密钥'
          });
        }
      }
    }
  });
  
  if (hardcodedSecrets.length > 0) {
    hardcodedSecrets.forEach(secret => {
      results.errors.push(`环境变量文件 ${envPath}:${secret.line} - ${secret.issue}: ${secret.content}`);
    });
  } else {
    results.passed.push(`环境变量文件 ${envPath} 检查通过`);
  }
}

function checkPackageJson(packagePath) {
  console.log(`${colors.cyan}检查 package.json: ${packagePath}${colors.reset}`);
  
  if (!fs.existsSync(packagePath)) {
    results.warnings.push(`package.json 不存在: ${packagePath}`);
    return;
  }
  
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // 检查依赖版本
    const checkDependencies = (deps, type) => {
      if (!deps) return;
      
      const vulnerableDeps = {
        // 已知有安全漏洞的包
        'serialize-javascript': '<3.1.0',
        'minimatch': '<9.0.7',
        'path-to-regexp': '<8.4.0',
        'tar': '<6.2.1',
        'tmp': '<0.2.4',
        'webpack': '<5.105.0'
      };
      
      Object.keys(vulnerableDeps).forEach(dep => {
        if (deps[dep]) {
          results.warnings.push(`${type} 依赖 ${dep} 可能存在安全漏洞，建议升级到 ${vulnerableDeps[dep]}`);
        }
      });
    };
    
    checkDependencies(pkg.dependencies, '生产');
    checkDependencies(pkg.devDependencies, '开发');
    
    results.passed.push(`package.json ${packagePath} 检查完成`);
  } catch (error) {
    results.errors.push(`解析 package.json 失败: ${error.message}`);
  }
}

function checkCodeSecurity(codeDir) {
  console.log(`${colors.cyan}检查代码安全: ${codeDir}${colors.reset}`);
  
  if (!fs.existsSync(codeDir)) {
    results.warnings.push(`代码目录不存在: ${codeDir}`);
    return;
  }
  
  // 检查常见的代码安全问题
  const securityPatterns = [
    {
      pattern: /eval\s*\(/g,
      issue: '使用 eval() 函数，可能导致代码注入'
    },
    {
      pattern: /new Function\s*\(/g,
      issue: '使用 Function 构造函数，可能导致代码注入'
    },
    {
      pattern: /child_process\.exec\s*\(/g,
      issue: '使用 exec() 执行系统命令，可能导致命令注入'
    },
    {
      pattern: /child_process\.execSync\s*\(/g,
      issue: '使用 execSync() 执行系统命令，可能导致命令注入'
    },
    {
      pattern: /\.innerHTML\s*=/g,
      issue: '直接设置 innerHTML，可能导致 XSS 攻击'
    },
    {
      pattern: /document\.write\s*\(/g,
      issue: '使用 document.write()，可能导致 XSS 攻击'
    },
    {
      pattern: /localStorage\.setItem\s*\(.*password.*\)/gi,
      issue: '在 localStorage 中存储密码，不安全'
    },
    {
      pattern: /console\.log\s*\(.*password.*\)/gi,
      issue: '在日志中输出密码，可能导致信息泄露'
    }
  ];
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    files.forEach(file => {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        // 跳过 node_modules
        if (file.name !== 'node_modules') {
          scanDirectory(fullPath);
        }
      } else if (file.isFile() && (file.name.endsWith('.js') || file.name.endsWith('.ts') || file.name.endsWith('.jsx') || file.name.endsWith('.tsx'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          securityPatterns.forEach(pattern => {
            const matches = content.match(pattern.pattern);
            if (matches) {
              results.warnings.push(`代码文件 ${fullPath}: ${pattern.issue} (找到 ${matches.length} 处)`);
            }
          });
        } catch (error) {
          // 忽略读取错误
        }
      }
    });
  }
  
  scanDirectory(codeDir);
  results.passed.push(`代码安全检查完成: ${codeDir}`);
}

function checkDockerConfig(dockerPath) {
  console.log(`${colors.cyan}检查 Docker 配置: ${dockerPath}${colors.reset}`);
  
  if (!fs.existsSync(dockerPath)) {
    results.warnings.push(`Docker 配置文件不存在: ${dockerPath}`);
    return;
  }
  
  const content = fs.readFileSync(dockerPath, 'utf8');
  
  // 检查常见的安全问题
  const issues = [];
  
  if (content.includes('USER root')) {
    issues.push('使用 root 用户运行容器，建议创建非特权用户');
  }
  
  if (content.includes('COPY .env')) {
    issues.push('将 .env 文件复制到容器中，可能泄露敏感信息');
  }
  
  if (content.includes('npm install') && !content.includes('--production')) {
    issues.push('安装所有依赖（包括开发依赖），增加攻击面');
  }
  
  if (issues.length > 0) {
    issues.forEach(issue => {
      results.warnings.push(`Docker 配置 ${dockerPath}: ${issue}`);
    });
  } else {
    results.passed.push(`Docker 配置 ${dockerPath} 检查通过`);
  }
}

// 主函数
async function main() {
  console.log(`${colors.bold}${colors.cyan}=== Facebook Auto Bot 安全配置检查 ===${colors.reset}\n`);
  
  // 检查后端
  console.log(`${colors.bold}检查后端项目:${colors.reset}`);
  checkEnvFile(path.join(__dirname, '../backend/.env'));
  checkEnvFile(path.join(__dirname, '../backend/.env.example'));
  checkPackageJson(path.join(__dirname, '../backend/package.json'));
  checkCodeSecurity(path.join(__dirname, '../backend/src'));
  checkDockerConfig(path.join(__dirname, '../backend/Dockerfile.dev'));
  
  // 检查前端
  console.log(`\n${colors.bold}检查前端项目:${colors.reset}`);
  checkPackageJson(path.join(__dirname, '../frontend/package.json'));
  checkCodeSecurity(path.join(__dirname, '../frontend/src'));
  checkDockerConfig(path.join(__dirname, '../frontend/Dockerfile.dev'));
  
  // 输出结果
  console.log(`\n${colors.bold}${colors.cyan}=== 检查结果汇总 ===${colors.reset}\n`);
  
  if (results.passed.length > 0) {
    console.log(`${colors.green}✓ 通过的项目 (${results.passed.length}):${colors.reset}`);
    results.passed.forEach(item => {
      console.log(`  ${colors.green}✓${colors.reset} ${item}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log(`\n${colors.yellow}⚠ 警告 (${results.warnings.length}):${colors.reset}`);
    results.warnings.forEach(item => {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${item}`);
    });
  }
  
  if (results.errors.length > 0) {
    console.log(`\n${colors.red}✗ 错误 (${results.errors.length}):${colors.reset}`);
    results.errors.forEach(item => {
      console.log(`  ${colors.red}✗${colors.reset} ${item}`);
    });
  }
  
  // 总结
  console.log(`\n${colors.bold}${colors.cyan}=== 总结 ===${colors.reset}`);
  console.log(`总计: ${results.passed.length} 项通过, ${results.warnings.length} 项警告, ${results.errors.length} 项错误`);
  
  if (results.errors.length > 0) {
    console.log(`${colors.red}存在严重安全问题，需要立即修复！${colors.reset}`);
    process.exit(1);
  } else if (results.warnings.length > 0) {
    console.log(`${colors.yellow}存在安全警告，建议尽快修复。${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.green}所有安全检查通过！${colors.reset}`);
    process.exit(0);
  }
}

// 执行主函数
main().catch(error => {
  console.error(`${colors.red}检查过程中发生错误:${colors.reset}`, error);
  process.exit(1);
});