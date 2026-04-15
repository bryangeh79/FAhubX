/**
 * 验证Phase 2.3目录结构
 */

const fs = require('fs');
const path = require('path');

console.log('=== Phase 2.3 目录结构验证 ===\n');

// 预期的目录结构
const expectedStructure = {
  'operations': {
    'src': {
      'core': ['base-operation.ts', 'operation-factory.ts'],
      'operations': ['post-operation.ts', 'like-operation.ts', 'comment-operation.ts'],
      'types': ['index.ts'],
      'utils': ['logger.ts'],
      'index.ts': true
    },
    'package.json': true,
    'tsconfig.json': true
  },
  'engine': {
    'src': {
      'core': ['base-task-executor.ts'],
      'executors': ['single-task-executor.ts', 'batch-task-executor.ts'],
      'queues': ['task-queue.ts'],
      'schedulers': ['task-scheduler.ts'],
      'types': ['index.ts'],
      'utils': ['logger.ts'],
      'index.ts': true
    },
    'package.json': true,
    'tsconfig.json': true
  },
  'error-handling': {
    'src': {
      'core': ['base-error-handler.ts'],
      'handlers': ['facebook-error-handler.ts'],
      'types': ['index.ts'],
      'utils': ['logger.ts'],
      'index.ts': true
    },
    'package.json': true,
    'tsconfig.json': true
  },
  'examples': {
    'integration-example.ts': true
  },
  'README.md': true
};

function checkStructure(basePath, structure, indent = '') {
  let allPassed = true;
  
  for (const [item, expected] of Object.entries(structure)) {
    const itemPath = path.join(basePath, item);
    const exists = fs.existsSync(itemPath);
    
    if (typeof expected === 'boolean') {
      // 文件
      if (exists) {
        console.log(`${indent}✓ ${item}`);
      } else {
        console.log(`${indent}✗ ${item} (缺失)`);
        allPassed = false;
      }
    } else {
      // 目录
      if (exists) {
        console.log(`${indent}📁 ${item}/`);
        const dirPassed = checkStructure(itemPath, expected, indent + '  ');
        if (!dirPassed) {
          allPassed = false;
        }
      } else {
        console.log(`${indent}✗ ${item}/ (目录缺失)`);
        allPassed = false;
      }
    }
  }
  
  return allPassed;
}

// 运行验证
const basePath = __dirname;
const passed = checkStructure(basePath, expectedStructure);

console.log('\n=== 验证结果 ===');
if (passed) {
  console.log('✅ 目录结构完整！');
  
  // 统计文件数量
  console.log('\n📊 文件统计:');
  
  const countFiles = (dirPath, extension) => {
    let count = 0;
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          count += countFiles(path.join(dirPath, item.name), extension);
        } else if (item.isFile() && item.name.endsWith(extension)) {
          count++;
        }
      }
    } catch (error) {
      // 目录可能不存在
    }
    return count;
  };
  
  const modules = ['operations', 'engine', 'error-handling'];
  let totalTs = 0;
  let totalLines = 0;
  
  for (const module of modules) {
    const srcPath = path.join(basePath, module, 'src');
    const tsCount = countFiles(srcPath, '.ts');
    totalTs += tsCount;
    
    // 估算代码行数
    const estimateLines = (dirPath) => {
      let lines = 0;
      try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dirPath, item.name);
          if (item.isDirectory()) {
            lines += estimateLines(fullPath);
          } else if (item.isFile() && item.name.endsWith('.ts')) {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              lines += content.split('\n').length;
            } catch (error) {
              // 忽略读取错误
            }
          }
        }
      } catch (error) {
        // 忽略目录错误
      }
      return lines;
    };
    
    const moduleLines = estimateLines(srcPath);
    totalLines += moduleLines;
    
    console.log(`  ${module}: ${tsCount}个TypeScript文件，约${moduleLines}行代码`);
  }
  
  console.log(`\n总计: ${totalTs}个TypeScript文件，约${totalLines}行代码`);
  
  // 检查关键功能
  console.log('\n🔍 关键功能检查:');
  
  const checkFileContent = (filePath, keywords) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8').toLowerCase();
      return keywords.every(keyword => content.includes(keyword.toLowerCase()));
    } catch (error) {
      return false;
    }
  };
  
  const checks = [
    {
      module: 'operations',
      file: 'src/core/base-operation.ts',
      keywords: ['abstract class', 'execute', 'validate', 'retry']
    },
    {
      module: 'operations',
      file: 'src/operations/post-operation.ts',
      keywords: ['postoperation', 'content', 'images', 'privacy']
    },
    {
      module: 'engine',
      file: 'src/core/base-task-executor.ts',
      keywords: ['abstract class', 'task', 'execute', 'retry']
    },
    {
      module: 'engine',
      file: 'src/queues/task-queue.ts',
      keywords: ['bull', 'queue', 'enqueue', 'dequeue']
    },
    {
      module: 'error-handling',
      file: 'src/core/base-error-handler.ts',
      keywords: ['errorhandler', 'severity', 'recovery', 'retry']
    },
    {
      module: 'error-handling',
      file: 'src/handlers/facebook-error-handler.ts',
      keywords: ['facebook', 'blocked', 'captcha', 'authentication']
    }
  ];
  
  let passedChecks = 0;
  for (const check of checks) {
    const filePath = path.join(basePath, check.module, check.file);
    if (fs.existsSync(filePath)) {
      const passed = checkFileContent(filePath, check.keywords);
      if (passed) {
        console.log(`  ✓ ${check.module}/${check.file} 包含关键功能`);
        passedChecks++;
      } else {
        console.log(`  ⚠ ${check.module}/${check.file} 可能缺少某些功能`);
      }
    } else {
      console.log(`  ✗ ${check.module}/${check.file} 文件缺失`);
    }
  }
  
  console.log(`\n功能检查: ${passedChecks}/${checks.length} 通过`);
  
} else {
  console.log('❌ 目录结构不完整，请检查缺失的文件/目录');
}

console.log('\n=== 验证完成 ===');