# 快速修复 "No such module" 错误

## 问题

在 Cloudflare Dashboard 中部署时遇到：
```
No such module "@neondatabase/serverless"
```

## 根本原因

Cloudflare Dashboard **不会自动安装 npm 依赖包**。必须使用 **Wrangler CLI** 部署。

## 立即解决方案

### 在服务器上执行（推荐）

```bash
# 1. 进入项目目录
cd /path/to/freeEmail

# 2. 安装 Wrangler（如果还没有）
npm install -g wrangler

# 3. 安装依赖
npm install @neondatabase/serverless

# 4. 登录 Cloudflare
wrangler login

# 5. 部署
wrangler deploy
```

### 或者使用部署脚本

```bash
chmod +x server/deploy-neon.sh
./server/deploy-neon.sh
```

## 为什么必须使用 Wrangler CLI？

1. **自动打包依赖**：Wrangler 会自动将 `node_modules` 中的依赖打包到 Worker
2. **正确配置**：确保 Worker 使用正确的模块格式
3. **环境变量**：可以方便地设置 Secrets

## Dashboard vs Wrangler CLI

| 功能 | Dashboard | Wrangler CLI |
|------|-----------|--------------|
| 安装 npm 包 | ❌ 不支持 | ✅ 自动处理 |
| 打包依赖 | ❌ 不支持 | ✅ 自动打包 |
| 快速编辑 | ✅ 方便 | ❌ 需要重新部署 |
| 推荐用途 | 查看日志、监控 | 部署、配置 |

## 部署后设置环境变量

即使使用 Wrangler CLI 部署，环境变量仍需要在 Dashboard 中设置：

1. 进入 Worker 设置
2. **Variables and Secrets**
3. 添加：
   - `DATABASE_URL` (Secret)
   - `ADMIN_KEY` (Secret, 可选)
   - `RESEND_API_KEY` (Secret, 可选)

## 验证

```bash
curl https://kami666.xyz/api/domains
```

应该返回域名列表，而不是错误。

## 如果仍然有问题

1. 检查 `wrangler.toml` 配置
2. 确认依赖已安装：`ls node_modules/@neondatabase`
3. 查看部署日志：`wrangler tail`
4. 检查 Worker 日志（Dashboard → Logs）

