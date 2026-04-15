// 简单的TypeScript错误检查脚本
const fs = require('fs');
const path = require('path');

// 检查常见错误模式
const errorPatterns = [
  /error TS\d+:.*/g,
  /Cannot find name/g,
  /is not assignable to type/g,
  /has no exported member/g,
  /JSX element.*has no corresponding closing tag/g,
  /Property.*does not exist on type/g,
];

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // 检查常见语法问题
    const issues = [];
    
    // 检查未闭合的JSX标签
    let openTags = 0;
    let closeTags = 0;
    lines.forEach((line, index) => {
      openTags += (line.match(/<[^/][^>]*>/g) || []).length;
      closeTags += (line.match(/<\/[^>]+>/g) || []).length;
      
      // 检查明显的语法错误
      if (line.includes('size="small"') && line.includes('<Tag')) {
        issues.push(`Line ${index + 1}: Tag组件不应使用size属性`);
      }
      
      if (line.includes('FirefoxOutlined') || line.includes('SafariOutlined')) {
        issues.push(`Line ${index + 1}: 可能使用了不存在的图标`);
      }
    });
    
    if (openTags !== closeTags) {
      issues.push(`JSX标签未平衡: 打开${openTags}个, 关闭${closeTags}个`);
    }
    
    if (issues.length > 0) {
      console.log(`\n🔍 ${filePath}:`);
      issues.forEach(issue => console.log(`  ⚠️ ${issue}`));
    }
    
    return issues.length;
  } catch (error) {
    console.log(`❌ 无法读取文件 ${filePath}: ${error.message}`);
    return 1;
  }
}

// 检查关键文件
const criticalFiles = [
  'src/pages/VPNPage.tsx',
  'src/pages/AntiDetectionPage.tsx',
  'src/pages/LoginStatusPage.tsx',
  'src/pages/AccountsPage.tsx',
  'src/components/AppLayout.tsx',
  'src/App.tsx',
];

console.log('📋 开始检查关键文件...');
let totalIssues = 0;

criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    totalIssues += checkFile(filePath);
  } else {
    console.log(`❌ 文件不存在: ${file}`);
    totalIssues++;
  }
});

console.log(`\n📊 检查完成: 发现 ${totalIssues} 个问题`);
if (totalIssues === 0) {
  console.log('✅ 所有关键文件看起来正常');
} else {
  console.log('⚠️ 需要修复上述问题');
  process.exit(1);
}