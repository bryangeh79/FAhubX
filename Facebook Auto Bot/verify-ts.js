const { spawn } = require('child_process');
const path = require('path');

console.log('验证 TypeScript 编译...');

const tsc = spawn('npx', ['tsc', '--noEmit'], {
  cwd: path.join(__dirname, 'frontend'),
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let error = '';

tsc.stdout.on('data', (data) => {
  output += data.toString();
});

tsc.stderr.on('data', (data) => {
  error += data.toString();
});

tsc.on('close', (code) => {
  console.log(`TypeScript 编译退出代码: ${code}`);
  
  if (error) {
    console.log('编译错误:');
    console.log(error);
  } else if (output) {
    console.log('编译输出:');
    console.log(output);
  } else {
    console.log('✅ TypeScript 编译成功，没有错误！');
  }
});

// 设置超时
setTimeout(() => {
  console.log('编译超时，强制终止...');
  tsc.kill('SIGTERM');
}, 10000);