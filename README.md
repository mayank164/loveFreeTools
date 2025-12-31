# Free Email Platform - 公益平台

一个基于 Cloudflare Workers 和 Node.js 的免费公益服务平台，提供临时邮箱、短链接生成、GitHub 代理、文件加速下载等功能，集成 AI 智能分析能力。

## 目录

- [功能特性](#功能特性)
- [系统架构](#系统架构)
- [部署指南](#部署指南)
- [API 文档](#api-文档)
- [配置说明](#配置说明)
- [文件结构](#文件结构)
- [技术栈](#技术栈)
- [安全说明](#安全说明)
- [许可证](#许可证)

## 功能特性

### 1. 临时邮箱服务

- **多域名支持**：支持多个域名自由切换
- **邮箱生成**：随机生成或自定义邮箱前缀
- **自动刷新**：每 5 秒自动检查新邮件
- **邮件查看**：支持纯文本和 HTML 两种视图模式
- **验证码提取**：智能识别并高亮显示验证码
- **一键复制**：快速复制邮箱地址或验证码
- **历史记录**：本地保存使用过的邮箱地址
- **邮件发送**：支持通过平台发送邮件

### 2. AI 智能分析

基于 Cloudflare Workers AI 和 ModelScope API（备用）实现：

- **验证码提取**：自动从邮件中识别并提取 4-8 位验证码
- **邮件摘要**：生成中英双语邮件摘要，支持一键切换
- **垃圾邮件检测**：智能判断邮件是否为垃圾邮件或钓鱼邮件
- **语言检测**：自动识别邮件语言（中文、英文、日文等）
- **内容翻译**：一键将邮件内容翻译为中文
- **链接安全检测**：分析短链接目标 URL 的安全性

AI 模型配置：
- 主用：Cloudflare Workers AI（@cf/meta/llama-3-8b-instruct）
- 备用：ModelScope API（deepseek-ai/DeepSeek-V3.2）

### 3. 短链接服务

- **链接缩短**：将长 URL 转换为短链接
- **自定义代码**：支持自定义短链接后缀
- **点击统计**：记录短链接访问次数
- **过期时间**：可设置链接有效期
- **安全检测**：AI 分析目标链接安全性

### 4. GitHub 代理加速

- **仓库克隆**：加速 git clone 操作
- **文件下载**：加速 Raw 文件下载
- **Release 下载**：加速 GitHub Release 资源下载
- **请求限制**：每 IP 每分钟最多 60 次请求
- **路径过滤**：禁止访问登录、设置等敏感路径

### 5. 文件加速下载

- **通用代理**：支持任意 HTTPS 文件加速下载
- **断点续传**：支持 Range 请求
- **无大小限制**：不限制文件大小
- **自动重定向**：自动跟随 HTTP 重定向
- **保留文件名**：保持原始文件名

## 系统架构

```
                                    +------------------+
                                    |   Cloudflare     |
                                    |   Workers AI     |
                                    +--------+---------+
                                             |
+-------------+     +------------------+     |     +------------------+
|   Browser   | --> | Cloudflare Worker| ----+---> | ModelScope API   |
|  Frontend   |     | (Email Handler)  |           | (Fallback)       |
+-------------+     +--------+---------+           +------------------+
                             |
                             v
                    +------------------+
                    |  Node.js Backend |
                    |  (Express API)   |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |     MySQL        |
                    |    Database      |
                    +------------------+
```

### 组件说明

| 组件 | 说明 |
|------|------|
| Cloudflare Worker | 处理邮件接收、API 路由、GitHub 代理、文件加速 |
| Node.js Backend | RESTful API 服务，处理数据存储和业务逻辑 |
| MySQL Database | 存储邮件、短链接、域名等数据 |
| Cloudflare Workers AI | 主 AI 服务，处理邮件分析 |
| ModelScope API | 备用 AI 服务，Cloudflare AI 失败时自动切换 |

## 部署指南

### 前置要求

- Cloudflare 账户（免费版即可）
- 一台服务器（运行 Node.js 后端）
- MySQL 数据库
- 域名（已托管在 Cloudflare）

### 步骤 1：配置数据库

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE free_email CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 导入表结构
USE free_email;
SOURCE server/database.sql;

# 添加 AI 字段（如果是升级）
SOURCE server/database-upgrade-ai.sql;

# 添加短链接表
SOURCE server/create-short-links-table.sql;
```

### 步骤 2：部署后端服务

```bash
# 进入服务器目录
cd server

# 安装依赖
npm install

# 配置环境变量
cp env.example.txt .env
# 编辑 .env 文件，填写数据库连接信息和 Resend API Key

# 启动服务
pm2 start index.js --name free-email-api

# 设置开机自启
pm2 save
pm2 startup
```

环境变量说明：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| DB_HOST | 数据库主机 | localhost |
| DB_USER | 数据库用户 | root |
| DB_PASSWORD | 数据库密码 | your_password |
| DB_NAME | 数据库名 | free_email |
| RESEND_API_KEY | Resend 邮件发送 API Key | re_xxx |
| ADMIN_KEY | 管理员密钥 | your_admin_key |

### 步骤 3：配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 步骤 4：部署 Cloudflare Worker

1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages，创建新 Worker
3. 将 `server/workers-mysql.js` 内容粘贴到编辑器
4. 配置环境变量：
   - `API_BASE`: 后端 API 地址（如 https://api.yourdomain.com）
   - `ADMIN_KEY`: 管理员密钥
   - `MODELSCOPE_KEY`: ModelScope API Key（可选）
5. 绑定 AI：Settings -> Variables -> AI Bindings，添加名为 `AI` 的绑定
6. 配置自定义域名或 Worker 路由

### 步骤 5：配置 Email Routing

1. 进入 Cloudflare Dashboard -> 域名 -> Email -> Email Routing
2. 配置 Catch-all 规则：Send to Worker，选择你的 Worker
3. 确保 DNS 中有正确的 MX 记录

### 步骤 6：部署前端

**方式 A：Cloudflare Pages**

1. 将代码推送到 GitHub
2. 在 Cloudflare Pages 中连接仓库
3. 构建设置：构建命令留空，输出目录设为 `/`

**方式 B：静态文件托管**

将以下文件上传到任意静态托管服务：
- index.html
- css/
- js/
- favicon.svg
- privacy.html
- terms.html

## API 文档

### 邮件 API

#### 获取邮件列表

```
GET /api/emails/:email
```

参数：
- `email`: 邮箱地址（URL 编码）
- `hideSpam`: 可选，设为 `true` 过滤垃圾邮件

返回：
```json
{
  "email": "test@example.com",
  "count": 5,
  "success": true,
  "emails": [
    {
      "id": 1,
      "from": "sender@example.com",
      "to": "test@example.com",
      "subject": "Test Email",
      "text": "Email content",
      "html": "<p>Email content</p>",
      "date": "2025-01-01T00:00:00.000Z",
      "verificationCode": "123456",
      "summary": "Test email summary",
      "isSpam": false,
      "language": "zh"
    }
  ]
}
```

#### 删除邮件

```
DELETE /api/emails/:email/:id
```

### 短链接 API

#### 创建短链接

```
POST /api/links
```

请求体：
```json
{
  "url": "https://example.com/very-long-url",
  "code": "custom",
  "expiresIn": 7
}
```

#### 获取短链接信息

```
GET /api/links/:code
```

#### 短链接跳转

```
GET /s/:code
```

### AI API

#### 翻译

```
POST /api/ai/translate
Content-Type: application/json

{
  "text": "Hello, world!",
  "targetLang": "zh"
}
```

#### 生成摘要

```
POST /api/ai/summarize
Content-Type: application/json

{
  "text": "Email content here...",
  "subject": "Email subject"
}
```

#### 提取验证码

```
POST /api/ai/extract-code
Content-Type: application/json

{
  "text": "Your verification code is 123456",
  "subject": "Verification"
}
```

#### URL 安全检测

```
POST /api/ai/check-url
Content-Type: application/json

{
  "url": "https://example.com"
}
```

### 域名管理 API

需要管理员密钥（通过 X-Admin-Key 请求头传递）

#### 获取域名列表

```
GET /api/domains
```

#### 添加域名

```
POST /api/domains
X-Admin-Key: your_admin_key
Content-Type: application/json

{
  "name": "example.com",
  "api": "https://api.example.com"
}
```

#### 删除域名

```
DELETE /api/domains/:name
X-Admin-Key: your_admin_key
```

### 发送邮件 API

```
POST /api/send-email
Content-Type: application/json

{
  "from": "sender@yourdomain.com",
  "to": "recipient@example.com",
  "subject": "Test Email",
  "text": "Plain text content",
  "html": "<p>HTML content</p>"
}
```

## 配置说明

### Worker 环境变量

| 变量名 | 必需 | 说明 |
|--------|------|------|
| API_BASE | 是 | 后端 API 地址 |
| ADMIN_KEY | 是 | 管理员密钥 |
| MODELSCOPE_KEY | 否 | ModelScope API Key（AI 备用） |
| AI_ENABLED | 否 | AI 功能开关（默认 true） |

### Worker 绑定

| 绑定名称 | 类型 | 说明 |
|----------|------|------|
| AI | Workers AI | AI 模型绑定 |
| EMAILS_KV | KV Namespace | 可选，用于缓存 |

## 文件结构

```
loveFreeTools/
├── index.html                    # 前端主页面
├── privacy.html                  # 隐私政策页面
├── terms.html                    # 服务条款页面
├── favicon.svg                   # 网站图标
├── _headers                      # Cloudflare Pages HTTP 头配置
├── _redirects                    # Cloudflare Pages 重定向规则
├── README.md                     # 项目说明文档
│
├── css/
│   └── style.css                 # 样式文件
│
├── js/
│   ├── app.js                    # 主应用逻辑
│   ├── api.js                    # API 请求封装
│   └── utils.js                  # 工具函数
│
├── server/
│   ├── index.js                  # Node.js 后端主程序
│   ├── workers-mysql.js          # Cloudflare Worker 代码（MySQL 版）
│   ├── workers-neon.js           # Cloudflare Worker 代码（Neon 版）
│   ├── database.sql              # MySQL 数据库结构
│   ├── database-postgres.sql     # PostgreSQL 数据库结构
│   ├── database-upgrade-ai.sql   # AI 字段升级脚本
│   ├── create-short-links-table.sql  # 短链接表创建脚本
│   ├── package.json              # Node.js 依赖配置
│   ├── env.example.txt           # 环境变量示例
│   ├── freeEmail.conf            # Nginx 配置示例
│   └── *.md                      # 部署文档
│
├── workers.js                    # 旧版 Worker（KV 存储版本）
├── workers-download.js           # 文件下载代理 Worker
└── wrangler.toml                 # Wrangler CLI 配置
```

## 技术栈

### 前端

- HTML5 + CSS3 + Vanilla JavaScript
- 深色赛博朋克主题设计
- 响应式布局，支持移动端
- 字体：JetBrains Mono + Noto Sans SC

### 后端

- Node.js + Express.js
- MySQL 数据库
- Resend API（邮件发送）

### 边缘计算

- Cloudflare Workers
- Cloudflare Workers AI
- Cloudflare Email Routing
- Cloudflare Pages

### AI 服务

- Cloudflare Workers AI（@cf/meta/llama-3-8b-instruct）
- ModelScope API（deepseek-ai/DeepSeek-V3.2）

## 安全说明

1. **邮件安全**
   - HTML 邮件在 sandbox iframe 中渲染，阻止脚本执行
   - 邮件数据 24 小时后自动删除
   - 不存储任何敏感信息到客户端

2. **短链接安全**
   - 创建短链接时显示安全风险提示
   - AI 自动分析目标链接安全性
   - 支持链接过期时间设置

3. **API 安全**
   - 管理员操作需要密钥验证
   - CORS 配置限制跨域请求
   - 请求频率限制

4. **数据安全**
   - 数据库连接使用 SSL
   - 敏感配置通过环境变量管理
   - 定期自动清理过期数据

## 注意事项

1. 临时邮箱仅用于接收验证码等一次性用途，请勿用于重要账户
2. 邮件在服务端保存 24 小时后自动删除
3. 每个邮箱最多保留 50 封邮件
4. 短链接服务可能被滥用，请谨慎使用
5. AI 分析功能有每日免费额度限制

## 许可证

MIT License

Copyright (c) 2025 VioletTeam

详见 [LICENSE](LICENSE) 文件。
