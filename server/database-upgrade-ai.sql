-- 公益平台 AI 功能数据库升级脚本
-- 为现有数据库添加 AI 分析相关字段
-- 请在 MySQL 中执行此脚本

USE free_email;

-- 检查并添加 verification_code 字段
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = 'free_email' 
               AND TABLE_NAME = 'emails' 
               AND COLUMN_NAME = 'verification_code');
SET @sql := IF(@exist = 0, 
    'ALTER TABLE emails ADD COLUMN verification_code VARCHAR(20) DEFAULT NULL COMMENT ''AI 提取的验证码''',
    'SELECT ''verification_code 字段已存在''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加 summary 字段
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = 'free_email' 
               AND TABLE_NAME = 'emails' 
               AND COLUMN_NAME = 'summary');
SET @sql := IF(@exist = 0, 
    'ALTER TABLE emails ADD COLUMN summary VARCHAR(500) DEFAULT NULL COMMENT ''AI 生成的邮件摘要''',
    'SELECT ''summary 字段已存在''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加 is_spam 字段
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = 'free_email' 
               AND TABLE_NAME = 'emails' 
               AND COLUMN_NAME = 'is_spam');
SET @sql := IF(@exist = 0, 
    'ALTER TABLE emails ADD COLUMN is_spam BOOLEAN DEFAULT FALSE COMMENT ''AI 检测是否为垃圾邮件''',
    'SELECT ''is_spam 字段已存在''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并添加 detected_language 字段
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = 'free_email' 
               AND TABLE_NAME = 'emails' 
               AND COLUMN_NAME = 'detected_language');
SET @sql := IF(@exist = 0, 
    'ALTER TABLE emails ADD COLUMN detected_language VARCHAR(10) DEFAULT NULL COMMENT ''AI 检测的邮件语言''',
    'SELECT ''detected_language 字段已存在''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加垃圾邮件索引（如果不存在）
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
               WHERE TABLE_SCHEMA = 'free_email' 
               AND TABLE_NAME = 'emails' 
               AND INDEX_NAME = 'idx_is_spam');
SET @sql := IF(@exist = 0, 
    'ALTER TABLE emails ADD INDEX idx_is_spam (is_spam)',
    'SELECT ''idx_is_spam 索引已存在''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 验证升级结果
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'free_email' 
AND TABLE_NAME = 'emails'
AND COLUMN_NAME IN ('verification_code', 'summary', 'is_spam', 'detected_language');

SELECT '数据库升级完成！AI 功能字段已添加。' AS message;

