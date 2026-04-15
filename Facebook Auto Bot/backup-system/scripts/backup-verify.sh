#!/bin/bash

# Facebook Auto Bot 备份验证脚本
# 版本: 1.0.0

set -euo pipefail

# 默认配置
CONFIG_FILE="${CONFIG_FILE:-/workspace/backup-system/backup-config.yaml}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/facebook-auto-bot}"
LOG_FILE="${LOG_FILE:-/var/log/facebook-auto-bot/backup-verify.log}"
TEMP_DIR="${TEMP_DIR:-/tmp/facebook-auto-bot-verify}"

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
    
    local dependencies=("gzip" "openssl" "tar" "file")
    
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
    
    # 使用yq解析YAML配置（如果可用）
    if command -v yq &> /dev/null; then
        BACKUP_DIR=$(yq e '.storage.local.path' "$CONFIG_FILE")
        
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
    
    log "INFO" "备份目录: $BACKUP_DIR"
}

# 创建临时目录
create_temp_dir() {
    log "INFO" "创建临时目录: $TEMP_DIR"
    
    mkdir -p "$TEMP_DIR"
    chmod 700 "$TEMP_DIR"
}

# 查找备份文件
find_backup_files() {
    local backup_type="$1"
    
    log "INFO" "查找 $backup_type 备份文件..."
    
    local backup_files=()
    
    case "$backup_type" in
        "database")
            backup_files=($(find "$BACKUP_DIR/database" -name "*.sql*" -type f 2>/dev/null | sort -r))
            ;;
        "filesystem")
            backup_files=($(find "$BACKUP_DIR/filesystem" -name "*.tar*" -type f 2>/dev/null | sort -r))
            ;;
        "config")
            backup_files=($(find "$BACKUP_DIR/config" -name "*.tar*" -type f 2>/dev/null | sort -r))
            ;;
        "all")
            backup_files=($(find "$BACKUP_DIR" -name "*.sql*" -o -name "*.tar*" -type f 2>/dev/null | sort -r))
            ;;
        *)
            backup_files=($(find "$BACKUP_DIR" -name "*$backup_type*" -type f 2>/dev/null | sort -r))
            ;;
    esac
    
    if [[ ${#backup_files[@]} -eq 0 ]]; then
        log "WARN" "未找到 $backup_type 备份文件"
    else
        log "INFO" "找到 ${#backup_files[@]} 个 $backup_type 备份文件"
    fi
    
    echo "${backup_files[@]}"
}

# 验证文件完整性
verify_file_integrity() {
    local file_path="$1"
    
    log "INFO" "验证文件完整性: $(basename "$file_path")"
    
    # 检查文件是否存在
    if [[ ! -f "$file_path" ]]; then
        log "ERROR" "文件不存在: $file_path"
        return 1
    fi
    
    # 检查文件大小
    local file_size=$(stat -c%s "$file_path")
    if [[ "$file_size" -lt 1024 ]]; then
        log "ERROR" "文件大小异常: $file_size 字节"
        return 1
    fi
    
    # 检查文件类型并验证
    local file_type=$(file -b "$file_path")
    
    case "$file_type" in
        *"gzip compressed data"*)
            verify_gzip_file "$file_path"
            ;;
        *"tar archive"*)
            verify_tar_file "$file_path"
            ;;
        *"PostgreSQL custom database dump"*)
            verify_pg_dump_file "$file_path"
            ;;
        *"data"*)
            # 可能是加密文件
            verify_encrypted_file "$file_path"
            ;;
        *)
            log "WARN" "未知文件类型: $file_type"
            verify_generic_file "$file_path"
            ;;
    esac
    
    local result=$?
    
    if [[ $result -eq 0 ]]; then
        log "INFO" "文件完整性验证通过: $(basename "$file_path")"
        return 0
    else
        log "ERROR" "文件完整性验证失败: $(basename "$file_path")"
        return 1
    fi
}

