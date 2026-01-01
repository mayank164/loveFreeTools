-- 为 DNS 记录表添加域名字段升级脚本
-- 运行方式: mysql -u root -p free_email < server/upgrade-dns-domain.sql

-- 添加域名列（如果不存在）
ALTER TABLE dns_records 
    ADD COLUMN domain VARCHAR(255) NOT NULL DEFAULT 'lovefreetools.site' AFTER subdomain;

-- 添加域名索引
ALTER TABLE dns_records ADD INDEX idx_domain (domain);

-- 更新唯一约束
ALTER TABLE dns_records DROP INDEX unique_record;
ALTER TABLE dns_records ADD UNIQUE KEY unique_record (subdomain, domain, record_type, record_value(255));

-- 显示表结构
DESCRIBE dns_records;

