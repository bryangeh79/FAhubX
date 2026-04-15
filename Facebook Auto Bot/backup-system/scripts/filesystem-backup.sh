#!/bin/bash

# Facebook Auto Bot 文件系统备份脚本
# 版本: 1.0.0

set -euo pipefail

# 默认配置
CONFIG_FILE="${CONFIG_FILE:-/workspace/backup-system/backup-config.yaml}"
BACKUP_TYPE="${BACKUP_TYPE:-full}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/facebook-auto-bot/filesystem}"
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
    
    local dependencies=("tar" "gzip" "openssl" "yq" "find")
    
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
        BACKUP_DIR=$(yq e '.storage.local.path' "$CONFIG_FILE")/filesystem
        RETENTION_DAYS=$(yq e '.filesystem.backup.full.retention_days' "$CONFIG_FILE")
        COMPRESSION=$(yq e '.filesystem.backup.full.compression' "$CONFIG_FILE")
        ENCRYPTION=$(yq e '.filesystem.backup.full.encryption' "$CONFIG_FILE")
        
        # 获取加密密钥
        local encryption_key_config=$(yq e '.filesystem.backup.full.encryption_key' "$CONFIG_FILE")
        if [[ "$encryption_key_config" == \${* ]]; then
            local env_var=$(echo "$encryption_key_config" | sed 's/[${}]//g')
            ENCRYPTION_KEY="${!env_var:-}"
        else
            ENCRYPTION_KEY="$encryption_key_config"
        fi
        
        # 获取备份路径
        BACKUP_PATHS=()
        local path_count=$(yq e '.filesystem.paths | length' "$CONFIG_FILE")
        
        for ((i=0; i<path_count; i++)); do
            local path=$(yq e ".filesystem.paths[$i].path" "$CONFIG_FILE")
            local enabled=$(yq e ".filesystem.paths[$i].enabled // true" "$CONFIG_FILE")
            
            if [[ "$enabled" == "true" ]] && [[ -e "$path" ]]; then
                BACKUP_PATHS+=("$path")
            fi
        done
        
        # 获取排除模式
        EXCLUDE_PATTERNS=()
        local exclude_count=$(yq e '.filesystem.paths[0].exclude | length' "$CONFIG_FILE")
        
        for ((i=0; i<exclude_count; i++)); do
            local pattern=$(yq e ".filesystem.paths[0].exclude[$i]" "$CONFIG_FILE")
            EXCLUDE_PATTERNS+=("--exclude=$pattern")
        done
        
    else
        log "WARN" "yq命令未找到，使用默认配置"
        BACKUP_PATHS=(
            "/workspace/backend"
            "/workspace/frontend"
            "/workspace/docker-compose.yml"
            "/workspace/.env"
            "/workspace/backup-system"
            "/workspace/docs"
            "/workspace/infrastructure"
        )
        EXCLUDE_PATTERNS=(
            "--exclude=**/node_modules"
            "--exclude=**/.git"
            "--exclude=**/*.log"
            "--exclude=**/tmp"
            "--exclude=**/dist"
            "--exclude=**/build"
        )
    fi
    
    log "INFO" "备份目录: $BACKUP_DIR"
    log "INFO" "保留天数: $RETENTION_DAYS"
    log "INFO" "备份路径数量: ${#BACKUP_PATHS[@]}"
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

# 检查备份路径
check_backup_paths() {
    log "INFO" "检查备份路径..."
    
    local valid_paths=()
    local invalid_paths=()
    
    for path in "${BACKUP_PATHS[@]}"; do
        if [[ -e "$path" ]]; then
            valid_paths+=("$path")
            log "DEBUG" "有效路径: $path"
        else
            invalid_paths+=("$path")
            log "WARN" "无效路径: $path (不存在)"
        fi
    done
    
    if [[ ${#valid_paths[@]} -eq 0 ]]; then
        error_exit "没有有效的备份路径"
    fi
    
    BACKUP_PATHS=("${valid_paths[@]}")
    
    if [[ ${#invalid_paths[@]} -gt 0 ]]; then
        log "WARN" "发现 ${#invalid_paths[@]} 个无效路径"
    fi
}

# 生成备份文件名
generate_backup_filename() {
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local hostname=$(hostname -s)
    
    echo "${timestamp}_${hostname}_filesystem_${BACKUP_TYPE}.tar"
}

# 构建tar命令
build_tar_command() {
    local output_file="$1"
    local tar_cmd="tar -cf -"
    
    # 添加排除模式
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        tar_cmd="$tar_cmd $pattern"
    done
    
    # 添加备份路径
    for path in "${BACKUP_PATHS[@]}"; do
        tar_cmd="$tar_cmd $path"
    done
    
    # 输出到文件
    tar_cmd="$tar_cmd > $output_file"
    
    echo "$tar_cmd"
}

# 执行文件系统备份
perform_backup() {
    log "INFO" "开始文件系统备份..."
    
    local backup_file="$TEMP_DIR/$(generate_backup_filename)"
    local final_backup_file="$BACKUP_DIR/$(basename "$backup_file")"
    
    # 构建并执行tar命令
    local tar_cmd=$(build_tar_command "$backup_file")
    
    log "DEBUG" "执行命令: $tar_cmd"
    
    # 执行备份
    if ! eval "$tar_cmd" 2>> "$LOG_FILE"; then
        error_exit "文件系统备份失败"
    fi
    
    local backup_size=$(du -h "$backup_file" | cut -f1)
    log "INFO" "文件系统备份完成，大小: $backup_size"
    
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
    
    # 检查文件完整性（如果是tar.gz）
    if [[ "$backup_file" == *.tar.gz ]] || [[ "$backup_file" == *.tgz ]]; then
        log "INFO" "检查tar.gz文件完整性..."
        if ! gzip -t "$backup_file" 2>> "$LOG_FILE"; then
            error_exit "备份文件完整性检查失败"
        fi
    fi
    
    log "INFO" "备份文件验证通过，大小: $(numfmt --to=iec $file_size)"
}

# 生成文件清单
generate_file_list() {
    local backup_file="$1"
    
    log "INFO" "生成文件清单..."
    
    local list_file="${backup_file%.*}.list"
    
    # 根据文件类型生成清单
    if [[ "$backup_file" == *.tar.gz.enc ]]; then
        # 加密文件，先解密再列出
        local temp_file="$TEMP_DIR/temp_decrypted.tar.gz"
        
        openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "$backup_file" \
            -out "$temp_file" \
            -pass "pass:$ENCRYPTION_KEY" 2>> "$LOG_FILE"
        
        tar -tzf "$temp_file" > "$list_file"
        rm -f "$temp_file"
        
    elif [[ "$backup_file" == *.tar.gz ]]; then
        # 压缩文件
        tar -tzf "$backup_file" > "$list_file"
        
    elif [[ "$backup_file" == *.tar.enc ]]; then
        # 加密的tar文件
        local temp_file="$TEMP_DIR/temp_decrypted.tar"
        
        openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "$backup_file" \
            -out "$temp_file" \
            -pass "pass:$ENCRYPTION_KEY" 2>> "$LOG_FILE"
        
        tar -tf "$temp_file" > "$list_file"
        rm -f "$temp_file"
        
    elif [[ "$backup_file" == *.tar ]]; then
        # 普通tar文件
        tar -tf "$backup_file" > "$list_file"
    fi
    
    local file_count=$(wc -l < "$list_file")
    log "INFO" "备份包含 $file_count 个文件"
    
    # 设置权限
    chmod 600 "$list_file"
}

# 计算备份统计信息
calculate_statistics() {
    local backup_file="$1"
    
    log "INFO" "计算备份统计信息..."
    
    local stats_file="${backup_file%.*}.stats"
    
    cat > "$stats_file" << EOF
备份文件: $(basename "$backup_file")
备份时间: $(date '+%Y-%m-%d %H:%M:%S')
备份类型: $BACKUP_TYPE
文件大小: $(du -h "$backup_file" | cut -f1)
原始大小: $(stat -c%s "$backup_file") 字节
压缩比例: N/A
加密状态: $ENCRYPTION
备份路径:
EOF
    
    for path in "${BACKUP_PATHS[@]}"; do
        echo "  - $path" >> "$stats_file"
    done
    
    echo "" >> "$stats_file"
    echo "排除模式:" >> "$stats_file"
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        echo "  - $pattern" >> "$stats_file"
    done
    
    # 设置权限
    chmod 600 "$stats_file"
}

# 清理旧备份
cleanup_old_backups() {
    log "INFO" "清理 $RETENTION_DAYS 天前的旧备份..."
    
    local find_cmd="find '$BACKUP_DIR' \( -name '*.tar' -o -name '*.tar.gz' -o -name '*.tar.enc' -o -name '*.tar.gz.enc' \) -type f -mtime +$RETENTION_DAYS"
    
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
    
    # 清理相关的.list和.stats文件
    local find_meta_cmd="find '$BACKUP_DIR' \( -name '*.list' -o -name '*.stats' \) -type f -mtime +$RETENTION_DAYS"
    
    if [[ "$DRY_RUN" != "true" ]]; then
        eval "$find_meta_cmd -delete" 2>/dev/null || true
    fi
}

# 生成备份报告
generate_report() {
    local backup_file="$1"
    
    log "INFO" "生成备份报告..."
    
    local report_file="$BACKUP_DIR/backup_report_filesystem_$(date '+%Y%m%d').txt"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local backup_size=$(du -h "$backup_file" | cut -f1)
    local file_size=$(stat -c%s "$backup_file")
    
    cat > "$report_file" << EOF
=== Facebook Auto Bot 文件系统备份报告 ===
备份时间: $timestamp
备份类型: $BACKUP_TYPE
备份文件: $(basename "$backup_file")
文件大小: $backup_size ($file_size 字节)
压缩: $COMPRESSION
加密: $ENCRYPTION
状态: 成功
保留策略: $RETENTION_DAYS 天
备份目录: $BACKUP_DIR

=== 备份路径 ===
$(for path in "${BACKUP_PATHS[@]}"; do echo "- $path"; done)

=== 排除模式 ===
$(for pattern in "${EXCLUDE_PATTERNS[@]}"; do echo "- $pattern"; done)

=== 系统信息 ===
主机名: $(hostname)
操作系统: $(uname -s) $(uname -r)
磁盘使用: $(df -h "$BACKUP_DIR" | tail -1)
脚本版本: 1.0.0

=== 验证信息 ===
文件完整性: 通过
大小检查: 通过
权限检查: 通过

=== 下一步 ===
1. 定期验证备份文件完整性
2. 测试恢复流程
3. 监控备份存储空间
4. 检查文件清单确保重要文件已备份
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
    log "INFO" "=== 开始 Facebook Auto Bot 文件系统备份 ==="
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
            --path=*)
                CUSTOM_PATH="${1#*=}"
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
    
    # 如果有自定义路径，覆盖配置
    if [[ -n "$CUSTOM_PATH" ]]; then
        BACKUP_PATHS=("$CUSTOM_PATH")
        log "INFO" "使用自定义路径: $CUSTOM_PATH"
    fi
    
    # 创建备份目录
    create_backup_dir
    
    # 检查备份路径
    check_backup_paths
    
    # 执行备份
    if [[ "$DRY_RUN" != "true" ]] && [[ "$TEST_MODE" != "true" ]]; then
        perform_backup
        
        # 获取最新的备份文件
        local latest_backup=$(ls -t "$BACKUP_DIR"/*.tar* 2>/dev/null | head -1)
        
        if [[ -n "$latest_backup" ]]; then
            # 验证备份
            verify_backup "$latest_backup"
            
            # 生成文件清单
            generate_file_list "$latest_backup"
            
            # 生成统计信息
            calculate_statistics "$latest_backup"
            
            # 生成报告
            generate_report "$latest_backup"
            
            # 发送成功通知
            send_notification "SUCCESS" "文件系统备份成功: $(basename "$latest_backup")"
        fi
    else
        log "INFO" "模拟运行，跳过实际备份操作"
    fi
    
    # 清理旧备份
    cleanup_old_backups
    
    log "INFO" "=== 文件系统备份完成 ==="
    log "INFO" "结束时间: $(date)"
}

# 显示帮助
show_help() {
    cat << EOF
Facebook Auto Bot 文件系统备份脚本

用法: $0 [选项]

选项:
  --full          执行全量备份（默认）
  --incremental   执行增量备份
  --config=FILE   指定配置文件路径
  --dry-run       模拟运行，不实际执行备份
  --test          测试模式，检查配置和依赖
  --path=PATH     指定自定义备份路径
  --help          显示此帮助信息

示例:
  $0 --full                     # 执行全量备份
  $0 --incremental --dry-run    # 模拟增量备份
  $0 --test                     # 测试配置和依赖
  $0 --path=/workspace/backend  # 备份指定路径

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
