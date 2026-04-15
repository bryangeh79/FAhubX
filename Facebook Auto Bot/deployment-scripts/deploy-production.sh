#!/bin/bash
# Facebook Auto Bot 生产环境部署脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 命令未找到，请先安装"
        exit 1
    fi
}

# 检查环境
check_environment() {
    log_info "检查部署环境..."
    
    # 检查必需命令
    check_command docker
    check_command docker-compose
    check_command git
    check_command curl
    
    # 检查 Docker 是否运行
    if ! docker info &> /dev/null; then
        log_error "Docker 守护进程未运行"
        exit 1
    fi
    
    # 检查磁盘空间
    local disk_space=$(df -h / | awk 'NR==2 {print $4}')
    log_info "可用磁盘空间: $disk_space"
    
    # 检查内存
    local mem_total=$(free -h | awk 'NR==2 {print $2}')
    log_info "总内存: $mem_total"
}

# 加载环境变量
load_environment() {
    local env_file=".env.production"
    
    if [ ! -f "$env_file" ]; then
        log_error "环境变量文件 $env_file 不存在"
        log_info "请从 .env.production.template 创建 $env_file 并配置相应值"
        exit 1
    fi
    
    log_info "加载环境变量..."
    source "$env_file"
    
    # 验证必需环境变量
    local required_vars=("DB_PASSWORD" "REDIS_PASSWORD" "JWT_SECRET" "MINIO_ACCESS_KEY" "MINIO_SECRET_KEY")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ] || [[ "${!var}" == *"your_"* ]]; then
            log_error "环境变量 $var 未正确配置"
            exit 1
        fi
    done
}

# 构建 Docker 镜像
build_images() {
    log_info "开始构建 Docker 镜像..."
    
    # 构建后端镜像
    log_info "构建后端镜像..."
    docker build -f docker/backend/Dockerfile -t fbautobot-backend:$TAG ./backend
    
    # 构建前端镜像
    log_info "构建前端镜像..."
    docker build -f docker/frontend/Dockerfile -t fbautobot-frontend:$TAG ./frontend
    
    log_info "Docker 镜像构建完成"
}

# 运行数据库迁移
run_migrations() {
    log_info "运行数据库迁移..."
    
    # 等待数据库就绪
    log_info "等待 PostgreSQL 就绪..."
    for i in {1..30}; do
        if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U $DB_USER; then
            log_info "PostgreSQL 已就绪"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "PostgreSQL 启动超时"
            exit 1
        fi
        sleep 2
    done
    
    # 运行迁移
    log_info "执行数据库迁移..."
    docker-compose -f docker-compose.prod.yml run --rm backend npm run migration:run
    
    log_info "数据库迁移完成"
}

# 启动服务
start_services() {
    log_info "启动生产环境服务..."
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker-compose -f docker-compose.prod.yml down || true
    
    # 启动服务
    log_info "启动服务..."
    docker-compose -f docker-compose.prod.yml up -d
    
    # 等待服务就绪
    log_info "等待服务就绪..."
    sleep 10
    
    # 检查服务状态
    check_services_health
}

# 检查服务健康状态
check_services_health() {
    log_info "检查服务健康状态..."
    
    local services=("backend" "frontend" "postgres" "redis" "rabbitmq" "nginx")
    local all_healthy=true
    
    for service in "${services[@]}"; do
        if docker-compose -f docker-compose.prod.yml ps $service | grep -q "Up (healthy)"; then
            log_info "$service: ✅ 健康"
        elif docker-compose -f docker-compose.prod.yml ps $service | grep -q "Up"; then
            log_warn "$service: ⚠️  运行中但健康检查未通过"
            all_healthy=false
        else
            log_error "$service: ❌ 未运行"
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        log_info "所有服务健康检查通过"
    else
        log_warn "部分服务健康检查未通过，请检查日志"
    fi
}

# 执行滚动更新
rolling_update() {
    local service=$1
    
    log_info "对 $service 执行滚动更新..."
    
    # 拉取最新镜像
    docker-compose -f docker-compose.prod.yml pull $service
    
    # 执行滚动更新
    docker-compose -f docker-compose.prod.yml up -d --no-deps --force-recreate $service
    
    # 等待服务就绪
    sleep 10
    
    # 检查服务健康
    if docker-compose -f docker-compose.prod.yml ps $service | grep -q "Up (healthy)"; then
        log_info "$service 滚动更新成功"
    else
        log_error "$service 滚动更新失败"
        exit 1
    fi
}

# 备份数据库
backup_database() {
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    
    log_info "备份数据库到 $backup_dir..."
    
    mkdir -p "$backup_dir"
    
    # 执行备份
    docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U $DB_USER $DB_NAME > "$backup_dir/db_backup.sql"
    
    # 压缩备份
    gzip "$backup_dir/db_backup.sql"
    
    log_info "数据库备份完成: $backup_dir/db_backup.sql.gz"
}

# 显示部署信息
show_deployment_info() {
    log_info "=== 部署完成 ==="
    log_info "前端地址: https://yourdomain.com"
    log_info "API地址: https://api.yourdomain.com"
    log_info "监控面板: http://localhost:3001 (用户名: admin, 密码: $GRAFANA_ADMIN_PASSWORD)"
    log_info "Prometheus: http://localhost:9090"
    log_info ""
    log_info "查看服务状态: docker-compose -f docker-compose.prod.yml ps"
    log_info "查看服务日志: docker-compose -f docker-compose.prod.yml logs -f"
    log_info "停止服务: docker-compose -f docker-compose.prod.yml down"
}

# 主函数
main() {
    local action=${1:-"deploy"}
    
    case $action in
        "deploy")
            check_environment
            load_environment
            build_images
            start_services
            run_migrations
            show_deployment_info
            ;;
        "update")
            check_environment
            load_environment
            build_images
            rolling_update "backend"
            rolling_update "frontend"
            show_deployment_info
            ;;
        "backup")
            check_environment
            load_environment
            backup_database
            ;;
        "status")
            check_services_health
            ;;
        "logs")
            docker-compose -f docker-compose.prod.yml logs -f
            ;;
        "stop")
            docker-compose -f docker-compose.prod.yml down
            log_info "服务已停止"
            ;;
        "restart")
            docker-compose -f docker-compose.prod.yml restart
            log_info "服务已重启"
            ;;
        *)
            echo "用法: $0 {deploy|update|backup|status|logs|stop|restart}"
            echo "  deploy    - 完整部署"
            echo "  update    - 滚动更新"
            echo "  backup    - 备份数据库"
            echo "  status    - 检查服务状态"
            echo "  logs      - 查看服务日志"
            echo "  stop      - 停止服务"
            echo "  restart   - 重启服务"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"