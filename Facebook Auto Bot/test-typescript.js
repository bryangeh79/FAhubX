const fs = require('fs');
const path = require('path');

// 检查 VpnConfigPage.tsx 文件
const filePath = path.join(__dirname, 'frontend/src/pages/VpnConfigPage.tsx');
console.log('检查文件:', filePath);

if (!fs.existsSync(filePath)) {
  console.error('文件不存在');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
console.log('文件大小:', content.length, '字符');
console.log('行数:', content.split('\n').length);

// 检查常见的语法问题
console.log('\n=== 语法检查 ===');

// 1. 检查 JSX 标签闭合
const openTags = (content.match(/<[^/>][^>]*>/g) || []).length;
const closeTags = (content.match(/<\/[^>]+>/g) || []).length;
console.log(`JSX标签: 打开 ${openTags}, 关闭 ${closeTags}`);

if (openTags !== closeTags) {
  console.error('❌ JSX标签不匹配!');
} else {
  console.log('✅ JSX标签匹配正常');
}

// 2. 检查花括号匹配
const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;
console.log(`花括号: 打开 ${openBraces}, 关闭 ${closeBraces}`);

if (openBraces !== closeBraces) {
  console.error('❌ 花括号不匹配!');
} else {
  console.log('✅ 花括号匹配正常');
}

// 3. 检查括号匹配
const openParens = (content.match(/\(/g) || []).length;
const closeParens = (content.match(/\)/g) || []).length;
console.log(`括号: 打开 ${openParens}, 关闭 ${closeParens}`);

if (openParens !== closeParens) {
  console.error('❌ 括号不匹配!');
} else {
  console.log('✅ 括号匹配正常');
}

// 4. 检查组件定义
const componentMatch = content.match(/const\s+(\w+)\s*:\s*React\.FC/g);
if (componentMatch) {
  console.log('✅ 找到组件定义:', componentMatch[0]);
} else {
  console.error('❌ 未找到组件定义');
}

// 5. 检查导出语句
if (content.includes('export default')) {
  console.log('✅ 找到导出语句');
} else {
  console.error('❌ 未找到导出语句');
}

console.log('\n=== 检查完成 ===');