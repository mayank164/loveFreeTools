#!/bin/bash
# 公益平台 - 服务器更新脚本
# 在服务器上运行此脚本更新所有文件

echo "🚀 开始更新服务器文件..."

# 1. 更新 API 后端 index.js
echo "📝 更新 /opt/free-email-api/index.js..."
cat > /opt/free-email-api/index.js << 'INDEXJS'
/**
 * 公益平台 - MySQL API 后端
 * 替代 Cloudflare Workers KV，使用 MySQL 存储数据
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== 数据库配置 ====================
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'free_email',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 测试数据库连接
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL 数据库连接成功');
        connection.release();
    } catch (error) {
        console.error('❌ MySQL 数据库连接失败:', error.message);
        process.exit(1);
    }
}

// ==================== 中间件配置 ====================

// 安全头
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS 配置
const corsOrigins = process.env.CORS_ORIGINS || '*';
app.use(cors({
    origin: corsOrigins === '*' ? '*' : corsOrigins.split(',').map(s => s.trim()),
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Admin-Key']
}));

// JSON 解析
app.use(express.json({ limit: '10mb' }));

// 请求日志
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// 全局速率限制
const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1分钟
    max: 100, // 每分钟最多100次请求
    message: { success: false, error: '请求过于频繁，请稍后再试' }
});
app.use(globalLimiter);

// ==================== 辅助函数 ====================

// 验证管理员密钥
function verifyAdmin(req) {
    const adminKey = req.headers['x-admin-key'];
    const configKey = process.env.ADMIN_KEY;
    if (!configKey) return true; // 未设置密钥时允许所有请求
    return adminKey === configKey;
}

// ==================== API 路由 ====================

// 根路径 - 服务状态
app.get('/', (req, res) => {
    res.json({
        service: '公益平台 - 免费公益服务',
        status: 'running',
        backend: 'MySQL',
        features: ['临时邮箱', '域名管理', '捐赠者管理'],
        endpoints: [
            'GET /api/domains',
            'POST /api/domains',
            'DELETE /api/domains/:name',
            'GET /api/donors',
            'POST /api/donors',
            'DELETE /api/donors/:id',
            'GET /api/emails/:email',
            'POST /api/emails (邮件接收)'
        ]
    });
});

// ==================== 域名 API ====================

// 获取域名列表
app.get('/api/domains', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT name, api FROM domains ORDER BY id');
        res.json({ success: true, domains: rows });
    } catch (error) {
        console.error('获取域名失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 添加域名（无需管理员密钥）
app.post('/api/domains', async (req, res) => {
    const { name, api } = req.body;
    if (!name || !api) {
        return res.status(400).json({ success: false, error: '缺少 name 或 api 参数' });
    }

    try {
        await pool.query('INSERT INTO domains (name, api) VALUES (?, ?)', [name, api]);
        const [rows] = await pool.query('SELECT name, api FROM domains ORDER BY id');
        res.json({ success: true, domains: rows });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: '域名已存在' });
        }
        console.error('添加域名失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 删除域名（需要管理员密钥）
app.delete('/api/domains/:name', async (req, res) => {
    if (!verifyAdmin(req)) {
        return res.status(401).json({ success: false, error: '未授权' });
    }

    const domainName = decodeURIComponent(req.params.name);

    try {
        const [result] = await pool.query('DELETE FROM domains WHERE name = ?', [domainName]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: '域名不存在' });
        }
        const [rows] = await pool.query('SELECT name, api FROM domains ORDER BY id');
        res.json({ success: true, domains: rows });
    } catch (error) {
        console.error('删除域名失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== 捐赠者 API ====================

// 获取捐赠者列表
app.get('/api/donors', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, domain, vip, created_at as createdAt FROM donors ORDER BY created_at DESC'
        );
        res.json({ success: true, donors: rows });
    } catch (error) {
        console.error('获取捐赠者失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 添加捐赠者（无需管理员密钥）
app.post('/api/donors', async (req, res) => {
    const { name, domain, vip } = req.body;
    if (!name || !domain) {
        return res.status(400).json({ success: false, error: '缺少 name 或 domain 参数' });
    }

    try {
        await pool.query(
            'INSERT INTO donors (name, domain, vip) VALUES (?, ?, ?)',
            [name, domain, vip || false]
        );
        const [rows] = await pool.query(
            'SELECT id, name, domain, vip, created_at as createdAt FROM donors ORDER BY created_at DESC'
        );
        res.json({ success: true, donors: rows });
    } catch (error) {
        console.error('添加捐赠者失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 删除捐赠者（需要管理员密钥）
app.delete('/api/donors/:id', async (req, res) => {
    if (!verifyAdmin(req)) {
        return res.status(401).json({ success: false, error: '未授权' });
    }

    const donorId = req.params.id;

    try {
        const [result] = await pool.query('DELETE FROM donors WHERE id = ?', [donorId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: '捐赠者不存在' });
        }
        const [rows] = await pool.query(
            'SELECT id, name, domain, vip, created_at as createdAt FROM donors ORDER BY created_at DESC'
        );
        res.json({ success: true, donors: rows });
    } catch (error) {
        console.error('删除捐赠者失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== 邮件 API ====================

// 获取邮件列表
app.get('/api/emails/:email', async (req, res) => {
    const email = decodeURIComponent(req.params.email);

    try {
        const [rows] = await pool.query(
            `SELECT 
                email_from as \`from\`, 
                email_to as \`to\`, 
                subject, 
                text_content as text, 
                html_content as html, 
                received_at as date 
            FROM emails 
            WHERE email_to = ? 
            ORDER BY received_at DESC 
            LIMIT 50`,
            [email]
        );

        res.json({
            email: email,
            emails: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('获取邮件失败:', error);
        res.status(500).json({ error: '获取邮件失败', message: error.message });
    }
});

// 接收邮件（供 Cloudflare Worker 调用）
app.post('/api/emails', async (req, res) => {
    const { to, from, subject, text, html, raw } = req.body;

    if (!to || !from) {
        return res.status(400).json({ success: false, error: '缺少 to 或 from 参数' });
    }

    try {
        // 计算过期时间（24小时后）
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await pool.query(
            `INSERT INTO emails (email_to, email_from, subject, text_content, html_content, raw_content, expires_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [to, from, subject || '', text || '', html || '', raw || '', expiresAt]
        );

        console.log(`📧 邮件已存储: ${from} -> ${to}`);
        res.json({ success: true, message: '邮件已存储' });
    } catch (error) {
        console.error('存储邮件失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== 清理任务 ====================

// 定期清理过期数据（每小时执行）
async function cleanupExpiredData() {
    try {
        // 清理过期邮件（超过24小时）
        const [emailResult] = await pool.query(
            'DELETE FROM emails WHERE received_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)'
        );
        if (emailResult.affectedRows > 0) {
            console.log(`🗑️ 已清理 ${emailResult.affectedRows} 封过期邮件`);
        }

        // 清理过期的频率限制记录
        const [rateLimitResult] = await pool.query(
            'DELETE FROM rate_limits WHERE window_start < DATE_SUB(NOW(), INTERVAL 5 MINUTE)'
        );
        if (rateLimitResult.affectedRows > 0) {
            console.log(`🗑️ 已清理 ${rateLimitResult.affectedRows} 条过期限制记录`);
        }
    } catch (error) {
        console.error('清理过期数据失败:', error);
    }
}

// 每小时执行一次清理
setInterval(cleanupExpiredData, 60 * 60 * 1000);

// ==================== 错误处理 ====================

// 404 处理
app.use((req, res) => {
    res.status(404).json({ success: false, error: '接口不存在' });
});

// 全局错误处理
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
});

// ==================== 启动服务器 ====================

async function start() {
    await testConnection();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`
╔════════════════════════════════════════════════════════╗
║           公益平台 - MySQL API 后端                     ║
╠════════════════════════════════════════════════════════╣
║  🚀 服务已启动: http://0.0.0.0:${PORT.toString().padEnd(24, ' ')}║
║  📦 数据库: ${(dbConfig.host + ':' + dbConfig.port).padEnd(34, ' ')}║
║  📊 数据库名: ${dbConfig.database.padEnd(32, ' ')}║
╚════════════════════════════════════════════════════════╝
        `);
    });
}

start().catch(console.error);
INDEXJS

echo "✅ index.js 更新完成"

# 2. 更新 Nginx 配置
echo "📝 更新 /etc/nginx/sites-available/mirror.conf..."
sudo tee /etc/nginx/sites-available/mirror.conf > /dev/null << 'NGINXCONF'
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name mirror.yljdteam.com;
    root /var/www/mirror;
    index index.html;
    client_max_body_size 0;

    ssl_certificate     /etc/letsencrypt/live/mirror.yljdteam.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mirror.yljdteam.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    resolver 8.8.8.8 1.1.1.1 valid=300s;
    resolver_timeout 5s;

    # Email API 后端代理 (最高优先级)
    location ^~ /email-api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = / {
        try_files /index.html =404;
    }

    location ^~ /css/ {
        access_log off;
        expires 7d;
        try_files $uri =404;
    }

    location ^~ /js/ {
        access_log off;
        expires 7d;
        try_files $uri =404;
    }

    location ~ ^/file/https/violetteam\.cloud(/v2/.*)$ {
        set $dst_path $1;
        proxy_pass https://mirror.ccs.tencentyun.com$dst_path$is_args$args;
        proxy_set_header Host mirror.ccs.tencentyun.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_ssl_server_name on;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_http_version 1.1;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location ~ ^/file/https/github\.com(/.*)$ {
        set $dst_path $1;
        proxy_set_header Host github.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_ssl_server_name on;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_http_version 1.1;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_hide_header Content-Security-Policy;
        proxy_hide_header X-Content-Security-Policy;
        proxy_hide_header X-WebKit-CSP;
        proxy_hide_header Content-Security-Policy-Report-Only;
        add_header Content-Security-Policy "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src *; style-src * 'unsafe-inline'; img-src * data:; font-src * data:; frame-src *; object-src *; media-src *; worker-src * blob:;" always;
        sub_filter_types text/html;
        sub_filter_once off;
        sub_filter '<meta http-equiv="Content-Security-Policy"' '<meta http-equiv="Content-Security-Policy-Disabled"';
        sub_filter '<meta http-equiv="content-security-policy"' '<meta http-equiv="content-security-policy-disabled"';
        sub_filter '</head>' '<script>!function(){try{var e=document.querySelector('\''meta[http-equiv="Content-Security-Policy"]'\'')||document.querySelector('\''meta[http-equiv="content-security-policy"]'\'');e&&e.remove();var t=new MutationObserver(function(e){e.forEach(function(e){e.addedNodes.forEach(function(e){1===e.nodeType&&"META"===e.tagName&&("Content-Security-Policy"===e.getAttribute("http-equiv")||"content-security-policy"===e.getAttribute("http-equiv"))&&e.remove()})})});t.observe(document.head,{childList:!0,subtree:!0})}catch(e){}}();</script></head>';
        proxy_pass https://github.com$dst_path$is_args$args;
    }

    location ~ ^/file/https/([^/]+)(/.*)$ {
        set $dst_host $1;
        set $dst_path $2;
        proxy_set_header Host $dst_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_ssl_server_name on;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_http_version 1.1;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_pass https://$dst_host$dst_path$is_args$args;
    }

    location /v2/search/ {
        proxy_pass https://hub.docker.com;
        proxy_set_header Host hub.docker.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header User-Agent "Docker-Client/25.0 (mirror.yljdteam.com)";
        proxy_set_header Accept "application/json";
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
    }

    location /gh/ {
        rewrite ^/gh/(.*)$ /$1 break;
        proxy_pass https://api.github.com;
        proxy_set_header Host api.github.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name mirror.yljdteam.com;
    return 301 https://$host$request_uri;
}
NGINXCONF

echo "✅ mirror.conf 更新完成"

# 3. 复制到 sites-enabled
echo "📝 同步到 sites-enabled..."
sudo cp /etc/nginx/sites-available/mirror.conf /etc/nginx/sites-enabled/mirror.conf

# 4. 重启服务
echo "🔄 重启服务..."
pm2 restart free-email-api
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✅ 所有文件更新完成！"
echo ""
echo "测试命令："
echo "  curl https://mirror.yljdteam.com/email-api/api/domains"
echo "  curl -X POST https://mirror.yljdteam.com/email-api/api/domains -H 'Content-Type: application/json' -d '{\"name\":\"violetteam.cloud\",\"api\":\"https://violetteam.cloud\"}'"

