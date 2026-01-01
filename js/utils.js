/**
 * 公益平台 - 工具函数
 */

const Utils = {
    /**
     * 生成随机邮箱前缀
     * @param {number} length - 前缀长度，默认10
     * @returns {string} 随机前缀
     */
    generateRandomPrefix(length = 10) {
        // 使用 UUID 的一部分，保证唯一性
        const uuid = crypto.randomUUID().replace(/-/g, '');
        return uuid.substring(0, length).toLowerCase();
    },

    /**
     * 生成完整邮箱地址
     * @param {string} prefix - 邮箱前缀（可选，为空则随机生成）
     * @param {string} domain - 域名
     * @returns {string} 完整邮箱地址
     */
    generateEmail(prefix, domain) {
        const emailPrefix = prefix && prefix.trim() 
            ? this.sanitizePrefix(prefix.trim()) 
            : this.generateRandomPrefix();
        return `${emailPrefix}@${domain}`;
    },

    /**
     * 清理邮箱前缀（移除非法字符）
     * @param {string} prefix - 原始前缀
     * @returns {string} 清理后的前缀
     */
    sanitizePrefix(prefix) {
        // 只保留字母、数字、点、下划线、连字符
        return prefix
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, '')
            .substring(0, 64); // 限制长度
    },

    /**
     * 复制文本到剪贴板
     * @param {string} text - 要复制的文本
     * @returns {Promise<boolean>} 是否成功
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // 降级方案：使用 execCommand
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            } catch (e) {
                console.error('复制失败:', e);
                return false;
            }
        }
    },

    /**
     * 格式化日期时间
     * @param {string|Date} date - 日期
     * @returns {string} 格式化后的日期字符串
     */
    formatDate(date) {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';

        // 转换为中国时间（UTC+8）
        const chinaTime = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (8 * 3600000));
        const now = new Date();
        const nowChinaTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
        const diff = nowChinaTime - chinaTime;
        
        // 1分钟内
        if (diff < 60 * 1000) {
            return '刚刚';
        }
        
        // 1小时内
        if (diff < 60 * 60 * 1000) {
            const minutes = Math.floor(diff / (60 * 1000));
            return `${minutes} 分钟前`;
        }
        
        // 今天
        if (this.isSameDay(chinaTime, nowChinaTime)) {
            return `今天 ${this.formatTime(chinaTime)}`;
        }
        
        // 昨天
        const yesterday = new Date(nowChinaTime);
        yesterday.setDate(yesterday.getDate() - 1);
        if (this.isSameDay(chinaTime, yesterday)) {
            return `昨天 ${this.formatTime(chinaTime)}`;
        }
        
        // 其他日期
        return `${chinaTime.getMonth() + 1}/${chinaTime.getDate()} ${this.formatTime(chinaTime)}`;
    },

    /**
     * 判断是否同一天
     */
    isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    },

    /**
     * 格式化时间 (HH:MM) - 中国时间
     */
    formatTime(date) {
        // 转换为中国时间（UTC+8）
        const chinaTime = new Date(date.getTime() + (date.getTimezoneOffset() * 60000) + (8 * 3600000));
        const hours = chinaTime.getHours().toString().padStart(2, '0');
        const minutes = chinaTime.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    },

    /**
     * 提取发件人名称首字母（用于头像）
     * @param {string} from - 发件人地址
     * @returns {string} 首字母或字符
     */
    getAvatarText(from) {
        if (!from) return '?';
        
        // 尝试提取名称部分 "Name <email@domain.com>"
        const nameMatch = from.match(/^([^<]+)</);
        if (nameMatch) {
            const name = nameMatch[1].trim();
            if (name) {
                // 如果是中文，取第一个字
                if (/[\u4e00-\u9fa5]/.test(name)) {
                    return name.charAt(0);
                }
                // 英文取首字母大写
                return name.charAt(0).toUpperCase();
            }
        }
        
        // 否则取邮箱用户名首字母
        const emailMatch = from.match(/([^@<\s]+)@/);
        if (emailMatch) {
            return emailMatch[1].charAt(0).toUpperCase();
        }
        
        return from.charAt(0).toUpperCase();
    },

    /**
     * 提取发件人显示名称
     * @param {string} from - 发件人地址
     * @returns {string} 显示名称
     */
    getDisplayName(from) {
        if (!from) return '未知发件人';
        
        // 尝试提取名称部分
        const nameMatch = from.match(/^([^<]+)</);
        if (nameMatch) {
            return nameMatch[1].trim() || from;
        }
        
        // 返回完整地址
        return from;
    },

    /**
     * 截断文本
     * @param {string} text - 原文本
     * @param {number} maxLength - 最大长度
     * @returns {string} 截断后的文本
     */
    truncate(text, maxLength = 50) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

    /**
     * 从本地存储读取数据
     * @param {string} key - 键名
     * @param {*} defaultValue - 默认值
     * @returns {*} 存储的值或默认值
     */
    getStorage(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            if (value === null) return defaultValue;
            return JSON.parse(value);
        } catch (e) {
            return defaultValue;
        }
    },

    /**
     * 保存数据到本地存储
     * @param {string} key - 键名
     * @param {*} value - 值
     */
    setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('保存到本地存储失败:', e);
        }
    },

    /**
     * 防抖函数
     * @param {Function} func - 要执行的函数
     * @param {number} wait - 等待时间（毫秒）
     * @returns {Function} 防抖后的函数
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * 节流函数
     * @param {Function} func - 要执行的函数
     * @param {number} limit - 限制时间（毫秒）
     * @returns {Function} 节流后的函数
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * 生成简单的唯一ID
     * @returns {string} 唯一ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * 生成随机字符串
     * @param {number} length - 字符串长度
     * @returns {string} 随机字符串
     */
    generateRandomString(length = 10) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    /**
     * HTML 转义（防止XSS）
     * @param {string} text - 原文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 解析邮箱地址
     * @param {string} email - 完整邮箱地址
     * @returns {object} { prefix, domain }
     */
    parseEmail(email) {
        const parts = email.split('@');
        return {
            prefix: parts[0] || '',
            domain: (parts[1] || '').replace(/\/+$/, '')  // 去除末尾斜杠
        };
    },

    /**
     * 从邮件内容中提取验证码
     * @param {string} text - 邮件文本内容
     * @param {string} html - 邮件HTML内容（可选）
     * @returns {string|null} 验证码或null
     */
    extractVerificationCode(text, html = '') {
        if (!text && !html) return null;
        
        // 合并文本和HTML内容（从HTML中提取纯文本）
        let content = text || '';
        if (html) {
            // 简单的HTML标签移除
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const htmlText = tempDiv.textContent || tempDiv.innerText || '';
            content = content + ' ' + htmlText;
        }
        
        // 清理内容：移除多余空格和换行
        content = content.replace(/\s+/g, ' ').trim();
        
        // 验证码关键词模式（按优先级排序）- 支持大小写字母
        const codePatterns = [
            // 中文：验证码是 123456 或 abc123
            /验证码[：:是]\s*([A-Za-z0-9]{4,8})/i,
            // 中文：您的验证码为 123456
            /验证码[为是]\s*([A-Za-z0-9]{4,8})/i,
            // 中文：验证码：123456
            /验证码[：:]\s*([A-Za-z0-9]{4,8})/i,
            // 中文：验证码 123456
            /验证码\s+([A-Za-z0-9]{4,8})/i,
            // 英文：verification code: 123456
            /verification\s+code[：:]\s*([A-Za-z0-9]{4,8})/i,
            // 英文：code: 123456
            /code[：:]\s*([A-Za-z0-9]{4,8})/i,
            // 英文：Your code is 123456
            /your\s+code\s+is\s+([A-Za-z0-9]{4,8})/i,
            // 英文：verification code is 123456
            /verification\s+code\s+is\s+([A-Za-z0-9]{4,8})/i
        ];
        
        // 优先匹配带关键词的验证码
        for (const pattern of codePatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                const code = match[1].trim(); // 保留原始大小写
                // 验证码通常是4-8位
                if (code.length >= 4 && code.length <= 8) {
                    return code;
                }
            }
        }
        
        // 如果没有找到带关键词的，尝试查找独立的验证码
        // 排除明显不是验证码的内容
        const excludePatterns = [
            /^20\d{2}$/, // 年份如 2024
            /^19\d{2}$/, // 年份如 1999
            /^\d{1,2}:\d{2}$/, // 时间如 12:30
            /^\d{4}-\d{2}-\d{2}$/, // 日期
            /^\d{2}\/\d{2}\/\d{4}$/, // 日期
            /^\d{5}-\d{4}$/, // 美国邮政编码格式 98109-5210
            /^\d{5}$/, // 5位数字可能是邮政编码（如果后面有地址信息）
        ];
        
        // 1. 优先查找纯数字验证码（4-8位）
        const numberPattern = /\b([0-9]{4,8})\b/g;
        const numberMatches = [];
        let match;
        while ((match = numberPattern.exec(content)) !== null) {
            const code = match[1];
            const matchIndex = match.index;
            
            // 检查是否是邮政编码格式（5位数字后跟连字符和4位数字）
            const zipCodePattern = /\d{5}-\d{4}/;
            const beforeMatch = content.substring(Math.max(0, matchIndex - 10), matchIndex + code.length + 10);
            if (zipCodePattern.test(beforeMatch)) {
                continue; // 跳过邮政编码
            }
            
            // 检查5位数字是否在地址上下文中（前后有地址相关词汇）
            if (code.length === 5) {
                const context = content.substring(Math.max(0, matchIndex - 50), Math.min(content.length, matchIndex + code.length + 50)).toLowerCase();
                const addressKeywords = ['street', 'st', 'avenue', 'ave', 'road', 'rd', 'boulevard', 'blvd', 'drive', 'dr', 'lane', 'ln', 'way', 'place', 'pl', 'terrace', 'ter', 'court', 'ct', 'circle', 'cir', 'parkway', 'pkwy', 'highway', 'hwy', 'zip', 'postal', 'code', 'address', 'seattle', 'wa', 'california', 'ca', 'new york', 'ny', 'texas', 'tx', 'florida', 'fl', 'illinois', 'il', 'pennsylvania', 'pa', 'ohio', 'oh', 'georgia', 'ga', 'north carolina', 'nc', 'michigan', 'mi', 'inc', 'terry', 'north', 'south', 'east', 'west', 'address', '地址', '街道', '路', '大道', '街', '邮编', '邮政编码', '410', 'terry', 'ave'];
                if (addressKeywords.some(keyword => context.includes(keyword))) {
                    continue; // 跳过地址中的邮政编码
                }
            }
            
            // 排除明显不是验证码的内容
            const isExcluded = excludePatterns.some(pattern => pattern.test(code));
            if (!isExcluded) {
                numberMatches.push(code);
            }
        }
        
        // 如果找到数字验证码，优先返回（优先6位，然后5位，最后4位或7-8位）
        if (numberMatches.length > 0) {
            const preferred = numberMatches.find(m => m.length === 6) ||
                             numberMatches.find(m => m.length === 5) ||
                             numberMatches.find(m => m.length === 4) ||
                             numberMatches[0];
            return preferred;
        }
        
        // 2. 查找纯字母验证码（4-8位，支持大小写混合）
        // 只在有明确验证码关键词时才提取纯字母验证码，避免误识别普通单词
        const letterPatternWithKeyword = /(?:验证码|code|verification\s+code|pin|otp)[：:\s]+([A-Za-z]{4,8})\b/gi;
        const letterMatchWithKeyword = content.match(letterPatternWithKeyword);
        if (letterMatchWithKeyword) {
            for (const match of letterMatchWithKeyword) {
                const codeMatch = match.match(/([A-Za-z]{4,8})$/);
                if (codeMatch && codeMatch[1]) {
                    const code = codeMatch[1];
                    // 排除明显是单词的情况（全小写且是常见单词）
                    const commonWordsLower = ['text', 'mail', 'html', 'body', 'head', 'link', 'form', 'data', 'info', 'name', 'time', 'date', 'user', 'pass', 'page', 'site', 'file', 'path', 'view', 'edit', 'save', 'send', 'read', 'open', 'close', 'back', 'next', 'prev', 'home', 'menu', 'help', 'more', 'less', 'full', 'part', 'some', 'many', 'most', 'each', 'both', 'only', 'just', 'very', 'much', 'more', 'most', 'such', 'than', 'then', 'them', 'they', 'this', 'that', 'with', 'from', 'your', 'have', 'will', 'would', 'which', 'there', 'their', 'when', 'what', 'where', 'these', 'those'];
                    if (!commonWordsLower.includes(code.toLowerCase())) {
                        return code; // 保留原始大小写
                    }
                }
            }
        }
        
        // 如果没有找到带关键词的纯字母验证码，不提取纯字母（避免误识别）
        
        // 3. 最后查找字母数字组合验证码（4-8位，必须包含字母和数字）
        const alphanumericPattern = /\b([A-Za-z0-9]{4,8})\b/g;
        const alphanumericMatches = [];
        while ((match = alphanumericPattern.exec(content)) !== null) {
            const code = match[1]; // 保留原始大小写
            // 必须同时包含字母和数字，且不是纯数字或纯字母
            const hasLetter = /[A-Za-z]/.test(code);
            const hasNumber = /[0-9]/.test(code);
            if (hasLetter && hasNumber && code.length >= 4 && code.length <= 8) {
                alphanumericMatches.push(code);
            }
        }
        
        // 如果找到字母数字组合验证码，返回第一个（保留原始大小写）
        if (alphanumericMatches.length > 0) {
            return alphanumericMatches[0];
        }
        
        return null;
    }
};

// 如果需要在模块环境中使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}

