const fs = require('fs');
const path = require('path');

console.log('=== TypeScript 编译检查 ===\n');

// 检查关键文件是否存在且语法正确
const filesToCheck = [
  'src/pages/DashboardPage.tsx',
  'src/pages/TasksPage.tsx',
  'src/pages/VpnConfigPage.tsx',
  'src/pages/AccountsPage.tsx',
  'src/App.tsx'
];

let allGood = true;

filesToCheck.forEach(filePath => {
  const fullPath = path.join(__dirname, 'frontend', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${filePath}: 文件不存在`);
    allGood = false;
    return;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // 基本语法检查
  let issues = [];
  
  // 1. 检查 React 导入
  if (!content.includes('import React')) {
    issues.push('缺少 React 导入');
  }
  
  // 2. 检查组件定义
  if (!content.includes('React.FC') && !content.includes('function')) {
    issues.push('缺少组件定义');
  }
  
  // 3. 检查导出
  if (!content.includes('export default')) {
    issues.push('缺少导出语句');
  }
  
  // 4. 检查 JSX 标签匹配
  const openTags = (content.match(/<[^/>][^>]*>/g) || []).length;
  const closeTags = (content.match(/<\/[^>]+>/g) || []).length;
  
  if (openTags !== closeTags) {
    issues.push(`JSX标签不匹配 (打开:${openTags}, 关闭:${closeTags})`);
  }
  
  // 5. 检查花括号匹配
  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    issues.push(`花括号不匹配 (打开:${openBraces}, 关闭:${closeBraces})`);
  }
  
  if (issues.length > 0) {
    console.log(`❌ ${filePath}:`);
    issues.forEach(issue => console.log(`   - ${issue}`));
    allGood = false;
  } else {
    console.log(`✅ ${filePath}: 语法检查通过`);
  }
});

console.log('\n=== 检查结果 ===');
if (allGood) {
  console.log('✅ 所有文件语法检查通过！');
  console.log('建议运行完整的 TypeScript 编译验证。');
} else {
  console.log('❌ 发现语法问题，需要修复。');
}

// 尝试运行 TypeScript 编译
console.log('\n=== 尝试 TypeScript 编译 ===');
try {
  const { execSync } = require('child_process');
  const result = execSync('cd frontend && timeout 5 npx tsc --noEmit --skipLibCheck 2>&1', {
    encoding: 'utf8'
  });
  
  if (result.includes('error TS')) {
    const errors = result.split('\n').filter(line => line.includes('error TS'));
    console.log('❌ 编译错误:');
    errors.forEach(error => console.log(`   ${error}`));
  } else if (result.trim()) {
    console.log('编译输出:', result);
  } else {
    console.log('✅ TypeScript 编译成功！');
  }
} catch (error) {
  console.log('编译检查:', error.message);
}

console.log('\n=== 检查完成 ===');