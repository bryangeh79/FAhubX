#!/bin/bash

echo "=== 数据库迁移验证脚本 ==="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 函数：打印成功消息
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 函数：打印错误消息
error() {
    echo -e "${RED}✗ $1${NC}"
}

# 函数：打印警告消息
warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 函数：检查文件是否存在
check_file() {
    if [ -f "$1" ]; then
        success "$2"
        return 0
    else
        error "$2"
        return 1
    fi
}

# 函数：检查目录是否存在
check_dir() {
    if [ -d "$1" ]; then
        success "$2"
        return 0
    else
        error "$2"
        return 1
    fi
}

# 函数：验证SQL文件语法
validate_sql() {
    local file=$1
    local name=$2
    
    if [ ! -f "$file" ]; then
        error "$name: 文件不存在"
        return 1
    fi
    
    # 检查文件是否为空
    if [ ! -s "$file" ]; then
        error "$name: 文件为空"
        return 1
    fi
    
    # 检查是否包含SQL关键字
    if grep -q -i "CREATE TABLE\|INSERT INTO\|ALTER TABLE\|DROP TABLE" "$file"; then
        success "$name: 包含有效的SQL语句"
        
        # 检查CREATE TABLE语句
        local table_count=$(grep -c "CREATE TABLE" "$file")
        if [ "$table_count" -gt 0 ]; then
            success "$name: 包含 $table_count 个CREATE TABLE语句"
        fi
        
        # 检查INSERT语句
        local insert_count=$(grep -c "INSERT INTO" "$file")
        if [ "$insert_count" -gt 0 ]; then
            success "$name: 包含 $insert_count 个INSERT语句"
        fi
        
        return 0
    else
        warning "$name: 未检测到标准SQL语句"
        return 0
    fi
}

echo "1. 验证迁移文件结构..."
echo ""

# 检查迁移目录
check_dir "backend/database/migrations" "迁移目录"

# 检查迁移文件
MIGRATION_FILES=("001_create_tables.sql" "002_insert_conversation_scripts.sql")
for file in "${MIGRATION_FILES[@]}"; do
    check_file "backend/database/migrations/$file" "迁移文件: $file"
done

echo ""
echo "2. 验证迁移文件内容..."
echo ""

# 验证第一个迁移文件
validate_sql "backend/database/migrations/001_create_tables.sql" "表结构迁移"

# 验证第二个迁移文件
validate_sql "backend/database/migrations/002_insert_conversation_scripts.sql" "数据迁移"

echo ""
echo "3. 验证迁移脚本..."
echo ""

# 检查迁移脚本
check_file "backend/database/migrate.js" "迁移脚本"

# 检查迁移脚本的关键函数
if [ -f "backend/database/migrate.js" ]; then
    if grep -q "async migrate()" "backend/database/migrate.js"; then
        success "迁移脚本包含 migrate() 函数"
    else
        error "迁移脚本缺少 migrate() 函数"
    fi
    
    if grep -q "async status()" "backend/database/migrate.js"; then
        success "迁移脚本包含 status() 函数"
    else
        error "迁移脚本缺少 status() 函数"
    fi
    
    if grep -q "async connect()" "backend/database/migrate.js"; then
        success "迁移脚本包含 connect() 函数"
    else
        error "迁移脚本缺少 connect() 函数"
    fi
fi

echo ""
echo "4. 验证种子脚本..."
echo ""

# 检查种子脚本
check_file "backend/scripts/seed-database.js" "种子脚本"

# 检查种子脚本的关键功能
if [ -f "backend/scripts/seed-database.js" ]; then
    if grep -q "async seedDatabase()" "backend/scripts/seed-database.js"; then
        success "种子脚本包含 seedDatabase() 函数"
    else
        error "种子脚本缺少 seedDatabase() 函数"
    fi
    
    # 检查是否包含测试用户创建
    if grep -q "test@fbautobot.com" "backend/scripts/seed-database.js"; then
        success "种子脚本包含测试用户"
    else
        warning "种子脚本可能不包含测试用户"
    fi
    
    # 检查是否包含管理员用户创建
    if grep -q "admin@fbautobot.com" "backend/scripts/seed-database.js"; then
        success "种子脚本包含管理员用户"
    else
        warning "种子脚本可能不包含管理员用户"
    fi
fi

echo ""
echo "5. 验证数据库初始化..."
echo ""

# 检查初始化脚本
check_file "infrastructure/init-db.sh" "数据库初始化脚本"
check_file "infrastructure/init-db.sql" "数据库初始化SQL"

echo ""
echo "6. 验证表结构完整性..."
echo ""

# 检查迁移文件中的表定义
if [ -f "backend/database/migrations/001_create_tables.sql" ]; then
    TABLES=("users" "user_sessions" "facebook_accounts" "conversation_scripts" "system_configs")
    
    for table in "${TABLES[@]}"; do
        if grep -q -i "CREATE TABLE.*$table" "backend/database/migrations/001_create_tables.sql"; then
            success "表 $table 已定义"
        else
            error "表 $table 未定义"
        fi
    done
fi

echo ""
echo "7. 验证环境配置..."
echo ""

# 检查环境变量示例文件
check_file ".env.example" "环境变量示例文件"

# 检查Docker Compose配置
check_file "docker-compose.yml" "Docker Compose配置"

if [ -f "docker-compose.yml" ]; then
    # 检查必要的服务
    SERVICES=("postgres" "backend" "frontend")
    for service in "${SERVICES[@]}"; do
        if grep -q "^[[:space:]]*$service:" "docker-compose.yml"; then
            success "服务 $service 已配置"
        else
            error "服务 $service 未配置"
        fi
    done
fi

echo ""
echo "=== 验证总结 ==="
echo ""

# 统计结果
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# 这里可以添加更详细的统计，但为了简洁，我们只显示总结
echo "数据库迁移验证完成。"
echo ""
echo "下一步操作建议:"
echo "1. 运行数据库迁移: cd backend && npm run db:migrate"
echo "2. 运行数据种子: cd backend && npm run db:seed"
echo "3. 启动开发环境: docker-compose up -d"
echo "4. 验证服务运行: docker-compose ps"
echo ""
echo "如果所有检查都通过，数据库迁移验证完成！"