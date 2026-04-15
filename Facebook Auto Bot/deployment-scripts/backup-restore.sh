#!/bin/bash
# Facebook Auto Bot 备份和恢复脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="fbautobot_backup_$TIMESTAMP"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# 加载环境变量
load_environment() {
    if [ -f .env.production ]; then
        source .env.production
    else
        log_error "环境变量文件 .env.production 不存在"
        exit 1
    fi
}

# 创建备份目录
create_backup_dir() {
    local backup_path="$BACKUP_DIR/$BACKUP_NAME"
    
    log_info "创建备份目录: $backup_path"
    mkdir -p "$backup_path"
    
    echo "$backup_path"
}

# 备份数据库
backup_database() {
    local backup_path=$1
    
    log_info "备份 PostgreSQL 数据库..."
    
    local db_backup_file="$backup_path/database.sql.gz"
    
    if docker-compose -f docker-compose.prod.yml exec -T postgres \
        pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$db_backup_file"; then
        log_success "数据库备份完成: $db_backup_file"
        echo "$db_backup_file"
    else
        log_error "数据库备份失败"
        return 1
    fi
}

# 备份 Redis 数据
backup_redis() {
    local backup_path=$1
    
    log_info "备份 Redis 数据..."
    
    local redis_backup_file="$backup_path/redis.rdb"
    
    # 执行 BGSAVE
    docker-compose -f docker-compose.prod.yml exec -T redis \
        redis-cli -a "$REDIS_PASSWORD" BGSAVE
    
    # 等待备份完成
    sleep 5
    
    # 复制 RDB 文件
    if docker cp "fbautobot-redis:/data/dump.rdb" "$redis_backup_file"; then
        log_success "Redis 备份完成: $redis_backup_file"
        echo "$redis_backup_file"
    else
        log_warn "Redis 备份失败（可能没有持久化数据）"
    fi
}

# 备份 MinIO 数据
backup_minio() {
    local backup_path=$1
    
    log_info "备份 MinIO 数据..."
    
    local minio_backup_dir="$backup_path/minio"
    
    mkdir -p "$minio_backup_dir"
    
    # 使用 mc 命令备份（需要先安装 mc）
    if command -v mc &> /dev/null; then
        mc mirror --overwrite minio/local "$minio_backup_dir"
        log_success "MinIO 备份完成: $minio_backup_dir"
        echo "$minio_backup_dir"
    else
        log_warn "mc 命令未安装，跳过 MinIO 备份"
    fi
}

# 备份配置文件
backup_configs() {
    local backup_path=$1
    
    log_info "备份配置文件..."
    
    local config_backup_dir="$backup_path/configs"
    
    mkdir -p "$config_backup_dir"
    
    # 备份环境变量
    cp .env.production "$config_backup_dir/"
    
    # 备份 Docker Compose 配置
    cp docker-compose.prod.yml "$config_backup_dir/"
    
    # 备份 Nginx 配置
    cp -r docker/nginx "$config_backup_dir/"
    
    # 备份监控配置
    cp -r docker/monitoring "$config_backup_dir/"
    
    log_success "配置文件备份完成: $config_backup_dir"
    echo "$config_backup_dir"
}

# 备份 Docker 镜像
backup_docker_images() {
    local backup_path=$1
    
    log_info "备份 Docker 镜像..."
    
    local images_backup_dir="$backup_path/images"
    
    mkdir -p "$images_backup_dir"
    
    # 保存关键镜像
    local images=("fbautobot-backend:$TAG" "fbautobot-frontend:$TAG" "postgres:16-alpine" "redis:7-alpine")
    
    for image in "${images[@]}"; do
        local image_file="$images_backup_dir/$(echo $image | tr ':' '_' | tr '/' '_').tar"
        
        if docker save "$image" -o "$image_file"; then
            log_success "镜像备份完成: $image_file"
        else
            log_warn "镜像备份失败: $image"
        fi
    done
    
    echo "$images_backup_dir"
}

# 创建备份清单
create_backup_manifest() {
    local backup_path=$1
    local manifest_file="$backup_path/backup_manifest.json"
    
    cat > "$manifest_file" << EOF
{
  "backup_name": "$BACKUP_NAME",
  "timestamp": "$(date -Iseconds)",
  "application": "Facebook Auto Bot",
  "environment": "production",
  "version": "$TAG",
  "components": {
    "database": "$(basename $(backup_database "$backup_path" 2>/dev/null || echo 'null'))",
    "redis": "$(basename $(backup_redis "$backup_path" 2>/dev/null || echo 'null'))",
    "minio": "$(basename $(backup_minio "$backup_path" 2>/dev/null || echo 'null'))",
    "configs": "configs/",
    "images": "images/"
  },
  "size": "$(du -sh "$backup_path" | cut -f1)",
  "checksum": "$(find "$backup_path" -type f -name "*.gz" -o -name "*.rdb" -o -name "*.tar" | xargs sha256sum | sha256sum | cut -d' ' -f1)"
}
EOF
    
    log_success "备份清单创建完成: $manifest_file"
    echo "$manifest_file"
}

# 压缩备份
compress_backup() {
    local backup_path=$1
    
    log_info "压缩备份文件..."
    
    local compressed_file="$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    
    if tar -czf "$compressed_file" -C "$BACKUP_DIR" "$BACKUP_NAME"; then
        log_success "备份压缩完成: $compressed_file"
        
        # 删除原始目录
        rm -rf "$backup_path"
        
        echo "$compressed_file"
    else
        log_error "备份压缩失败"
        return 1
    fi
}

