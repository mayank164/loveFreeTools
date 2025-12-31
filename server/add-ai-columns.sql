
-- 添加 AI 相关列（如果已存在会报错但可忽略）
ALTER TABLE emails ADD COLUMN verification_code VARCHAR(20) DEFAULT NULL;
ALTER TABLE emails ADD COLUMN summary VARCHAR(500) DEFAULT NULL;
ALTER TABLE emails ADD COLUMN is_spam BOOLEAN DEFAULT FALSE;
ALTER TABLE emails ADD COLUMN detected_language VARCHAR(10) DEFAULT NULL;
ALTER TABLE emails ADD INDEX idx_is_spam (is_spam);

