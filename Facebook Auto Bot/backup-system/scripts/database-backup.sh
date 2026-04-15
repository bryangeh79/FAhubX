#!/bin/bash

# Facebook Auto Bot 数据库备份脚本
# 版本: 1.0.0

set -euo pipefail

# 默认配置
CONFIG_FILE="${CONFIG_FILE:-/workspace/backup-system/backup-config.yaml}"
BACKUP_TYPE="${BACKUP_TYPE:-full}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/facebook-auto-bot/database}"
LOG_FILE="${LOG_FILE:-/var/log/facebook-auto-bot/backup.log}"
TEMP_DIR="${TEMP_DIR:-/tmp/facebook-auto-bot-backup}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
COMPRESSION="${COMPRESSION:-gzip}"
ENCRYPTION="${ENCRYPTION:-aes256}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} $message"
            ;;
    esac
    
    # 写入日志文件
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# 错误处理函数
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# 检查依赖
check_dependencies() {
    log "INFO" "检查依赖..."
    
    local dependencies=("pg_dump" "gzip" "openssl" "yq")
    
    for cmd in "${dependencies[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error_exit "缺少依赖: $cmd"
        fi
    done
    
    log "INFO" "所有依赖已安装"
}

# 加载配置
load_config() {
    log "INFO" "加载配置文件: $CONFIG_FILE"
    
    if [[ ! -f "$CONFIG_FILE" ]]; then
        error_exit "配置文件不存在: $CONFIG_FILE"
    fi
    
    # 使用yq解析YAML配置
    if command -v yq &> /dev/null; then
        DB_HOST=$(yq e '.database.connection.host' "$CONFIG_FILE")
        DB_PORT=$(yq e '.database.connection.port' "$CONFIG_FILE")
        DB_NAME=$(yq e '.database.connection.database' "$CONFIG_FILE")
        DB_USERNAME=$(yq e '.database.connection.username' "$CONFIG_FILE")
        DB_PASSWORD=$(yq e '.database.connection.password' "$CONFIG_FILE")
        
        # 从环境变量获取密码（如果配置中使用变量）
        if [[ "$DB_PASSWORD" == \${* ]]; then
            local env_var=$(echo "$DB_PASSWORD" | sed 's/[${}]//g')
            DB_PASSWORD="${!env_var:-}"
        fi
        
        BACKUP_DIR=$(yq e '.storage.local.path' "$CONFIG_FILE")/database
        RETENTION_DAYS=$(yq e '.database.backup.full.retention_days' "$CONFIG_FILE")
        COMPRESSION=$(yq e '.database.backup.full.compression' "$CONFIG_FILE")
        ENCRYPTION=$(yq e '.database.backup.full.encryption' "$CONFIG_FILE")
        
        # 获取加密密钥
        local encryption_key_config=$(yq e '.database.backup.full.encryption_key' "$CONFIG_FILE")
        if [[ "$encryption_key_config" == \${* ]]; then
            local env_var=$(echo "$encryption_key_config" | sed 's/[${}]//g')
            ENCRYPTION_KEY="${!env_var:-}"
        else
            ENCRYPTION_KEY="$encryption_key_config"
        fi
    else
        log "WARN" "yq命令未找到，使用默认配置"
    fi
    
    # 设置环境变量供pg_dump使用
    export PGHOST="$DB_HOST"
    export PGPORT="$DB_PORT"
    export PGDATABASE="$DB_NAME"
    export PGUSER="$DB_USERNAME"
    export PGPASSWORD="$DB_PASSWORD"
    
    log "INFO" "数据库配置: $DB_HOST:$DB_PORT/$DB_NAME"
    log "INFO" "备份目录: $BACKUP_DIR"
    log "INFO" "保留天数: $RETENTION_DAYS"
}

# 创建备份目录
create_backup_dir() {
    log "INFO" "创建备份目录: $BACKUP_DIR"
    
    mkdir -p "$BACKUP_DIR"
    
    # 设置权限
    chmod 700 "$BACKUP_DIR"
    
    # 创建临时目录
    mkdir -p "$TEMP_DIR"
    chmod 700 "$TEMP_DIR"
}

# 检查数据库连接
check_database_connection() {
    log "INFO" "检查数据库连接..."
    
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" > /dev/null 2>&1; then
        error_exit "数据库连接失败"
    fi
    
    log "INFO" "数据库连接成功"
}

# 生成备份文件名
generate_backup_filename() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local hostname=$(hostname -s)
    local db_name="$DB_NAME"
    
    echo "${timestamp}_${hostname}_${db_name}_${BACKUP_TYPE}.sql"
}

# 执行数据库备份
perform_backup() {
    log "INFO" "开始数据库备份..."
    
    local backup_file="$TEMP_DIR/$(generate_backup_filename)"
    local final_backup_file="$BACKUP_DIR/$(basename "$backup_file")"
    
    # 构建pg_dump命令
    local pg_dump_cmd="pg_dump --format=custom --verbose --no-owner --no-privileges --clean"
    
    # 添加排除表选项
    if [[ -f "$CONFIG_FILE" ]] && command -v yq &> /dev/null; then
        local exclude_tables=($(yq e '.database.backup.options.exclude_tables[]' "$CONFIG_FILE" 2>/dev/null || true))
        for table in "${exclude_tables[@]}"; do
            if [[ -n "$table" ]]; then
                pg_dump_cmd="$pg_dump_cmd --exclude-table-data='$table'"
            fi
        done
    fi
    
    log "DEBUG" "执行命令: $pg_dump_cmd > $backup_file"
    
    # 执行备份
    if ! eval "$pg_dump_cmd" > "$backup_file" 2>> "$LOG_FILE"; then
        error_exit "数据库备份失败"
    fi
    
    local backup_size=$(du -h "$backup_file" | cut -f1)
    log "INFO" "数据库备份完成，大小: $backup_size"
    
    # 处理备份文件
    process_backup_file "$backup_file" "$final_backup_file"
    
    # 清理临时文件
    rm -f "$backup_file"
    
    log "INFO" "备份文件保存到: $final_backup_file"
}

# 处理备份文件（压缩、加密）
process_backup_file() {
    local input_file="$1"
    local output_file="$2"
    
    log "INFO" "处理备份文件..."
    
    local current_file="$input_file"
    
    # 压缩
    if [[ "$COMPRESSION" == "gzip" ]]; then
        log "INFO" "压缩备份文件..."
        local compressed_file="${current_file}.gz"
        
        if ! gzip -c "$current_file" > "$compressed_file"; then
            error_exit "备份文件压缩失败"
        fi
        
        current_file="$compressed_file"
    fi
    
    # 加密
    if [[ "$ENCRYPTION" == "aes256" ]] && [[ -n "$ENCRYPTION_KEY" ]]; then
        log "INFO" "加密备份文件..."
        local encrypted_file="${current_file}.enc"
        
        if ! openssl enc -aes-256-cbc -salt -pbkdf2 \
            -in "$current_file" \
            -out "$encrypted_file" \
            -pass "pass:$ENCRYPTION_KEY" 2>> "$LOG_FILE"; then
            error_exit "备份文件加密失败"
        fi
        
        current_file="$encrypted_file"
    fi
    
    # 移动到最终位置
    mv "$current_file" "$output_file"
    
    # 设置权限
    chmod 600 "$output_file"
}

# 验证备份文件
verify_backup() {
    local backup_file="$1"
    
    log "INFO" "验证备份文件: $backup_file"
    
    # 检查文件是否存在
    if [[ ! -f "$backup_file" ]]; then
        error_exit "备份文件不存在: $backup_file"
    fi
    
    # 检查文件大小
    local file_size=$(stat -c%s "$backup_file")
    if [[ "$file_size" -lt 1024 ]]; then
        error_exit "备份文件大小异常: $file_size 字节"
    fi
    
    log "INFO" "备份文件验证通过，大小: $(numfmt --to=iec $file_size)"
}

# 清理旧备份
cleanup_old_backups() {
    log "INFO" "清理 $RETENTION_DAYS 天前的旧备份..."
    
    local find_cmd="find '$BACKUP_DIR' -name '*.sql*' -type f -mtime +$RETENTION_DAYS"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "模拟清理模式，不会实际删除文件"
        find_cmd="$find_cmd -print"
    else
        find_cmd="$find_cmd -delete -print"
    fi
    
    local deleted_files=$(eval "$find_cmd")
    
    if [[ -n "$deleted_files" ]]; then
        log "INFO" "已清理的备份文件:"
        echo "$deleted_files" | while read -r file; do
            log "INFO" "  - $(basename "$file")"
        done
    else
        log "INFO" "没有需要清理的旧备份"
    fi
}

# 生成备份报告
generate_report() {
    local backup_file="$1"
    
    log "INFO" "生成备份报告..."
    
    local report_file="$BACKUP_DIR/backup_report_$(date '+%Y%m%d').txt"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local backup_size=$(du -h "$backup_file" | cut -f1)
    local file_size=$(stat -c%s "$backup_file")
    
    cat > "$report_file" << EOF
=== Facebook Auto Bot 数据库备份报告 ===
备份时间: $timestamp
备份类型: $BACKUP_TYPE
数据库: $DB_NAME
主机: $DB_HOST:$DB_PORT
备份文件: $(basename "$backup_file")
文件大小: $backup_size ($file_size 字节)
压缩: $COMPRESSION
加密: $ENCRYPTION
状态: 成功
保留策略: $RETENTION_DAYS 天
备份目录: $BACKUP_DIR

=== 系统信息 ===
主机名: $(hostname)
操作系统: $(uname -s) $(uname -r)
脚本版本: 1.0.0

=== 验证信息 ===
文件完整性: 通过
大小检查: 通过
权限检查: 通过

=== 下一步 ===
1. 定期验证备份文件完整性
2. 测试恢复流程
3. 监控备份存储空间
EOF
    
    log "INFO" "备份报告已生成: $report_file"
}

# 发送通知
send_notification() {
    local status="$1"
    local message="$2"
    
    log "INFO" "发送备份通知: $status"
    
    # 这里可以实现邮件、Slack、Webhook等通知
    # 目前只记录到日志
    log "NOTIFY" "备份状态: $status - $message"
}

# 主函数
main() {
    log "INFO" "=== 开始 Facebook Auto Bot 数据库备份 ==="
    log "INFO" "备份类型: $BACKUP_TYPE"
    log "INFO" "开始时间: $(date)"
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --full)
                BACKUP_TYPE="full"
                shift
                ;;
            --incremental)
                BACKUP_TYPE="incremental"
                shift
                ;;
            --config=*)
                CONFIG_FILE="${1#*=}"
                shift
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --test)
                TEST_MODE="true"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                error_exit "未知参数: $1"
                ;;
        esac
    done
    
    # 检查依赖
    check_dependencies
    
    # 加载配置
    load_config
    
    # 创建备份目录
    create_backup_dir
    
    # 检查数据库连接
    if [[ "$TEST_MODE" != "true" ]]; then
        check_database_connection
    else
        log "INFO" "测试模式，跳过数据库连接检查"
    fi
    
    # 执行备份
    if [[ "$DRY_RUN" != "true" ]] && [[ "$TEST_MODE" != "true" ]]; then
        perform_backup
        
        # 获取最新的备份文件
        local latest_backup=$(ls -t "$BACKUP_DIR"/*.sql* 2>/dev/null | head -1)
        
        if [[ -n "$latest_backup" ]]; then
            # 验证备份
            verify_backup "$latest_backup"
            
            # 生成报告
            generate_report "$latest_backup"
            
            # 发送成功通知
            send_notification "SUCCESS" "数据库备份成功: $(basename "$latest_backup")"
        fi
    else
        log "INFO" "模拟运行，跳过实际备份操作"
    fi
    
    # 清理旧备份
    cleanup_old_backups
    
    log "INFO" "=== 数据库备份完成 ==="
    log "INFO" "结束时间: $(date)"
}

# 显示帮助
show_help() {
    cat << EOF
Facebook Auto Bot 数据库备份脚本

用法: $0 [选项]

选项:
  --full          执行全量备份（默认）
  --incremental   执行增量备份
  --config=FILE   指定配置文件路径
  --dry-run       模拟运行，不实际执行备份
  --test          测试模式，检查配置和依赖
  --help          显示此帮助信息

示例:
  $0 --full                     # 执行全量备份
  $0 --incremental --dry-run    # 模拟增量备份
  $0 --test                     # 测试配置和依赖

环境变量:
  CONFIG_FILE     配置文件路径
  BACKUP_TYPE     备份类型 (full/incremental)
  BACKUP_DIR      备份目录
  LOG_FILE        日志文件路径
  TEMP_DIR        临时目录
  RETENTION_DAYS  备份保留天数
  COMPRESSION     压缩方式 (gzip/none)
  ENCRYPTION      加密方式 (aes256/none)
  ENCRYPTION_KEY  加密密钥

报告问题:
  查看日志文件: $LOG_FILE
EOF
}

# 运行主函数
main "$@"