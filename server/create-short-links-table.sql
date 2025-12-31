-- 短链接表
-- 在 MySQL 中执行此文件创建表

USE free_email;

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

-- 验证表是否创建成功
SHOW TABLES LIKE 'short_links';
DESCRIBE short_links;

