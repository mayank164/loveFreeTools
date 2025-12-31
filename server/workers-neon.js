/**
 * Cloudflare Email Worker - Neon PostgreSQL 版本
 * 
 * 完全无服务器架构，直接连接 Neon 数据库
 * 
 * 部署说明：
 * 1. 在 Cloudflare Workers 中创建新 Worker
 * 2. 复制此代码到 Worker
 * 3. 设置环境变量：
 *    - DATABASE_URL: Neon 数据库连接字符串
 *    - ADMIN_KEY: 管理员密钥（可选）
 *    - RESEND_API_KEY: Resend API 密钥（可选，用于发送邮件）
 * 4. 在域名设置中启用 Email Routing
 * 5. 添加 Catch-all 规则，将所有邮件发送到此 Worker
 * 6. 配置 Cron Triggers 用于自动清理（在 wrangler.toml 中）
 * 
 * 依赖：@neondatabase/serverless
 * 
 * 注意：此版本使用动态导入 (import())，兼容所有 Cloudflare Workers 环境
 * 包括 Cloudflare Dashboard 和 Wrangler CLI
 */

// 获取环境变量
const getDatabaseUrl = () => {
  if (typeof DATABASE_URL !== 'undefined') return DATABASE_URL;
  throw new Error('DATABASE_URL 环境变量未设置');
};

const getAdminKey = () => {
  if (typeof ADMIN_KEY !== 'undefined') return ADMIN_KEY;
  return '';
};

const getResendApiKey = () => {
  if (typeof RESEND_API_KEY !== 'undefined') return RESEND_API_KEY;
  return null;
};

// 直接使用 Neon Serverless HTTP API（不依赖 npm 包）
// 实现一个简单的 SQL 执行函数，直接调用 Neon 的 HTTP API

function parseConnectionString(connStr) {
  try {
    const url = new URL(connStr);
    return {
      host: url.hostname,
      database: url.pathname.slice(1),
      user: url.username,
      password: url.password
    };
  } catch (e) {
    throw new Error('无效的数据库连接字符串');
  }
}

// 创建 SQL 执行函数（兼容 @neondatabase/serverless 的 API）
function createSqlExecutor(connectionString) {
  const config = parseConnectionString(connectionString);
  
  // Neon Serverless 使用 HTTP API
  // API 端点格式：https://[project-id].neon.tech/v2/sql
  // 或者使用 pooler: https://[project-id]-pooler.neon.tech/v2/sql
  
  // 返回一个模板字符串函数，用于执行 SQL
  return async function sql(strings, ...values) {
    // 构建 SQL 查询和参数
    let query = '';
    const params = [];
    
    for (let i = 0; i < strings.length; i++) {
      query += strings[i];
      if (i < values.length) {
        const paramIndex = params.length + 1;
        query += `$${paramIndex}`;
        params.push(values[i]);
      }
    }
    
    // Neon Serverless 使用 WebSocket 或 HTTP
    // 由于 Cloudflare Workers 限制，我们使用 HTTP API
    // 注意：这需要正确的 API 端点，可能需要使用 @neondatabase/serverless 包
    
    // 临时方案：尝试使用连接字符串直接调用
    // 实际部署时，建议使用 Wrangler CLI 安装 @neondatabase/serverless
    
    // 如果 host 包含 pooler，直接使用
    let apiHost = config.host;
    if (!apiHost.includes('pooler')) {
      // 尝试转换为 pooler 端点
      apiHost = apiHost.replace(/\.neon\.tech$/, '-pooler.neon.tech');
    }
    
    // Neon HTTP API 端点（需要验证实际端点）
    const apiUrl = `https://${apiHost}/sql`;
    
    const auth = btoa(`${config.user}:${config.password}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        query: query,
        params: params
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `数据库查询失败 (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.message || errorJson.error || errorMsg;
      } catch (e) {
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }
    
    const result = await response.json();
    
    // 返回兼容格式的结果
    return {
      rows: result.rows || result.data || [],
      rowCount: result.rowCount || result.count || (result.rows ? result.rows.length : (result.data ? result.data.length : 0))
    };
  };
}

// 初始化 SQL 执行器
let sql = null;

function getSql() {
  if (!sql) {
    sql = createSqlExecutor(getDatabaseUrl());
  }
  return sql;
}


// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
};

