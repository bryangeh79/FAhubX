#!/bin/bash

# Facebook Auto Bot 安全监控启动脚本
# 版本: 1.0
# 日期: 2026-04-13

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."
    
    local missing_deps=()
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js")
    fi
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    # 检查Docker（可选）
    if ! command -v docker &> /dev/null; then
        log_warning "Docker未安装，某些监控功能可能不可用"
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "缺少必要依赖: ${missing_deps[*]}"
        return 1
    fi
    
    log_success "所有必要依赖已安装"
    return 0
}

# 检查环境变量
check_environment() {
    log_info "检查环境变量..."
    
    local required_vars=("NODE_ENV")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_warning "缺少环境变量: ${missing_vars[*]}"
        log_info "使用默认值继续..."
    else
        log_success "环境变量检查通过"
    fi
}

# 启动安全监控服务
start_monitoring_services() {
    log_info "启动安全监控服务..."
    
    # 1. 创建监控目录
    mkdir -p /workspace/logs/security
    mkdir -p /workspace/monitoring/alerts
    
    # 2. 启动依赖漏洞扫描
    start_dependency_scanning &
    
    # 3. 启动安全日志监控
    start_security_log_monitor &
    
    # 4. 启动API安全监控
    start_api_security_monitor &
    
    # 5. 启动系统健康检查
    start_system_health_check &
    
    log_success "安全监控服务已启动"
}

# 依赖漏洞扫描
start_dependency_scanning() {
    log_info "启动依赖漏洞扫描..."
    
    while true; do
        log_info "运行依赖漏洞扫描..."
        
        # 扫描后端依赖
        cd /workspace/backend
        npm audit --json > /workspace/monitoring/dependency-scan-backend-$(date +%Y%m%d-%H%M%S).json 2>/dev/null || true
        
        # 扫描前端依赖
        cd /workspace/frontend
        npm audit --json > /workspace/monitoring/dependency-scan-frontend-$(date +%Y%m%d-%H%M%S).json 2>/dev/null || true
        
        # 分析扫描结果
        analyze_dependency_scan
        
        # 每天扫描一次
        sleep 86400
    done
}

# 分析依赖扫描结果
analyze_dependency_scan() {
    log_info "分析依赖扫描结果..."
    
    # 这里可以添加更复杂的分析逻辑
    # 例如：发送告警、生成报告等
    
    log_success "依赖扫描分析完成"
}

# 安全日志监控
start_security_log_monitor() {
    log_info "启动安全日志监控..."
    
    local security_log="/workspace/logs/security/security.log"
    
    # 创建安全日志文件
    touch "$security_log"
    
    # 监控安全日志文件
    tail -f "$security_log" | while read line; do
        # 分析安全日志行
        analyze_security_log "$line"
    done
}

# 分析安全日志
analyze_security_log() {
    local line="$1"
    
    # 检查安全事件模式
    if echo "$line" | grep -q -E "(failed login|invalid token|access denied|security violation)"; then
        log_warning "检测到安全事件: $line"
        send_security_alert "$line"
    fi
}

# API安全监控
start_api_security_monitor() {
    log_info "启动API安全监控..."
    
    # 这里可以添加API监控逻辑
    # 例如：监控异常API请求、速率限制违规等
    
    while true; do
        # 监控逻辑
        sleep 60
    done
}

# 系统健康检查
start_system_health_check() {
    log_info "启动系统健康检查..."
    
    while true; do
        log_info "运行系统健康检查..."
        
        # 检查磁盘空间
        check_disk_space
        
        # 检查内存使用
        check_memory_usage
        
        # 检查进程状态
        check_process_status
        
        # 每小时检查一次
        sleep 3600
    done
}

# 检查磁盘空间
check_disk_space() {
    local threshold=80
    local usage=$(df /workspace | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$usage" -gt "$threshold" ]; then
        log_warning "磁盘空间使用率过高: ${usage}%"
        send_disk_alert "$usage"
    fi
}

# 检查内存使用
check_memory_usage() {
    local threshold=90
    local usage=$(free | grep Mem | awk '{print $3/$2 * 100.0}' | cut -d. -f1)
    
    if [ "$usage" -gt "$threshold" ]; then
        log_warning "内存使用率过高: ${usage}%"
        send_memory_alert "$usage"
    fi
}

# 检查进程状态
check_process_status() {
    # 检查关键进程
    local critical_processes=("node" "nginx" "postgres")
    
    for process in "${critical_processes[@]}"; do
        if ! pgrep -x "$process" > /dev/null; then
            log_error "关键进程未运行: $process"
            send_process_alert "$process"
        fi
    done
}

# 发送安全告警
send_security_alert() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 记录到告警文件
    echo "[$timestamp] SECURITY_ALERT: $message" >> /workspace/monitoring/alerts/security-$(date +%Y%m%d).log
    
    # 这里可以添加发送邮件、Slack通知等逻辑
    # send_email_alert "security@fbautobot.com" "安全告警" "$message"
    # send_slack_alert "#security-alerts" "$message"
}

# 发送磁盘告警
send_disk_alert() {
    local usage="$1"
    local message="磁盘空间使用率: ${usage}%"
    send_system_alert "DISK_USAGE" "$message"
}

# 发送内存告警
send_memory_alert() {
    local usage="$1"
    local message="内存使用率: ${usage}%"
    send_system_alert "MEMORY_USAGE" "$message"
}

# 发送进程告警
send_process_alert() {
    local process="$1"
    local message="关键进程未运行: $process"
    send_system_alert "PROCESS_DOWN" "$message"
}

# 发送系统告警
send_system_alert() {
    local type="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] SYSTEM_ALERT [$type]: $message" >> /workspace/monitoring/alerts/system-$(date +%Y%m%d).log
}

# 清理旧日志
cleanup_old_logs() {
    log_info "清理旧日志..."
    
    # 保留最近30天的日志
    find /workspace/logs -name "*.log" -mtime +30 -delete
    find /workspace/monitoring -name "*.json" -mtime +30 -delete
    find /workspace/monitoring/alerts -name "*.log" -mtime +30 -delete
    
    log_success "日志清理完成"
}

# 主函数
main() {
    log_info "=== Facebook Auto Bot 安全监控系统 ==="
    log_info "启动时间: $(date)"
    
    # 检查依赖
    if ! check_dependencies; then
        log_error "依赖检查失败，退出"
        exit 1
    fi
    
    # 检查环境变量
    check_environment
    
    # 清理旧日志
    cleanup_old_logs
    
    # 启动监控服务
    start_monitoring_services
    
    # 保持脚本运行
    log_success "安全监控系统已启动并运行"
    log_info "按 Ctrl+C 停止监控"
    
    # 等待所有子进程
    wait
}

# 捕获退出信号
trap 'log_info "收到退出信号，停止监控..."; exit 0' INT TERM

# 运行主函数
main "$@"