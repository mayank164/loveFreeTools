/**
 * Cloudflare Worker - 文件加速下载专用
 * 域名：download.qxfy.store
 * 功能：代理加速下载任意 HTTPS 文件
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// 文件加速配置
const FILE_PROXY_CONFIG = {
  allowedProtocols: ['https:', 'http:'],
  blockedDomains: ['localhost', '127.0.0.1', '0.0.0.0', '::1'],
  timeout: 300000 // 5分钟超时
};

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Disposition'
  };
  
  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // 根路径返回使用说明
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(getUsageHTML(url.origin), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders
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
    return handleFileProxy(targetUrl, request, corsHeaders);
  }
  
  // 其他路径返回 404
  return jsonResponse({ error: '未找到', path: url.pathname }, 404);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handleFileProxy(targetUrl, request, corsHeaders) {
  try {
    // URL 验证
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return jsonResponse({ error: '无效的 URL' }, 400);
    }
    
    // 协议检查
    if (!FILE_PROXY_CONFIG.allowedProtocols.includes(parsedUrl.protocol)) {
      return jsonResponse({ error: '仅支持 HTTP/HTTPS 协议' }, 400);
    }
    
    // 域名检查
    if (FILE_PROXY_CONFIG.blockedDomains.some(d => parsedUrl.hostname.includes(d))) {
      return jsonResponse({ error: '禁止访问的域名' }, 403);
    }
    
    // 代理请求
    const headers = new Headers();
    headers.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
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
    const responseHeaders = new Headers(corsHeaders);
    
    // 传递重要的响应头
    const headersToPass = [
      'Content-Type', 
      'Content-Length', 
      'Content-Disposition', 
      'Accept-Ranges', 
      'Content-Range', 
      'ETag', 
      'Last-Modified',
      'Cache-Control'
    ];
    headersToPass.forEach(h => {
      const value = response.headers.get(h);
      if (value) responseHeaders.set(h, value);
    });
    
    // 如果没有 Content-Disposition，尝试从 URL 提取文件名
    if (!responseHeaders.get('Content-Disposition')) {
      const filename = parsedUrl.pathname.split('/').pop();
      if (filename && filename.includes('.')) {
        responseHeaders.set('Content-Disposition', 'attachment; filename="' + decodeURIComponent(filename) + '"');
      }
    }
    
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });
    
  } catch (error) {
    if (error.name === 'AbortError') {
      return jsonResponse({ error: '请求超时' }, 504);
    }
    return jsonResponse({ error: '代理请求失败: ' + error.message }, 502);
  }
}

function getUsageHTML(origin) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文件加速下载 - 公益平台</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0e17 0%, #1a1a2e 100%);
            color: #f1f5f9;
            min-height: 100vh;
            padding: 40px 20px;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .logo { font-size: 48px; color: #00f5d4; margin-bottom: 10px; }
        .title { font-size: 28px; margin-bottom: 10px; }
        .subtitle { color: #94a3b8; }
        .card {
            background: rgba(17, 24, 39, 0.8);
            border: 1px solid #1e293b;
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 20px;
        }
        .card-title { color: #00f5d4; font-size: 20px; margin-bottom: 15px; }
        .code {
            background: #0a0e17;
            border: 1px solid #1e293b;
            border-radius: 8px;
            padding: 15px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 14px;
            overflow-x: auto;
            margin: 10px 0;
        }
        .highlight { color: #00f5d4; }
        ul { padding-left: 20px; color: #94a3b8; }
        li { margin: 8px 0; }
        .footer { text-align: center; color: #64748b; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">↓</div>
            <h1 class="title">文件加速下载</h1>
            <p class="subtitle">通过 Cloudflare 加速下载任意 HTTPS 文件</p>
        </div>
        
        <div class="card">
            <h2 class="card-title">使用方法</h2>
            <p style="color: #94a3b8; margin-bottom: 15px;">将文件 URL 作为参数传递给代理接口：</p>
            <div class="code">
                <span class="highlight">${origin}/proxy/?url=</span>https://example.com/file.zip
            </div>
        </div>
        
        <div class="card">
            <h2 class="card-title">示例</h2>
            <p style="color: #94a3b8; margin-bottom: 10px;">加速下载 GitHub Release：</p>
            <div class="code" style="font-size: 12px; word-break: break-all;">
${origin}/proxy/?url=https://github.com/ollama/ollama/releases/download/v0.13.5/ollama-linux-arm64.tgz
            </div>
        </div>
        
        <div class="card">
            <h2 class="card-title">功能特性</h2>
            <ul>
                <li>支持断点续传（Range 请求）</li>
                <li>无文件大小限制</li>
                <li>自动跟随重定向</li>
                <li>保留原始文件名</li>
                <li>5 分钟超时保护</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>Powered by VioletTeam - 公益平台</p>
        </div>
    </div>
</body>
</html>`;
}

