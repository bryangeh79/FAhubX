const fs = require('fs');
const path = require('path');

console.log('=== 准确的 JSX 标签检查 ===\n');

function countJSXTags(content) {
  let openTags = 0;
  let closeTags = 0;
  let selfClosingTags = 0;
  
  // 匹配所有 JSX 标签
  const tagRegex = /<(\/?)([A-Za-z][A-Za-z0-9]*)(?:\s[^>]*)?(\/?)>/g;
  let match;
  
  while ((match = tagRegex.exec(content)) !== null) {
    const isClosing = match[1] === '/';
    const tagName = match[2];
    const isSelfClosing = match[3] === '/';
    
    if (isSelfClosing) {
      selfClosingTags++;
    } else if (isClosing) {
      closeTags++;
    } else {
      openTags++;
    }
  }
  
  return { openTags, closeTags, selfClosingTags, totalTags: openTags + closeTags + selfClosingTags };
}

// 检查文件
const filesToCheck = [
  'src/pages/DashboardPage.tsx',
  'src/pages/TasksPage.tsx',
  'src/pages/VpnConfigPage.tsx',
  'src/pages/AccountsPage.tsx',
  'src/App.tsx'
];

filesToCheck.forEach(filePath => {
  const fullPath = path.join(__dirname, 'frontend', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${filePath}: 文件不存在`);
    return;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const counts = countJSXTags(content);
  
  console.log(`${filePath}:`);
  console.log(`  打开标签: ${counts.openTags}`);
  console.log(`  关闭标签: ${counts.closeTags}`);
  console.log(`  自闭合标签: ${counts.selfClosingTags}`);
  console.log(`  总标签数: ${counts.totalTags}`);
  
  // 正确的检查：打开标签应该等于关闭标签
  if (counts.openTags === counts.closeTags) {
    console.log(`  ✅ JSX 标签匹配正确`);
  } else {
    console.log(`  ❌ JSX 标签不匹配 (打开:${counts.openTags}, 关闭:${counts.closeTags})`);
    
    // 显示不匹配的详细信息
    if (counts.openTags > counts.closeTags) {
      console.log(`  ⚠️  缺少 ${counts.openTags - counts.closeTags} 个关闭标签`);
    } else {
      console.log(`  ⚠️  多出 ${counts.closeTags - counts.openTags} 个关闭标签`);
    }
  }
  console.log('');
});

console.log('=== 检查完成 ===');

// 现在让我们检查实际的 TypeScript 错误
console.log('\n=== 检查实际 TypeScript 错误 ===');
try {
  const { execSync } = require('child_process');
  
  // 只检查单个文件来定位问题
  const testFile = 'src/pages/DashboardPage.tsx';
  console.log(`检查 ${testFile}...`);
  
  // 创建一个临时的 tsconfig 来检查单个文件
  const tempConfig = {
    compilerOptions: {
      target: "ES2020",
      lib: ["DOM", "DOM.Iterable", "ESNext"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true
    },
    include: [testFile]
  };
  
  const tempConfigPath = path.join(__dirname, 'frontend', 'temp-tsconfig.json');
  fs.writeFileSync(tempConfigPath, JSON.stringify(tempConfig, null, 2));
  
  const result = execSync(`cd frontend && npx tsc --project temp-tsconfig.json --noEmit 2>&1`, {
    encoding: 'utf8',
    timeout: 5000
  });
  
  fs.unlinkSync(tempConfigPath);
  
  if (result.includes('error TS')) {
    const errors = result.split('\n').filter(line => line.includes('error TS'));
    console.log('发现错误:');
    errors.forEach(error => console.log(`  ${error}`));
  } else {
    console.log('✅ 没有发现 TypeScript 错误');
  }
} catch (error) {
  console.log('检查失败:', error.message);
}