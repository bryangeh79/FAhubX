#!/bin/bash
# Facebook Auto Bot 生产环境健康检查脚本

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

# 检查 HTTP 端点
check_http_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    log_info "检查 $name ($url)..."
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_status"; then
        log_success "$name 可达 (HTTP $expected_status)"
        return 0
    else
        log_error "$name 不可达或返回非预期状态码"
        return 1
    fi
}

# 检查 Docker 容器
check_docker_container() {
    local container=$1
    
    log_info "检查 Docker 容器: $container"
    
    if docker ps --format "{{.Names}}" | grep -q "^$container$"; then
        if docker ps --format "{{.Names}} {{.Status}}" | grep "^$container " | grep -q "Up"; then
            if docker ps --format "{{.Names}} {{.Status}}" | grep "^$container " | grep -q "(healthy)"; then
                log_success "$container: 运行中且健康"
                return 0
            else
                log_warn "$container: 运行中但健康检查未通过"
                return 1
            fi
        else
            log_error "$container: 容器存在但未运行"
            return 1
        fi
    else
        log_error "$container: 容器不存在"
        return 1
    fi
}

# 检查端口监听
check_port_listening() {
    local port=$1
    local service=$2
    
    log_info "检查 $service 端口 $port..."
    
    if netstat -tuln | grep -q ":$port "; then
        log_success "$service 端口 $port 正在监听"
        return 0
    else
        log_error "$service 端口 $port 未监听"
        return 1
    fi
}

# 检查磁盘空间
check_disk_space() {
    local threshold=${1:-80}
    
    log_info "检查磁盘空间..."
    
    local usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$usage" -lt "$threshold" ]; then
        log_success "磁盘使用率: ${usage}% (低于 ${threshold}%)"
        return 0
    else
        log_error "磁盘使用率: ${usage}% (高于 ${threshold}%)"
        return 1
    fi
}

# 检查内存使用
check_memory_usage() {
    local threshold=${1:-80}
    
    log_info "检查内存使用..."
    
    local usage=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
    
    if [ "$usage" -lt "$threshold" ]; then
        log_success "内存使用率: ${usage}% (低于 ${threshold}%)"
        return 0
    else
        log_error "内存使用率: ${usage}% (高于 ${threshold}%)"
        return 1
    fi
}

# 检查 CPU 负载
check_cpu_load() {
    local threshold=${1:-4.0}
    
    log_info "检查 CPU 负载..."
    
    local load=$(uptime | awk -F'load average:' '{print $2}' | awk -F, '{print $1}' | tr -d ' ')
    
    if (( $(echo "$load < $threshold" | bc -l) )); then
        log_success "CPU 负载: $load (低于 $threshold)"
        return 0
    else
        log_error "CPU 负载: $load (高于 $threshold)"
        return 1
    fi
}

# 检查服务日志错误
check_service_logs() {
    local service=$1
    local minutes=${2:-5}
    
    log_info "检查 $service 最近 ${minutes} 分钟的错误日志..."
    
    local error_count=$(docker logs --since "${minutes}m" "$service" 2>/dev/null | grep -i "error\|exception\|fatal\|failed" | wc -l)
    
    if [ "$error_count" -eq 0 ]; then
        log_success "$service: 最近 ${minutes} 分钟无错误日志"
        return 0
    else
        log_warn "$service: 最近 ${minutes} 分钟发现 $error_count 个错误"
        
        # 显示前3个错误
        docker logs --since "${minutes}m" "$service" 2>/dev/null | grep -i "error\|exception\|fatal\|failed" | head -3 | while read line; do
            log_warn "  - $line"
        done
        
        return 1
    fi
}

# 检查数据库连接
check_database_connection() {
    log_info "检查数据库连接..."
    
    if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U $DB_USER -d $DB_NAME; then
        log_success "数据库连接正常"
        return 0
    else
        log_error "数据库连接失败"
        return 1
    fi
}

# 检查 Redis 连接
check_redis_connection() {
    log_info "检查 Redis 连接..."
    
    if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli -a $REDIS_PASSWORD ping | grep -q "PONG"; then
        log_success "Redis 连接正常"
        return 0
    else
        log_error "Redis 连接失败"
        return 1
    fi
}

