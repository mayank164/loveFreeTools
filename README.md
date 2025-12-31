# ∞ 公益平台 - 免费公益服务

一个现代化的临时邮箱 Web 应用，支持多域名切换、随机/自定义邮箱生成、自动刷新收件、HTML 邮件渲染等功能。

## 功能特性

- **多域名支持** - 支持 5 个域名自由切换
  - logincursor.xyz
  - kami666.xyz
  - deploytools.site
  - loginvipcursor.icu
  - qxfy.store

- **邮箱生成**
  - 随机生成唯一邮箱地址
  - 支持自定义邮箱前缀

- **邮件管理**
  - 自动刷新（每 5 秒）
  - 手动刷新
  - 新邮件到达通知

- **邮件查看**
  - 支持纯文本和 HTML 两种视图
  - 安全的 HTML 渲染（sandbox iframe）

- **其他功能**
  - 一键复制邮箱地址
  - 历史邮箱记录
  - 本地状态持久化
  - 响应式布局，支持移动端

## 快速开始

### 方式一：部署到 Cloudflare（推荐）

#### 步骤 1: 部署 Worker（邮件 API）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → **Create Application** → **Create Worker**
3. 将 `workers.js` 的内容粘贴进去，保存并部署
4. 绑定你的域名到这个 Worker
5. 创建 KV 命名空间 `EMAILS`，并绑定到 Worker

#### 步骤 2: 部署 Pages（前端）

**方法 A：通过 Git 仓库**
1. 将代码推送到 GitHub/GitLab
2. 进入 **Workers & Pages** → **Create Application** → **Pages**
3. 连接你的 Git 仓库
4. 设置：
   - 构建命令：留空
   - 输出目录：`/`（根目录）
5. 点击部署

**方法 B：直接上传**
1. 进入 **Workers & Pages** → **Create Application** → **Pages**
2. 选择 **Upload assets**
3. 上传整个项目文件夹（除了 `workers.js`）
4. 点击部署

#### 步骤 3: 配置自定义域名（可选）

1. Pages 部署完成后，进入项目设置
2. **Custom domains** → 添加你的域名（如 `free.violetteam.cloud`）
3. 按提示配置 DNS 记录

### 方式二：直接打开

双击 `index.html` 文件，在浏览器中打开即可使用。

### 方式三：本地服务器

```bash
# 使用 Python 启动简单服务器
python -m http.server 8080

# 或使用 Node.js 的 http-server
npx http-server -p 8080
```

然后访问 http://localhost:8080

## 使用说明

1. **选择域名** - 点击左侧域名按钮选择要使用的域名
2. **生成邮箱** - 点击"生成新邮箱"按钮，或输入自定义前缀后点击
3. **复制邮箱** - 点击"复制"按钮一键复制邮箱地址
4. **等待邮件** - 系统会自动每 5 秒刷新一次检查新邮件
5. **查看邮件** - 点击邮件列表中的邮件查看详情

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + C` | 复制当前邮箱地址（无选中文本时） |
| `R` | 刷新邮件列表 |
| `ESC` | 关闭邮件详情 |
| `Enter` | 在前缀输入框中按下生成新邮箱 |

## 后端服务

本应用需要配合 Cloudflare Email Worker 使用。Worker 代码已在项目根目录或由用户单独部署。

### Worker 功能

- 接收发送到对应域名的所有邮件
- 存储邮件到 Cloudflare KV（24小时自动过期）
- 提供 RESTful API 查询邮件

### API 接口

```
GET /api/emails/{email}
```

返回指定邮箱收到的所有邮件列表。

## 技术栈

- **前端**: HTML5 + CSS3 + Vanilla JavaScript
- **UI**: 深色赛博朋克主题
- **字体**: JetBrains Mono + Noto Sans SC
- **后端**: Cloudflare Workers + KV

## 管理员功能

访问 `#freeadmin` 路由可进入管理面板：

```
https://your-domain.com/#freeadmin
```

管理员可以：
- 添加/删除邮箱域名
- 添加/删除捐赠者记录
- 所有数据保存在浏览器 localStorage 中

## 文件结构

```
freeEmail/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── app.js          # 主应用逻辑
│   ├── api.js          # API 请求封装
│   └── utils.js        # 工具函数
├── workers.js          # Cloudflare Worker 代码（单独部署）
├── _headers            # Cloudflare Pages HTTP 头配置
├── _redirects          # Cloudflare Pages 重定向规则
└── README.md           # 说明文档
```

## 安全说明

- HTML 邮件在 sandbox iframe 中渲染，阻止脚本执行
- 不存储任何敏感信息到本地
- 邮件由 Cloudflare KV 管理，24小时自动过期
- 临时邮箱仅用于接收验证码等一次性用途，请勿用于重要账户

## 注意事项

1. 邮件在服务端保存 24 小时后自动删除
2. 每个邮箱最多保留 50 封邮件
3. 建议不要将临时邮箱用于重要账户注册
4. 如遇刷新失败，请检查网络连接或尝试切换域名

## 许可证

MIT License