# 验证gzip文件
verify_gzip_file() {
    local file_path="$1"
    
    log "DEBUG" "验证gzip文件: $(basename "$file_path")"
    
    if ! gzip -t "$file_path" 2>> "$LOG_FILE"; then
        log "ERROR" "gzip文件完整性检查失败"
        return 1
    fi
    
    # 检查压缩率
    local uncompressed_size=$(gzip -l "$file_path" | tail -1 | awk '{print $2}')
    local compressed_size=$(gzip -l "$file_path" | tail -1 | awk '{print $1}')
    
    if [[ "$uncompressed_size" -eq 0 ]]; then
        log "WARN" "gzip文件解压大小为0"
        return 1
    fi
    
    local compression_ratio=$((compressed_size * 100 / uncompressed_size))
    log "DEBUG" "压缩率: $compression_ratio% ($compressed_size/$uncompressed_size)"
    
    return 0
}

# 验证tar文件
verify_tar_file() {
    local file_path="$1"
    
    log "DEBUG" "验证tar文件: $(basename "$file_path")"
    
    # 尝试列出tar文件内容
    if ! tar -tf "$file_path" > /dev/null 2>> "$LOG_FILE"; then
        log "ERROR" "tar文件完整性检查失败"
        return 1
    fi
    
    # 统计文件数量
    local file_count=$(tar -tf "$file_path" | wc -l)
    log "DEBUG" "tar文件包含 $file_count 个文件"
    
    if [[ "$file_count" -eq 0 ]]; then
        log "WARN" "tar文件为空"
        return 1
    fi
    
    return 0
}

# 验证pg_dump文件
verify_pg_dump_file() {
    local file_path="$1"
    
    log "DEBUG" "验证pg_dump文件: $(basename "$file_path")"
    
    # 检查文件头
    if ! head -c 100 "$file_path" | grep -q "PGDMP"; then
        log "ERROR" "不是有效的pg_dump文件"
        return 1
    fi
    
    # 检查文件大小
    local file_size=$(stat -c%s "$file_path")
    if [[ "$file_size" -lt 10240 ]]; then
        log "WARN" "pg_dump文件可能不完整: $file_size 字节"
        return 1
    fi
    
    return 0
}

# 验证加密文件
verify_encrypted_file() {
    local file_path="$1"
    
    log "DEBUG" "验证加密文件: $(basename "$file_path")"
    
    # 检查是否是加密文件
    if [[ ! "$file_path" == *.enc ]]; then
        log "WARN" "文件扩展名不是.enc，但被识别为数据文件"
        return 0
    fi
    
    # 如果有加密密钥，尝试解密验证
    if [[ -n "$ENCRYPTION_KEY" ]]; then
        local temp_file="$TEMP_DIR/$(basename "$file_path").decrypted"
        
        if openssl enc -aes-256-cbc -d -pbkdf2 \
            -in "$file_path" \
            -out "$temp_file" \
            -pass "pass:$ENCRYPTION_KEY" 2>> "$LOG_FILE"; then
            log "INFO" "加密文件解密成功"
            
            # 验证解密后的文件
            verify_file_integrity "$temp_file"
            local result=$?
            
            # 清理临时文件
            rm -f "$temp_file"
            
            return $result
        else
            log "ERROR" "加密文件解密失败"
            return 1
        fi
    else
        log "WARN" "无加密密钥，跳过加密文件验证"
        return 0
    fi
}

# 验证通用文件
verify_generic_file() {
    local file_path="$1"
    
    log "DEBUG" "验证通用文件: $(basename "$file_path")"
    
    # 计算MD5校验和
    local md5sum=$(md5sum "$file_path" | cut -d' ' -f1)
    log "DEBUG" "文件MD5: $md5sum"
    
    # 检查文件权限
    local permissions=$(stat -c "%a" "$file_path")
    if [[ "$permissions" != "600" ]] && [[ "$permissions" != "400" ]]; then
        log "WARN" "文件权限可能不安全: $permissions"
    fi
    
    return 0
}