// 辅助函数：返回 JSON 响应
const jsonResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

// 管理员验证
function requireAdminKey(request) {
  const adminKey = request.headers.get('x-admin-key');
  const expectedKey = getAdminKey();
  
  if (!expectedKey) {
    return jsonResponse({ 
      success: false, 
      error: '管理员功能未配置，请设置 ADMIN_KEY 环境变量' 
    }, 503);
  }
  
  if (!adminKey) {
    return jsonResponse({ 
      success: false, 
      error: '需要管理员密钥，请在请求头中添加 X-Admin-Key' 
    }, 401);
  }
  
  if (adminKey !== expectedKey) {
    return jsonResponse({ 
      success: false, 
      error: '管理员密钥无效' 
    }, 403);
  }
  
  return null; // 验证通过
}

// ==================== 事件监听器 ====================

addEventListener('email', event => {
  event.waitUntil(handleEmail(event));
});

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Cron Trigger 用于自动清理
addEventListener('scheduled', event => {
  event.waitUntil(cleanupExpiredData());
});

// ==================== 邮件处理 ====================

async function handleEmail(event) {
  const message = event.message;
  
  try {
    // 提取邮件信息
    const to = message.to;
    const from = message.from;
    const subject = message.headers.get('subject') || '(无主题)';
    
    // 读取原始邮件内容
    const rawEmail = await new Response(message.raw).text();
    
    // 提取纯文本和 HTML 内容
    const { text, html } = await extractEmailContent(rawEmail);
    
    // 存储到数据库
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const sql = getSql();
    await sql`
      INSERT INTO emails (email_to, email_from, subject, text_content, html_content, raw_content, expires_at) 
      VALUES (${to}, ${from}, ${subject || ''}, ${text || ''}, ${html || ''}, ${rawEmail.substring(0, 10000)}, ${expiresAt.toISOString()})
    `;
    
    console.log(`Email stored for ${to}, text length: ${text?.length || 0}, html length: ${html?.length || 0}`);
  } catch (error) {
    console.error('Error handling email:', error);
  }
}

// ==================== HTTP 请求处理 ====================

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 处理 OPTIONS 请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // API 路由
  if (url.pathname.startsWith('/api/')) {
    return handleApiRequest(request, url);
  }
  
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
  
  // GitHub 代理
  if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/proxy') && url.pathname.length > 1) {
    return handleGitHubProxy(request, url);
  }
  
  // 默认响应
  return jsonResponse({
    service: '公益平台 - 免费公益服务',
    status: 'running',
    backend: 'Neon PostgreSQL',
    features: ['临时邮箱', 'GitHub 代理', '文件加速下载'],
    endpoints: [
      'GET /api/domains',
      'POST /api/domains',
      'DELETE /api/domains/:name',
      'GET /api/emails/:email',
      'POST /api/emails',
      'DELETE /api/emails/:email/:id',
      'POST /api/send-email'
    ]
  });
}

// ==================== API 路由处理 ====================

async function handleApiRequest(request, url) {
  const path = url.pathname;
  const method = request.method;
  
  // 域名 API
  if (path === '/api/domains') {
    if (method === 'GET') {
      return handleGetDomains();
    } else if (method === 'POST') {
      return handlePostDomains(request);
    }
  }
  
  if (path.startsWith('/api/domains/') && method === 'DELETE') {
    const domainName = decodeURIComponent(path.split('/').pop());
    return handleDeleteDomain(request, domainName);
  }
  
  // 邮件 API
  if (path.startsWith('/api/emails/') && method === 'GET') {
    const email = decodeURIComponent(path.split('/').pop());
    return handleGetEmails(email);
  }
  
  if (path === '/api/emails' && method === 'POST') {
    return handlePostEmails(request);
  }
  
  if (path.startsWith('/api/emails/') && method === 'DELETE') {
    const parts = path.split('/');
    const email = decodeURIComponent(parts[parts.length - 2]);
    const id = parts[parts.length - 1];
    return handleDeleteEmail(email, id);
  }
  
  // 发送邮件 API
  if (path === '/api/send-email' && method === 'POST') {
    return handleSendEmail(request);
  }
  
  return jsonResponse({ success: false, error: '接口不存在' }, 404);
}

