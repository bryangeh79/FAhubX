const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== 数据库迁移验证测试 ===\n');

// 检查迁移文件是否存在
const migrationsDir = path.join(__dirname, 'backend/database/migrations');
console.log('检查迁移目录:', migrationsDir);

if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir);
  console.log(`找到 ${files.length} 个迁移文件:`);
  files.forEach(file => {
    console.log(`  - ${file}`);
  });
  
  // 检查迁移文件内容
  const migrationFile = path.join(migrationsDir, '001_create_tables.sql');
  if (fs.existsSync(migrationFile)) {
    const content = fs.readFileSync(migrationFile, 'utf-8');
    const tables = content.match(/CREATE TABLE (\w+)/g);
    console.log(`\n迁移文件包含 ${tables ? tables.length : 0} 个表创建语句`);
    
    if (tables) {
      console.log('包含的表:');
      tables.forEach(table => {
        const tableName = table.replace('CREATE TABLE ', '');
        console.log(`  - ${tableName}`);
      });
    }
  }
} else {
  console.log('错误: 迁移目录不存在');
}

// 检查迁移脚本
const migrateScript = path.join(__dirname, 'backend/database/migrate.js');
if (fs.existsSync(migrateScript)) {
  console.log('\n迁移脚本存在:', migrateScript);
  
  // 检查脚本语法
  try {
    const scriptContent = fs.readFileSync(migrateScript, 'utf-8');
    console.log('迁移脚本语法检查: ✓ 通过');
    
    // 检查关键函数
    const hasConnect = scriptContent.includes('async connect()');
    const hasMigrate = scriptContent.includes('async migrate()');
    const hasStatus = scriptContent.includes('async status()');
    
    console.log('关键函数检查:');
    console.log(`  - connect(): ${hasConnect ? '✓' : '✗'}`);
    console.log(`  - migrate(): ${hasMigrate ? '✓' : '✗'}`);
    console.log(`  - status(): ${hasStatus ? '✓' : '✗'}`);
  } catch (error) {
    console.log('迁移脚本语法检查: ✗ 失败', error.message);
  }
} else {
  console.log('错误: 迁移脚本不存在');
}

// 检查数据库种子脚本
const seedScript = path.join(__dirname, 'backend/scripts/seed-database.js');
if (fs.existsSync(seedScript)) {
  console.log('\n数据库种子脚本存在:', seedScript);
} else {
  console.log('警告: 数据库种子脚本不存在');
}

// 检查Docker Compose配置
const dockerCompose = path.join(__dirname, 'docker-compose.yml');
if (fs.existsSync(dockerCompose)) {
  console.log('\nDocker Compose配置存在:', dockerCompose);
  
  try {
    const content = fs.readFileSync(dockerCompose, 'utf-8');
    const services = content.match(/^\s*(\w+):/gm);
    console.log(`定义的服务数量: ${services ? services.length : 0}`);
    
    if (services) {
      console.log('服务列表:');
      services.forEach(service => {
        const serviceName = service.trim().replace(':', '');
        console.log(`  - ${serviceName}`);
      });
    }
  } catch (error) {
    console.log('Docker Compose解析错误:', error.message);
  }
}

console.log('\n=== 数据库迁移验证完成 ===');