# HTTP 代理服务器

国内服务器 HTTP 代理，供爬虫使用。

## 服务器信息

| 项目 | 值 |
|------|-----|
| IP | 115.190.229.8 |
| 端口 | 8888 |
| 协议 | HTTP/HTTPS |
| 认证 | 无 |

## 安装

### 1. SSH 登录服务器

```bash
ssh root@115.190.229.8
```

### 2. 运行安装脚本

```bash
# 下载脚本
curl -O https://raw.githubusercontent.com/violettoolssite/loveFreeTools/main/proxy-server/install-tinyproxy.sh

# 或直接粘贴脚本内容

# 运行
chmod +x install-tinyproxy.sh
./install-tinyproxy.sh
```

### 3. 开放云平台安全组

在服务器供应商控制台添加入站规则：
- 端口: 8888
- 协议: TCP
- 来源: 0.0.0.0/0 (或指定 IP)

## 使用方法

### Python requests

```python
import requests

proxies = {
    "http": "http://115.190.229.8:8888",
    "https": "http://115.190.229.8:8888"
}

response = requests.get("http://example.com", proxies=proxies)
print(response.text)
```

### Python aiohttp

```python
import aiohttp

async def fetch():
    async with aiohttp.ClientSession() as session:
        async with session.get(
            "http://example.com",
            proxy="http://115.190.229.8:8888"
        ) as response:
            return await response.text()
```

### curl

```bash
curl -x http://115.190.229.8:8888 http://example.com
```

### wget

```bash
wget -e use_proxy=yes -e http_proxy=http://115.190.229.8:8888 http://example.com
```

### Scrapy

在 `settings.py` 中：

```python
DOWNLOADER_MIDDLEWARES = {
    'scrapy.downloadermiddlewares.httpproxy.HttpProxyMiddleware': 1,
}

HTTP_PROXY = 'http://115.190.229.8:8888'
```

## 管理命令

```bash
# 查看状态
systemctl status tinyproxy

# 重启服务
systemctl restart tinyproxy

# 停止服务
systemctl stop tinyproxy

# 查看日志
tail -f /var/log/tinyproxy/tinyproxy.log

# 查看连接数
netstat -an | grep 8888 | wc -l
```

## 性能说明

| 指标 | 值 |
|------|-----|
| 带宽 | 1Mbps (约 125KB/s) |
| 建议并发 | 5 个以内 |
| 最大连接 | 50 |
| 超时时间 | 600 秒 |

## 安全建议

当前配置允许所有 IP 访问。如需限制：

编辑 `/etc/tinyproxy/tinyproxy.conf`：

```conf
# 注释掉
# Allow 0.0.0.0/0

# 添加允许的 IP
Allow 你的IP地址
Allow 另一个IP
```

然后重启：`systemctl restart tinyproxy`

## 故障排查

### 无法连接

1. 检查服务状态：`systemctl status tinyproxy`
2. 检查端口监听：`netstat -tlnp | grep 8888`
3. 检查防火墙：`ufw status` 或 `firewall-cmd --list-all`
4. 检查云平台安全组

### 连接超时

1. 检查带宽使用：`iftop` 或 `nload`
2. 减少并发连接数
3. 增加客户端超时时间

### 代理被识别

1. 已禁用 Via 头部
2. 如需更隐蔽，考虑使用 Squid 或私有代理