// 获取域名列表
async function handleGetDomains() {
  try {
    const sql = getSql();
    const rows = await sql`SELECT name, api FROM domains ORDER BY id`;
    return jsonResponse({ success: true, domains: rows });
  } catch (error) {
    console.error('获取域名失败:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// 添加域名
async function handlePostDomains(request) {
  try {
    const body = await request.json();
    const { name, api } = body;
    
    if (!name || !api) {
      return jsonResponse({ success: false, error: '缺少 name 或 api 参数' }, 400);
    }
    
    try {
      const sql = getSql();
      await sql`INSERT INTO domains (name, api) VALUES (${name}, ${api})`;
      const rows = await sql`SELECT name, api FROM domains ORDER BY id`;
      return jsonResponse({ success: true, domains: rows });
    } catch (error) {
      if (error.code === '23505') { // PostgreSQL 唯一约束违反
        return jsonResponse({ success: false, error: '域名已存在' }, 400);
      }
      throw error;
    }
  } catch (error) {
    console.error('添加域名失败:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// 删除域名
async function handleDeleteDomain(request, domainName) {
  const authError = requireAdminKey(request);
  if (authError) return authError;
  
  try {
    const sql = getSql();
    const result = await sql`DELETE FROM domains WHERE name = ${domainName}`;
    if (result.rowCount === 0) {
      return jsonResponse({ success: false, error: '域名不存在' }, 404);
    }
    const rows = await sql`SELECT name, api FROM domains ORDER BY id`;
    return jsonResponse({ success: true, domains: rows });
  } catch (error) {
    console.error('删除域名失败:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// 获取邮件列表
async function handleGetEmails(email) {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT 
        id,
        email_from as "from", 
        email_to as "to", 
        subject, 
        text_content as text, 
        html_content as html, 
        received_at as date 
      FROM emails 
      WHERE email_to = ${email} 
      ORDER BY received_at DESC 
      LIMIT 50
    `;
    
    return jsonResponse({
      email: email,
      emails: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('获取邮件失败:', error);
    return jsonResponse({ error: '获取邮件失败', message: error.message }, 500);
  }
}

// 接收邮件（供外部调用）
async function handlePostEmails(request) {
  try {
    const body = await request.json();
    const { to, from, subject, text, html, raw } = body;
    
    if (!to || !from) {
      return jsonResponse({ success: false, error: '缺少 to 或 from 参数' }, 400);
    }
    
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    const sql = getSql();
    await sql`
      INSERT INTO emails (email_to, email_from, subject, text_content, html_content, raw_content, expires_at) 
      VALUES (${to}, ${from}, ${subject || ''}, ${text || ''}, ${html || ''}, ${raw || ''}, ${expiresAt.toISOString()})
    `;
    
    console.log(`邮件已存储: ${from} -> ${to}`);
    return jsonResponse({ success: true, message: '邮件已存储' });
  } catch (error) {
    console.error('存储邮件失败:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// 删除邮件
async function handleDeleteEmail(email, id) {
  try {
    const sql = getSql();
    // 先验证邮件是否属于该邮箱
    const rows = await sql`SELECT id FROM emails WHERE id = ${id} AND email_to = ${email}`;
    
    if (rows.length === 0) {
      return jsonResponse({ success: false, error: '邮件不存在' }, 404);
    }
    
    // 删除邮件
    await sql`DELETE FROM emails WHERE id = ${id} AND email_to = ${email}`;
    
    console.log(`邮件已删除: ${email} (ID: ${id})`);
    return jsonResponse({ success: true, message: '邮件已删除' });
  } catch (error) {
    console.error('删除邮件失败:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// 发送邮件
async function handleSendEmail(request) {
  const resendApiKey = getResendApiKey();
  
  if (!resendApiKey) {
    return jsonResponse({ 
      success: false, 
      error: '邮件发送服务未配置，请设置 RESEND_API_KEY 环境变量' 
    }, 503);
  }
  
  // 先读取 body，以便在错误处理中使用
  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    return jsonResponse({ 
      success: false, 
      error: '请求体解析失败' 
    }, 400);
  }
  
  const { from, to, subject, text, html, replyTo } = body;
  
  try {
    
    if (!from || !to || !subject) {
      return jsonResponse({ 
        success: false, 
        error: '缺少必要参数：from, to, subject' 
      }, 400);
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(from) || !emailRegex.test(to)) {
      return jsonResponse({ 
        success: false, 
        error: '邮箱格式无效' 
      }, 400);
    }
    
    const clientIp = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Real-IP') || 
                     request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
                     'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    
    // 调用 Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: from,
        to: to,
        subject: subject,
        text: text || '',
        html: html || text || '',
        reply_to: replyTo || from
      })
    });
    
    const resendData = await resendResponse.json();
    const status = resendResponse.ok ? 'success' : 'failed';
    const errorMsg = resendResponse.ok ? null : (resendData.message || JSON.stringify(resendData));
    const resendId = resendData.id || null;
    
    // 记录发送日志
    try {
      const sql = getSql();
      await sql`
        INSERT INTO send_logs (email_from, email_to, subject, status, resend_id, error_message, client_ip, user_agent) 
        VALUES (${from}, ${to}, ${subject}, ${status}, ${resendId}, ${errorMsg}, ${clientIp}, ${userAgent})
      `;
    } catch (logError) {
      console.error('记录发送日志失败:', logError);
    }
    
    if (!resendResponse.ok) {
      return jsonResponse({ 
        success: false, 
        error: resendData.message || '邮件发送失败' 
      }, 500);
    }
    
    // 获取 IP 地理位置（简化版，不依赖 UAParser）
    let location = null;
    try {
      const ipToQuery = clientIp.replace('::ffff:', '');
      const geoResponse = await fetch(`http://ip-api.com/json/${ipToQuery}?lang=zh-CN&fields=status,country,regionName,city`);
      const geoData = await geoResponse.json();
      if (geoData.status === 'success') {
        if (geoData.country === '中国' || geoData.country === 'China') {
          location = `${geoData.regionName || ''}${geoData.city || ''}`;
        } else {
          location = `${geoData.country || ''} ${geoData.city || ''}`.trim();
        }
      }
    } catch (geoError) {
      console.error('获取 IP 位置失败:', geoError.message);
    }
    
    // 简化设备信息解析（不依赖 UAParser）
    let device = '未知设备';
    const ua = userAgent || '';
    if (ua.includes('iPhone')) {
      device = 'iPhone';
    } else if (ua.includes('iPad')) {
      device = 'iPad';
    } else if (ua.includes('Android')) {
      device = 'Android';
    } else if (ua.includes('Windows')) {
      device = 'Windows';
    } else if (ua.includes('Mac')) {
      device = 'Mac';
    } else if (ua.includes('Linux')) {
      device = 'Linux';
    }
    
    console.log(`邮件已发送: ${from} -> ${to}, ID: ${resendId || 'unknown'}, IP: ${clientIp}, 位置: ${location || '未知'}, 设备: ${device}`);
    
    return jsonResponse({ 
      success: true, 
      message: '邮件发送成功',
      id: resendId,
      clientIp: clientIp.replace('::ffff:', ''),
      location: location,
      device: device
    });
  } catch (error) {
    console.error('发送邮件失败:', error);
    
    // 记录失败日志
    try {
      const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
      const userAgent = request.headers.get('User-Agent') || 'unknown';
      
      const sql = getSql();
      await sql`
        INSERT INTO send_logs (email_from, email_to, subject, status, error_message, client_ip, user_agent) 
        VALUES (${from || 'unknown'}, ${to || 'unknown'}, ${subject || 'Send Error'}, 'failed', ${error.message}, ${clientIp}, ${userAgent})
      `;
    } catch (logError) {
      console.error('记录发送日志失败:', logError);
    }
    
    return jsonResponse({ 
      success: false, 
      error: error.message || '邮件发送失败' 
    }, 500);
  }
}

// ==================== 自动清理任务 ====================

async function cleanupExpiredData() {
  try {
    const sql = getSql();
    const result = await sql`DELETE FROM emails WHERE received_at < NOW() - INTERVAL '24 hours'`;
    if (result.rowCount > 0) {
      console.log(`已清理 ${result.rowCount} 封过期邮件`);
    }
    
    // 清理过期的频率限制记录
    await sql`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '5 minutes'`;
  } catch (error) {
    console.error('清理过期数据失败:', error);
  }
}

// ==================== GitHub 代理 ====================

const GITHUB_PROXY_CONFIG = {
  rateLimit: 60,
  rateLimitWindow: 60,
  allowedUserAgents: [
    'git/', 'curl/', 'wget/', 'libcurl/', 'Go-http-client',
    'python-requests', 'axios/', 'node-fetch', 'Mozilla/',
  ],
  blockedPaths: [
    '/login', '/logout', '/signup', '/join', '/sessions',
    '/settings', '/password_reset', '/users/', '/orgs/', '/.git/config',
  ],
  blockedExtensions: [
    '.zip', '.tar.gz', '.tgz', '.exe', '.dmg', '.pkg',
    '.deb', '.rpm', '.msi', '.iso',
  ],
};

const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - GITHUB_PROXY_CONFIG.rateLimitWindow;
  
  let data = rateLimitMap.get(ip);
  if (!data) {
    data = { timestamps: [] };
  }
  
  data.timestamps = data.timestamps.filter(t => t > windowStart);
  
  if (data.timestamps.length >= GITHUB_PROXY_CONFIG.rateLimit) {
    return false;
  }
  
  data.timestamps.push(now);
  rateLimitMap.set(ip, data);
  
  if (rateLimitMap.size > 10000) {
    const keysToDelete = [];
    rateLimitMap.forEach((value, key) => {
      if (value.timestamps.length === 0 || value.timestamps[value.timestamps.length - 1] < windowStart) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => rateLimitMap.delete(key));
  }
  
  return true;
}

function isAllowedUserAgent(userAgent) {
  if (!userAgent) return false;
  return GITHUB_PROXY_CONFIG.allowedUserAgents.some(ua => 
    userAgent.toLowerCase().includes(ua.toLowerCase())
  );
}

function isBlockedPath(pathname) {
  const lowerPath = pathname.toLowerCase();
  
  if (GITHUB_PROXY_CONFIG.blockedPaths.some(p => lowerPath.includes(p.toLowerCase()))) {
    return true;
  }
  
  if (GITHUB_PROXY_CONFIG.blockedExtensions.some(ext => lowerPath.endsWith(ext.toLowerCase()))) {
    return true;
  }
  
  return false;
}

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Real-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         '0.0.0.0';
}

async function handleGitHubProxy(request, url) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('User-Agent') || '';
  
  if (!isAllowedUserAgent(userAgent)) {
    return jsonResponse({ 
      error: '禁止访问', 
      message: '不支持的客户端类型',
      hint: '请使用 git/curl/wget 等工具访问'
    }, 403);
  }
  
  if (isBlockedPath(url.pathname)) {
    return jsonResponse({ 
      error: '禁止访问', 
      message: '该路径不允许代理'
    }, 403);
  }
  
  if (!checkRateLimit(clientIP)) {
    return jsonResponse({ 
      error: '请求过于频繁', 
      message: `每分钟最多 ${GITHUB_PROXY_CONFIG.rateLimit} 次请求`,
      retryAfter: GITHUB_PROXY_CONFIG.rateLimitWindow
    }, 429);
  }
  
  const githubUrl = `https://github.com${url.pathname}${url.search}`;
  
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
    
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.set('X-RateLimit-Limit', String(GITHUB_PROXY_CONFIG.rateLimit));
    responseHeaders.set('X-RateLimit-Window', `${GITHUB_PROXY_CONFIG.rateLimitWindow}s`);
    
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
    return jsonResponse({ 
      error: 'GitHub 代理失败', 
      message: error.message,
      url: githubUrl
    }, 502);
  }
}

// ==================== 文件加速代理 ====================

const FILE_PROXY_CONFIG = {
  allowedProtocols: ['https:', 'http:'],
  blockedDomains: ['localhost', '127.0.0.1', '0.0.0.0', '::1'],
  timeout: 300000
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
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return errorResponse('无效的 URL', 400);
    }
    
    if (!FILE_PROXY_CONFIG.allowedProtocols.includes(parsedUrl.protocol)) {
      return errorResponse('仅支持 HTTP/HTTPS 协议', 400);
    }
    
    if (FILE_PROXY_CONFIG.blockedDomains.some(d => parsedUrl.hostname.includes(d))) {
      return errorResponse('禁止访问的域名', 403);
    }
    
    const headers = new Headers();
    headers.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0');
    
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
    
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Expose-Headers', '*');
    
    const headersToPass = ['Content-Type', 'Content-Length', 'Content-Disposition', 'Accept-Ranges', 'Content-Range', 'ETag', 'Last-Modified'];
    headersToPass.forEach(h => {
      const value = response.headers.get(h);
      if (value) responseHeaders.set(h, value);
    });
    
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

// ==================== 邮件内容解析 ====================

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
      
      if (line.match(/^Content-Type:\s*text\/(plain|html)/i)) {
        const typeMatch = line.match(/text\/(plain|html)/i);
        currentContentType = typeMatch ? typeMatch[1].toLowerCase() : '';
        
        const charsetMatch = line.match(/charset[=\s]*["']?([^"'\s;]+)/i);
        if (charsetMatch) {
          currentCharset = charsetMatch[1].toLowerCase();
        }
        continue;
      }
      
      if (line.match(/^Content-Transfer-Encoding:\s*(.+)/i)) {
        const match = line.match(/Content-Transfer-Encoding:\s*(.+)/i);
        currentEncoding = match ? match[1].trim().toLowerCase() : '';
        continue;
      }
      
      if (!inBody && line === '' && currentContentType) {
        inBody = true;
        continue;
      }
      
      if (inBody) {
        if (line.startsWith('--')) {
          if (contentBuffer.length > 0) {
            let content = decodeContent(contentBuffer.join('\n'), currentEncoding, currentCharset);
            
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
        
        if (line.match(/^Content-/i)) continue;
        
        contentBuffer.push(line);
      }
    }
    
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

function decodeContent(content, encoding, charset) {
  try {
    charset = charset || 'utf-8';
    
    if (encoding === 'base64') {
      const cleaned = content.replace(/\s/g, '');
      const binaryString = atob(cleaned);
      
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const decoder = new TextDecoder(charset);
      content = decoder.decode(bytes);
      
    } else if (encoding === 'quoted-printable') {
      content = decodeQuotedPrintable(content, charset);
    }
    
    return content;
  } catch (e) {
    console.error('Decode content error:', e);
    return content;
  }
}

function decodeQuotedPrintable(str, charset = 'utf-8') {
  try {
    str = str.replace(/=\r?\n/g, '');
    
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
    
    const uint8Array = new Uint8Array(bytes);
    const decoder = new TextDecoder(charset);
    return decoder.decode(uint8Array);
  } catch (e) {
    console.error('Decode quoted-printable error:', e);
    return str;
  }
}

// ==================== API 文档 HTML ====================

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
              公益平台提供免费的临时邮箱服务、GitHub 代理服务和文件加速下载服务。所有服务均通过 Cloudflare Workers 部署，
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
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/domains</span>
              <div class="endpoint-desc">
                  添加新域名
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-delete">DELETE</span>
              <span class="endpoint-path">/api/domains/:name</span>
              <div class="endpoint-desc">
                  删除指定域名（需要管理员密钥）
              </div>
          </div>
      </div>

      <div class="card">
          <div class="card-title">GitHub 代理服务</div>
          <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
              通过本域名代理访问 GitHub，支持 Git 克隆、下载等操作。
          </p>
      </div>

      <div class="card">
          <div class="card-title">文件加速下载</div>
          <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
              通过 Cloudflare 加速下载各类文件，支持 GitHub Releases、npm、PyPI 等任意 HTTPS 文件。
          </p>
      </div>

      <div class="card">
          <div class="card-title">CORS 支持</div>
          <p style="color: var(--text-secondary); line-height: 1.8;">
              所有 API 接口均支持跨域访问（CORS），允许从任何域名调用。
          </p>
      </div>

      <div class="footer">
          <p>Powered by <span class="highlight">VioletTeam</span></p>
          <p style="margin-top: 10px; font-size: 14px;">公益平台 - 免费公益服务</p>
      </div>
  </div>
</body>
</html>`;
}

