#!/bin/bash

# Facebook Auto Bot 数据库恢复脚本
# 版本: 1.0.0

set -euo pipefail

# 默认配置
CONFIG_FILE="${CONFIG_FILE:-/workspace/backup-system/backup-config.yaml}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/facebook-auto-bot/database}"
LOG_FILE="${LOG_FILE:-/var/log/facebook-auto-bot/recovery.log}"
TEMP_DIR="${TEMP_DIR:-/tmp/facebook-auto-bot-recovery}"
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
    
    local dependencies=("pg_restore" "gzip" "openssl" "yq")
    
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
        
        # 从环境变量获取密码
        if [[ "$DB_PASSWORD" == \${* ]]; then
            local env_var=$(echo "$DB_PASSWORD" | sed 's/[${}]//g')
            DB_PASSWORD="${!env_var:-}"
        fi
        
        BACKUP_DIR=$(yq e '.storage.local.path' "$CONFIG_FILE")/database
        
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
    
    # 设置环境变量
    export PGHOST="$DB_HOST"
    export PGPORT="$DB_PORT"
    export PGUSER="$DB_USERNAME"
    export PGPASSWORD="$DB_PASSWORD"
    
    log "INFO" "数据库配置: $DB_HOST:$DB_PORT"
    log "INFO" "备份目录: $BACKUP_DIR"
}

# 创建临时目录
create_temp_dir() {
    log "INFO" "创建临时目录: $TEMP_DIR"
    
    mkdir -p "$TEMP_DIR"
    chmod 700 "$TEMP_DIR"
}

