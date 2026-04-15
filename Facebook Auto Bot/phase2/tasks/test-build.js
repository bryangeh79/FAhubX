/**
 * 构建测试脚本
 * 测试Phase 2.3所有模块的构建
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Phase 2.3 模块构建测试 ===\n');

// 检查目录结构
const directories = [
  'operations',
  'engine', 
  'error-handling'
];

console.log('1. 检查目录结构...');
for (const dir of directories) {
  const dirPath = path.join(__dirname, dir);
  if (fs.existsSync(dirPath)) {
    console.log(`  ✓ ${dir} 目录存在`);
    
    // 检查关键文件
    const requiredFiles = ['package.json', 'tsconfig.json', 'src/index.ts'];
    for (const file of requiredFiles) {
      const filePath = path.join(dirPath, file);
      if (fs.existsSync(filePath)) {
        console.log(`    ✓ ${file} 存在`);
      } else {
        console.log(`    ✗ ${file} 缺失`);
      }
    }
  } else {
    console.log(`  ✗ ${dir} 目录缺失`);
  }
}

console.log('\n2. 检查TypeScript配置...');
for (const dir of directories) {
  const tsconfigPath = path.join(__dirname, dir, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    try {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      if (tsconfig.compilerOptions && tsconfig.compilerOptions.strict) {
        console.log(`  ✓ ${dir} TypeScript严格模式已启用`);
      } else {
        console.log(`  ⚠ ${dir} TypeScript严格模式未启用`);
      }
    } catch (error) {
      console.log(`  ✗ ${dir} TypeScript配置解析失败: ${error.message}`);
    }
  }
}

console.log('\n3. 检查依赖关系...');
const dependencyGraph = {
  'operations': [],
  'engine': ['operations'],
  'error-handling': ['operations', 'engine']
};

for (const [module, deps] of Object.entries(dependencyGraph)) {
  const pkgPath = path.join(__dirname, module, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      console.log(`  ${module}:`);
      console.log(`    - 名称: ${pkg.name}`);
      console.log(`    - 版本: ${pkg.version}`);
      
      if (pkg.dependencies) {
        const localDeps = Object.keys(pkg.dependencies).filter(dep => 
          dep.startsWith('@facebook-bot/')
        );
        if (localDeps.length > 0) {
          console.log(`    - 本地依赖: ${localDeps.join(', ')}`);
        }
      }
    } catch (error) {
      console.log(`  ✗ ${module} package.json解析失败: ${error.message}`);
    }
  }
}

console.log('\n4. 尝试构建模块...');
const buildResults = {};

for (const dir of directories) {
  console.log(`\n  构建 ${dir}...`);
  const modulePath = path.join(__dirname, dir);
  
  try {
    // 检查是否有node_modules
    const nodeModulesPath = path.join(modulePath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log(`  ⚠ ${dir} node_modules不存在，跳过构建`);
      buildResults[dir] = 'skipped';
      continue;
    }
    
    // 尝试构建
    execSync('npm run build', {
      cwd: modulePath,
      stdio: 'pipe',
      timeout: 30000 // 30秒超时
    });
    
    // 检查dist目录
    const distPath = path.join(modulePath, 'dist');
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(distPath);
      const hasIndex = files.includes('index.js') && files.includes('index.d.ts');
      
      if (hasIndex) {
        console.log(`  ✓ ${dir} 构建成功，生成 ${files.length} 个文件`);
        buildResults[dir] = 'success';
      } else {
        console.log(`  ⚠ ${dir} 构建完成但缺少index文件`);
        buildResults[dir] = 'partial';
      }
    } else {
      console.log(`  ✗ ${dir} 构建失败，dist目录未生成`);
      buildResults[dir] = 'failed';
    }
    
  } catch (error) {
    console.log(`  ✗ ${dir} 构建失败: ${error.message}`);
    buildResults[dir] = 'error';
  }
}

console.log('\n5. 检查类型定义导出...');
for (const dir of directories) {
  const indexPath = path.join(__dirname, dir, 'src/index.ts');
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // 检查是否有类型导出
    const hasTypeExports = content.includes('export * from') || 
                          content.includes('export type') ||
                          content.includes('export interface') ||
                          content.includes('export enum');
    
    if (hasTypeExports) {
      console.log(`  ✓ ${dir} 有类型定义导出`);
    } else {
      console.log(`  ⚠ ${dir} 可能缺少类型定义导出`);
    }
    
    // 检查是否有主导出函数
    const hasMainExport = content.includes('export function') || 
                         content.includes('export class') ||
                         content.includes('export const');
    
    if (hasMainExport) {
      console.log(`  ✓ ${dir} 有主导出函数/类`);
    }
  }
}

console.log('\n6. 生成构建报告...');
const report = {
  timestamp: new Date().toISOString(),
  modules: {}
};

let successCount = 0;
let totalCount = 0;

for (const dir of directories) {
  totalCount++;
  const modulePath = path.join(__dirname, dir);
  
  const moduleInfo = {
    path: dir,
    exists: fs.existsSync(modulePath),
    buildStatus: buildResults[dir] || 'not_attempted'
  };
  
  if (moduleInfo.buildStatus === 'success') {
    successCount++;
  }
  
  // 收集文件信息
  if (moduleInfo.exists) {
    const srcPath = path.join(modulePath, 'src');
    if (fs.existsSync(srcPath)) {
      const countFiles = (dirPath) => {
        let count = 0;
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory()) {
            count += countFiles(path.join(dirPath, item.name));
          } else if (item.isFile() && item.name.endsWith('.ts')) {
            count++;
          }
        }
        return count;
      };
      
      moduleInfo.sourceFiles = countFiles(srcPath);
    }
    
    const distPath = path.join(modulePath, 'dist');
    if (fs.existsSync(distPath)) {
      const jsFiles = fs.readdirSync(distPath).filter(f => f.endsWith('.js'));
      const dtsFiles = fs.readdirSync(distPath).filter(f => f.endsWith('.d.ts'));
      moduleInfo.distFiles = {
        js: jsFiles.length,
        dts: dtsFiles.length,
        total: jsFiles.length + dtsFiles.length
      };
    }
  }
  
  report.modules[dir] = moduleInfo;
}

// 计算成功率
report.summary = {
  totalModules: totalCount,
  successfulBuilds: successCount,
  successRate: totalCount > 0 ? (successCount / totalCount * 100).toFixed(1) + '%' : '0%',
  overallStatus: successCount === totalCount ? 'PASS' : successCount >= totalCount * 0.5 ? 'PARTIAL' : 'FAIL'
};

console.log('\n=== 构建测试报告 ===');
console.log(`总计模块: ${report.summary.totalModules}`);
console.log(`构建成功: ${report.summary.successfulBuilds}`);
console.log(`成功率: ${report.summary.successRate}`);
console.log(`总体状态: ${report.summary.overallStatus}`);

console.log('\n详细模块信息:');
for (const [module, info] of Object.entries(report.modules)) {
  console.log(`\n${module}:`);
  console.log(`  路径: ${info.path}`);
  console.log(`  存在: ${info.exists ? '是' : '否'}`);
  console.log(`  构建状态: ${info.buildStatus}`);
  if (info.sourceFiles) {
    console.log(`  源文件数: ${info.sourceFiles}`);
  }
  if (info.distFiles) {
    console.log(`  生成文件: ${info.distFiles.total} (${info.distFiles.js} JS, ${info.distFiles.dts} 类型定义)`);
  }
}

// 保存报告
const reportPath = path.join(__dirname, 'build-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n详细报告已保存到: ${reportPath}`);

// 输出建议
console.log('\n=== 建议 ===');
if (report.summary.overallStatus === 'PASS') {
  console.log('✅ 所有模块构建成功，可以继续开发！');
} else if (report.summary.overallStatus === 'PARTIAL') {
  console.log('⚠️ 部分模块构建成功，需要检查失败模块：');
  for (const [module, info] of Object.entries(report.modules)) {
    if (info.buildStatus !== 'success') {
      console.log(`  - ${module}: ${info.buildStatus}`);
    }
  }
} else {
  console.log('❌ 多数模块构建失败，需要修复：');
  for (const [module, info] of Object.entries(report.modules)) {
    if (info.buildStatus !== 'success') {
      console.log(`  - ${module}: ${info.buildStatus}`);
    }
  }
  console.log('\n建议步骤:');
  console.log('1. 检查TypeScript配置');
  console.log('2. 确保所有依赖已安装');
  console.log('3. 检查源代码语法错误');
  console.log('4. 查看详细错误日志');
}

console.log('\n=== 构建测试完成 ===');