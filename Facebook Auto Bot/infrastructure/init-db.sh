#!/bin/bash

# Facebook Auto Bot 数据库初始化脚本
# 用法: ./init-db.sh [环境]
# 环境: development (默认), test, production

set -e

ENVIRONMENT=${1:-development}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=== Facebook Auto Bot 数据库初始化 ==="
echo "环境: $ENVIRONMENT"
echo "项目根目录: $PROJECT_ROOT"
echo ""

# 加载环境变量
if [ -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]; then
    echo "加载环境变量: .env.$ENVIRONMENT"
    source "$PROJECT_ROOT/.env.$ENVIRONMENT"
elif [ -f "$PROJECT_ROOT/.env" ]; then
    echo "加载环境变量: .env"
    source "$PROJECT_ROOT/.env"
else
    echo "警告: 未找到环境变量文件"
fi

# 设置默认值
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-fbautobot}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-password}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@fbautobot.com}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-Admin123!}

echo "数据库配置:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: ***"
echo ""

# 检查 PostgreSQL 是否可用
echo "检查 PostgreSQL 连接..."
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
    echo "错误: PostgreSQL 不可用"
    echo "请确保 PostgreSQL 正在运行，并且配置正确"
    exit 1
fi
echo "✓ PostgreSQL 连接正常"
echo ""

# 创建数据库（如果不存在）
echo "检查数据库 '$DB_NAME'..."
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "创建数据库 '$DB_NAME'..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"
    echo "✓ 数据库创建成功"
else
    echo "✓ 数据库已存在"
fi
echo ""

# 运行迁移
echo "运行数据库迁移..."
cd "$BACKEND_DIR"
if [ -f "database/migrate.js" ]; then
    node database/migrate.js migrate
else
    echo "错误: 未找到迁移脚本"
    exit 1
fi
echo ""

# 创建管理员用户（可选）
if [ "$ENVIRONMENT" != "production" ]; then
    echo "创建测试用户..."
    
    # 使用 Node.js 脚本创建用户
    cat > /tmp/create-test-user.js << 'EOF'
const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function createTestUser() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'fbautobot',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password'
    });

    try {
        await client.connect();
        
        const email = process.env.ADMIN_EMAIL || 'admin@fbautobot.com';
        const password = process.env.ADMIN_PASSWORD || 'Admin123!';
        const passwordHash = await bcrypt.hash(password, 10);
        
        // 检查用户是否已存在
        const checkResult = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        
        if (checkResult.rows.length > 0) {
            console.log(`用户 ${email} 已存在`);
            return;
        }
        
        // 创建用户
        await client.query(`
            INSERT INTO users (email, username, password_hash, full_name, email_verified, preferences)
            VALUES ($1, $2, $3, $4, true, $5)
        `, [
            email,
            'admin',
            passwordHash,
            '系统管理员',
            JSON.stringify({
                notifications: {
                    failures: true,
                    warnings: true,
                    successes: false
                },
                ui: {
                    theme: 'light',
                    density: 'comfortable'
                }
            })
        ]);
        
        console.log(`✓ 创建测试用户: ${email}`);
        console.log(`  密码: ${password}`);
        
    } catch (error) {
        console.error('创建测试用户失败:', error.message);
    } finally {
        await client.end();
    }
}

createTestUser();
EOF
    
    # 设置环境变量并运行脚本
    export DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD ADMIN_EMAIL ADMIN_PASSWORD
    cd "$BACKEND_DIR"
    
    if [ -f "package.json" ] && grep -q '"bcrypt"' "package.json"; then
        node /tmp/create-test-user.js
    else
        echo "注意: 需要 bcrypt 包来创建用户，跳过用户创建"
    fi
    
    rm -f /tmp/create-test-user.js
fi
echo ""

# 验证数据库结构
echo "验证数据库结构..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
SELECT 
    table_name,
    COUNT(*) as column_count,
    pg_size_pretty(pg_total_relation_size('"' || table_schema || '"."' || table_name || '"')) as size
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_schema, table_name
ORDER BY table_name;
EOF
echo ""

# 创建数据库备份脚本
echo "创建数据库备份脚本..."
cat > "$PROJECT_ROOT/backup-db.sh" << 'EOF'
#!/bin/bash
# 数据库备份脚本

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/fbautobot_$TIMESTAMP.sql"

# 加载环境变量
if [ -f .env ]; then
    source .env
fi

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-fbautobot}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-password}

# 创建备份目录
mkdir -p "$BACKUP_DIR"

echo "备份数据库 $DB_NAME 到 $BACKUP_FILE..."

# 执行备份
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --clean --if-exists --no-owner --no-privileges \
    > "$BACKUP_FILE"

# 压缩备份
gzip -f "$BACKUP_FILE"

echo "✓ 备份完成: ${BACKUP_FILE}.gz"

# 清理旧备份（保留最近7天）
find "$BACKUP_DIR" -name "fbautobot_*.sql.gz" -mtime +7 -delete
echo "已清理7天前的旧备份"
EOF

chmod +x "$PROJECT_ROOT/backup-db.sh"
echo "✓ 创建备份脚本: $PROJECT_ROOT/backup-db.sh"
echo ""

echo "=== 数据库初始化完成 ==="
echo ""
echo "下一步:"
echo "1. 启动后端服务: cd backend && npm run dev"
echo "2. 启动前端服务: cd frontend && npm run dev"
echo "3. 访问应用: http://localhost:8080"
echo ""
echo "测试用户:"
echo "  Email: $ADMIN_EMAIL"
echo "  Password: $ADMIN_PASSWORD"
echo ""
echo "数据库信息:"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""