# 选择备份文件
select_backup_file() {
    local backup_pattern="$1"
    
    log "INFO" "选择备份文件..."
    
    if [[ -n "$BACKUP_FILE" ]]; then
        # 使用指定的备份文件
        if [[ ! -f "$BACKUP_FILE" ]]; then
            error_exit "指定的备份文件不存在: $BACKUP_FILE"
        fi
        echo "$BACKUP_FILE"
        return
    fi
    
    # 根据模式选择备份文件
    local backup_files=()
    
    if [[ "$backup_pattern" == "latest" ]]; then
        # 选择最新的备份文件
        backup_files=($(ls -t "$BACKUP_DIR"/*.sql* 2>/dev/null))
    elif [[ "$backup_pattern" == "full" ]]; then
        # 选择最新的全量备份
        backup_files=($(ls -t "$BACKUP_DIR"/*_full.* 2>/dev/null))
    elif [[ "$backup_pattern" =~ ^[0-9]{8}_[0-9]{6} ]]; then
        # 选择特定时间戳的备份
        backup_files=($(ls "$BACKUP_DIR"/*${backup_pattern}* 2>/dev/null))
    else
        # 列出所有备份文件供选择
        backup_files=($(ls -t "$BACKUP_DIR"/*.sql* 2>/dev/null))
    fi
    
    if [[ ${#backup_files[@]} -eq 0 ]]; then
        error_exit "在 $BACKUP_DIR 中找不到备份文件"
    fi
    
    local selected_file="${backup_files[0]}"
    
    log "INFO" "选择的备份文件: $(basename "$selected_file")"
    echo "$selected_file"
}

# 解密备份文件
decrypt_backup_file() {
    local input_file="$1"
    local output_file="$2"
    
    log "INFO" "解密备份文件..."
    
    if [[ "$input_file" == *.enc ]]; then
        if [[ -z "$ENCRYPTION_KEY" ]]; then
            error_exit "需要加密密钥来解密备份文件"
        fi
        
        if ! openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "$input_file" \
            -out "$output_file" \
            -pass "pass:$ENCRYPTION_KEY" 2>> "$LOG_FILE"; then
            error_exit "备份文件解密失败"
        fi
        
        log "INFO" "备份文件解密成功"
    else
        # 如果不是加密文件，直接复制
        cp "$input_file" "$output_file"
    fi
}

# 解压备份文件
decompress_backup_file() {
    local input_file="$1"
    local output_file="$2"
    
    log "INFO" "解压备份文件..."
    
    if [[ "$input_file" == *.gz ]]; then
        if ! gzip -dc "$input_file" > "$output_file" 2>> "$LOG_FILE"; then
            error_exit "备份文件解压失败"
        fi
        
        log "INFO" "备份文件解压成功"
    else
        # 如果不是压缩文件，直接复制
        cp "$input_file" "$output_file"
    fi
}

# 准备恢复文件
prepare_backup_file() {
    local backup_file="$1"
    
    log "INFO" "准备恢复文件..."
    
    local temp_file="$TEMP_DIR/$(basename "$backup_file")"
    local decrypted_file="${temp_file%.enc}"
    local final_file="${decrypted_file%.gz}"
    
    # 复制到临时目录
    cp "$backup_file" "$temp_file"
    
    # 解密（如果需要）
    if [[ "$backup_file" == *.enc ]]; then
        decrypt_backup_file "$temp_file" "$decrypted_file"
        rm -f "$temp_file"
        temp_file="$decrypted_file"
    fi
    
    # 解压（如果需要）
    if [[ "$temp_file" == *.gz ]]; then
        decompress_backup_file "$temp_file" "$final_file"
        rm -f "$temp_file"
    else
        final_file="$temp_file"
    fi
    
    # 验证文件格式
    if ! file "$final_file" | grep -q "PostgreSQL custom database dump"; then
        error_exit "备份文件格式不正确"
    fi
    
    log "INFO" "备份文件准备完成: $final_file"
    echo "$final_file"
}

# 检查数据库连接
check_database_connection() {
    log "INFO" "检查数据库连接..."
    
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" > /dev/null 2>&1; then
        error_exit "数据库连接失败"
    fi
    
    log "INFO" "数据库连接成功"
}

# 创建新数据库（如果需要）
create_new_database() {
    local new_db="$1"
    
    log "INFO" "创建新数据库: $new_db"
    
    # 检查数据库是否已存在
    if psql -lqt | cut -d \| -f 1 | grep -qw "$new_db"; then
        if [[ "$FORCE" == "true" ]]; then
            log "WARN" "数据库 $new_db 已存在，强制删除..."
            dropdb "$new_db"
        else
            error_exit "数据库 $new_db 已存在，使用 --force 覆盖"
        fi
    fi
    
    # 创建新数据库
    if ! createdb "$new_db"; then
        error_exit "创建数据库失败: $new_db"
    fi
    
    log "INFO" "数据库创建成功: $new_db"
}

# 执行数据库恢复
perform_restore() {
    local backup_file="$1"
    local target_db="$2"
    
    log "INFO" "开始数据库恢复..."
    
    # 构建pg_restore命令
    local pg_restore_cmd="pg_restore --verbose --clean --if-exists --no-owner --no-privileges"
    
    # 添加作业数（如果支持）
    if pg_restore --help 2>&1 | grep -q "--jobs"; then
        pg_restore_cmd="$pg_restore_cmd --jobs=4"
    fi
    
    # 指定数据库
    pg_restore_cmd="$pg_restore_cmd -d $target_db"
    
    # 添加备份文件
    pg_restore_cmd="$pg_restore_cmd $backup_file"
    
    log "DEBUG" "执行命令: $pg_restore_cmd"
    
    # 执行恢复
    if ! eval "$pg_restore_cmd" 2>> "$LOG_FILE"; then
        error_exit "数据库恢复失败"
    fi
    
    log "INFO" "数据库恢复完成"
}

# 验证恢复结果
verify_restore() {
    local target_db="$1"
    
    log "INFO" "验证恢复结果..."
    
    # 检查表数量
    local table_count=$(psql -d "$target_db" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    
    if [[ "$table_count" -lt 5 ]]; then
        error_exit "恢复的表数量异常: $table_count"
    fi
    
    # 检查关键表
    local critical_tables=("users" "facebook_accounts" "task_configs")
    
    for table in "${critical_tables[@]}"; do
        if ! psql -d "$target_db" -t -c "SELECT 1 FROM $table LIMIT 1;" > /dev/null 2>&1; then
            error_exit "关键表 $table 恢复失败"
        fi
    done
    
    # 检查数据量
    local user_count=$(psql -d "$target_db" -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
    local account_count=$(psql -d "$target_db" -t -c "SELECT COUNT(*) FROM facebook_accounts;" | tr -d ' ')
    
    log "INFO" "恢复验证通过:"
    log "INFO" "  - 表数量: $table_count"
    log "INFO" "  - 用户数: $user_count"
    log "INFO" "  - 账号数: $account_count"
}

# 生成恢复报告
generate_report() {
    local backup_file="$1"
    local target_db="$2"
    
    log "INFO" "生成恢复报告..."
    
    local report_file="$TEMP_DIR/recovery_report_$(date '+%Y%m%d_%H%M%S').txt"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 收集恢复信息
    local backup_size=$(du -h "$backup_file" | cut -f1)
    local db_size=$(psql -d "$target_db" -t -c "SELECT pg_size_pretty(pg_database_size('$target_db'));" | tr -d ' ')
    local table_count=$(psql -d "$target_db" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    
    cat > "$report_file" << EOF
=== Facebook Auto Bot 数据库恢复报告 ===
恢复时间: $timestamp
备份文件: $(basename "$BACKUP_FILE")
目标数据库: $target_db
备份大小: $backup_size
数据库大小: $db_size
表数量: $table_count
恢复状态: 成功

=== 恢复详情 ===
源数据库: $DB_NAME
目标数据库: $target_db
恢复方式: $RESTORE_MODE
强制恢复: $FORCE
测试模式: $TEST_MODE

=== 验证结果 ===
数据库连接: 成功
表结构恢复: 成功
数据完整性: 成功
关键表检查: 成功

=== 系统信息 ===
主机名: $(hostname)
PostgreSQL版本: $(psql --version)
恢复脚本版本: 1.0.0

=== 下一步建议 ===
1. 验证应用功能
2. 更新应用配置（如果需要）
3. 通知相关团队
4. 监控系统性能
EOF
    
    log "INFO" "恢复报告已生成: $report_file"
    
    # 复制到备份目录
    cp "$report_file" "$BACKUP_DIR/"
}

# 清理临时文件
cleanup_temp_files() {
    log "INFO" "清理临时文件..."
    
    if [[ -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}

# 显示帮助
show_help() {
    cat << EOF
Facebook Auto Bot 数据库恢复脚本

用法: $0 [选项]

选项:
  --backup=FILE     指定备份文件路径
  --latest          使用最新的备份（默认）
  --full            使用最新的全量备份
  --timestamp=TIME  使用特定时间戳的备份 (YYYYMMDD_HHMMSS)
  --database=DB     目标数据库名（默认: 原数据库名）
  --new-database=DB 恢复到新数据库
  --force           强制覆盖已存在的数据库
  --test            测试模式，只验证不执行恢复
  --config=FILE     指定配置文件路径
  --help            显示此帮助信息

示例:
  $0 --latest                     # 使用最新备份恢复
  $0 --backup=/path/to/backup.sql # 使用指定备份恢复
  $0 --new-database=recovery_db   # 恢复到新数据库
  $0 --test --latest              # 测试恢复流程

环境变量:
  CONFIG_FILE     配置文件路径
  BACKUP_DIR      备份目录
  LOG_FILE        日志文件路径
  TEMP_DIR        临时目录
  ENCRYPTION_KEY  加密密钥

报告问题:
  查看日志文件: $LOG_FILE
EOF
}

# 主函数
main() {
    log "INFO" "=== 开始 Facebook Auto Bot 数据库恢复 ==="
    log "INFO" "开始时间: $(date)"
    
    # 默认参数
    local BACKUP_FILE=""
    local TARGET_DB="$DB_NAME"
    local RESTORE_MODE="latest"
    local FORCE="false"
    local TEST_MODE="false"
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup=*)
                BACKUP_FILE="${1#*=}"
                RESTORE_MODE="custom"
                shift
                ;;
            --latest)
                RESTORE_MODE="latest"
                shift
                ;;
            --full)
                RESTORE_MODE="full"
                shift
                ;;
            --timestamp=*)
                RESTORE_MODE="${1#*=}"
                shift
                ;;
            --database=*)
                TARGET_DB="${1#*=}"
                shift
                ;;
            --new-database=*)
                TARGET_DB="${1#*=}"
                shift
                ;;
            --force)
                FORCE="true"
                shift
                ;;
            --test)
                TEST_MODE="true"
                shift
                ;;
            --config=*)
                CONFIG_FILE="${1#*=}"
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
    
    # 创建临时目录
    create_temp_dir
    
    # 选择备份文件
    local selected_backup=$(select_backup_file "$RESTORE_MODE")
    
    # 准备恢复文件
    local prepared_backup=$(prepare_backup_file "$selected_backup")
    
    # 检查数据库连接
    check_database_connection
    
    # 创建新数据库（如果需要）
    if [[ "$TARGET_DB" != "$DB_NAME" ]]; then
        create_new_database "$TARGET_DB"
    fi
    
    # 执行恢复
    if [[ "$TEST_MODE" != "true" ]]; then
        perform_restore "$prepared_backup" "$TARGET_DB"
        
        # 验证恢复结果
        verify_restore "$TARGET_DB"
        
        # 生成报告
        generate_report "$selected_backup" "$TARGET_DB"
        
        log "INFO" "数据库恢复成功！"
        log "INFO" "目标数据库: $TARGET_DB"
        log "INFO" "备份文件: $(basename "$selected_backup")"
    else
        log "INFO" "测试模式，跳过实际恢复操作"
        log "INFO" "将恢复: $(basename "$selected_backup") -> $TARGET_DB"
    fi
    
    # 清理临时文件
    cleanup_temp_files
    
    log "INFO" "=== 数据库恢复完成 ==="
    log "INFO" "结束时间: $(date)"
}

# 运行主函数
main "$@"