# 验证备份年龄
verify_backup_age() {
    local file_path="$1"
    
    log "DEBUG" "验证备份年龄: $(basename "$file_path")"
    
    local file_mtime=$(stat -c "%Y" "$file_path")
    local current_time=$(date +%s)
    local age_hours=$(( (current_time - file_mtime) / 3600 ))
    
    log "DEBUG" "备份年龄: $age_hours 小时"
    
    # 根据备份类型设置最大年龄
    local max_age_hours=0
    local backup_name=$(basename "$file_path")
    
    if [[ "$backup_name" == *"database"* ]]; then
        if [[ "$backup_name" == *"full"* ]]; then
            max_age_hours=24  # 全量备份最大24小时
        else
            max_age_hours=2   # 增量备份最大2小时
        fi
    elif [[ "$backup_name" == *"filesystem"* ]]; then
        max_age_hours=24
    elif [[ "$backup_name" == *"config"* ]]; then
        max_age_hours=168  # 配置备份最大7天
    fi
    
    if [[ $max_age_hours -gt 0 ]] && [[ $age_hours -gt $max_age_hours ]]; then
        log "WARN" "备份文件年龄过大: $age_hours 小时 (最大: $max_age_hours 小时)"
        return 1
    fi
    
    return 0
}

# 验证备份存储
verify_backup_storage() {
    log "INFO" "验证备份存储..."
    
    # 检查备份目录是否存在
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "ERROR" "备份目录不存在: $BACKUP_DIR"
        return 1
    fi
    
    # 检查磁盘空间
    local disk_usage=$(df -h "$BACKUP_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    local disk_available=$(df -h "$BACKUP_DIR" | tail -1 | awk '{print $4}')
    
    log "INFO" "磁盘使用率: $disk_usage%"
    log "INFO" "可用空间: $disk_available"
    
    if [[ "$disk_usage" -gt 90 ]]; then
        log "ERROR" "磁盘空间不足: 使用率 $disk_usage%"
        return 1
    fi
    
    # 检查目录权限
    local dir_permissions=$(stat -c "%a" "$BACKUP_DIR")
    if [[ "$dir_permissions" != "700" ]]; then
        log "WARN" "备份目录权限可能不安全: $dir_permissions"
    fi
    
    return 0
}

# 生成验证报告
generate_verification_report() {
    local results_file="$1"
    local backup_type="$2"
    local total_files="$3"
    local passed_files="$4"
    local failed_files="$5"
    
    log "INFO" "生成验证报告..."
    
    local report_file="$BACKUP_DIR/verification_report_${backup_type}_$(date '+%Y%m%d_%H%M%S').txt"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local pass_rate=$((passed_files * 100 / total_files))
    
    cat > "$report_file" << EOF
=== Facebook Auto Bot 备份验证报告 ===
验证时间: $timestamp
备份类型: $backup_type
验证文件数: $total_files
通过文件数: $passed_files
失败文件数: $failed_files
通过率: $pass_rate%
验证目录: $BACKUP_DIR

=== 详细结果 ===
$(cat "$results_file")

=== 总结 ===
$(if [[ $failed_files -eq 0 ]]; then
    echo "所有备份文件验证通过"
else
    echo "发现 $failed_files 个备份文件验证失败"
    echo "建议立即检查备份系统"
fi)

=== 建议 ===
1. 定期运行备份验证
2. 监控备份系统状态
3. 测试恢复流程
4. 检查存储空间

=== 系统信息 ===
主机名: $(hostname)
脚本版本: 1.0.0
生成时间: $timestamp
EOF
    
    log "INFO" "验证报告已生成: $report_file"
    
    # 复制到标准位置
    cp "$report_file" "$BACKUP_DIR/latest_verification_report.txt"
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
Facebook Auto Bot 备份验证脚本

用法: $0 [选项]

选项:
  --type=TYPE       备份类型 (database, filesystem, config, all)
  --latest          只验证最新的备份
  --all             验证所有备份（默认）
  --age            检查备份年龄
  --storage        检查备份存储
  --verbose        详细输出
  --config=FILE    指定配置文件路径
  --help           显示此帮助信息

示例:
  $0 --type=database           # 验证数据库备份
  $0 --type=filesystem --latest # 验证最新的文件系统备份
  $0 --all --verbose           # 验证所有备份并详细输出
  $0 --storage                 # 检查备份存储状态

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
    log "INFO" "=== 开始 Facebook Auto Bot 备份验证 ==="
    log "INFO" "开始时间: $(date)"
    
    # 默认参数
    local BACKUP_TYPE="all"
    local VERIFY_LATEST=false
    local CHECK_AGE=false
    local CHECK_STORAGE=false
    local VERBOSE=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --type=*)
                BACKUP_TYPE="${1#*=}"
                shift
                ;;
            --latest)
                VERIFY_LATEST=true
                shift
                ;;
            --all)
                BACKUP_TYPE="all"
                shift
                ;;
            --age)
                CHECK_AGE=true
                shift
                ;;
            --storage)
                CHECK_STORAGE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
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
    
    # 检查备份存储
    if [[ "$CHECK_STORAGE" == "true" ]] || [[ "$BACKUP_TYPE" == "all" ]]; then
        verify_backup_storage
    fi
    
    # 查找备份文件
    local backup_files=($(find_backup_files "$BACKUP_TYPE"))
    
    if [[ ${#backup_files[@]} -eq 0 ]]; then
        log "ERROR" "未找到备份文件"
        exit 1
    fi
    
    # 如果只验证最新的，只取第一个文件
    if [[ "$VERIFY_LATEST" == "true" ]]; then
        backup_files=("${backup_files[0]}")
        log "INFO" "只验证最新的备份文件: $(basename "${backup_files[0]}")"
    fi
    
    # 验证每个备份文件
    local results_file="$TEMP_DIR/verification_results.txt"
    local total_files=0
    local passed_files=0
    local failed_files=0
    
    > "$results_file"  # 清空结果文件
    
    for backup_file in "${backup_files[@]}"; do
        ((total_files++))
        
        log "INFO" "验证备份文件 ($total_files/${#backup_files[@]}): $(basename "$backup_file")"
        
        # 验证文件完整性
        if verify_file_integrity "$backup_file"; then
            local integrity_status="✅ 通过"
            ((passed_files++))
        else
            local integrity_status="❌ 失败"
            ((failed_files++))
        fi
        
        # 验证备份年龄
        local age_status=""
        if [[ "$CHECK_AGE" == "true" ]]; then
            if verify_backup_age "$backup_file"; then
                age_status="✅ 年龄正常"
            else
                age_status="⚠️  年龄过大"
            fi
        fi
        
        # 记录结果
        echo "文件: $(basename "$backup_file")" >> "$results_file"
        echo "路径: $backup_file" >> "$results_file"
        echo "大小: $(du -h "$backup_file" | cut -f1)" >> "$results_file"
        echo "修改时间: $(stat -c "%y" "$backup_file")" >> "$results_file"
        echo "完整性: $integrity_status" >> "$results_file"
        if [[ -n "$age_status" ]]; then
            echo "年龄检查: $age_status" >> "$results_file"
        fi
        echo "---" >> "$results_file"
        
        # 详细输出
        if [[ "$VERBOSE" == "true" ]]; then
            log "INFO" "  - 完整性: $integrity_status"
            if [[ -n "$age_status" ]]; then
                log "INFO" "  - 年龄检查: $age_status"
            fi
        fi
    done
    
    # 生成验证报告
    generate_verification_report "$results_file" "$BACKUP_TYPE" "$total_files" "$passed_files" "$failed_files"
    
    # 输出总结
    log "INFO" "=== 验证完成 ==="
    log "INFO" "总文件数: $total_files"
    log "INFO" "通过数: $passed_files"
    log "INFO" "失败数: $failed_files"
    
    if [[ $failed_files -eq 0 ]]; then
        log "INFO" "✅ 所有备份文件验证通过"
    else
        log "ERROR" "❌ 发现 $failed_files 个备份文件验证失败"
        exit 1
    fi
    
    # 清理临时文件
    cleanup_temp_files
    
    log "INFO" "=== 备份验证完成 ==="
    log "INFO" "结束时间: $(date)"
}

# 运行主函数
main "$@"
