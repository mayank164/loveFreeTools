# 公益平台 - MySQL 后端部署指南

## 概述

此方案将数据存储从 Cloudflare Workers KV 迁移到 MySQL 数据库，解决免费额度超限问题。

## 架构

```
用户浏览器 → Cloudflare Worker → MySQL API 后端 → MySQL 数据库
                    ↓                              (35.220.142.223)
              GitHub 代理
```

## 部署步骤

### 1. 设置 MySQL 数据库

连接到你的 MySQL 服务器：

```bash
mysql -u root -p -h 35.220.142.223
```

执行数据库初始化脚本：

```bash
mysql -u root -p < database.sql
```

或者手动执行 `database.sql` 中的 SQL 语句。

启用事件调度器（用于自动清理过期数据）：

```sql
SET GLOBAL event_scheduler = ON;
```

### 2. 部署 Node.js API 后端

在服务器上创建目录并上传文件：

```bash
# 创建项目目录
mkdir -p /opt/free-email-api
cd /opt/free-email-api

# 上传文件（或使用 git clone）
# 需要的文件：index.js, package.json, env.example.txt
```

安装依赖：

```bash
npm install
```

配置环境变量：

```bash
cp env.example.txt .env
nano .env
```

编辑 `.env` 文件，填入实际值：

```env
DB_HOST=35.220.142.223
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密码
DB_NAME=free_email

PORT=3000
NODE_ENV=production

ADMIN_KEY=你的管理员密钥

CORS_ORIGINS=*
```

启动服务：

```bash
# 开发模式
npm run dev

# 生产模式（使用 PM2）
npm install -g pm2
npm run pm2

# 查看日志
npm run pm2:logs
```

设置开机自启：

```bash
pm2 startup
pm2 save
```

### 3. 配置防火墙

确保端口 3000 对外开放：

```bash
# Ubuntu/Debian
sudo ufw allow 3000

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### 4. 更新 Cloudflare Worker

在 Cloudflare Dashboard 中：

1. 进入 Workers & Pages
2. 创建新 Worker 或编辑现有 Worker
3. 复制 `workers-mysql.js` 的内容
4. 添加环境变量：
   - `API_BASE`: `http://35.220.142.223:3000`
   - `ADMIN_KEY`: 你的管理员密钥
5. 部署 Worker

### 5. 配置 Email Routing

确保域名的 Email Routing 仍然指向 Worker：

1. 进入域名设置 → Email → Email Routing
2. 确认 Catch-all 规则指向正确的 Worker

## 验证部署

### 测试 API 后端

```bash
# 测试服务状态
curl http://35.220.142.223:3000/

# 测试获取域名列表
curl http://35.220.142.223:3000/api/domains

# 测试获取邮件
curl http://35.220.142.223:3000/api/emails/test@example.com
```

### 测试 Worker

访问你的域名根路径，应该返回服务状态 JSON。

## 可选：使用 Nginx 反向代理

如果需要 HTTPS 支持，可以使用 Nginx：

```nginx
server {
    listen 80;
    server_name your-api-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

然后使用 Certbot 配置 SSL：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-api-domain.com
```

## 维护

### 查看日志

```bash
pm2 logs free-email-api
```

### 重启服务

```bash
pm2 restart free-email-api
```

### 手动清理过期数据

```sql
DELETE FROM emails WHERE received_at < DATE_SUB(NOW(), INTERVAL 24 HOUR);
```

## 故障排除

### 数据库连接失败

1. 检查 MySQL 服务是否运行：`systemctl status mysql`
2. 检查防火墙是否允许 3306 端口
3. 检查 MySQL 用户权限

### API 请求失败

1. 检查 PM2 进程：`pm2 list`
2. 查看错误日志：`pm2 logs free-email-api --err`
3. 检查端口是否被占用：`netstat -tlnp | grep 3000`

### Worker 无法连接 API

1. 确保 API_BASE 环境变量正确
2. 检查服务器防火墙
3. 查看 Cloudflare Worker 日志

