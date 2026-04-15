#!/bin/bash

echo "=== 数据库迁移验证测试 ==="
echo ""

# 检查迁移文件
echo "1. 检查迁移文件:"
MIGRATIONS_DIR="backend/database/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
    echo "   ✓ 迁移目录存在"
    COUNT=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
    echo "   ✓ 找到 $COUNT 个SQL迁移文件"
    
    # 列出迁移文件
    for file in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
            echo "     - $filename ($size 字节)"
        fi
    done
else
    echo "   ✗ 迁移目录不存在"
fi

echo ""
echo "2. 检查迁移脚本:"
MIGRATE_SCRIPT="backend/database/migrate.js"
if [ -f "$MIGRATE_SCRIPT" ]; then
    echo "   ✓ 迁移脚本存在"
    # 检查文件大小
    size=$(stat -c%s "$MIGRATE_SCRIPT" 2>/dev/null || stat -f%z "$MIGRATE_SCRIPT" 2>/dev/null)
    echo "   ✓ 脚本大小: $size 字节"
else
    echo "   ✗ 迁移脚本不存在"
fi

echo ""
echo "3. 检查种子脚本:"
SEED_SCRIPT="backend/scripts/seed-database.js"
if [ -f "$SEED_SCRIPT" ]; then
    echo "   ✓ 种子脚本存在"
else
    echo "   ✗ 种子脚本不存在"
fi

echo ""
echo "4. 检查数据库初始化脚本:"
INIT_DB="infrastructure/init-db.sh"
if [ -f "$INIT_DB" ]; then
    echo "   ✓ 数据库初始化脚本存在"
else
    echo "   ✗ 数据库初始化脚本不存在"
fi

echo ""
echo "5. 检查Docker Compose配置:"
DOCKER_COMPOSE="docker-compose.yml"
if [ -f "$DOCKER_COMPOSE" ]; then
    echo "   ✓ Docker Compose配置存在"
    # 检查服务数量
    SERVICES=$(grep -c "^[[:space:]]*[a-zA-Z][a-zA-Z0-9_]*:" "$DOCKER_COMPOSE" || echo "0")
    echo "   ✓ 定义的服务数量: $SERVICES"
else
    echo "   ✗ Docker Compose配置不存在"
fi

echo ""
echo "=== 验证完成 ==="