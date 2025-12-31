# Neon PostgreSQL 完全无服务器部署指南

## 概述

本指南将帮助你将应用从 MySQL 后端迁移到 Neon PostgreSQL，并实现完全无服务器架构。

## 架构

```
用户浏览器 → Cloudflare Worker → Neon PostgreSQL (直接连接)
邮件路由 → Cloudflare Email Worker → Neon PostgreSQL
定时任务 → Cloudflare Cron Triggers → 自动清理过期邮件
```

## 前置要求

1. Cloudflare 账户（免费版即可）
2. Neon 账户（免费版即可）
3. Neon 数据库连接字符串

## 部署步骤

### 第一步：在 Neon 中创建数据库表

1. 登录 [Neon 控制台](https://console.neon.tech/)
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 复制 `server/database-postgres.sql` 文件的全部内容
5. 粘贴到 SQL Editor 中
6. 点击 **Run** 执行 SQL
7. 确认所有表创建成功（应该看到 "Success" 消息）

**验证表是否创建成功：**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

应该看到以下表：
- `domains`
- `emails`
- `rate_limits`
- `send_logs`

### 第二步：安装 Wrangler CLI（可选，推荐）

如果你使用命令行部署，需要安装 Wrangler：

```bash
npm install -g wrangler
# 或
npm install wrangler --save-dev
```

登录 Cloudflare：
```bash
wrangler login
```

### 第三步：在 Cloudflare 中创建 Worker

#### 方法 A：使用 Cloudflare Dashboard（推荐新手）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 点击 **Create application**
4. 选择 **Create Worker**
5. 输入 Worker 名称：`free-email-neon`
6. 点击 **Deploy**

#### 方法 B：使用 Wrangler CLI

```bash
# 在项目根目录执行
wrangler init free-email-neon
# 选择 "No" 当询问是否使用 TypeScript
```

### 第四步：上传 Worker 代码

#### 方法 A：使用 Dashboard

1. 在 Worker 页面，点击 **Quick edit**
2. 删除默认代码
3. 复制 `server/workers-neon.js` 的全部内容
4. 粘贴到编辑器中
5. 点击 **Save and deploy**

#### 方法 B：使用 Wrangler CLI

1. 将 `server/workers-neon.js` 复制到 Worker 目录
2. 更新 `wrangler.toml`（如果使用 CLI）：
   ```toml
   name = "free-email-neon"
   main = "workers-neon.js"
   compatibility_date = "2024-01-01"
   
   [triggers]
   crons = ["0 * * * *"]
   ```
3. 部署：
   ```bash
   wrangler deploy
   ```

### 第五步：配置环境变量

在 Cloudflare Dashboard 中：

1. 进入 Worker 设置页面
2. 点击 **Variables and Secrets**
3. 添加以下环境变量：

#### 必需变量

**DATABASE_URL**
- 类型：Secret（点击 "Encrypt"）
- 值：你的 Neon 连接字符串
  ```
  postgresql://neondb_owner:npg_MN0rFxTpGaZ9@ep-broad-darkness-ab8xx6z2-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
  ```

#### 可选变量

**ADMIN_KEY**
- 类型：Secret
- 值：你的管理员密钥（用于删除域名等操作）
- 如果不设置，删除域名功能将不可用

**RESEND_API_KEY**
- 类型：Secret
- 值：你的 Resend API 密钥（用于发送邮件）
- 如果不设置，发送邮件功能将不可用
- 获取方式：https://resend.com/api-keys

#### 使用 Wrangler CLI 设置 Secrets

```bash
# 设置 DATABASE_URL
wrangler secret put DATABASE_URL
# 粘贴连接字符串并按 Enter

# 设置 ADMIN_KEY（可选）
wrangler secret put ADMIN_KEY

# 设置 RESEND_API_KEY（可选）
wrangler secret put RESEND_API_KEY
```

### 第六步：配置 Cron Triggers（定时任务）

#### 方法 A：使用 Dashboard

1. 在 Worker 设置页面
2. 点击 **Triggers**
3. 在 **Cron Triggers** 部分
4. 点击 **Add Cron Trigger**
5. 输入 Cron 表达式：`0 * * * *`（每小时执行一次）
6. 点击 **Save**

#### 方法 B：使用 wrangler.toml（已配置）

如果使用 `wrangler.toml`，Cron Triggers 已自动配置：
```toml
[triggers]
crons = ["0 * * * *"]
```

### 第七步：配置 Email Routing

1. 在 Cloudflare Dashboard 中，选择你的域名
2. 进入 **Email** → **Email Routing**
3. 如果未启用，点击 **Get started** 启用 Email Routing
4. 点击 **Routing rules** → **Create address**
5. 选择 **Catch-all address**（`*@yourdomain.com`）
6. 选择 **Send to** → **Workers**
7. 选择你刚创建的 Worker：`free-email-neon`
8. 点击 **Save**

### 第八步：绑定自定义域名（可选）

如果你想通过自定义域名访问 Worker：

1. 在 Worker 设置页面
2. 点击 **Triggers**
3. 在 **Routes** 部分
4. 点击 **Add route**
5. 输入路由：`yourdomain.com/*`
6. 选择你的 Worker
7. 点击 **Save**

### 第九步：测试部署

#### 测试 API 端点

```bash
# 测试根路径（应该返回 API 文档）
curl https://your-worker-name.your-subdomain.workers.dev/

# 测试获取域名列表
curl https://your-worker-name.your-subdomain.workers.dev/api/domains

# 测试邮件接收（发送一封邮件到 test@yourdomain.com）
# 然后查询邮件
curl https://your-worker-name.your-subdomain.workers.dev/api/emails/test@yourdomain.com
```

#### 测试邮件接收

1. 发送一封测试邮件到 `test@yourdomain.com`
2. 等待几秒钟
3. 查询邮件：
   ```bash
   curl https://your-worker-name.your-subdomain.workers.dev/api/emails/test@yourdomain.com
   ```

#### 测试自动清理

1. 等待下一个整点（Cron Trigger 每小时执行一次）
2. 检查 Worker 日志，应该看到清理记录

### 第十步：验证数据库连接

在 Neon SQL Editor 中执行：

```sql
-- 检查是否有邮件存储
SELECT COUNT(*) FROM emails;

-- 检查域名列表
SELECT * FROM domains;

-- 检查发送日志
SELECT * FROM send_logs ORDER BY created_at DESC LIMIT 10;
```

## 故障排查

### 问题 1：Worker 报错 "DATABASE_URL 环境变量未设置"

**解决方案：**
- 确认在 Cloudflare Dashboard 中已设置 `DATABASE_URL` Secret
- 确认 Secret 已加密（点击了 "Encrypt"）
- 重新部署 Worker

### 问题 2：数据库连接失败

**解决方案：**
- 检查连接字符串格式是否正确
- 确认使用了 Pooler 连接（包含 `-pooler`）
- 检查 Neon 项目是否处于活动状态
- 在 Neon 控制台测试连接

### 问题 3：邮件未存储

**解决方案：**
- 检查 Email Routing 配置是否正确
- 检查 Worker 日志（在 Dashboard 的 **Logs** 标签）
- 确认 Catch-all 规则指向正确的 Worker

### 问题 4：Cron Trigger 未执行

**解决方案：**
- 确认 Cron Trigger 已配置（`0 * * * *`）
- 等待下一个整点
- 检查 Worker 日志
- 注意：免费版 Cron Trigger 可能有延迟

### 问题 5：API 返回 502 错误

**解决方案：**
- 检查 Worker 代码是否有语法错误
- 检查环境变量是否正确设置
- 查看 Worker 日志获取详细错误信息

## 监控和维护

### 查看 Worker 日志

1. 在 Cloudflare Dashboard 中进入 Worker
2. 点击 **Logs** 标签
3. 可以实时查看请求和错误日志

### 监控数据库使用量

在 Neon Dashboard 中：
- 查看 **Usage** 标签
- 监控 Compute、Storage、Network Transfer 使用量
- 免费版限制：
  - Compute: 100 CU-hrs/月
  - Storage: 0.5 GB
  - Network: 5 GB/月

### 定期检查

- 每周检查一次 Worker 日志
- 每月检查一次 Neon 使用量
- 确认自动清理任务正常运行

## 从旧架构迁移

如果你之前使用 MySQL + 后端服务器：

1. **数据迁移（可选）**
   - 如果需要迁移现有数据，可以使用 `pgloader` 或编写迁移脚本
   - 或者让新系统自然积累数据

2. **停止旧服务器**
   - 确认新 Worker 正常运行后
   - 可以停止或删除旧的 Node.js 后端服务器

3. **更新 Worker 路由**
   - 如果之前 Worker 转发到后端 API
   - 现在可以直接使用新 Worker，无需转发

## 成本估算

### Cloudflare Workers（免费版）
- ✅ 每天 100,000 次请求
- ✅ 10ms CPU 时间/请求
- ✅ 足够日常使用

### Neon（免费版）
- ✅ 100 CU-hrs/月（约 30,000 请求）
- ✅ 0.5 GB 存储
- ✅ 5 GB 网络传输
- ✅ 每天 < 1000 请求完全够用

## 总结

部署完成后，你将拥有：
- ✅ 完全无服务器的架构
- ✅ 零服务器维护成本
- ✅ 自动扩缩容
- ✅ 高可用性（Cloudflare + Neon）
- ✅ 自动清理过期数据

如有问题，请查看 Cloudflare 和 Neon 的官方文档，或检查 Worker 日志。

