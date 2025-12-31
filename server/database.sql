-- 公益平台 MySQL 数据库结构
-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS free_email CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE free_email;

-- 域名表
CREATE TABLE IF NOT EXISTS domains (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE COMMENT '域名',
    api VARCHAR(500) NOT NULL COMMENT 'API 地址',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 邮件表
CREATE TABLE IF NOT EXISTS emails (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email_to VARCHAR(255) NOT NULL COMMENT '收件人邮箱',
    email_from VARCHAR(255) NOT NULL COMMENT '发件人邮箱',
    subject VARCHAR(1000) DEFAULT '' COMMENT '邮件主题',
    text_content MEDIUMTEXT COMMENT '纯文本内容',
    html_content MEDIUMTEXT COMMENT 'HTML 内容',
    raw_content MEDIUMTEXT COMMENT '原始邮件内容',
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '接收时间',
    expires_at TIMESTAMP NULL COMMENT '过期时间',
    -- AI 分析字段
    verification_code VARCHAR(20) DEFAULT NULL COMMENT 'AI 提取的验证码',
    summary VARCHAR(500) DEFAULT NULL COMMENT 'AI 生成的邮件摘要',
    is_spam BOOLEAN DEFAULT FALSE COMMENT 'AI 检测是否为垃圾邮件',
    detected_language VARCHAR(10) DEFAULT NULL COMMENT 'AI 检测的邮件语言',
    INDEX idx_email_to (email_to),
    INDEX idx_received_at (received_at),
    INDEX idx_expires_at (expires_at),
    INDEX idx_is_spam (is_spam)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 为已有表添加 AI 字段的升级脚本（可选执行）
-- ALTER TABLE emails ADD COLUMN verification_code VARCHAR(20) DEFAULT NULL COMMENT 'AI 提取的验证码';
-- ALTER TABLE emails ADD COLUMN summary VARCHAR(500) DEFAULT NULL COMMENT 'AI 生成的邮件摘要';
-- ALTER TABLE emails ADD COLUMN is_spam BOOLEAN DEFAULT FALSE COMMENT 'AI 检测是否为垃圾邮件';
-- ALTER TABLE emails ADD COLUMN detected_language VARCHAR(10) DEFAULT NULL COMMENT 'AI 检测的邮件语言';
-- ALTER TABLE emails ADD INDEX idx_is_spam (is_spam);

-- 捐赠者表
CREATE TABLE IF NOT EXISTS donors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT '捐赠者名称',
    domain VARCHAR(255) DEFAULT '' COMMENT '贡献的域名',
    vip BOOLEAN DEFAULT FALSE COMMENT '是否 VIP',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 频率限制表（用于 GitHub 代理等）
CREATE TABLE IF NOT EXISTS rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL COMMENT 'IP 地址',
    endpoint VARCHAR(100) NOT NULL COMMENT '端点类型',
    request_count INT DEFAULT 1 COMMENT '请求次数',
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '窗口开始时间',
    INDEX idx_ip_endpoint (ip_address, endpoint),
    INDEX idx_window_start (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认域名
INSERT IGNORE INTO domains (name, api) VALUES 
    ('logincursor.xyz', 'https://logincursor.xyz'),
    ('kami666.xyz', 'https://kami666.xyz'),
    ('deploytools.site', 'https://deploytools.site'),
    ('loginvipcursor.icu', 'https://loginvipcursor.icu'),
    ('qxfy.store', 'https://qxfy.store');

-- 创建定时清理过期邮件的事件（每小时执行一次）
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_expired_emails
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
    -- 删除超过 24 小时的邮件
    DELETE FROM emails WHERE received_at < DATE_SUB(NOW(), INTERVAL 24 HOUR);
    -- 清理过期的频率限制记录
    DELETE FROM rate_limits WHERE window_start < DATE_SUB(NOW(), INTERVAL 5 MINUTE);
END//
DELIMITER ;

-- 启用事件调度器（需要 SUPER 权限）
-- SET GLOBAL event_scheduler = ON;

-- ==================== 短链接表 ====================
CREATE TABLE IF NOT EXISTS short_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE COMMENT '短码',
    original_url TEXT NOT NULL COMMENT '原始 URL',
    title VARCHAR(255) DEFAULT '' COMMENT '链接标题',
    clicks INT DEFAULT 0 COMMENT '点击次数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    expires_at TIMESTAMP NULL COMMENT '过期时间',
    client_ip VARCHAR(45) COMMENT '创建者 IP',
    INDEX idx_code (code),
    INDEX idx_expires (expires_at),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='短链接';

-- ==================== 发送日志表（审计用） ====================
CREATE TABLE IF NOT EXISTS send_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email_from VARCHAR(255) NOT NULL COMMENT '发件人',
    email_to VARCHAR(255) NOT NULL COMMENT '收件人',
    subject VARCHAR(500) COMMENT '邮件主题',
    status ENUM('success', 'failed') NOT NULL COMMENT '发送状态',
    resend_id VARCHAR(100) COMMENT 'Resend 返回的邮件ID',
    error_message TEXT COMMENT '错误信息',
    client_ip VARCHAR(45) COMMENT '客户端IP',
    user_agent VARCHAR(500) COMMENT '用户代理',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_from (email_from),
    INDEX idx_to (email_to),
    INDEX idx_status (status),
    INDEX idx_created (created_at),
    INDEX idx_ip (client_ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邮件发送日志';

