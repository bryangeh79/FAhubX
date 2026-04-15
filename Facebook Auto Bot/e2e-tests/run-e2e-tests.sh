#!/bin/bash

# Facebook Auto Bot端到端测试执行脚本
# 用法: ./run-e2e-tests.sh [选项]

set -e

# 颜色定义
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

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助
show_help() {
    cat << EOF
Facebook Auto Bot端到端测试执行脚本

用法: $0 [选项]

选项:
  -h, --help            显示帮助信息
  -e, --env <环境>      测试环境 (test, staging, prod) [默认: test]
  -b, --browser <浏览器> 测试浏览器 (chromium, firefox, webkit, all) [默认: chromium]
  -t, --test <测试文件>  运行特定测试文件
  -g, --grep <模式>      运行匹配模式的测试
  -p, --parallel        并行运行测试
  -d, --debug           调试模式
  -v, --verbose         详细输出
  --headed              显示浏览器界面
  --no-report           不生成报告
  --clean               清理测试环境
  --setup-only          只设置测试环境
  --teardown-only       只清理测试环境

示例:
  $0                    运行所有测试（Chromium浏览器）
  $0 -b all             所有浏览器运行测试
  $0 -t auth/login.spec.ts 运行特定测试文件
  $0 -g "用户注册"       运行包含"用户注册"的测试
  $0 -p -b chromium     并行运行Chromium测试
  $0 --clean            清理测试环境
EOF
}

# 默认参数
ENVIRONMENT="test"
BROWSER="chromium"
TEST_FILE=""
TEST_PATTERN=""
PARALLEL=false
DEBUG=false
VERBOSE=false
HEADED=false
GENERATE_REPORT=true
CLEAN=false
SETUP_ONLY=false
TEARDOWN_ONLY=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -b|--browser)
            BROWSER="$2"
            shift 2
            ;;
        -t|--test)
            TEST_FILE="$2"
            shift 2
            ;;
        -g|--grep)
            TEST_PATTERN="$2"
            shift 2
            ;;
        -p|--parallel)
            PARALLEL=true
            shift
            ;;
        -d|--debug)
            DEBUG=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --headed)
            HEADED=true
            shift
            ;;
        --no-report)
            GENERATE_REPORT=false
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --setup-only)
            SETUP_ONLY=true
            shift
            ;;
        --teardown-only)
            TEARDOWN_ONLY=true
            shift
            ;;
        *)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 设置环境变量
export NODE_ENV="$ENVIRONMENT"

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E_DIR="$PROJECT_ROOT/e2e-tests"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# 检查目录是否存在
check_directories() {
    if [[ ! -d "$E2E_DIR" ]]; then
        log_error "E2E测试目录不存在: $E2E_DIR"
        exit 1
    fi
    
    if [[ ! -d "$BACKEND_DIR" ]]; then
        log_error "后端目录不存在: $BACKEND_DIR"
        exit 1
    fi
    
    if [[ ! -d "$FRONTEND_DIR" ]]; then
        log_error "前端目录不存在: $FRONTEND_DIR"
        exit 1
    fi
}

# 清理测试环境
cleanup_environment() {
    log_info "清理测试环境..."
    
    # 停止可能运行的服务
    pkill -f "node.*start:test" || true
    pkill -f "node.*dev" || true
    
    # 清理测试数据库
    if [[ -f "$BACKEND_DIR/scripts/cleanup-database.js" ]]; then
        cd "$BACKEND_DIR"
        NODE_ENV=test node scripts/cleanup-database.js
    fi
    
    # 清理测试报告
    if [[ -d "$E2E_DIR/reports" ]]; then
        rm -rf "$E2E_DIR/reports"
        log_success "清理测试报告"
    fi
    
    # 清理Playwright缓存
    if [[ -d "$E2E_DIR/node_modules/.cache/playwright" ]]; then
        rm -rf "$E2E_DIR/node_modules/.cache/playwright"
        log_success "清理Playwright缓存"
    fi
    
    log_success "测试环境清理完成"
}

