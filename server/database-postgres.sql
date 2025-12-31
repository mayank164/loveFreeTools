-- 公益平台 PostgreSQL 数据库结构（Neon）
-- 在 Neon 控制台的 SQL Editor 中执行此脚本

-- 域名表
CREATE TABLE IF NOT EXISTS domains (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    api VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_domains_name ON domains(name);

-- 邮件表
CREATE TABLE IF NOT EXISTS emails (
    id SERIAL PRIMARY KEY,
    email_to VARCHAR(255) NOT NULL,
    email_from VARCHAR(255) NOT NULL,
    subject VARCHAR(1000) DEFAULT '',
    text_content TEXT,
    html_content TEXT,
    raw_content TEXT,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_emails_email_to ON emails(email_to);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);
CREATE INDEX IF NOT EXISTS idx_emails_expires_at ON emails(expires_at);

-- 频率限制表（用于 GitHub 代理等）
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    endpoint VARCHAR(100) NOT NULL,
    request_count INT DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON rate_limits(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- 发送日志表（审计用）
CREATE TABLE IF NOT EXISTS send_logs (
    id SERIAL PRIMARY KEY,
    email_from VARCHAR(255) NOT NULL,
    email_to VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
    resend_id VARCHAR(100),
    error_message TEXT,
    client_ip VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_send_logs_from ON send_logs(email_from);
CREATE INDEX IF NOT EXISTS idx_send_logs_to ON send_logs(email_to);
CREATE INDEX IF NOT EXISTS idx_send_logs_status ON send_logs(status);
CREATE INDEX IF NOT EXISTS idx_send_logs_created ON send_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_send_logs_ip ON send_logs(client_ip);

-- 插入默认域名（使用 ON CONFLICT 处理重复）
INSERT INTO domains (name, api) VALUES 
    ('logincursor.xyz', 'https://logincursor.xyz'),
    ('kami666.xyz', 'https://kami666.xyz'),
    ('deploytools.site', 'https://deploytools.site'),
    ('loginvipcursor.icu', 'https://loginvipcursor.icu'),
    ('qxfy.store', 'https://qxfy.store')
ON CONFLICT (name) DO NOTHING;

-- 注意：PostgreSQL 不支持 MySQL 的 CREATE EVENT
-- 自动清理任务将通过 Cloudflare Cron Triggers 在 Worker 中执行

