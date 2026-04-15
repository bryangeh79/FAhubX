#!/bin/bash
# Facebook Auto Bot 环境配置脚本

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

# 生成随机密码
generate_password() {
    openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24
}

# 生成 JWT 密钥
generate_jwt_secret() {
    openssl rand -base64 64
}

# 创建环境配置文件
create_env_file() {
    local env=$1
    local template_file=".env.${env}.template"
    local output_file=".env.${env}"
    
    if [ ! -f "$template_file" ]; then
        log_error "模板文件 $template_file 不存在"
        return 1
    fi
    
    log_info "创建 $output_file 环境配置文件..."
    
    # 复制模板
    cp "$template_file" "$output_file"
    
    # 生成密码和密钥
    local db_password=$(generate_password)
    local redis_password=$(generate_password)
    local rabbitmq_password=$(generate_password)
    local minio_access_key=$(generate_password)
    local minio_secret_key=$(generate_password)
    local jwt_secret=$(generate_jwt_secret)
    local grafana_password=$(generate_password)
    
    # 替换占位符
    sed -i.bak "
        s/your_secure_password_here/$db_password/g
        s/your_redis_password_here/$redis_password/g
        s/your_rabbitmq_password_here/$rabbitmq_password/g
        s/your_minio_access_key/$minio_access_key/g
        s/your_minio_secret_key/$minio_secret_key/g
        s/your_super_secure_jwt_secret_here/$jwt_secret/g
        s/admin_password_here/$grafana_password/g
        s/yourdomain\.com/localhost/g
        s/api\.yourdomain\.com/localhost/g
    " "$output_file"
    
    # 删除备份文件
    rm -f "$output_file.bak"
    
    log_info "环境配置文件已创建: $output_file"
    
    # 显示生成的凭据
    echo ""
    log_info "=== 生成的凭据 ==="
    log_info "数据库密码: $db_password"
    log_info "Redis密码: $redis_password"
    log_info "RabbitMQ密码: $rabbitmq_password"
    log_info "MinIO Access Key: $minio_access_key"
    log_info "MinIO Secret Key: $minio_secret_key"
    log_info "JWT Secret: (已安全保存)"
    log_info "Grafana密码: $grafana_password"
    echo ""
    log_warn "请务必将这些凭据保存在安全的地方！"
}

# 创建 SSL 证书（自签名）
create_ssl_certificates() {
    local ssl_dir="docker/nginx/ssl"
    
    log_info "创建 SSL 证书..."
    
    mkdir -p "$ssl_dir"
    
    # 生成私钥
    openssl genrsa -out "$ssl_dir/private.key" 2048
    
    # 生成证书签名请求
    openssl req -new -key "$ssl_dir/private.key" -out "$ssl_dir/certificate.csr" \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=Facebook Auto Bot/CN=localhost"
    
    # 生成自签名证书
    openssl x509 -req -days 365 -in "$ssl_dir/certificate.csr" \
        -signkey "$ssl_dir/private.key" -out "$ssl_dir/certificate.crt"
    
    # 设置权限
    chmod 600 "$ssl_dir/private.key"
    chmod 644 "$ssl_dir/certificate.crt"
    
    log_info "SSL 证书已创建: $ssl_dir/"
}

# 创建目录结构
create_directories() {
    log_info "创建必要的目录..."
    
    # 日志目录
    mkdir -p logs/{nginx,backend,frontend}
    
    # 备份目录
    mkdir -p backups
    
    # 数据目录
    mkdir -p data/{postgres,redis,rabbitmq,minio}
    
    # 设置权限
    chmod 755 logs backups data
    
    log_info "目录结构创建完成"
}

# 创建 Docker 网络
create_docker_network() {
    log_info "创建 Docker 网络..."
    
    if ! docker network ls | grep -q fbautobot-network; then
        docker network create fbautobot-network
        log_info "Docker 网络 'fbautobot-network' 已创建"
    else
        log_info "Docker 网络 'fbautobot-network' 已存在"
    fi
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."
    
    local missing_deps=()
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        missing_deps+=("docker-compose")
    fi
    
    # 检查 OpenSSL
    if ! command -v openssl &> /dev/null; then
        missing_deps+=("openssl")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "缺少以下依赖: ${missing_deps[*]}"
        return 1
    fi
    
    log_info "所有依赖已安装"
}

# 显示配置信息
show_configuration() {
    log_info "=== 配置完成 ==="
    log_info "环境配置文件: .env.production"
    log_info "SSL 证书: docker/nginx/ssl/"
    log_info "目录结构: logs/, backups/, data/"
    log_info "Docker 网络: fbautobot-network"
    echo ""
    log_info "下一步:"
    log_info "1. 编辑 .env.production 文件，更新域名配置"
    log_info "2. 运行 ./deployment-scripts/deploy-production.sh deploy 开始部署"
    log_info "3. 访问 https://localhost 查看应用"
}

# 主函数
main() {
    local action=${1:-"all"}
    
    case $action in
        "all")
            check_dependencies
            create_env_file "production"
            create_ssl_certificates
            create_directories
            create_docker_network
            show_configuration
            ;;
        "env")
            create_env_file "production"
            ;;
        "ssl")
            create_ssl_certificates
            ;;
        "dirs")
            create_directories
            ;;
        "network")
            create_docker_network
            ;;
        "check")
            check_dependencies
            ;;
        *)
            echo "用法: $0 {all|env|ssl|dirs|network|check}"
            echo "  all     - 执行所有配置步骤"
            echo "  env     - 仅创建环境配置文件"
            echo "  ssl     - 仅创建 SSL 证书"
            echo "  dirs    - 仅创建目录结构"
            echo "  network - 仅创建 Docker 网络"
            echo "  check   - 仅检查依赖"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"