# 设置测试环境
setup_environment() {
    log_info "设置测试环境..."
    
    # 安装依赖
    log_info "安装后端依赖..."
    cd "$BACKEND_DIR"
    npm ci --silent
    
    log_info "安装前端依赖..."
    cd "$FRONTEND_DIR"
    npm ci --silent
    
    log_info "安装E2E测试依赖..."
    cd "$E2E_DIR"
    npm ci --silent
    
    # 安装Playwright浏览器
    log_info "安装Playwright浏览器..."
    npx playwright install --with-deps
    
    # 设置测试数据库
    log_info "设置测试数据库..."
    cd "$BACKEND_DIR"
    
    # 创建测试数据库
    if [[ -f "database/migrate.js" ]]; then
        NODE_ENV=test node database/migrate.js create
        NODE_ENV=test node database/migrate.js migrate
    fi
    
    # 导入测试数据
    if [[ -f "scripts/seed-database.js" ]]; then
        NODE_ENV=test node scripts/seed-database.js
    fi
    
    log_success "测试环境设置完成"
}

# 启动测试服务
start_test_services() {
    log_info "启动测试服务..."
    
    # 启动后端测试服务
    log_info "启动后端测试服务..."
    cd "$BACKEND_DIR"
    NODE_ENV=test npm run start:test > "$E2E_DIR/logs/backend-test.log" 2>&1 &
    BACKEND_PID=$!
    
    # 等待后端启动
    log_info "等待后端服务启动..."
    sleep 10
    
    # 检查后端是否运行
    if ! curl -s http://localhost:3001/health > /dev/null; then
        log_error "后端服务启动失败"
        cat "$E2E_DIR/logs/backend-test.log"
        exit 1
    fi
    
    # 启动前端开发服务器
    log_info "启动前端开发服务器..."
    cd "$FRONTEND_DIR"
    NODE_ENV=test npm run dev > "$E2E_DIR/logs/frontend-dev.log" 2>&1 &
    FRONTEND_PID=$!
    
    # 等待前端启动
    log_info "等待前端服务启动..."
    sleep 10
    
    # 检查前端是否运行
    if ! curl -s http://localhost:5173 > /dev/null; then
        log_error "前端服务启动失败"
        cat "$E2E_DIR/logs/frontend-dev.log"
        exit 1
    fi
    
    log_success "测试服务启动完成"
    echo $BACKEND_PID > "$E2E_DIR/logs/backend.pid"
    echo $FRONTEND_PID > "$E2E_DIR/logs/frontend.pid"
}

# 停止测试服务
stop_test_services() {
    log_info "停止测试服务..."
    
    if [[ -f "$E2E_DIR/logs/backend.pid" ]]; then
        BACKEND_PID=$(cat "$E2E_DIR/logs/backend.pid")
        kill $BACKEND_PID 2>/dev/null || true
        rm "$E2E_DIR/logs/backend.pid"
    fi
    
    if [[ -f "$E2E_DIR/logs/frontend.pid" ]]; then
        FRONTEND_PID=$(cat "$E2E_DIR/logs/frontend.pid")
        kill $FRONTEND_PID 2>/dev/null || true
        rm "$E2E_DIR/logs/frontend.pid"
    fi
    
    log_success "测试服务已停止"
}

# 运行测试
run_tests() {
    log_info "运行端到端测试..."
    
    cd "$E2E_DIR"
    
    # 构建测试命令
    TEST_CMD="npx playwright test"
    
    # 添加浏览器参数
    if [[ "$BROWSER" != "all" ]]; then
        TEST_CMD="$TEST_CMD --project=$BROWSER"
    fi
    
    # 添加测试文件参数
    if [[ -n "$TEST_FILE" ]]; then
        TEST_CMD="$TEST_CMD $TEST_FILE"
    fi
    
    # 添加测试模式参数
    if [[ -n "$TEST_PATTERN" ]]; then
        TEST_CMD="$TEST_CMD --grep \"$TEST_PATTERN\""
    fi
    
    # 添加并行参数
    if [[ "$PARALLEL" == true ]]; then
        TEST_CMD="$TEST_CMD --workers=4"
    fi
    
    # 添加调试参数
    if [[ "$DEBUG" == true ]]; then
        TEST_CMD="$TEST_CMD --debug"
    fi
    
    # 添加headed参数
    if [[ "$HEADED" == true ]]; then
        TEST_CMD="$TEST_CMD --headed"
    fi
    
    # 添加详细输出参数
    if [[ "$VERBOSE" == true ]]; then
        TEST_CMD="$TEST_CMD --verbose"
    fi
    
    # 设置超时
    TEST_CMD="timeout 1800 $TEST_CMD"
    
    log_info "执行命令: $TEST_CMD"
    
    # 执行测试
    eval $TEST_CMD
    TEST_EXIT_CODE=$?
    
    if [[ $TEST_EXIT_CODE -eq 0 ]]; then
        log_success "测试执行成功"
    else
        log_error "测试执行失败，退出码: $TEST_EXIT_CODE"
    fi
    
    return $TEST_EXIT_CODE
}

