# 修复 "No such module" 错误 - Dashboard 部署方案

## 问题

在 Cloudflare Dashboard 中部署时遇到：
```
No such module "@neondatabase/serverless"
```

## 原因

Cloudflare Dashboard 不会自动安装 npm 依赖包。需要使用 Wrangler CLI 部署，或者使用其他方法。

## 解决方案

### 方案 1：使用 Wrangler CLI 部署（推荐）

这是最可靠的方法，Wrangler 会自动处理 npm 依赖：

1. **安装依赖**：
   ```bash
   cd server
   npm install @neondatabase/serverless
   ```

2. **或者使用项目根目录的 package.json**：
   ```bash
   # 在项目根目录
   npm install @neondatabase/serverless wrangler --save-dev
   ```

3. **登录 Cloudflare**：
   ```bash
   wrangler login
   ```

4. **部署**：
   ```bash
   wrangler deploy
   ```

### 方案 2：使用外部 CDN（实验性）

我已经更新了代码，尝试从 CDN 加载模块。但这可能不稳定。

如果 CDN 方案不工作，请使用方案 1。

### 方案 3：使用 npm 包管理（Dashboard）

如果你坚持使用 Dashboard：

1. **在项目目录安装依赖**：
   ```bash
   npm install @neondatabase/serverless
   ```

2. **使用 Wrangler 打包**：
   ```bash
   wrangler deploy --dry-run
   ```

3. **然后手动上传打包后的代码到 Dashboard**

但这很复杂，不推荐。

## 推荐工作流

**最佳实践：使用 Wrangler CLI**

```bash
# 1. 安装 Wrangler（如果还没有）
npm install -g wrangler

# 2. 登录
wrangler login

# 3. 在项目根目录安装依赖
npm install @neondatabase/serverless

# 4. 部署
wrangler deploy
```

这样 Wrangler 会自动：
- 打包所有依赖
- 上传到 Cloudflare
- 配置环境变量
- 设置 Cron Triggers

## 验证部署

部署后测试：

```bash
curl https://kami666.xyz/api/domains
```

应该返回域名列表，而不是错误。

## 如果仍然有问题

1. 检查 `wrangler.toml` 配置
2. 确认 `DATABASE_URL` 环境变量已设置
3. 查看 Worker 日志获取详细错误信息

