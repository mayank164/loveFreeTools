#!/bin/bash
#===============================================
# TinyProxy 一键安装脚本
# 服务器: 115.190.229.8
# 端口: 8888
#===============================================

set -e

echo "=========================================="
echo "  TinyProxy HTTP 代理服务安装脚本"
echo "=========================================="
echo ""

# 检测系统类型
if [ -f /etc/debian_version ]; then
    OS="debian"
    echo "[INFO] 检测到 Debian/Ubuntu 系统"
elif [ -f /etc/redhat-release ]; then
    OS="centos"
    echo "[INFO] 检测到 CentOS/RHEL 系统"
else
    echo "[ERROR] 不支持的操作系统"
    exit 1
fi

# 安装 TinyProxy
echo ""
echo "[STEP 1] 安装 TinyProxy..."
if [ "$OS" = "debian" ]; then
    apt update
    apt install -y tinyproxy
elif [ "$OS" = "centos" ]; then
    yum install -y epel-release
    yum install -y tinyproxy
fi
echo "[OK] TinyProxy 安装完成"

# 备份原配置
echo ""
echo "[STEP 2] 配置 TinyProxy..."
cp /etc/tinyproxy/tinyproxy.conf /etc/tinyproxy/tinyproxy.conf.bak

# 创建新配置
cat > /etc/tinyproxy/tinyproxy.conf << 'EOF'
##
## TinyProxy 配置文件
## 用于爬虫 HTTP 代理服务
##

# 监听端口
Port 8888

# 监听地址 (0.0.0.0 表示所有接口)
Listen 0.0.0.0

# 连接超时 (秒)
Timeout 600

# 最大客户端连接数
MaxClients 50

# 最小空闲服务器数
MinSpareServers 2

# 最大空闲服务器数
MaxSpareServers 10

# 启动时的服务器数
StartServers 5

# 每个子进程最大请求数
MaxRequestsPerChild 0

# 允许所有 IP 访问 (无认证模式)
Allow 0.0.0.0/0

# 隐藏 Via 头部 (隐藏代理痕迹)
DisableViaHeader Yes

# 日志文件
Logfile "/var/log/tinyproxy/tinyproxy.log"

# 日志级别 (Info, Warning, Error, Critical)
LogLevel Info

# PID 文件
PidFile "/run/tinyproxy/tinyproxy.pid"

# 错误页面
DefaultErrorFile "/usr/share/tinyproxy/default.html"

# 连接日志
#ConnectPort 443
#ConnectPort 563

# X-Tinyproxy 头部 (建议禁用)
#XTinyproxy Yes
EOF

echo "[OK] 配置文件已更新"

# 创建日志目录
mkdir -p /var/log/tinyproxy
mkdir -p /run/tinyproxy
chown -R nobody:nogroup /var/log/tinyproxy 2>/dev/null || chown -R nobody:nobody /var/log/tinyproxy

# 启动服务
echo ""
echo "[STEP 3] 启动 TinyProxy 服务..."
systemctl enable tinyproxy
systemctl restart tinyproxy
sleep 2

# 检查状态
if systemctl is-active --quiet tinyproxy; then
    echo "[OK] TinyProxy 服务已启动"
else
    echo "[ERROR] TinyProxy 启动失败"
    systemctl status tinyproxy
    exit 1
fi

# 配置防火墙
echo ""
echo "[STEP 4] 配置防火墙..."
if command -v ufw &> /dev/null; then
    ufw allow 8888/tcp
    echo "[OK] UFW 防火墙已开放 8888 端口"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=8888/tcp
    firewall-cmd --reload
    echo "[OK] Firewalld 已开放 8888 端口"
else
    echo "[WARN] 未检测到防火墙管理工具，请手动开放 8888 端口"
fi

# 测试代理
echo ""
echo "[STEP 5] 测试代理服务..."
sleep 1

# 本地测试
if curl -s -x http://127.0.0.1:8888 http://httpbin.org/ip --connect-timeout 10 | grep -q "origin"; then
    echo "[OK] 代理服务正常工作"
else
    echo "[WARN] 代理测试可能失败，请手动检查"
fi

# 完成
echo ""
echo "=========================================="
echo "  安装完成!"
echo "=========================================="
echo ""
echo "代理地址: http://115.190.229.8:8888"
echo ""
echo "Python 使用示例:"
echo '  proxies = {"http": "http://115.190.229.8:8888", "https": "http://115.190.229.8:8888"}'
echo '  requests.get("http://example.com", proxies=proxies)'
echo ""
echo "curl 使用示例:"
echo '  curl -x http://115.190.229.8:8888 http://example.com'
echo ""
echo "重要: 请在云平台安全组中开放 8888 端口入站规则!"
echo ""

