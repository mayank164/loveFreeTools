/**
 * Cloudflare Email Worker for logincursor.xyz
 * 
 * 部署说明：
 * 1. 在 Cloudflare Workers 中创建新 Worker
 * 2. 复制此代码到 Worker
 * 3. 在 logincursor.xyz 域名设置中启用 Email Routing
 * 4. 添加 Catch-all 规则，将所有邮件发送到此 Worker
 * 5. 绑定 KV 命名空间：EMAILS_KV
 * 6. 设置环境变量：ADMIN_KEY（管理员密钥，用于域名和捐赠者管理）
 */

// 默认域名列表（首次初始化使用）
const DEFAULT_DOMAINS = [
  { name: 'logincursor.xyz', api: 'https://logincursor.xyz' },
  { name: 'kami666.xyz', api: 'https://kami666.xyz' },
  { name: 'deploytools.site', api: 'https://deploytools.site' },
  { name: 'loginvipcursor.icu', api: 'https://loginvipcursor.icu' },
  { name: 'qxfy.store', api: 'https://qxfy.store' }
];

addEventListener('email', event => {
    event.waitUntil(handleEmail(event));
  });
  
  addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
  });
  
  /**
   * 处理接收到的邮件
   */
  async function handleEmail(event) {
    const message = event.message;
    
    try {
      // 提取邮件信息
      const to = message.to;
      const from = message.from;
      const subject = message.headers.get('subject') || '(无主题)';
      const date = new Date().toISOString();
      
      // 读取原始邮件内容
      const rawEmail = await new Response(message.raw).text();
      
      // 提取纯文本和 HTML 内容
      const { text, html } = await extractEmailContent(rawEmail);
      
      // 构造邮件对象
      const emailData = {
        from,
        to,
        subject,
        date,
        text: text || '',
        html: html || '',
        raw: rawEmail.substring(0, 10000) // 限制大小
      };
      
      // 存储到 KV（按收件人地址）
      const key = `emails:${to}`;
      let emails = [];
      
      try {
        const existing = await EMAILS_KV.get(key, 'json');
        if (existing && Array.isArray(existing)) {
          emails = existing;
        }
      } catch (e) {
        console.error('Failed to get existing emails:', e);
      }
      
      // 添加新邮件（最多保留50封）
      emails.unshift(emailData);
      if (emails.length > 50) {
        emails = emails.slice(0, 50);
      }
      
      // 保存到 KV（24小时过期）
      await EMAILS_KV.put(key, JSON.stringify(emails), {
        expirationTtl: 86400 // 24小时
      });
      
      console.log(`Email stored for ${to}, text length: ${text?.length || 0}, html length: ${html?.length || 0}`);
    } catch (error) {
      console.error('Error handling email:', error);
    }
  }
  
  /**
   * 生成 API 文档 HTML 页面
   */
  function getApiDocumentationHTML(origin) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API 使用说明 - 公益平台</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #00f5d4;
            --primary-dim: #00c4aa;
            --primary-glow: rgba(0, 245, 212, 0.3);
            --secondary: #9b5de5;
            --secondary-dim: #7b3ec5;
            --accent: #f15bb5;
            --bg-dark: #0a0e17;
            --bg-darker: #060912;
            --bg-card: #111827;
            --bg-card-hover: #1a2332;
            --bg-elevated: #1e293b;
            --text-primary: #f1f5f9;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --border: #1e293b;
            --border-glow: rgba(0, 245, 212, 0.2);
            --success: #10b981;
            --warning: #f59e0b;
            --error: #ef4444;
            --font-mono: 'JetBrains Mono', 'Consolas', monospace;
            --font-sans: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: var(--font-sans);
            background: var(--bg-dark);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            padding: 40px 20px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 40px;
        }
        .logo {
            font-size: 48px;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: 10px;
            text-shadow: 0 0 20px var(--primary-glow);
        }
        .subtitle {
            color: var(--text-secondary);
            font-size: 18px;
            margin-top: 10px;
        }
        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            transition: all 0.3s ease;
        }
        .card:hover {
            border-color: var(--primary);
            box-shadow: 0 0 20px var(--primary-glow);
        }
        .card-title {
            font-size: 24px;
            color: var(--primary);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .card-title::before {
            content: '';
            width: 4px;
            height: 24px;
            background: var(--primary);
            border-radius: 2px;
        }
        .endpoint {
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
        }
        .endpoint-method {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            font-family: var(--font-mono);
            margin-right: 10px;
        }
        .method-get { background: var(--success); color: white; }
        .method-post { background: var(--primary); color: var(--bg-dark); }
        .method-delete { background: var(--error); color: white; }
        .endpoint-path {
            font-family: var(--font-mono);
            color: var(--text-primary);
            font-size: 16px;
            margin: 10px 0;
        }
        .endpoint-desc {
            color: var(--text-secondary);
            margin-top: 10px;
            line-height: 1.8;
        }
        .code-block {
            background: var(--bg-darker);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
            overflow-x: auto;
        }
        .code-block code {
            font-family: var(--font-mono);
            font-size: 14px;
            color: var(--text-primary);
            white-space: pre;
        }
        .highlight {
            color: var(--primary);
        }
        .example {
            background: var(--bg-elevated);
            border-left: 3px solid var(--primary);
            padding: 15px 20px;
            margin: 15px 0;
            border-radius: 4px;
        }
        .example-title {
            color: var(--primary);
            font-weight: 600;
            margin-bottom: 10px;
        }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: 4px;
            font-size: 12px;
            color: var(--text-secondary);
            margin-left: 10px;
        }
        .footer {
            text-align: center;
            padding: 40px 20px;
            color: var(--text-muted);
            border-top: 1px solid var(--border);
            margin-top: 60px;
        }
        a {
            color: var(--primary);
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">∞ 公益平台</div>
            <div class="subtitle">API 使用说明文档</div>
            <div class="subtitle" style="font-size: 14px; margin-top: 5px; color: var(--text-muted);">
                当前域名: <span class="highlight">${origin}</span>
            </div>
        </div>

        <div class="card">
            <div class="card-title">服务简介</div>
            <p style="color: var(--text-secondary); line-height: 1.8;">
                公益平台提供免费的临时邮箱服务、GitHub 代理服务、文件加速下载和 Docker 镜像加速服务。所有服务均通过 Cloudflare Workers 部署，
                支持高并发、低延迟访问。邮件数据会在 24 小时后自动删除，确保隐私安全。
            </p>
        </div>

        <div class="card">
            <div class="card-title">邮件 API</div>
            
            <div class="endpoint">
                <span class="endpoint-method method-get">GET</span>
                <span class="endpoint-path">/api/emails/:email</span>
                <div class="endpoint-desc">
                    获取指定邮箱地址的所有邮件列表
                    <div class="example">
                        <div class="example-title">请求示例</div>
                        <code>GET ${origin}/api/emails/test@example.com</code>
                    </div>
                    <div class="example">
                        <div class="example-title">响应格式</div>
                        <code>{
  "email": "test@example.com",
  "emails": [
    {
      "from": "sender@example.com",
      "to": "test@example.com",
      "subject": "邮件主题",
      "date": "2025-12-29T00:00:00.000Z",
      "text": "纯文本内容",
      "html": "HTML 内容"
    }
  ],
  "count": 1
}</code>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">域名管理 API <span class="badge">需要管理员密钥</span></div>
            
            <div class="endpoint">
                <span class="endpoint-method method-get">GET</span>
                <span class="endpoint-path">/api/domains</span>
                <div class="endpoint-desc">
                    获取所有可用的域名列表
                    <div class="example">
                        <div class="example-title">请求示例</div>
                        <code>GET ${origin}/api/domains</code>
                    </div>
                </div>
            </div>

            <div class="endpoint">
                <span class="endpoint-method method-post">POST</span>
                <span class="endpoint-path">/api/domains</span>
                <div class="endpoint-desc">
                    添加新域名（需要管理员密钥）
                    <div class="example">
                        <div class="example-title">请求示例</div>
                        <code>POST ${origin}/api/domains
Headers: {
  "Content-Type": "application/json",
  "X-Admin-Key": "your-admin-key"
}
Body: {
  "name": "example.com",
  "api": "https://example.com"
}</code>
                    </div>
                </div>
            </div>

            <div class="endpoint">
                <span class="endpoint-method method-delete">DELETE</span>
                <span class="endpoint-path">/api/domains/:name</span>
                <div class="endpoint-desc">
                    删除指定域名（需要管理员密钥）
                    <div class="example">
                        <div class="example-title">请求示例</div>
                        <code>DELETE ${origin}/api/domains/example.com
Headers: {
  "X-Admin-Key": "your-admin-key"
}</code>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">捐赠者管理 API <span class="badge">需要管理员密钥</span></div>
            
            <div class="endpoint">
                <span class="endpoint-method method-get">GET</span>
                <span class="endpoint-path">/api/donors</span>
                <div class="endpoint-desc">
                    获取所有捐赠者列表
                </div>
            </div>

            <div class="endpoint">
                <span class="endpoint-method method-post">POST</span>
                <span class="endpoint-path">/api/donors</span>
                <div class="endpoint-desc">
                    添加新捐赠者（需要管理员密钥）
                    <div class="example">
                        <div class="example-title">请求示例</div>
                        <code>POST ${origin}/api/donors
Headers: {
  "Content-Type": "application/json",
  "X-Admin-Key": "your-admin-key"
}
Body: {
  "name": "贡献者名字",
  "domain": "example.com",
  "vip": false
}</code>
                    </div>
                </div>
            </div>

            <div class="endpoint">
                <span class="endpoint-method method-delete">DELETE</span>
                <span class="endpoint-path">/api/donors/:id</span>
                <div class="endpoint-desc">
                    删除指定捐赠者（需要管理员密钥）
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">GitHub 代理服务</div>
            <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
                通过本域名代理访问 GitHub，支持 Git 克隆、下载等操作。自动将 <span class="highlight">github.com</span> 替换为当前域名。
            </p>
            
            <div class="endpoint">
                <span class="endpoint-method method-get">GET</span>
                <span class="endpoint-path">/{user}/{repo}[.git]</span>
                <div class="endpoint-desc">
                    GitHub 仓库代理访问
                    <div class="example">
                        <div class="example-title">使用示例</div>
                        <code># Git 克隆
git clone ${origin}/username/repository.git

# 访问仓库页面
curl ${origin}/username/repository

# 下载文件
curl ${origin}/username/repository/raw/main/file.txt</code>
                    </div>
                    <div style="margin-top: 15px; padding: 15px; background: var(--bg-elevated); border-radius: 6px; border-left: 3px solid var(--warning);">
                        <strong style="color: var(--warning);">⚠️ 限制说明：</strong>
                        <ul style="margin-top: 10px; padding-left: 20px; color: var(--text-secondary);">
                            <li>仅允许 Git/Curl/Wget 等工具访问</li>
                            <li>每 IP 每分钟最多 60 次请求</li>
                            <li>禁止访问登录、设置等敏感路径</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">文件加速下载</div>
            <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
                通过 Cloudflare 加速下载各类文件，支持 GitHub Releases、npm、PyPI 等任意 HTTPS 文件，无大小限制。
            </p>
            
            <div class="endpoint">
                <span class="endpoint-method method-get">GET</span>
                <span class="endpoint-path">/proxy/?url={文件URL}</span>
                <div class="endpoint-desc">
                    代理下载指定 URL 的文件
                    <div class="example">
                        <div class="example-title">使用示例</div>
                        <code># 加速下载 GitHub Release 文件
${origin}/proxy/?url=https://github.com/ollama/ollama/releases/download/v0.13.5/ollama-linux-arm64.tgz

# 加速下载 npm 包
${origin}/proxy/?url=https://registry.npmjs.org/package/-/package-1.0.0.tgz

# 加速下载任意 HTTPS 文件
${origin}/proxy/?url=https://example.com/file.zip</code>
                    </div>
                    <div style="margin-top: 15px; padding: 15px; background: var(--bg-elevated); border-radius: 6px; border-left: 3px solid var(--success);">
                        <strong style="color: var(--success);">功能特性：</strong>
                        <ul style="margin-top: 10px; padding-left: 20px; color: var(--text-secondary);">
                            <li>支持断点续传（Range 请求）</li>
                            <li>无文件大小限制</li>
                            <li>自动跟随重定向</li>
                            <li>保留原始文件名</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">Docker 镜像加速</div>
            <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
                通过 Cloudflare 加速 Docker 镜像拉取，支持 Docker Hub 等 Registry，提升国内镜像下载速度。
            </p>
            
            <div class="endpoint">
                <span class="endpoint-method method-get">GET</span>
                <span class="endpoint-path">/v2/...</span>
                <div class="endpoint-desc">
                    Docker Registry API v2 代理
                    <div class="example">
                        <div class="example-title">使用方式</div>
                        <code># 配置 Docker daemon.json
{
  "registry-mirrors": [
    "https://logincursor.xyz"
  ]
}

# 或使用环境变量
export DOCKER_REGISTRY_MIRROR=https://logincursor.xyz

# 拉取镜像（自动使用加速）
docker pull nginx:latest

# 直接使用加速地址
docker pull logincursor.xyz/library/nginx:latest</code>
                    </div>
                    <div style="margin-top: 15px; padding: 15px; background: var(--bg-elevated); border-radius: 6px; border-left: 3px solid var(--primary);">
                        <strong style="color: var(--primary);">功能特性：</strong>
                        <ul style="margin-top: 10px; padding-left: 20px; color: var(--text-secondary);">
                            <li>支持 Docker Registry API v2</li>
                            <li>自动代理到 Docker Hub</li>
                            <li>支持镜像拉取、推送、查询</li>
                            <li>支持认证和私有镜像</li>
                            <li>支持分片下载（blob）</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">CORS 支持</div>
            <p style="color: var(--text-secondary); line-height: 1.8;">
                所有 API 接口均支持跨域访问（CORS），允许从任何域名调用。响应头包含：
            </p>
            <div class="code-block">
                <code>Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Admin-Key</code>
            </div>
        </div>

        <div class="footer">
            <p>Powered by <span class="highlight">VioletTeam</span></p>
            <p style="margin-top: 10px; font-size: 14px;">公益平台 - 免费公益服务</p>
        </div>
    </div>
</body>
</html>`;
  }
  
  /**
   * 处理 HTTP 请求
   */
  async function handleRequest(request) {
    const url = new URL(request.url);
    
    // CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    };
    
    // 处理 OPTIONS 请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 辅助函数：返回 JSON 响应
    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    };

    // 辅助函数：验证管理员密钥
    const verifyAdmin = (request) => {
      const adminKey = request.headers.get('X-Admin-Key');
      // 如果没有设置 ADMIN_KEY 环境变量，则允许所有请求（方便测试）
      if (typeof ADMIN_KEY === 'undefined' || !ADMIN_KEY) {
        return true;
      }
      return adminKey === ADMIN_KEY;
    };

    // ==================== 域名 API ====================
    
    // GET /api/domains - 获取域名列表
    if (url.pathname === '/api/domains' && request.method === 'GET') {
      try {
        let domains = await EMAILS_KV.get('config:domains', 'json');
        if (!domains || !Array.isArray(domains) || domains.length === 0) {
          domains = DEFAULT_DOMAINS;
          // 首次访问时初始化默认域名
          await EMAILS_KV.put('config:domains', JSON.stringify(domains));
        }
        return jsonResponse({ success: true, domains });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // POST /api/domains - 添加域名
    if (url.pathname === '/api/domains' && request.method === 'POST') {
      if (!verifyAdmin(request)) {
        return jsonResponse({ success: false, error: '未授权' }, 401);
      }
      try {
        const body = await request.json();
        const { name, api } = body;
        if (!name || !api) {
          return jsonResponse({ success: false, error: '缺少 name 或 api 参数' }, 400);
        }

        let domains = await EMAILS_KV.get('config:domains', 'json') || DEFAULT_DOMAINS;
        
        // 检查是否已存在
        if (domains.find(d => d.name === name)) {
          return jsonResponse({ success: false, error: '域名已存在' }, 400);
        }

        domains.push({ name, api });
        await EMAILS_KV.put('config:domains', JSON.stringify(domains));
        
        return jsonResponse({ success: true, domains });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // DELETE /api/domains/:name - 删除域名
    const domainDeleteMatch = url.pathname.match(/^\/api\/domains\/(.+)$/);
    if (domainDeleteMatch && request.method === 'DELETE') {
      if (!verifyAdmin(request)) {
        return jsonResponse({ success: false, error: '未授权' }, 401);
      }
      try {
        const domainName = decodeURIComponent(domainDeleteMatch[1]);
        let domains = await EMAILS_KV.get('config:domains', 'json') || DEFAULT_DOMAINS;
        
        const newDomains = domains.filter(d => d.name !== domainName);
        if (newDomains.length === domains.length) {
          return jsonResponse({ success: false, error: '域名不存在' }, 404);
        }

        await EMAILS_KV.put('config:domains', JSON.stringify(newDomains));
        return jsonResponse({ success: true, domains: newDomains });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // ==================== 捐赠者 API ====================
    
    // GET /api/donors - 获取捐赠者列表
    if (url.pathname === '/api/donors' && request.method === 'GET') {
      try {
        const donors = await EMAILS_KV.get('config:donors', 'json') || [];
        return jsonResponse({ success: true, donors });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // POST /api/donors - 添加捐赠者
    if (url.pathname === '/api/donors' && request.method === 'POST') {
      if (!verifyAdmin(request)) {
        return jsonResponse({ success: false, error: '未授权' }, 401);
      }
      try {
        const body = await request.json();
        const { name, domain, vip } = body;
        if (!name || !domain) {
          return jsonResponse({ success: false, error: '缺少 name 或 domain 参数' }, 400);
        }

        let donors = await EMAILS_KV.get('config:donors', 'json') || [];
        
        // 去重检查（名字+域名组合）
        if (donors.find(d => d.name === name && d.domain === domain)) {
          return jsonResponse({ success: false, error: '该捐赠记录已存在' }, 400);
        }

        const newDonor = {
          id: Date.now().toString(),
          name,
          domain,
          vip: vip || false,
          createdAt: new Date().toISOString()
        };

        donors.push(newDonor);
        await EMAILS_KV.put('config:donors', JSON.stringify(donors));
        
        return jsonResponse({ success: true, donors });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // DELETE /api/donors/:id - 删除捐赠者
    const donorDeleteMatch = url.pathname.match(/^\/api\/donors\/(.+)$/);
    if (donorDeleteMatch && request.method === 'DELETE') {
      if (!verifyAdmin(request)) {
        return jsonResponse({ success: false, error: '未授权' }, 401);
      }
      try {
        const donorId = decodeURIComponent(donorDeleteMatch[1]);
        let donors = await EMAILS_KV.get('config:donors', 'json') || [];
        
        const newDonors = donors.filter(d => d.id !== donorId);
        if (newDonors.length === donors.length) {
          return jsonResponse({ success: false, error: '捐赠者不存在' }, 404);
        }

        await EMAILS_KV.put('config:donors', JSON.stringify(newDonors));
        return jsonResponse({ success: true, donors: newDonors });
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // ==================== 邮件 API ====================
    
    // GET /api/emails/:email - 获取邮件列表
    const emailMatch = url.pathname.match(/^\/api\/emails\/(.+)$/);
    if (emailMatch && request.method === 'GET') {
      const email = decodeURIComponent(emailMatch[1]);
      
      try {
        const key = `emails:${email}`;
        const emails = await EMAILS_KV.get(key, 'json');
        
        return jsonResponse({
          email,
          emails: emails || [],
          count: emails ? emails.length : 0
        });
      } catch (error) {
        return jsonResponse({ error: '获取邮件失败', message: error.message }, 500);
      }
    }
    
    // ==================== GitHub 代理 ====================
    // 格式: https://域名/user/repo.git 或 https://域名/user/repo/...
    // 代理到: https://github.com/user/repo.git 或 https://github.com/user/repo/...
    
    // 根路径返回 HTML API 文档页面
    if (url.pathname === '/') {
      return new Response(getApiDocumentationHTML(url.origin), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

  // 文件加速代理
  if (url.pathname === '/proxy/' || url.pathname === '/proxy') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return jsonResponse({
        error: '缺少 url 参数',
        usage: url.origin + '/proxy/?url=https://example.com/file.zip'
      }, 400);
    }
    return handleFileProxy(targetUrl, request);
  }

  // Docker Registry 代理 (v2 API)
  if (url.pathname.startsWith('/v2/')) {
    return handleDockerProxy(request, url);
  }

  // 排除 API 路径、文件代理路径和 Docker 路径，其他路径代理到 GitHub
  if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/proxy') && !url.pathname.startsWith('/v2/') && url.pathname.length > 1) {
      return handleGitHubProxy(request, url);
    }

    // 默认响应（不应该到达这里，但保留作为后备）
    return jsonResponse({
      service: '公益平台 - 免费公益服务',
      status: 'running',
      features: ['临时邮箱', 'GitHub 代理', '文件加速下载', 'Docker 加速'],
      endpoints: [
        'GET /api/domains',
        'POST /api/domains',
        'DELETE /api/domains/:name',
        'GET /api/donors',
        'POST /api/donors',
        'DELETE /api/donors/:id',
        'GET /api/emails/:email',
        'GET /{user}/{repo}[.git] - GitHub 代理',
        'GET /v2/... - Docker Registry 代理'
      ]
    });
  }

  // ==================== GitHub 代理防护配置 ====================
  const GITHUB_PROXY_CONFIG = {
    // 频率限制：每 IP 每分钟最大请求数
    rateLimit: 60,
    rateLimitWindow: 60, // 秒
    
    // User-Agent 白名单（允许的客户端）
    allowedUserAgents: [
      'git/',           // Git 客户端
      'curl/',          // curl
      'wget/',          // wget
      'libcurl/',       // libcurl
      'Go-http-client', // Go HTTP 客户端
      'python-requests',// Python requests
      'axios/',         // Axios
      'node-fetch',     // Node fetch
      'Mozilla/',       // 浏览器（用于查看仓库页面）
    ],
    
    // 路径黑名单（禁止代理的路径）
    blockedPaths: [
      '/login',
      '/logout', 
      '/signup',
      '/join',
      '/sessions',
      '/settings',
      '/password_reset',
      '/users/',
      '/orgs/',
      '/.git/config',   // 防止泄露配置
    ],
    
    // 禁止的文件扩展名（防止滥用下载大文件）
    blockedExtensions: [
      '.zip',
      '.tar.gz',
      '.tgz',
      '.exe',
      '.dmg',
      '.pkg',
      '.deb',
      '.rpm',
      '.msi',
      '.iso',
    ],
    
    // 最大允许的单个文件大小 (字节)，0 表示不限制
    maxFileSize: 0,
  };

  /**
   * 检查频率限制
   * 使用 KV 存储计数器
   */
  async function checkRateLimit(ip) {
    const key = `ratelimit:github:${ip}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - GITHUB_PROXY_CONFIG.rateLimitWindow;
    
    try {
      let data = await EMAILS_KV.get(key, 'json');
      
      if (!data) {
        data = { count: 0, timestamps: [] };
      }
      
      // 清理过期的时间戳
      data.timestamps = data.timestamps.filter(t => t > windowStart);
      
      // 检查是否超过限制
      if (data.timestamps.length >= GITHUB_PROXY_CONFIG.rateLimit) {
        return false; // 超过限制
      }
      
      // 添加新的时间戳
      data.timestamps.push(now);
      data.count = data.timestamps.length;
      
      // 保存到 KV（设置 TTL 为窗口时间的 2 倍）
      await EMAILS_KV.put(key, JSON.stringify(data), {
        expirationTtl: GITHUB_PROXY_CONFIG.rateLimitWindow * 2
      });
      
      return true; // 允许请求
    } catch (e) {
      console.error('Rate limit check error:', e);
      return true; // 出错时放行
    }
  }

  /**
   * 检查 User-Agent 是否在白名单中
   */
  function isAllowedUserAgent(userAgent) {
    if (!userAgent) return false;
    return GITHUB_PROXY_CONFIG.allowedUserAgents.some(ua => 
      userAgent.toLowerCase().includes(ua.toLowerCase())
    );
  }

  /**
   * 检查路径是否被禁止
   */
  function isBlockedPath(pathname) {
    const lowerPath = pathname.toLowerCase();
    
    // 检查路径黑名单
    if (GITHUB_PROXY_CONFIG.blockedPaths.some(p => lowerPath.includes(p.toLowerCase()))) {
      return true;
    }
    
    // 检查文件扩展名黑名单
    if (GITHUB_PROXY_CONFIG.blockedExtensions.some(ext => lowerPath.endsWith(ext.toLowerCase()))) {
      return true;
    }
    
    return false;
  }

  /**
   * 获取客户端 IP
   */
  function getClientIP(request) {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Real-IP') || 
           request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
           '0.0.0.0';
  }

  // ==================== 文件加速代理 ====================
  const FILE_PROXY_CONFIG = {
    allowedProtocols: ['https:', 'http:'],
    blockedDomains: ['localhost', '127.0.0.1', '0.0.0.0', '::1'],
    timeout: 300000 // 5分钟超时
  };

  async function handleFileProxy(targetUrl, request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };
    
    const errorResponse = (message, status) => {
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: corsHeaders
      });
    };
    
    try {
      // URL 验证
      let parsedUrl;
      try {
        parsedUrl = new URL(targetUrl);
      } catch {
        return errorResponse('无效的 URL', 400);
      }
      
      // 协议检查
      if (!FILE_PROXY_CONFIG.allowedProtocols.includes(parsedUrl.protocol)) {
        return errorResponse('仅支持 HTTP/HTTPS 协议', 400);
      }
      
      // 域名检查
      if (FILE_PROXY_CONFIG.blockedDomains.some(d => parsedUrl.hostname.includes(d))) {
        return errorResponse('禁止访问的域名', 403);
      }
      
      // 代理请求
      const headers = new Headers();
      headers.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0');
      
      // 支持 Range 请求（断点续传）
      const range = request.headers.get('Range');
      if (range) {
        headers.set('Range', range);
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FILE_PROXY_CONFIG.timeout);
      
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: headers,
        redirect: 'follow',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // 构建响应头
      const responseHeaders = new Headers();
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Expose-Headers', '*');
      
      // 传递重要的响应头
      const headersToPass = ['Content-Type', 'Content-Length', 'Content-Disposition', 'Accept-Ranges', 'Content-Range', 'ETag', 'Last-Modified'];
      headersToPass.forEach(h => {
        const value = response.headers.get(h);
        if (value) responseHeaders.set(h, value);
      });
      
      // 如果没有 Content-Disposition，尝试从 URL 提取文件名
      if (!responseHeaders.get('Content-Disposition')) {
        const filename = parsedUrl.pathname.split('/').pop();
        if (filename && filename.includes('.')) {
          responseHeaders.set('Content-Disposition', 'attachment; filename="' + filename + '"');
        }
      }
      
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });
      
    } catch (error) {
      if (error.name === 'AbortError') {
        return errorResponse('请求超时', 504);
      }
      return errorResponse('代理请求失败: ' + error.message, 502);
    }
  }

  /**
   * 处理 Docker Registry 代理请求
   * 将 https://域名/v2/... 代理到 https://registry-1.docker.io/v2/...
   */
  /**
   * 处理 Docker Registry 代理请求
   * 参考: https://github.com/ciiiii/cloudflare-docker-proxy
   */
  async function handleDockerProxy(request, url) {
    const dockerHub = 'https://registry-1.docker.io';
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
      'Access-Control-Expose-Headers': 'Docker-Content-Digest, Content-Length, Content-Range, WWW-Authenticate'
    };

    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const authorization = request.headers.get('Authorization');

      // 处理 /v2/ 根路径 - 检查认证
      if (url.pathname === '/v2/' || url.pathname === '/v2') {
        const resp = await fetch(dockerHub + '/v2/', {
          method: 'GET',
          headers: authorization ? { 'Authorization': authorization } : {},
          redirect: 'follow'
        });
        
        if (resp.status === 401) {
          return dockerUnauthorizedResponse(url);
        }
        return new Response(resp.body, {
          status: resp.status,
          headers: { ...corsHeaders, ...Object.fromEntries(resp.headers) }
        });
      }

      // 处理 /v2/auth - 代理获取令牌请求
      if (url.pathname === '/v2/auth') {
        const resp = await fetch(dockerHub + '/v2/', {
          method: 'GET',
          redirect: 'follow'
        });
        
        if (resp.status !== 401) {
          return new Response(resp.body, { status: resp.status, headers: corsHeaders });
        }
        
        const authenticateStr = resp.headers.get('WWW-Authenticate');
        if (!authenticateStr) {
          return new Response(resp.body, { status: resp.status, headers: corsHeaders });
        }
        
        const wwwAuthenticate = parseDockerAuthenticate(authenticateStr);
        let scope = url.searchParams.get('scope');
        
        // 自动补全 library 前缀
        if (scope) {
          const scopeParts = scope.split(':');
          if (scopeParts.length === 3 && !scopeParts[1].includes('/')) {
            scopeParts[1] = 'library/' + scopeParts[1];
            scope = scopeParts.join(':');
          }
        }
        
        return await fetchDockerToken(wwwAuthenticate, scope, authorization);
      }

      // 自动补全 library 前缀
      const pathParts = url.pathname.split('/');
      if (pathParts.length === 5 && pathParts[1] === 'v2') {
        pathParts.splice(2, 0, 'library');
        const redirectUrl = new URL(url);
        redirectUrl.pathname = pathParts.join('/');
        return Response.redirect(redirectUrl.toString(), 301);
      }

      // 转发请求到 Docker Hub
      const targetUrl = dockerHub + url.pathname + url.search;
      
      // 构建请求头，确保 Authorization 被正确转发
      const forwardHeaders = new Headers();
      for (const [key, value] of request.headers) {
        if (!['host', 'cf-connecting-ip', 'cf-ray', 'cf-visitor', 'cf-ipcountry'].includes(key.toLowerCase())) {
          forwardHeaders.set(key, value);
        }
      }
      
      const resp = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
        redirect: 'manual'
      });
      
      if (resp.status === 401) {
        return dockerUnauthorizedResponse(url);
      }
      
      // 处理 307 重定向 (blob 下载)
      if (resp.status === 307) {
        const location = resp.headers.get('Location');
        if (location) {
          const redirectResp = await fetch(location, {
            method: 'GET',
            redirect: 'follow'
          });
          const responseHeaders = new Headers(corsHeaders);
          for (const [key, value] of redirectResp.headers) {
            responseHeaders.set(key, value);
          }
          return new Response(redirectResp.body, {
            status: redirectResp.status,
            headers: responseHeaders
          });
        }
      }

      const responseHeaders = new Headers(corsHeaders);
      for (const [key, value] of resp.headers) {
        responseHeaders.set(key, value);
      }
      
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: responseHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Docker 代理失败', 
        message: error.message 
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  function parseDockerAuthenticate(authenticateStr) {
    // 格式: Bearer realm="https://auth.docker.io/token",service="registry.docker.io"
    const realmMatch = authenticateStr.match(/realm="([^"]+)"/);
    const serviceMatch = authenticateStr.match(/service="([^"]+)"/);
    
    return {
      realm: realmMatch ? realmMatch[1] : 'https://auth.docker.io/token',
      service: serviceMatch ? serviceMatch[1] : 'registry.docker.io'
    };
  }

  async function fetchDockerToken(wwwAuthenticate, scope, authorization) {
    const tokenUrl = new URL(wwwAuthenticate.realm);
    if (wwwAuthenticate.service) {
      tokenUrl.searchParams.set('service', wwwAuthenticate.service);
    }
    if (scope) {
      tokenUrl.searchParams.set('scope', scope);
    }
    
    const headers = new Headers();
    if (authorization) {
      headers.set('Authorization', authorization);
    }
    
    const resp = await fetch(tokenUrl.toString(), { method: 'GET', headers });
    
    return new Response(resp.body, {
      status: resp.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    });
  }

  function dockerUnauthorizedResponse(url) {
    return new Response(JSON.stringify({ message: 'UNAUTHORIZED' }), {
      status: 401,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'WWW-Authenticate': `Bearer realm="https://${url.hostname}/v2/auth",service="cloudflare-docker-proxy"`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * 处理 GitHub 代理请求
   * 将 https://域名/user/repo 代理到 https://github.com/user/repo
   */
  async function handleGitHubProxy(request, url) {
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('User-Agent') || '';
    
    // 1. 检查 User-Agent 白名单
    if (!isAllowedUserAgent(userAgent)) {
      return new Response(JSON.stringify({ 
        error: '禁止访问', 
        message: '不支持的客户端类型',
        hint: '请使用 git/curl/wget 等工具访问'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // 2. 检查路径黑名单
    if (isBlockedPath(url.pathname)) {
      return new Response(JSON.stringify({ 
        error: '禁止访问', 
        message: '该路径不允许代理'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    // 3. 检查频率限制
    const withinLimit = await checkRateLimit(clientIP);
    if (!withinLimit) {
      return new Response(JSON.stringify({ 
        error: '请求过于频繁', 
        message: `每分钟最多 ${GITHUB_PROXY_CONFIG.rateLimit} 次请求`,
        retryAfter: GITHUB_PROXY_CONFIG.rateLimitWindow
      }), {
        status: 429,
        headers: { 
          'Content-Type': 'application/json', 
          'Access-Control-Allow-Origin': '*',
          'Retry-After': String(GITHUB_PROXY_CONFIG.rateLimitWindow)
        }
      });
    }
    
    // 构造 GitHub URL
    const githubUrl = `https://github.com${url.pathname}${url.search}`;
    
    // 复制原始请求的 headers，但移除 host
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set('User-Agent', userAgent || 'git/2.40.0');
    
    try {
      const response = await fetch(githubUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
        redirect: 'follow'
      });
      
      // 复制响应 headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', '*');
      
      // 添加速率限制信息到响应头
      responseHeaders.set('X-RateLimit-Limit', String(GITHUB_PROXY_CONFIG.rateLimit));
      responseHeaders.set('X-RateLimit-Window', `${GITHUB_PROXY_CONFIG.rateLimitWindow}s`);
      
      // 处理重定向：将 github.com 替换为当前域名
      const location = responseHeaders.get('Location');
      if (location && location.includes('github.com')) {
        const newLocation = location.replace('https://github.com', url.origin);
        responseHeaders.set('Location', newLocation);
      }
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'GitHub 代理失败', 
        message: error.message,
        url: githubUrl
      }), {
        status: 502,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  /**
   * 从原始邮件中提取文本和 HTML 内容
   */
  async function extractEmailContent(rawEmail) {
    let text = '';
    let html = '';
    
    try {
      const lines = rawEmail.split('\n');
      let inBody = false;
      let currentContentType = '';
      let currentEncoding = '';
      let currentCharset = 'utf-8';
      let contentBuffer = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 检测 Content-Type 和 charset
        if (line.match(/^Content-Type:\s*text\/(plain|html)/i)) {
          const typeMatch = line.match(/text\/(plain|html)/i);
          currentContentType = typeMatch ? typeMatch[1].toLowerCase() : '';
          
          // 提取 charset
          const charsetMatch = line.match(/charset[=\s]*["']?([^"'\s;]+)/i);
          if (charsetMatch) {
            currentCharset = charsetMatch[1].toLowerCase();
          }
          continue;
        }
        
        // 检测编码方式
        if (line.match(/^Content-Transfer-Encoding:\s*(.+)/i)) {
          const match = line.match(/Content-Transfer-Encoding:\s*(.+)/i);
          currentEncoding = match ? match[1].trim().toLowerCase() : '';
          continue;
        }
        
        // 空行表示正文开始
        if (!inBody && line === '' && currentContentType) {
          inBody = true;
          continue;
        }
        
        // 读取正文内容
        if (inBody) {
          // MIME 边界表示内容结束
          if (line.startsWith('--')) {
            // 处理收集到的内容
            if (contentBuffer.length > 0) {
              let content = decodeContent(contentBuffer.join('\n'), currentEncoding, currentCharset);
              
              // 根据类型存储
              if (currentContentType === 'plain') {
                text = content;
              } else if (currentContentType === 'html') {
                html = content;
              }
              
              contentBuffer = [];
            }
            
            inBody = false;
            currentContentType = '';
            currentEncoding = '';
            currentCharset = 'utf-8';
            continue;
          }
          
          // 跳过 Content- 开头的行
          if (line.match(/^Content-/i)) continue;
          
          contentBuffer.push(line);
        }
      }
      
      // 处理剩余内容
      if (contentBuffer.length > 0) {
        let content = decodeContent(contentBuffer.join('\n'), currentEncoding, currentCharset);
        
        if (currentContentType === 'plain') {
          text = content;
        } else if (currentContentType === 'html') {
          html = content;
        }
      }
      
    } catch (error) {
      console.error('Extract email content error:', error);
    }
    
    return { text, html };
  }
  
  /**
   * 解码邮件内容
   */
  function decodeContent(content, encoding, charset) {
    try {
      charset = charset || 'utf-8';
      
      // 先根据 Transfer-Encoding 解码
      if (encoding === 'base64') {
        // Base64 解码
        const cleaned = content.replace(/\s/g, '');
        const binaryString = atob(cleaned);
        
        // 转换为 Uint8Array
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // 使用 TextDecoder 解码
        const decoder = new TextDecoder(charset);
        content = decoder.decode(bytes);
        
      } else if (encoding === 'quoted-printable') {
        // Quoted-Printable 解码，传入 charset
        content = decodeQuotedPrintable(content, charset);
      }
      
      return content;
    } catch (e) {
      console.error('Decode content error:', e);
      return content;
    }
  }
  
  /**
   * 解码 Quoted-Printable 编码
   */
  function decodeQuotedPrintable(str, charset = 'utf-8') {
    try {
      // 移除软换行
      str = str.replace(/=\r?\n/g, '');
      
      // 将 =XX 转换为字节数组
      const bytes = [];
      let i = 0;
      while (i < str.length) {
        if (str[i] === '=' && i + 2 < str.length) {
          const hex = str.substr(i + 1, 2);
          if (/^[0-9A-F]{2}$/i.test(hex)) {
            bytes.push(parseInt(hex, 16));
            i += 3;
          } else {
            bytes.push(str.charCodeAt(i));
            i++;
          }
        } else {
          bytes.push(str.charCodeAt(i));
          i++;
        }
      }
      
      // 使用 TextDecoder 正确解码 UTF-8
      const uint8Array = new Uint8Array(bytes);
      const decoder = new TextDecoder(charset);
      return decoder.decode(uint8Array);
    } catch (e) {
      console.error('Decode quoted-printable error:', e);
      return str;
    }
  }
  
  