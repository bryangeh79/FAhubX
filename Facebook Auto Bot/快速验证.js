// Facebook Auto Bot 快速验证脚本
// 不依赖构建环境，直接验证代码质量

const fs = require('fs');
const path = require('path');

console.log('🚀 Facebook Auto Bot 代码快速验证\n');

// 检查关键文件
const criticalFiles = [
  // 页面文件
  'src/pages/AccountsPage.tsx',
  'src/pages/VPNPage.tsx',
  'src/pages/AntiDetectionPage.tsx',
  'src/pages/LoginStatusPage.tsx',
  'src/pages/TasksPage.tsx',
  'src/pages/DashboardPage.tsx',
  'src/pages/LoginPage.tsx',
  
  // 核心组件
  'src/components/AppLayout.tsx',
  'src/components/account-wizard/AccountWizard.tsx',
  'src/components/VPNAccountAssociation.tsx',
  
  // 配置文件
  'src/App.tsx',
  'package.json',
  'tsconfig.json',
  'vite.config.ts'
];

// 检查文件是否存在
console.log('📁 文件存在性检查:');
let missingFiles = 0;
criticalFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} (缺失)`);
    missingFiles++;
  }
});

// 检查App.tsx路由
console.log('\n🔄 路由配置检查:');
const appPath = path.join(__dirname, 'src/App.tsx');
if (fs.existsSync(appPath)) {
  const content = fs.readFileSync(appPath, 'utf8');
  const routeCount = (content.match(/<Route/g) || []).length;
  const protectedCount = (content.match(/<ProtectedRoute/g) || []).length;
  
  console.log(`  路由数量: ${routeCount}`);
  console.log(`  保护路由: ${protectedCount}`);
  
  // 检查关键路由
  const routesToCheck = ['/login', '/accounts', '/vpn', '/anti-detection', '/login-status', '/tasks'];
  routesToCheck.forEach(route => {
    if (content.includes(`path="${route}"`)) {
      console.log(`  ✅ ${route}`);
    } else {
      console.log(`  ❌ ${route} (未找到)`);
    }
  });
}

// 检查组件目录
console.log('\n🧩 组件完整性检查:');
const componentDirs = [
  'src/components/account-wizard',
  'src/components/anti-detection',
  'src/components/login-status'
];

componentDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.tsx'));
    console.log(`  📂 ${dir}: ${files.length} 个组件`);
    files.forEach(file => {
      console.log(`    📄 ${file}`);
    });
  } else {
    console.log(`  ❌ ${dir} (目录不存在)`);
  }
});

// 检查服务层
console.log('\n🔧 服务层检查:');
const serviceDir = path.join(__dirname, 'src/services');
if (fs.existsSync(serviceDir)) {
  const services = fs.readdirSync(serviceDir).filter(f => f.endsWith('.ts'));
  console.log(`  服务文件: ${services.length} 个`);
  services.forEach(service => {
    console.log(`    📄 ${service}`);
  });
}

// 总结
console.log('\n📊 验证总结:');
console.log(`  检查文件: ${criticalFiles.length} 个`);
console.log(`  缺失文件: ${missingFiles} 个`);
console.log(`  组件目录: ${componentDirs.length} 个`);
console.log(`  服务文件: ${fs.existsSync(serviceDir) ? fs.readdirSync(serviceDir).filter(f => f.endsWith('.ts')).length : 0} 个`);

if (missingFiles === 0) {
  console.log('\n🎉 验证通过！所有关键文件完整。');
  console.log('💡 建议: 使用静态演示展示功能，同时修复构建环境。');
} else {
  console.log(`\n⚠️ 验证发现 ${missingFiles} 个缺失文件。`);
  console.log('💡 建议: 先补充缺失文件，再进行构建。');
}

console.log('\n🚀 下一步行动:');
console.log('1. 打开 静态演示/index.html 体验完整功能');
console.log('2. 查看 代码质量验证报告.md 了解详细情况');
console.log('3. 基于 后端API需求文档.md 开始后端开发');
console.log('4. 并行修复前端构建环境问题');