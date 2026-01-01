-- DNS 记录表（完整的 DNS 托管）
CREATE TABLE IF NOT EXISTS dns_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subdomain VARCHAR(63) NOT NULL,                  -- 子域名（如 www, mail, @表示根域名）
    record_type ENUM('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'REDIRECT') NOT NULL,
    record_value VARCHAR(2048) NOT NULL,             -- 记录值（IP、域名、文本等）
    ttl INT DEFAULT 3600,                            -- TTL（秒）
    priority INT DEFAULT 0,                          -- 优先级（MX、SRV 用）
    proxied BOOLEAN DEFAULT FALSE,                   -- 是否通过 Cloudflare 代理
    owner_email VARCHAR(255),                        -- 所有者邮箱
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_subdomain (subdomain),
    INDEX idx_type (record_type),
    INDEX idx_owner (owner_email),
    UNIQUE KEY unique_record (subdomain, record_type, record_value(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 保留子域名列表
CREATE TABLE IF NOT EXISTS reserved_subdomains (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subdomain VARCHAR(63) NOT NULL UNIQUE,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入保留子域名
INSERT IGNORE INTO reserved_subdomains (subdomain, reason) VALUES
('www', '系统保留'),
('mail', '邮件服务'),
('email', '邮件服务'),
('smtp', '邮件服务'),
('pop', '邮件服务'),
('imap', '邮件服务'),
('api', 'API 服务'),
('admin', '管理后台'),
('dashboard', '控制面板'),
('app', '应用服务'),
('static', '静态资源'),
('cdn', 'CDN 服务'),
('img', '图片服务'),
('images', '图片服务'),
('assets', '资源服务'),
('download', '下载服务'),
('mirror', '镜像服务'),
('proxy', '代理服务'),
('ns1', 'DNS 服务'),
('ns2', 'DNS 服务'),
('ns', 'DNS 服务'),
('ftp', 'FTP 服务'),
('ssh', 'SSH 服务'),
('vpn', 'VPN 服务'),
('test', '测试用'),
('dev', '开发用'),
('staging', '预发布'),
('prod', '生产环境'),
('demo', '演示用'),
('docs', '文档'),
('help', '帮助'),
('support', '支持'),
('blog', '博客'),
('shop', '商店'),
('store', '商店'),
('pay', '支付'),
('login', '登录'),
('auth', '认证'),
('oauth', 'OAuth'),
('sso', '单点登录'),
('cpanel', '控制面板'),
('webmail', '网页邮箱'),
('mx', '邮件交换'),
('autoconfig', '自动配置'),
('autodiscover', '自动发现');

-- 如果旧的 subdomains 表存在，迁移数据
-- INSERT INTO dns_records (subdomain, record_type, record_value, owner_email, created_at)
-- SELECT subdomain, 'REDIRECT', target_url, owner_email, created_at FROM subdomains;