# 生成测试报告
generate_report() {
    if [[ "$GENERATE_REPORT" == false ]]; then
        log_info "跳过报告生成"
        return 0
    fi
    
    log_info "生成测试报告..."
    
    cd "$E2E_DIR"
    
    # 生成Allure报告
    if [[ -f "node_modules/.bin/allure" ]]; then
        npx allure generate reports/allure-results --clean -o reports/allure-report
        log_success "Allure报告生成完成: reports/allure-report/index.html"
    fi
    
    # 生成HTML报告
    if [[ -d "reports/playwright-html" ]]; then
        log_success "Playwright HTML报告: reports/playwright-html/index.html"
    fi
    
    # 生成JUnit报告
    if [[ -f "reports/junit-results.xml" ]]; then
        log_success "JUnit报告: reports/junit-results.xml"
    fi
    
    # 生成测试摘要
    generate_test_summary
}

# 生成测试摘要
generate_test_summary() {
    log_info "生成测试摘要..."
    
    cd "$E2E_DIR"
    
    cat > "reports/test-summary.md" << EOF
# Facebook Auto Bot端到端测试报告

## 测试信息
- **执行时间**: $(date)
- **测试环境**: $ENVIRONMENT
- **测试浏览器**: $BROWSER
- **测试模式**: $([ "$PARALLEL" == true ] && echo "并行" || echo "串行")

## 测试结果
EOF
    
    # 如果有测试结果文件，解析并添加详细信息
    if [[ -f "reports/playwright-results.json" ]]; then
        # 这里可以添加解析JSON结果文件的逻辑
        echo "- **结果文件**: reports/playwright-results.json" >> "reports/test-summary.md"
    fi
    
    # 添加报告链接
    cat >> "reports/test-summary.md" << EOF

## 报告链接
- [Allure报告](reports/allure-report/index.html)
- [Playwright HTML报告](reports/playwright-html/index.html)
- [JUnit报告](reports/junit-results.xml)

## 下一步
1. 查看详细报告了解测试详情
2. 修复失败的测试用例
3. 重新运行测试验证修复
EOF
    
    log_success "测试摘要生成完成: reports/test-summary.md"
}

# 主函数
main() {
    log_info "开始Facebook Auto Bot端到端测试..."
    log_info "环境: $ENVIRONMENT, 浏览器: $BROWSER"
    
    # 检查目录
    check_directories
    
    # 创建日志目录
    mkdir -p "$E2E_DIR/logs"
    
    # 清理环境
    if [[ "$CLEAN" == true ]] || [[ "$TEARDOWN_ONLY" == true ]]; then
        cleanup_environment
        if [[ "$TEARDOWN_ONLY" == true ]]; then
            exit 0
        fi
    fi
    
    # 设置环境
    if [[ "$SETUP_ONLY" == true ]]; then
        setup_environment
        exit 0
    fi
    
    # 设置测试环境
    setup_environment
    
    # 启动测试服务
    start_test_services
    
    # 运行测试
    run_tests
    TEST_RESULT=$?
    
    # 生成报告
    generate_report
    
    # 停止测试服务
    stop_test_services
    
    # 返回测试结果
    if [[ $TEST_RESULT -eq 0 ]]; then
        log_success "端到端测试执行完成"
    else
        log_error "端到端测试执行失败"
    fi
    
    exit $TEST_RESULT
}

# 异常处理
trap 'log_error "脚本执行中断"; stop_test_services; exit 1' INT TERM
trap 'stop_test_services' EXIT

# 运行主函数
main "$@"