const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('检查 TypeScript 编译错误...\n');

try {
  // 运行 TypeScript 编译器
  const result = execSync('npx tsc --noEmit --skipLibCheck 2>&1', { 
    encoding: 'utf8',
    cwd: __dirname 
  });
  
  console.log('TypeScript 编译输出:');
  console.log(result);
  
  // 解析错误信息
  const errorLines = result.split('\n').filter(line => line.includes('error TS'));
  
  if (errorLines.length > 0) {
    console.log('\n找到的错误:');
    errorLines.forEach(line => console.log(line));
    
    // 尝试修复常见错误
    const filePath = path.join(__dirname, 'src/pages/VpnConfigPage.tsx');
    if (fs.existsSync(filePath)) {
      console.log('\n尝试修复 VpnConfigPage.tsx...');
      
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 检查常见的语法错误
      // 1. 检查 JSX 标签闭合
      const openTags = (content.match(/<[^/>][^>]*>/g) || []).length;
      const closeTags = (content.match(/<\/[^>]+>/g) || []).length;
      
      if (openTags !== closeTags) {
        console.log(`警告: 标签不匹配 - 打开标签: ${openTags}, 关闭标签: ${closeTags}`);
      }
      
      // 2. 检查 JSX 表达式中的语法
      const jsxExpressions = content.match(/{[^}]*}/g) || [];
      jsxExpressions.forEach((expr, index) => {
        if (expr.includes('=>') && !expr.includes('(') && !expr.includes(')')) {
          console.log(`警告: 可能缺少箭头函数参数括号: ${expr.substring(0, 50)}...`);
        }
      });
      
      // 保存备份
      fs.writeFileSync(filePath + '.backup', content);
      console.log('已创建备份文件: VpnConfigPage.tsx.backup');
    }
  } else {
    console.log('没有找到 TypeScript 错误！');
  }
  
} catch (error) {
  console.error('检查过程中出错:', error.message);
}