# 综合健康检查
comprehensive_health_check() {
    log_info "开始综合健康检查..."
    echo ""
    
    local all_passed=true
    
    # 系统资源检查
    log_info "=== 系统资源检查 ==="
    check_disk_space 90 || all_passed=false
    check_memory_usage 90 || all_passed=false
    check_cpu_load 5.0 || all_passed=false
    echo ""
    
    # Docker 容器检查
    log_info "=== Docker 容器检查 ==="
    local containers=("fbautobot-nginx" "fbautobot-backend" "fbautobot-frontend" "fbautobot-postgres" "fbautobot-redis" "fbautobot-rabbitmq")
    for container in "${containers[@]}"; do
        check_docker_container "$container" || all_passed=false
    done
    echo ""
    
    # 服务连接检查
    log_info "=== 服务连接检查 ==="
    check_database_connection || all_passed=false
    check_redis_connection || all_passed=false
    echo ""
    
    # HTTP 端点检查
    log_info "=== HTTP 端点检查 ==="
    check_http_endpoint "http://localhost:80" "前端服务" || all_passed=false
    check_http_endpoint "http://localhost:3000/health" "后端健康检查" || all_passed=false
    check_http_endpoint "http://localhost:3001" "Grafana" 200 || all_passed=false
    check_http_endpoint "http://localhost:9090" "Prometheus" 200 || all_passed=false
    echo ""
    
    # 服务日志检查
    log_info "=== 服务日志检查 ==="
    check_service_logs "fbautobot-backend" 5 || all_passed=false
    check_service_logs "fbautobot-nginx" 5 || all_passed=false
    echo ""
    
    # 端口监听检查
    log_info "=== 端口监听检查 ==="
    check_port_listening 80 "HTTP" || all_passed=false
    check_port_listening 443 "HTTPS" || all_passed=false
    check_port_listening 3000 "后端API" || all_passed=false
    check_port_listening 5432 "PostgreSQL" || all_passed=false
    check_port_listening 6379 "Redis" || all_passed=false
    echo ""
    
    # 总结
    log_info "=== 检查完成 ==="
    if [ "$all_passed" = true ]; then
        log_success "所有健康检查通过！系统运行正常。"
        return 0
    else
        log_error "部分健康检查未通过，请检查相关问题。"
        return 1
    fi
}

# 快速健康检查
quick_health_check() {
    log_info "执行快速健康检查..."
    echo ""
    
    # 检查关键服务
    check_http_endpoint "http://localhost:80" "前端服务"
    check_http_endpoint "http://localhost:3000/health" "后端健康检查"
    
    # 检查关键容器
    check_docker_container "fbautobot-backend"
    check_docker_container "fbautobot-postgres"
    
    log_info "快速健康检查完成"
}

# 监控检查
monitoring_check() {
    log_info "检查监控系统..."
    echo ""
    
    check_http_endpoint "http://localhost:3001" "Grafana" 200
    check_http_endpoint "http://localhost:9090" "Prometheus" 200
    check_http_endpoint "http://localhost:3100" "Loki" 200
    
    log_info "监控系统检查完成"
}

# 主函数
main() {
    local action=${1:-"comprehensive"}
    
    # 加载环境变量
    if [ -f .env.production ]; then
        source .env.production
    fi
    
    case $action in
        "comprehensive")
            comprehensive_health_check
            ;;
        "quick")
            quick_health_check
            ;;
        "monitoring")
            monitoring_check
            ;;
        "system")
            check_disk_space
            check_memory_usage
            check_cpu_load
            ;;
        "services")
            check_database_connection
            check_redis_connection
            check_http_endpoint "http://localhost:3000/health" "后端健康检查"
            ;;
        *)
            echo "用法: $0 {comprehensive|quick|monitoring|system|services}"
            echo "  comprehensive - 综合健康检查（默认）"
            echo "  quick         - 快速健康检查"
            echo "  monitoring    - 监控系统检查"
            echo "  system        - 系统资源检查"
            echo "  services      - 服务连接检查"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"