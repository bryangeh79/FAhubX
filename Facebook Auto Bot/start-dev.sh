#!/bin/bash

# Facebook Auto Bot 开发环境启动脚本
# 版本: 1.0.0

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函数：打印带颜色的消息
print_message() {
    echo -e "${2}${1}${NC}"
}

# 函数：检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_message "错误: $1 未安装" $RED
        exit 1
    fi
}

# 函数：检查Docker服务状态
check_docker() {
    if ! docker info &> /dev/null; then
        print_message "错误: Docker服务未运行" $RED
        exit 1
    fi
}

# 函数：检查端口是否被占用
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        print_message "警告: 端口 $1 已被占用" $YELLOW
        return 1
    fi
    return 0
}

# 函数：等待服务就绪
wait_for_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    print_message "等待 $service 服务启动..." $BLUE
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port &> /dev/null; then
            print_message "✓ $service 服务已就绪" $GREEN
            return 0
        fi
        
        print_message "  尝试 $attempt/$max_attempts..." $YELLOW
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_message "✗ $service 服务启动超时" $RED
    return 1
}

# 函数：启动后端服务
start_backend() {
    print_message "启动后端服务..." $BLUE
    
    cd backend
    
    # 安装依赖
    if [ ! -d "node_modules" ]; then
        print_message "安装后端依赖..." $YELLOW
        npm install
    fi
    
    # 检查环境变量
    if [ ! -f ".env" ]; then
        print_message "创建环境变量文件..." $YELLOW
        cp .env.example .env
        print_message "请编辑 .env 文件配置环境变量" $YELLOW
    fi
    
    # 启动服务
    print_message "启动后端开发服务器..." $YELLOW
    npm run dev &
    BACKEND_PID=$!
    
    cd ..
}

# 函数：启动前端服务
start_frontend() {
    print_message "启动前端服务..." $BLUE
    
    cd frontend
    
    # 安装依赖
    if [ ! -d "node_modules" ]; then
        print_message "安装前端依赖..." $YELLOW
        npm install
    fi
    
    # 启动服务
    print_message "启动前端开发服务器..." $YELLOW
    npm run dev &
    FRONTEND_PID=$!
    
    cd ..
}

# 函数：启动Docker服务
start_docker() {
    print_message "启动Docker服务..." $BLUE
    
    # 检查Docker Compose文件
    if [ ! -f "docker-compose.yml" ]; then
        print_message "错误: docker-compose.yml 文件不存在" $RED
        exit 1
    fi
    
    # 启动服务
    docker-compose up -d
    
    # 等待关键服务启动
    wait_for_service "PostgreSQL" 5432
    wait_for_service "Redis" 6379
    wait_for_service "RabbitMQ" 5672
}

# 函数：运行数据库迁移
run_migrations() {
    print_message "运行数据库迁移..." $BLUE
    
    cd backend
    
    # 等待数据库就绪
    sleep 5
    
    # 运行迁移
    if npm run db:migrate; then
        print_message "✓ 数据库迁移完成" $GREEN
    else
        print_message "✗ 数据库迁移失败" $RED
    fi
    
    cd ..
}

# 函数：运行数据种子
run_seeds() {
    print_message "运行数据种子..." $BLUE
    
    cd backend
    
    # 运行种子
    if npm run db:seed; then
        print_message "✓ 数据种子完成" $GREEN
    else
        print_message "✗ 数据种子失败" $RED
    fi
    
    cd ..
}

# 函数：显示服务状态
show_status() {
    print_message "\n=== 服务状态 ===" $BLUE
    
    # 检查Docker服务
    print_message "\nDocker服务:" $YELLOW
    docker-compose ps
    
    # 检查后端服务
    print_message "\n后端服务:" $YELLOW
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        print_message "✓ 运行中 (PID: $BACKEND_PID)" $GREEN
    else
        print_message "✗ 未运行" $RED
    fi
    
    # 检查前端服务
    print_message "\n前端服务:" $YELLOW
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        print_message "✓ 运行中 (PID: $FRONTEND_PID)" $GREEN
    else
        print_message "✗ 未运行" $RED
    fi
    
    # 显示访问信息
    print_message "\n=== 访问信息 ===" $BLUE
    print_message "前端应用: http://localhost:8080" $GREEN
    print_message "后端API: http://localhost:3000" $GREEN
    print_message "API文档: http://localhost:3000/api-docs" $GREEN
    print_message "数据库管理: http://localhost:8081 (如果启用)" $GREEN
    print_message "RabbitMQ管理: http://localhost:15672" $GREEN
    print_message "MinIO控制台: http://localhost:9001" $GREEN
    print_message "Grafana监控: http://localhost:3001" $GREEN
    
    print_message "\n默认登录信息:" $YELLOW
    print_message "管理员: admin@fbautobot.com / Admin123!" $GREEN
    print_message "测试用户: test@fbautobot.com / Test123!" $GREEN
}

# 函数：清理函数
cleanup() {
    print_message "\n正在停止服务..." $YELLOW
    
    # 停止后端服务
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    # 停止前端服务
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # 停止Docker服务
    docker-compose down
    
    print_message "服务已停止" $GREEN
}

# 主函数
main() {
    print_message "=== Facebook Auto Bot 开发环境启动 ===" $BLUE
    
    # 检查必要命令
    check_command "docker"
    check_command "docker-compose"
    check_command "node"
    check_command "npm"
    check_command "nc"  # netcat
    
    # 检查Docker服务
    check_docker
    
    # 检查端口占用
    check_port 3000  # 后端
    check_port 8080  # 前端
    check_port 5432  # PostgreSQL
    check_port 6379  # Redis
    check_port 5672  # RabbitMQ
    
    # 设置退出时清理
    trap cleanup EXIT INT TERM
    
    # 启动服务
    start_docker
    run_migrations
    run_seeds
    start_backend
    start_frontend
    
    # 等待服务启动
    sleep 3
    
    # 显示状态
    show_status
    
    print_message "\n开发环境启动完成！" $GREEN
    print_message "按 Ctrl+C 停止所有服务" $YELLOW
    
    # 等待用户中断
    wait
}

# 处理命令行参数
case "$1" in
    "docker-only")
        check_command "docker"
        check_command "docker-compose"
        check_docker
        start_docker
        show_status
        ;;
    "backend-only")
        check_command "node"
        check_command "npm"
        start_backend
        show_status
        ;;
    "frontend-only")
        check_command "node"
        check_command "npm"
        start_frontend
        show_status
        ;;
    "migrate")
        run_migrations
        ;;
    "seed")
        run_seeds
        ;;
    "status")
        show_status
        ;;
    "stop")
        cleanup
        ;;
    *)
        main
        ;;
esac