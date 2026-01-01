-- 子域名表
CREATE TABLE IF NOT EXISTS subdomains (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subdomain VARCHAR(63) NOT NULL UNIQUE,           -- 子域名（如 mysite）
    target_url VARCHAR(2048) NOT NULL,               -- 目标 URL
    record_type ENUM('redirect', 'proxy', 'cname') DEFAULT 'redirect',  -- 记录类型
    owner_email VARCHAR(255),                        -- 所有者邮箱（可选）
    clicks INT DEFAULT 0,                            -- 访问次数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,                       -- 过期时间（NULL 表示永不过期）
    is_active BOOLEAN DEFAULT TRUE,                  -- 是否启用
    INDEX idx_subdomain (subdomain),
    INDEX idx_owner (owner_email),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 保留子域名列表（防止被注册）
CREATE TABLE IF NOT EXISTS reserved_subdomains (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subdomain VARCHAR(63) NOT NULL UNIQUE,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入一些保留子域名
INSERT IGNORE INTO reserved_subdomains (subdomain, reason) VALUES
('www', '系统保留'),
('mail', '邮件服务'),
('email', '邮件服务'),
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
('sso', '单点登录');

