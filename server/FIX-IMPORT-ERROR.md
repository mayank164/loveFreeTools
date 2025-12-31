# 修复 "Cannot use import statement" 错误

## 问题

在 Cloudflare Dashboard 中部署 Worker 时，遇到错误：
```
Uncaught SyntaxError: Cannot use import statement outside a module
```

## 原因

Cloudflare Workers 支持 ES modules，但需要确保 Worker 配置正确。

## 解决方案

### 方案 1：在 Dashboard 中确保使用 ES modules（推荐）

1. **创建新 Worker 时**：
   - 在 Cloudflare Dashboard → Workers & Pages
   - 点击 **Create application** → **Create Worker**
   - 选择 **"Use the new editor"**（新编辑器默认支持 ES modules）

2. **如果已创建 Worker**：
   - 进入 Worker 设置页面
   - 点击 **Settings** 标签
   - 找到 **Compatibility Date**
   - 确保设置为 `2024-01-01` 或更新
   - 保存设置

3. **上传代码**：
   - 在 Worker 编辑器中
   - 直接粘贴 `workers-neon.js` 的代码（包含 `import` 语句）
   - 点击 **Save and deploy**

### 方案 2：使用 Wrangler CLI（最可靠）

使用命令行部署可以确保配置正确：

1. **安装 Wrangler**：
   ```bash
   npm install -g wrangler
   ```

2. **登录 Cloudflare**：
   ```bash
   wrangler login
   ```

3. **创建项目**（如果还没有）：
   ```bash
   wrangler init free-email-neon
   # 选择 "No" 当询问是否使用 TypeScript
   ```

4. **配置 wrangler.toml**：
   ```toml
   name = "free-email-neon"
   main = "server/workers-neon.js"
   compatibility_date = "2024-01-01"
   
   [triggers]
   crons = ["0 * * * *"]
   ```

5. **部署**：
   ```bash
   wrangler deploy
   ```

### 方案 3：使用兼容格式（不推荐，但可用）

如果上述方案都不行，可以修改代码使用兼容格式，但会失去类型检查和优化。

## 验证

部署后，检查 Worker 是否正常工作：

1. 访问 Worker URL，应该看到 API 文档页面
2. 测试 API：
   ```bash
   curl https://你的worker.workers.dev/api/domains
   ```
3. 检查 Worker 日志，不应该有 import 相关错误

## 常见问题

**Q: 为什么 Dashboard 中不支持 import？**  
A: 旧版本的 Worker 编辑器可能不支持。使用新编辑器或 Wrangler CLI。

**Q: 使用 Wrangler 部署后，如何在 Dashboard 中编辑？**  
A: 可以在 Dashboard 中继续编辑，但建议使用 Wrangler 进行部署以确保一致性。

**Q: 可以混用 Dashboard 和 Wrangler 吗？**  
A: 可以，但建议统一使用一种方式，避免配置冲突。

## 推荐工作流

1. 使用 Wrangler CLI 进行初始部署和配置
2. 在 Dashboard 中查看日志和监控
3. 代码更新时使用 Wrangler 重新部署

这样可以确保配置正确，同时方便监控。