# 清理旧备份
cleanup_old_backups() {
    log_info "清理 $RETENTION_DAYS 天前的旧备份..."
    
    local deleted_count=0
    
    find "$BACKUP_DIR" -name "fbautobot_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS | while read backup; do
        log_info "删除旧备份: $(basename $backup)"
        rm -f "$backup"
        deleted_count=$((deleted_count + 1))
    done
    
    if [ $deleted_count -gt 0 ]; then
        log_success "已删除 $deleted_count 个旧备份"
    else
        log_info "没有需要删除的旧备份"
    fi
}

# 完整备份
full_backup() {
    log_info "开始完整备份..."
    
    load_environment
    
    # 创建备份目录
    local backup_path=$(create_backup_dir)
    
    # 执行备份
    backup_database "$backup_path"
    backup_redis "$backup_path"
    backup_configs "$backup_path"
    backup_docker_images "$backup_path"
    
    # 创建清单
    create_backup_manifest "$backup_path"
    
    # 压缩备份
    local compressed_file=$(compress_backup "$backup_path")
    
    # 清理旧备份
    cleanup_old_backups
    
    log_success "完整备份完成: $compressed_file"
    echo "备份文件: $compressed_file"
    echo "大小: $(du -h "$compressed_file" | cut -f1)"
}

# 数据库备份
database_backup() {
    log_info "开始数据库备份..."
    
    load_environment
    
    local backup_path=$(create_backup_dir)
    backup_database "$backup_path"
    
    local compressed_file=$(compress_backup "$backup_path")
    
    log_success "数据库备份完成: $compressed_file"
}

# 列出备份
list_backups() {
    log_info "可用备份列表:"
    echo ""
    
    find "$BACKUP_DIR" -name "fbautobot_backup_*.tar.gz" -type f | sort -r | while read backup; do
        local backup_name=$(basename "$backup" .tar.gz)
        local backup_date=$(echo "$backup_name" | sed 's/fbautobot_backup_//')
        local formatted_date=$(echo "$backup_date" | sed 's/_/ /')
        local size=$(du -h "$backup" | cut -f1)
        
        echo "📦 $backup_name"
        echo "   📅 时间: $formatted_date"
        echo "   📊 大小: $size"
        echo ""
    done
}

# 恢复备份
restore_backup() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        log_error "请指定备份文件"
        list_backups
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "备份文件不存在: $backup_file"
        exit 1
    fi
    
    log_info "开始恢复备份: $backup_file"
    
    # 停止服务
    log_info "停止服务..."
    docker-compose -f docker-compose.prod.yml down
    
    # 提取备份
    local restore_dir="$BACKUP_DIR/restore_$TIMESTAMP"
    mkdir -p "$restore_dir"
    
    log_info "提取备份文件..."
    tar -xzf "$backup_file" -C "$restore_dir"
    
    local backup_name=$(basename "$backup_file" .tar.gz)
    local backup_content="$restore_dir/$backup_name"
    
    # 检查备份内容
    if [ ! -d "$backup_content" ]; then
        log_error "备份内容格式错误"
        exit 1
    fi
    
    # 恢复数据库
    if [ -f "$backup_content/database.sql.gz" ]; then
        log_info "恢复数据库..."
        
        # 启动数据库
        docker-compose -f docker-compose.prod.yml up -d postgres
        
        # 等待数据库就绪
        sleep 10
        
        # 恢复数据
        gunzip -c "$backup_content/database.sql.gz" | \
            docker-compose -f docker-compose.prod.yml exec -T postgres \
            psql -U "$DB_USER" "$DB_NAME"
        
        log_success "数据库恢复完成"
    fi
    
    # 恢复配置文件
    if [ -d "$backup_content/configs" ]; then
        log_info "恢复配置文件..."
        cp -r "$backup_content/configs/"* .
        log_success "配置文件恢复完成"
    fi
    
    # 启动服务
    log_info "启动服务..."
    docker-compose -f docker-compose.prod.yml up -d
    
    # 清理恢复目录
    rm -rf "$restore_dir"
    
    log_success "备份恢复完成"
    log_info "请运行健康检查确认服务状态: ./deployment-scripts/health-check.sh"
}

# 验证备份
verify_backup() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        log_error "请指定备份文件"
        exit 1
    fi
    
    log_info "验证备份文件: $backup_file"
    
    # 检查文件完整性
    if tar -tzf "$backup_file" > /dev/null 2>&1; then
        log_success "备份文件完整性验证通过"
        
        # 显示备份内容
        log_info "备份内容:"
        tar -tzf "$backup_file" | head -20
    else
        log_error "备份文件损坏或格式错误"
        exit 1
    fi
}

# 主函数
main() {
    local action=${1:-"help"}
    
    case $action in
        "full")
            full_backup
            ;;
        "database")
            database_backup
            ;;
        "list")
            list_backups
            ;;
        "restore")
            restore_backup "$2"
            ;;
        "verify")
            verify_backup "$2"
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        "help"|*)
            echo "用法: $0 {full|database|list|restore|verify|cleanup}"
            echo "  full              - 完整备份（数据库、配置、镜像）"
            echo "  database          - 仅备份数据库"
            echo "  list              - 列出所有备份"
            echo "  restore <file>    - 从备份恢复"
            echo "  verify <file>     - 验证备份文件"
            echo "  cleanup           - 清理旧备份"
            echo ""
            echo "示例:"
            echo "  $0 full                    # 创建完整备份"
            echo "  $0 list                    # 列出备份"
            echo "  $0 restore backups/fbautobot_backup_20240101_120000.tar.gz"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"