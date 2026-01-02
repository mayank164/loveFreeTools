var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// server/workers-mysql.js
var getApiBase = /* @__PURE__ */ __name((env) => {
  if (env && env.API_BASE) return env.API_BASE;
  if (typeof API_BASE !== "undefined") return API_BASE;
  return "http://35.220.142.223:3001";
}, "getApiBase");
var AIService = {
  // AI 模型配置
  MODEL: "@cf/meta/llama-3-8b-instruct",
  // AI 功能开关（可通过环境变量控制）
  isEnabled: /* @__PURE__ */ __name(() => {
    if (typeof AI_ENABLED !== "undefined") return AI_ENABLED === "true";
    return true;
  }, "isEnabled"),
  // ModelScope 备用 API 配置
  MODELSCOPE_API: "https://api-inference.modelscope.cn/v1/chat/completions",
  MODELSCOPE_MODEL: "deepseek-ai/DeepSeek-V3.2",
  /**
   * 调用 ModelScope API（备用）
   * @param {object} env - Worker 环境对象
   * @param {string} prompt - 提示词
   * @returns {Promise<string>} AI 响应
   */
  async callModelScope(env, prompt) {
    const apiKey = env.MODELSCOPE_KEY || "ms-7c9a95a1-bbfe-4011-8eba-11162b1dd120";
    try {
      console.log("[ModelScope] Calling API...");
      const response = await fetch(this.MODELSCOPE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.MODELSCOPE_MODEL,
          messages: [
            { role: "system", content: "\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u90AE\u4EF6\u5206\u6790\u52A9\u624B\u3002\u8BF7\u6839\u636E\u8981\u6C42\u7B80\u6D01\u51C6\u786E\u5730\u56DE\u7B54\uFF0C\u53EA\u8F93\u51FA\u7ED3\u679C\uFF0C\u4E0D\u8981\u89E3\u91CA\u3002" },
            { role: "user", content: prompt }
          ],
          max_tokens: 500,
          stream: false
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[ModelScope] API error:", response.status, errorText.substring(0, 200));
        return null;
      }
      const data = await response.json();
      const result = data.choices?.[0]?.message?.content || "";
      console.log("[ModelScope] Success, response length:", result.length);
      return result;
    } catch (error) {
      console.error("[ModelScope] Call failed:", error.message);
      return null;
    }
  },
  /**
   * 调用 AI 模型（优先 Cloudflare，失败后切换 ModelScope）
   * @param {object} env - Worker 环境对象
   * @param {string} prompt - 提示词
   * @returns {Promise<string>} AI 响应
   */
  async callAI(env, prompt) {
    if (env.AI) {
      console.log("[AI] Using Cloudflare Workers AI, model:", this.MODEL);
      try {
        const response = await env.AI.run(this.MODEL, {
          messages: [
            { role: "system", content: "\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u90AE\u4EF6\u5206\u6790\u52A9\u624B\u3002\u8BF7\u6839\u636E\u8981\u6C42\u7B80\u6D01\u51C6\u786E\u5730\u56DE\u7B54\uFF0C\u53EA\u8F93\u51FA\u7ED3\u679C\uFF0C\u4E0D\u8981\u89E3\u91CA\u3002" },
            { role: "user", content: prompt }
          ],
          max_tokens: 500
        });
        console.log("[AI] Cloudflare AI response:", JSON.stringify(response).substring(0, 200));
        if (response && response.response) {
          console.log("[AI] Cloudflare AI success, length:", response.response.length);
          return response.response;
        }
        console.log("[AI] Cloudflare AI returned empty or invalid response");
      } catch (error) {
        console.error("[AI] Cloudflare AI failed:", error.message, error.stack);
      }
    } else {
      console.log("[AI] env.AI not available, Cloudflare AI not bound");
    }
    console.log("[AI] Using ModelScope API as fallback");
    return await this.callModelScope(env, prompt);
  },
  /**
   * 从邮件中提取验证码
   * @param {object} env - Worker 环境对象
   * @param {string} text - 邮件文本内容
   * @param {string} subject - 邮件主题
   * @returns {Promise<string|null>} 验证码
   */
  async extractVerificationCode(env, text, subject) {
    if (!this.isEnabled()) return null;
    const content = `${subject}
${text}`.substring(0, 2e3);
    const prompt = `\u4ECE\u4EE5\u4E0B\u90AE\u4EF6\u5185\u5BB9\u4E2D\u63D0\u53D6\u9A8C\u8BC1\u7801\u3002\u9A8C\u8BC1\u7801\u901A\u5E38\u662F4-8\u4F4D\u7684\u6570\u5B57\u6216\u5B57\u6BCD\u6570\u5B57\u7EC4\u5408\u3002
\u5982\u679C\u627E\u5230\u9A8C\u8BC1\u7801\uFF0C\u53EA\u8F93\u51FA\u9A8C\u8BC1\u7801\u672C\u8EAB\uFF08\u5982\uFF1A123456 \u6216 ABC123\uFF09\u3002
\u5982\u679C\u6CA1\u6709\u627E\u5230\u9A8C\u8BC1\u7801\uFF0C\u8F93\u51FA\uFF1A\u65E0

\u90AE\u4EF6\u5185\u5BB9\uFF1A
${content}`;
    const result = await this.callAI(env, prompt);
    if (!result || result.includes("\u65E0") || result.length > 10) {
      return null;
    }
    const code = result.trim().replace(/[^a-zA-Z0-9]/g, "");
    return code.length >= 4 && code.length <= 8 ? code : null;
  },
  /**
   * 生成邮件摘要
   * @param {object} env - Worker 环境对象
   * @param {string} text - 邮件文本内容
   * @param {string} subject - 邮件主题
   * @returns {Promise<string|null>} 摘要
   */
  async generateSummary(env, text, subject) {
    if (!this.isEnabled()) return null;
    const content = `${subject}
${text}`.substring(0, 3e3);
    const prompt = `\u7528\u4E2D\u82F1\u53CC\u8BED\u5404\u4E00\u53E5\u8BDD\u6982\u62EC\u4EE5\u4E0B\u90AE\u4EF6\u5185\u5BB9\u3002
\u683C\u5F0F\uFF1A\u4E2D\u6587\u5185\u5BB9 | English content
\u4E0D\u8981\u52A0\u4EFB\u4F55\u524D\u7F00\u6807\u7B7E\uFF0C\u76F4\u63A5\u8F93\u51FA\u5185\u5BB9\uFF0C\u7528|\u5206\u9694\u3002\u6BCF\u79CD\u8BED\u8A00\u4E0D\u8D85\u8FC730\u5B57\u3002

${content}`;
    const result = await this.callAI(env, prompt);
    if (!result) return null;
    return result.trim().substring(0, 150);
  },
  /**
   * 检测是否为垃圾邮件
   * @param {object} env - Worker 环境对象
   * @param {string} text - 邮件文本内容
   * @param {string} subject - 邮件主题
   * @param {string} from - 发件人
   * @returns {Promise<boolean>} 是否为垃圾邮件
   */
  async detectSpam(env, text, subject, from) {
    if (!this.isEnabled()) return false;
    const content = `\u53D1\u4EF6\u4EBA: ${from}
\u4E3B\u9898: ${subject}
\u5185\u5BB9: ${text}`.substring(0, 2e3);
    const prompt = `\u5224\u65AD\u4EE5\u4E0B\u90AE\u4EF6\u662F\u5426\u4E3A\u5783\u573E\u90AE\u4EF6\u6216\u9493\u9C7C\u90AE\u4EF6\u3002
\u53EA\u56DE\u7B54"\u662F"\u6216"\u5426"\u3002

${content}`;
    const result = await this.callAI(env, prompt);
    if (!result) return false;
    return result.includes("\u662F");
  },
  /**
   * 检测邮件语言
   * @param {object} env - Worker 环境对象
   * @param {string} text - 邮件文本内容
   * @returns {Promise<string>} 语言代码 (zh/en/ja/ko/...)
   */
  async detectLanguage(env, text) {
    if (!this.isEnabled()) return "unknown";
    const content = text.substring(0, 500);
    const prompt = `\u68C0\u6D4B\u4EE5\u4E0B\u6587\u672C\u7684\u8BED\u8A00\uFF0C\u53EA\u8F93\u51FA\u8BED\u8A00\u4EE3\u7801\uFF08\u5982\uFF1Azh\u3001en\u3001ja\u3001ko\u3001fr\u3001de\u3001es\u3001ru\uFF09\uFF1A

${content}`;
    const result = await this.callAI(env, prompt);
    if (!result) return "unknown";
    const lang = result.trim().toLowerCase().replace(/[^a-z]/g, "");
    return lang.length === 2 ? lang : "unknown";
  },
  /**
   * 翻译文本内容
   * @param {object} env - Worker 环境对象
   * @param {string} text - 要翻译的文本
   * @param {string} targetLang - 目标语言 (zh/en/ja/ko/...)
   * @returns {Promise<string|null>} 翻译结果
   */
  async translate(env, text, targetLang = "zh") {
    if (!this.isEnabled()) return null;
    const langMap = {
      "zh": "\u4E2D\u6587",
      "en": "\u82F1\u6587",
      "ja": "\u65E5\u6587",
      "ko": "\u97E9\u6587",
      "fr": "\u6CD5\u6587",
      "de": "\u5FB7\u6587",
      "es": "\u897F\u73ED\u7259\u6587",
      "ru": "\u4FC4\u6587"
    };
    const targetName = langMap[targetLang] || "\u4E2D\u6587";
    const content = text.substring(0, 3e3);
    const prompt = `\u5C06\u4EE5\u4E0B\u6587\u672C\u7FFB\u8BD1\u6210${targetName}\uFF0C\u53EA\u8F93\u51FA\u7FFB\u8BD1\u7ED3\u679C\uFF1A

${content}`;
    const result = await this.callAI(env, prompt);
    return result ? result.trim() : null;
  },
  /**
   * 检测 URL 安全性
   * @param {object} env - Worker 环境对象
   * @param {string} url - 要检测的 URL
   * @returns {Promise<{safe: boolean, reason: string}>} 安全检测结果
   */
  async checkUrlSafety(env, url) {
    if (!this.isEnabled()) {
      return { safe: true, reason: "AI \u529F\u80FD\u5DF2\u7981\u7528" };
    }
    const prompt = `\u5206\u6790\u4EE5\u4E0B URL \u662F\u5426\u53EF\u80FD\u662F\u6076\u610F\u94FE\u63A5\uFF08\u9493\u9C7C\u3001\u8BC8\u9A97\u3001\u6076\u610F\u8F6F\u4EF6\u7B49\uFF09\u3002
\u8F93\u51FA\u683C\u5F0F\uFF1A\u5B89\u5168/\u53EF\u7591/\u5371\u9669 - \u539F\u56E0

URL: ${url}`;
    const result = await this.callAI(env, prompt);
    if (!result) {
      return { safe: true, reason: "\u65E0\u6CD5\u5206\u6790" };
    }
    const isSafe = result.includes("\u5B89\u5168") && !result.includes("\u4E0D\u5B89\u5168");
    const reason = result.replace(/^(安全|可疑|危险)\s*[-:：]?\s*/, "").trim();
    return {
      safe: isSafe,
      reason: reason || (isSafe ? "\u672A\u53D1\u73B0\u53EF\u7591\u7279\u5F81" : "\u5B58\u5728\u6F5C\u5728\u98CE\u9669")
    };
  },
  /**
   * 综合分析邮件（验证码提取 + 摘要 + 垃圾检测 + 语言检测）
   * @param {object} env - Worker 环境对象
   * @param {object} email - 邮件对象 {subject, text, html, from}
   * @returns {Promise<object>} 分析结果
   */
  async analyzeEmail(env, email) {
    if (!this.isEnabled()) {
      return {
        verificationCode: null,
        summary: null,
        isSpam: false,
        language: "unknown",
        aiEnabled: false
      };
    }
    const { subject = "", text = "", from = "" } = email;
    const [verificationCode, summary, isSpamResult, language] = await Promise.all([
      this.extractVerificationCode(env, text, subject),
      this.generateSummary(env, text, subject),
      this.detectSpam(env, text, subject, from),
      this.detectLanguage(env, text)
    ]);
    const isSpam = verificationCode ? false : isSpamResult;
    return {
      verificationCode,
      summary,
      isSpam,
      language,
      aiEnabled: true
    };
  }
};
var workers_mysql_default = {
  async email(message, env, ctx) {
    ctx.waitUntil(handleEmail(message, env));
  },
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};
async function handleEmail(message, env) {
  try {
    const to = message.to;
    const from = message.from;
    const subject = message.headers.get("subject") || "(\u65E0\u4E3B\u9898)";
    const date = (/* @__PURE__ */ new Date()).toISOString();
    const rawEmail = await new Response(message.raw).text();
    const { text, html } = await extractEmailContent(rawEmail);
    let aiResult = {
      verificationCode: null,
      summary: null,
      isSpam: false,
      language: "unknown",
      aiEnabled: false
    };
    try {
      aiResult = await AIService.analyzeEmail(env, {
        subject,
        text: text || "",
        from
      });
      console.log(`AI analysis: code=${aiResult.verificationCode || "none"}, summary=${aiResult.summary ? "yes" : "no"}, spam=${aiResult.isSpam}, lang=${aiResult.language}`);
    } catch (aiError) {
      console.error("AI analysis failed:", aiError);
    }
    const emailData = {
      from,
      to,
      subject,
      date,
      text: text || "",
      html: html || "",
      raw: rawEmail.substring(0, 1e4),
      // 限制大小
      // AI 分析字段
      verificationCode: aiResult.verificationCode,
      summary: aiResult.summary,
      isSpam: aiResult.isSpam,
      language: aiResult.language
    };
    const response = await fetch(`${getApiBase(env)}/api/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emailData)
    });
    if (response.ok) {
      console.log(`Email stored for ${to}, text length: ${text?.length || 0}, html length: ${html?.length || 0}`);
    } else {
      const error = await response.text();
      console.error(`Failed to store email: ${error}`);
    }
  } catch (error) {
    console.error("Error handling email:", error);
  }
}
__name(handleEmail, "handleEmail");
async function handleShortLinkRedirect(code, origin, env) {
  try {
    const response = await fetch(`${getApiBase(env)}/api/links/${code}/redirect`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      return new Response(getShortLinkErrorHTML(data.error || "\u77ED\u94FE\u63A5\u4E0D\u5B58\u5728", origin), {
        status: response.status,
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        }
      });
    }
    return Response.redirect(data.url, 302);
  } catch (error) {
    console.error("Short link redirect error:", error);
    return new Response(getShortLinkErrorHTML("\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528", origin), {
      status: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    });
  }
}
__name(handleShortLinkRedirect, "handleShortLinkRedirect");
function getShortLinkErrorHTML(errorMessage, origin) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\u77ED\u94FE\u63A5\u9519\u8BEF - \u516C\u76CA\u5E73\u53F0</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0a0e17;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 40px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #ef4444;
      font-size: 24px;
      margin-bottom: 10px;
    }
    p {
      color: #94a3b8;
      margin-bottom: 30px;
    }
    a {
      display: inline-block;
      padding: 12px 24px;
      background: #00f5d4;
      color: #0a0e17;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
    }
    a:hover {
      background: #00c4aa;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">:(</div>
    <h1>${errorMessage}</h1>
    <p>\u8BF7\u68C0\u67E5\u94FE\u63A5\u662F\u5426\u6B63\u786E\uFF0C\u6216\u8054\u7CFB\u94FE\u63A5\u521B\u5EFA\u8005</p>
    <a href="https://free.violetteam.cloud">\u8FD4\u56DE\u9996\u9875</a>
  </div>
</body>
</html>`;
}
__name(getShortLinkErrorHTML, "getShortLinkErrorHTML");
function getSubdomainErrorHTML(subdomain, errorMessage) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\u5B50\u57DF\u540D\u4E0D\u5B58\u5728 - \u516C\u76CA\u5E73\u53F0</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%);
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 40px;
      max-width: 500px;
    }
    .icon {
      font-size: 80px;
      margin-bottom: 20px;
      opacity: 0.8;
    }
    h1 {
      color: #f59e0b;
      font-size: 28px;
      margin-bottom: 15px;
    }
    .domain {
      font-family: 'JetBrains Mono', monospace;
      color: #00f5d4;
      font-size: 18px;
      background: rgba(0, 245, 212, 0.1);
      padding: 8px 16px;
      border-radius: 6px;
      margin-bottom: 20px;
      display: inline-block;
    }
    .error-msg {
      color: #94a3b8;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    .buttons {
      display: flex;
      gap: 15px;
      justify-content: center;
      flex-wrap: wrap;
    }
    a {
      display: inline-block;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .primary {
      background: #00f5d4;
      color: #0a0e17;
    }
    .primary:hover {
      background: #00c4aa;
    }
    .secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #f1f5f9;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .secondary:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">:/</div>
    <h1>\u5B50\u57DF\u540D\u4E0D\u5B58\u5728</h1>
    <div class="domain">${subdomain}.yljdteam.com</div>
    <p class="error-msg">${errorMessage || "\u8BE5\u5B50\u57DF\u540D\u5C1A\u672A\u6CE8\u518C\u6216\u5DF2\u8FC7\u671F"}</p>
    <div class="buttons">
      <a href="https://free.violetteam.cloud" class="primary">\u8FD4\u56DE\u9996\u9875</a>
      <a href="https://free.violetteam.cloud#subdomain" class="secondary">\u7533\u8BF7\u5B50\u57DF\u540D</a>
    </div>
  </div>
</body>
</html>`;
}
__name(getSubdomainErrorHTML, "getSubdomainErrorHTML");
function getApiDocumentationHTML(origin) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API \u4F7F\u7528\u8BF4\u660E - \u516C\u76CA\u5E73\u53F0</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
      :root {
          --primary: #00f5d4;
          --primary-dim: #00c4aa;
          --primary-glow: rgba(0, 245, 212, 0.3);
          --secondary: #9b5de5;
          --secondary-dim: #7b3ec5;
          --accent: #f15bb5;
          --bg-dark: #0a0e17;
          --bg-darker: #060912;
          --bg-card: #111827;
          --bg-card-hover: #1a2332;
          --bg-elevated: #1e293b;
          --text-primary: #f1f5f9;
          --text-secondary: #94a3b8;
          --text-muted: #64748b;
          --border: #1e293b;
          --border-glow: rgba(0, 245, 212, 0.2);
          --success: #10b981;
          --warning: #f59e0b;
          --error: #ef4444;
          --font-mono: 'JetBrains Mono', 'Consolas', monospace;
          --font-sans: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
      }
      body {
          font-family: var(--font-sans);
          background: var(--bg-dark);
          color: var(--text-primary);
          line-height: 1.6;
          min-height: 100vh;
          padding: 20px;
      }
      .container {
          max-width: 1200px;
          margin: 0 auto;
      }
      .header {
          text-align: center;
          padding: 40px 20px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 40px;
      }
      .logo {
          font-size: 48px;
          font-weight: 700;
          color: var(--primary);
          margin-bottom: 10px;
          text-shadow: 0 0 20px var(--primary-glow);
      }
      .subtitle {
          color: var(--text-secondary);
          font-size: 18px;
          margin-top: 10px;
      }
      .card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 30px;
          margin-bottom: 30px;
          transition: all 0.3s ease;
      }
      .card:hover {
          border-color: var(--primary);
          box-shadow: 0 0 20px var(--primary-glow);
      }
      .card-title {
          font-size: 24px;
          color: var(--primary);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
      }
      .card-title::before {
          content: '';
          width: 4px;
          height: 24px;
          background: var(--primary);
          border-radius: 2px;
      }
      .endpoint {
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 15px;
      }
      .endpoint-method {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          font-family: var(--font-mono);
          margin-right: 10px;
      }
      .method-get { background: var(--success); color: white; }
      .method-post { background: var(--primary); color: var(--bg-dark); }
      .method-delete { background: var(--error); color: white; }
      .endpoint-path {
          font-family: var(--font-mono);
          color: var(--text-primary);
          font-size: 16px;
          margin: 10px 0;
      }
      .endpoint-desc {
          color: var(--text-secondary);
          margin-top: 10px;
          line-height: 1.8;
      }
      .code-block {
          background: var(--bg-darker);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 20px;
          margin: 15px 0;
          overflow-x: auto;
      }
      .code-block code {
          font-family: var(--font-mono);
          font-size: 14px;
          color: var(--text-primary);
          white-space: pre;
      }
      .highlight {
          color: var(--primary);
      }
      .example {
          background: var(--bg-elevated);
          border-left: 3px solid var(--primary);
          padding: 15px 20px;
          margin: 15px 0;
          border-radius: 4px;
      }
      .example-title {
          color: var(--primary);
          font-weight: 600;
          margin-bottom: 10px;
      }
      .badge {
          display: inline-block;
          padding: 4px 10px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 12px;
          color: var(--text-secondary);
          margin-left: 10px;
      }
      .footer {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-muted);
          border-top: 1px solid var(--border);
          margin-top: 60px;
      }
      a {
          color: var(--primary);
          text-decoration: none;
      }
      a:hover {
          text-decoration: underline;
      }
      .btn-primary {
          display: inline-block;
          padding: 10px 24px;
          background: var(--primary);
          color: var(--bg-dark);
          border-radius: 8px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.3s ease;
      }
      .btn-primary:hover {
          background: var(--primary-dim);
          text-decoration: none;
          transform: translateY(-2px);
          box-shadow: 0 4px 15px var(--primary-glow);
      }
      .btn-secondary {
          display: inline-block;
          padding: 10px 24px;
          background: transparent;
          color: var(--primary);
          border: 1px solid var(--primary);
          border-radius: 8px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.3s ease;
      }
      .btn-secondary:hover {
          background: rgba(0, 245, 212, 0.1);
          text-decoration: none;
          transform: translateY(-2px);
      }
      .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid var(--success);
          border-radius: 20px;
          font-size: 13px;
          color: var(--success);
      }
      .status-badge::before {
          content: '';
          width: 8px;
          height: 8px;
          background: var(--success);
          border-radius: 50%;
          animation: pulse 2s infinite;
      }
      @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
      }
      .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-top: 20px;
      }
      .feature-item {
          padding: 20px;
          background: var(--bg-elevated);
          border-radius: 8px;
          border-left: 3px solid var(--primary);
      }
      .feature-item h4 {
          color: var(--primary);
          margin-bottom: 8px;
          font-size: 16px;
      }
      .feature-item p {
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.6;
      }
  </style>
</head>
<body>
  <div class="container">
      <div class="header">
          <div class="logo">\u221E \u516C\u76CA\u5E73\u53F0</div>
          <div class="subtitle">API \u4F7F\u7528\u8BF4\u660E\u6587\u6863</div>
          <div class="subtitle" style="font-size: 14px; margin-top: 5px; color: var(--text-muted);">
              \u5F53\u524D\u57DF\u540D: <span class="highlight">${origin}</span>
          </div>
          <div style="margin-top: 20px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <a href="https://free.violetteam.cloud" class="btn-primary">\u524D\u5F80\u4E3B\u9875</a>
              <a href="https://github.com/violettoolssite/loveFreeTools" target="_blank" class="btn-secondary">GitHub \u6E90\u7801</a>
          </div>
      </div>

      <div class="card">
          <div class="card-title">\u670D\u52A1\u7B80\u4ECB</div>
          <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
              <span class="status-badge">\u670D\u52A1\u8FD0\u884C\u4E2D</span>
              <span style="color: var(--text-muted); font-size: 13px;">Cloudflare Workers \u5168\u7403\u8FB9\u7F18\u90E8\u7F72</span>
          </div>
          <p style="color: var(--text-secondary); line-height: 1.8;">
              \u516C\u76CA\u5E73\u53F0\u662F\u4E00\u4E2A\u5B8C\u5168\u514D\u8D39\u7684\u516C\u76CA\u670D\u52A1\u9879\u76EE\uFF0C\u81F4\u529B\u4E8E\u4E3A\u5F00\u53D1\u8005\u63D0\u4F9B\u4FBF\u6377\u7684\u5DE5\u5177\u548C\u670D\u52A1\u3002
              \u6211\u4EEC\u63D0\u4F9B\u4E34\u65F6\u90AE\u7BB1\u3001\u77ED\u94FE\u63A5\u670D\u52A1\u3001GitHub \u4EE3\u7406\u3001\u6587\u4EF6\u52A0\u901F\u4E0B\u8F7D\u3001AI \u667A\u80FD\u5206\u6790\u7B49\u591A\u9879\u514D\u8D39\u670D\u52A1\u3002
              \u6240\u6709\u670D\u52A1\u5747\u901A\u8FC7 Cloudflare Workers \u90E8\u7F72\uFF0C\u652F\u6301\u9AD8\u5E76\u53D1\u3001\u4F4E\u5EF6\u8FDF\u8BBF\u95EE\u3002\u90AE\u4EF6\u6570\u636E\u4F1A\u5728 24 \u5C0F\u65F6\u540E\u81EA\u52A8\u5220\u9664\uFF0C\u786E\u4FDD\u9690\u79C1\u5B89\u5168\u3002
          </p>
          <div class="feature-grid">
              <div class="feature-item">
                  <h4>\u4E34\u65F6\u90AE\u7BB1</h4>
                  <p>\u514D\u8D39\u63A5\u6536\u90AE\u4EF6\uFF0C\u652F\u6301\u591A\u57DF\u540D\uFF0C24 \u5C0F\u65F6\u81EA\u52A8\u6E05\u7406\uFF0C\u4FDD\u62A4\u9690\u79C1</p>
              </div>
              <div class="feature-item">
                  <h4>\u77ED\u94FE\u63A5\u670D\u52A1</h4>
                  <p>\u957F\u94FE\u63A5\u8F6C\u77ED\u94FE\uFF0C\u652F\u6301\u81EA\u5B9A\u4E49\u77ED\u7801\uFF0C\u8BBF\u95EE\u7EDF\u8BA1\uFF0C\u53EF\u8BBE\u8FC7\u671F\u65F6\u95F4</p>
              </div>
              <div class="feature-item">
                  <h4>GitHub \u52A0\u901F</h4>
                  <p>\u4EE3\u7406 GitHub \u8BBF\u95EE\uFF0C\u652F\u6301 git clone\u3001\u6587\u4EF6\u4E0B\u8F7D\u7B49\u64CD\u4F5C</p>
              </div>
              <div class="feature-item">
                  <h4>\u6587\u4EF6\u52A0\u901F</h4>
                  <p>\u52A0\u901F\u4E0B\u8F7D\u4EFB\u610F HTTPS \u6587\u4EF6\uFF0C\u65E0\u5927\u5C0F\u9650\u5236\uFF0C\u652F\u6301\u65AD\u70B9\u7EED\u4F20</p>
              </div>
              <div class="feature-item">
                  <h4>AI \u667A\u80FD\u5206\u6790</h4>
                  <p>\u90AE\u4EF6\u6458\u8981\u751F\u6210\u3001\u9A8C\u8BC1\u7801\u63D0\u53D6\u3001\u5783\u573E\u68C0\u6D4B\u3001\u591A\u8BED\u8A00\u7FFB\u8BD1</p>
              </div>
              <div class="feature-item">
                  <h4>\u5F00\u6E90\u900F\u660E</h4>
                  <p>\u4EE3\u7801\u5B8C\u5168\u5F00\u6E90\uFF0C\u6B22\u8FCE\u8D21\u732E\u548C\u81EA\u90E8\u7F72</p>
              </div>
          </div>
      </div>

      <div class="card">
          <div class="card-title">\u90AE\u4EF6 API</div>
          
          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/api/emails/:email</span>
              <div class="endpoint-desc">
                  \u83B7\u53D6\u6307\u5B9A\u90AE\u7BB1\u5730\u5740\u7684\u6240\u6709\u90AE\u4EF6\u5217\u8868\uFF08\u516C\u5F00\u63A5\u53E3\uFF09
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u793A\u4F8B</div>
                      <code>GET ${origin}/api/emails/test@example.com</code>
                  </div>
                  <div class="example">
                      <div class="example-title">\u54CD\u5E94\u683C\u5F0F</div>
                      <code>{
  "email": "test@example.com",
  "emails": [
    {
      "id": 1,
      "from": "sender@example.com",
      "to": "test@example.com",
      "subject": "\u90AE\u4EF6\u4E3B\u9898",
      "date": "2025-12-29T00:00:00.000Z",
      "text": "\u7EAF\u6587\u672C\u5185\u5BB9",
      "html": "HTML \u5185\u5BB9"
    }
  ],
  "count": 1
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-delete">DELETE</span>
              <span class="endpoint-path">/api/emails/:email/:id</span>
              <div class="endpoint-desc">
                  \u5220\u9664\u6307\u5B9A\u90AE\u4EF6\uFF08\u516C\u5F00\u63A5\u53E3\uFF09
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u793A\u4F8B</div>
                      <code>DELETE ${origin}/api/emails/test@example.com/1</code>
                  </div>
              </div>
          </div>
      </div>

      <div class="card">
          <div class="card-title">\u57DF\u540D\u7BA1\u7406 API</div>
          
          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/api/domains</span>
              <div class="endpoint-desc">
                  \u83B7\u53D6\u6240\u6709\u53EF\u7528\u7684\u57DF\u540D\u5217\u8868\uFF08\u516C\u5F00\u63A5\u53E3\uFF09
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u793A\u4F8B</div>
                      <code>GET ${origin}/api/domains</code>
                  </div>
                  <div class="example">
                      <div class="example-title">\u54CD\u5E94\u683C\u5F0F</div>
                      <code>{
  "success": true,
  "domains": [
    {
      "name": "example.com",
      "api": "https://example.com"
    }
  ]
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/domains</span>
              <div class="endpoint-desc">
                  \u6DFB\u52A0\u65B0\u57DF\u540D\uFF08\u516C\u5F00\u63A5\u53E3\uFF0C\u65E0\u9700\u7BA1\u7406\u5458\u5BC6\u94A5\uFF09
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u793A\u4F8B</div>
                      <code>POST ${origin}/api/domains
Headers: {
"Content-Type": "application/json"
}
Body: {
"name": "example.com",
"api": "https://example.com"
}</code>
                  </div>
                  <div style="margin-top: 10px; padding: 10px; background: var(--bg-elevated); border-radius: 4px; font-size: 13px; color: var(--text-secondary);">
                      \u63D0\u793A\uFF1A\u4EFB\u4F55\u4EBA\u90FD\u53EF\u4EE5\u6DFB\u52A0\u57DF\u540D\uFF0C\u8FD9\u6709\u52A9\u4E8E\u6269\u5C55\u5E73\u53F0\u670D\u52A1\u8303\u56F4
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-delete">DELETE</span>
              <span class="endpoint-path">/api/domains/:name</span>
              <div class="endpoint-desc">
                  \u5220\u9664\u6307\u5B9A\u57DF\u540D <span class="badge">\u9700\u8981\u7BA1\u7406\u5458\u5BC6\u94A5</span>
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u793A\u4F8B</div>
                      <code>DELETE ${origin}/api/domains/example.com
Headers: {
"X-Admin-Key": "your-admin-key"
}</code>
                  </div>
                  <div style="margin-top: 10px; padding: 10px; background: var(--bg-elevated); border-radius: 4px; font-size: 13px; color: var(--text-secondary);">
                      \u6CE8\u610F\uFF1A\u5220\u9664\u64CD\u4F5C\u9700\u8981\u7BA1\u7406\u5458\u5BC6\u94A5\uFF0C\u9632\u6B62\u8BEF\u5220
                  </div>
              </div>
          </div>
      </div>

      <div class="card">
          <div class="card-title">\u53D1\u9001\u90AE\u4EF6 API</div>
          
          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/send-email</span>
              <div class="endpoint-desc">
                  \u53D1\u9001\u90AE\u4EF6\uFF08\u9700\u8981\u914D\u7F6E RESEND_API_KEY\uFF09
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u793A\u4F8B</div>
                      <code>POST ${origin}/api/send-email
Headers: {
"Content-Type": "application/json"
}
Body: {
"from": "sender@example.com",
"to": "recipient@example.com",
"subject": "\u90AE\u4EF6\u4E3B\u9898",
"text": "\u7EAF\u6587\u672C\u5185\u5BB9",
"html": "HTML \u5185\u5BB9\uFF08\u53EF\u9009\uFF09"
}</code>
                  </div>
              </div>
          </div>
      </div>

      <div class="card">
          <div class="card-title">\u77ED\u94FE\u63A5\u670D\u52A1</div>
          <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
              \u514D\u8D39\u7684\u77ED\u94FE\u63A5\u751F\u6210\u670D\u52A1\uFF0C\u5C06\u957F URL \u8F6C\u6362\u4E3A\u77ED\u94FE\u63A5\uFF0C\u652F\u6301\u81EA\u5B9A\u4E49\u77ED\u7801\u548C\u8BBF\u95EE\u7EDF\u8BA1\u3002
          </p>
          
          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/links</span>
              <div class="endpoint-desc">
                  \u521B\u5EFA\u77ED\u94FE\u63A5
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u793A\u4F8B</div>
                      <code>POST ${origin}/api/links
Headers: {
"Content-Type": "application/json"
}
Body: {
"url": "https://example.com/very/long/url",
"title": "\u94FE\u63A5\u6807\u9898\uFF08\u53EF\u9009\uFF09",
"customCode": "mylink\uFF08\u53EF\u9009\uFF0C\u81EA\u5B9A\u4E49\u77ED\u7801\uFF09",
"expiresIn": 24\uFF08\u53EF\u9009\uFF0C\u8FC7\u671F\u65F6\u95F4\uFF0C\u5355\u4F4D\uFF1A\u5C0F\u65F6\uFF09
}</code>
                  </div>
                  <div class="example">
                      <div class="example-title">\u54CD\u5E94\u683C\u5F0F</div>
                      <code>{
  "success": true,
  "code": "abc123",
  "shortUrl": "${origin}/s/abc123",
  "originalUrl": "https://example.com/very/long/url",
  "expiresAt": "2025-01-01T12:00:00.000Z"
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/s/:code</span>
              <div class="endpoint-desc">
                  \u8BBF\u95EE\u77ED\u94FE\u63A5\uFF0C\u81EA\u52A8\u8DF3\u8F6C\u5230\u539F\u59CB URL
                  <div class="example">
                      <div class="example-title">\u4F7F\u7528\u793A\u4F8B</div>
                      <code># \u76F4\u63A5\u8BBF\u95EE\u77ED\u94FE\u63A5
${origin}/s/abc123

# \u5C06\u81EA\u52A8\u8DF3\u8F6C\u5230\u539F\u59CB URL</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/api/links/:code/stats</span>
              <div class="endpoint-desc">
                  \u83B7\u53D6\u77ED\u94FE\u63A5\u7EDF\u8BA1\u4FE1\u606F
                  <div class="example">
                      <div class="example-title">\u54CD\u5E94\u683C\u5F0F</div>
                      <code>{
  "success": true,
  "stats": {
    "code": "abc123",
    "originalUrl": "https://example.com/...",
    "clicks": 42,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "expiresAt": null,
    "isExpired": false
  }
}</code>
                  </div>
              </div>
          </div>

          <div style="margin-top: 15px; padding: 15px; background: var(--bg-elevated); border-radius: 6px; border-left: 3px solid var(--primary);">
              <strong style="color: var(--primary);">\u529F\u80FD\u7279\u6027\uFF1A</strong>
              <ul style="margin-top: 10px; padding-left: 20px; color: var(--text-secondary);">
                  <li>\u652F\u6301\u81EA\u5B9A\u4E49\u77ED\u7801\uFF083-20 \u5B57\u7B26\uFF09</li>
                  <li>\u53EF\u8BBE\u7F6E\u8FC7\u671F\u65F6\u95F4</li>
                  <li>\u8BBF\u95EE\u6B21\u6570\u7EDF\u8BA1</li>
                  <li>\u5B8C\u5168\u514D\u8D39\uFF0C\u65E0\u9700\u6CE8\u518C</li>
              </ul>
          </div>
      </div>

      <div class="card">
          <div class="card-title">GitHub \u4EE3\u7406\u670D\u52A1</div>
          <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
              \u901A\u8FC7\u672C\u57DF\u540D\u4EE3\u7406\u8BBF\u95EE GitHub\uFF0C\u652F\u6301 Git \u514B\u9686\u3001\u4E0B\u8F7D\u7B49\u64CD\u4F5C\u3002\u81EA\u52A8\u5C06 <span class="highlight">github.com</span> \u66FF\u6362\u4E3A\u5F53\u524D\u57DF\u540D\u3002
          </p>
          
          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/{user}/{repo}[.git]</span>
              <div class="endpoint-desc">
                  GitHub \u4ED3\u5E93\u4EE3\u7406\u8BBF\u95EE
                  <div class="example">
                      <div class="example-title">\u4F7F\u7528\u793A\u4F8B</div>
                      <code># Git \u514B\u9686
git clone ${origin}/username/repository.git

# \u8BBF\u95EE\u4ED3\u5E93\u9875\u9762
curl ${origin}/username/repository

# \u4E0B\u8F7D\u6587\u4EF6
curl ${origin}/username/repository/raw/main/file.txt</code>
                  </div>
                  <div style="margin-top: 15px; padding: 15px; background: var(--bg-elevated); border-radius: 6px; border-left: 3px solid var(--warning);">
                      <strong style="color: var(--warning);">\u9650\u5236\u8BF4\u660E\uFF1A</strong>
                      <ul style="margin-top: 10px; padding-left: 20px; color: var(--text-secondary);">
                          <li>\u4EC5\u5141\u8BB8 Git/Curl/Wget \u7B49\u5DE5\u5177\u8BBF\u95EE</li>
                          <li>\u6BCF IP \u6BCF\u5206\u949F\u6700\u591A 60 \u6B21\u8BF7\u6C42</li>
                          <li>\u7981\u6B62\u8BBF\u95EE\u767B\u5F55\u3001\u8BBE\u7F6E\u7B49\u654F\u611F\u8DEF\u5F84</li>
                      </ul>
                  </div>
              </div>
          </div>
      </div>

      <div class="card">
          <div class="card-title">\u6587\u4EF6\u52A0\u901F\u4E0B\u8F7D</div>
          <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
              \u901A\u8FC7 Cloudflare \u52A0\u901F\u4E0B\u8F7D\u5404\u7C7B\u6587\u4EF6\uFF0C\u652F\u6301 GitHub Releases\u3001npm\u3001PyPI \u7B49\u4EFB\u610F HTTPS \u6587\u4EF6\uFF0C\u65E0\u5927\u5C0F\u9650\u5236\u3002
          </p>
          
          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/proxy/?url={\u6587\u4EF6URL}</span>
              <div class="endpoint-desc">
                  \u4EE3\u7406\u4E0B\u8F7D\u6307\u5B9A URL \u7684\u6587\u4EF6
                  <div class="example">
                      <div class="example-title">\u4F7F\u7528\u793A\u4F8B</div>
                      <code># \u52A0\u901F\u4E0B\u8F7D GitHub Release \u6587\u4EF6
\${origin}/proxy/?url=https://github.com/ollama/ollama/releases/download/v0.13.5/ollama-linux-arm64.tgz

# \u52A0\u901F\u4E0B\u8F7D npm \u5305
\${origin}/proxy/?url=https://registry.npmjs.org/package/-/package-1.0.0.tgz

# \u52A0\u901F\u4E0B\u8F7D\u4EFB\u610F HTTPS \u6587\u4EF6
\${origin}/proxy/?url=https://example.com/file.zip</code>
                  </div>
                  <div style="margin-top: 15px; padding: 15px; background: var(--bg-elevated); border-radius: 6px; border-left: 3px solid var(--success);">
                      <strong style="color: var(--success);">\u529F\u80FD\u7279\u6027\uFF1A</strong>
                      <ul style="margin-top: 10px; padding-left: 20px; color: var(--text-secondary);">
                          <li>\u652F\u6301\u65AD\u70B9\u7EED\u4F20\uFF08Range \u8BF7\u6C42\uFF09</li>
                          <li>\u65E0\u6587\u4EF6\u5927\u5C0F\u9650\u5236</li>
                          <li>\u81EA\u52A8\u8DDF\u968F\u91CD\u5B9A\u5411</li>
                          <li>\u4FDD\u7559\u539F\u59CB\u6587\u4EF6\u540D</li>
                      </ul>
                  </div>
              </div>
          </div>
      </div>

      <div class="card">
          <div class="card-title">CORS \u652F\u6301</div>
          <p style="color: var(--text-secondary); line-height: 1.8;">
              \u6240\u6709 API \u63A5\u53E3\u5747\u652F\u6301\u8DE8\u57DF\u8BBF\u95EE\uFF08CORS\uFF09\uFF0C\u5141\u8BB8\u4ECE\u4EFB\u4F55\u57DF\u540D\u8C03\u7528\u3002\u54CD\u5E94\u5934\u5305\u542B\uFF1A
          </p>
          <div class="code-block">
              <code>Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Admin-Key</code>
          </div>
      </div>

      <div class="card">
          <div class="card-title">AI \u667A\u80FD\u5206\u6790 <span class="badge">Cloudflare Workers AI</span></div>
          <p style="color: var(--text-secondary); margin-bottom: 20px; line-height: 1.8;">
              \u57FA\u4E8E Cloudflare Workers AI\uFF08Meta Llama 3 8B \u6A21\u578B\uFF09\u63D0\u4F9B\u667A\u80FD\u6587\u672C\u5206\u6790\u529F\u80FD\u3002
              \u90AE\u4EF6\u63A5\u6536\u65F6\u81EA\u52A8\u8FDB\u884C AI \u5206\u6790\uFF0C\u4E5F\u53EF\u901A\u8FC7 API \u624B\u52A8\u8C03\u7528\u3002
          </p>
          
          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/ai/translate</span>
              <div class="endpoint-desc">
                  \u7FFB\u8BD1\u6587\u672C\u5185\u5BB9\uFF0C\u652F\u6301\u591A\u8BED\u8A00\u4E92\u8BD1
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u53C2\u6570</div>
                      <code>{
  "text": "\u8981\u7FFB\u8BD1\u7684\u6587\u672C\u5185\u5BB9",
  "targetLang": "\u76EE\u6807\u8BED\u8A00\u4EE3\u7801"
}

\u652F\u6301\u7684\u8BED\u8A00\u4EE3\u7801\uFF1A
  zh - \u4E2D\u6587    en - \u82F1\u6587    ja - \u65E5\u6587
  ko - \u97E9\u6587    fr - \u6CD5\u6587    de - \u5FB7\u6587
  es - \u897F\u73ED\u7259\u6587    ru - \u4FC4\u6587</code>
                  </div>
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u793A\u4F8B</div>
                      <code>curl -X POST ${origin}/api/ai/translate \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Hello, World!", "targetLang": "zh"}'</code>
                  </div>
                  <div class="example">
                      <div class="example-title">\u54CD\u5E94\u683C\u5F0F</div>
                      <code>{
  "success": true,
  "translation": "\u4F60\u597D\uFF0C\u4E16\u754C\uFF01",
  "targetLang": "zh"
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/ai/summarize</span>
              <div class="endpoint-desc">
                  \u751F\u6210\u6587\u672C\u6458\u8981\uFF0C\u8FD4\u56DE\u4E2D\u82F1\u53CC\u8BED\u6458\u8981
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u53C2\u6570</div>
                      <code>{
  "text": "\u90AE\u4EF6\u6216\u6587\u7AE0\u6B63\u6587\u5185\u5BB9",
  "subject": "\u6807\u9898\uFF08\u53EF\u9009\uFF0C\u7528\u4E8E\u8F85\u52A9\u7406\u89E3\uFF09"
}</code>
                  </div>
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u793A\u4F8B</div>
                      <code>curl -X POST ${origin}/api/ai/summarize \\
  -H "Content-Type: application/json" \\
  -d '{"text": "\u60A8\u7684\u8BA2\u5355\u5DF2\u53D1\u8D27...", "subject": "\u8BA2\u5355\u901A\u77E5"}'</code>
                  </div>
                  <div class="example">
                      <div class="example-title">\u54CD\u5E94\u683C\u5F0F</div>
                      <code>{
  "success": true,
  "summary": "\u8BA2\u5355\u5DF2\u53D1\u8D27\uFF0C\u9884\u8BA13\u5929\u9001\u8FBE | Order shipped, expected in 3 days"
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/ai/extract-code</span>
              <div class="endpoint-desc">
                  \u4ECE\u6587\u672C\u4E2D\u667A\u80FD\u63D0\u53D6\u9A8C\u8BC1\u7801\uFF084-8\u4F4D\u6570\u5B57\u6216\u5B57\u6BCD\u7EC4\u5408\uFF09
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u53C2\u6570</div>
                      <code>{
  "text": "\u90AE\u4EF6\u6B63\u6587\u5185\u5BB9",
  "subject": "\u90AE\u4EF6\u4E3B\u9898\uFF08\u53EF\u9009\uFF09"
}</code>
                  </div>
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u793A\u4F8B</div>
                      <code>curl -X POST ${origin}/api/ai/extract-code \\
  -H "Content-Type: application/json" \\
  -d '{"text": "\u60A8\u7684\u9A8C\u8BC1\u7801\u662F 123456\uFF0C10\u5206\u949F\u5185\u6709\u6548", "subject": "\u9A8C\u8BC1\u90AE\u4EF6"}'</code>
                  </div>
                  <div class="example">
                      <div class="example-title">\u54CD\u5E94\u683C\u5F0F</div>
                      <code>{
  "success": true,
  "code": "123456"
}

// \u5982\u679C\u672A\u627E\u5230\u9A8C\u8BC1\u7801
{
  "success": true,
  "code": null
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-post">POST</span>
              <span class="endpoint-path">/api/ai/check-url</span>
              <div class="endpoint-desc">
                  \u68C0\u6D4B URL \u5B89\u5168\u6027\uFF0C\u8BC6\u522B\u9493\u9C7C\u3001\u6076\u610F\u94FE\u63A5
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u53C2\u6570</div>
                      <code>{
  "url": "\u8981\u68C0\u6D4B\u7684 URL \u5730\u5740"
}</code>
                  </div>
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u793A\u4F8B</div>
                      <code>curl -X POST ${origin}/api/ai/check-url \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/login"}'</code>
                  </div>
                  <div class="example">
                      <div class="example-title">\u54CD\u5E94\u683C\u5F0F</div>
                      <code>// \u5B89\u5168\u94FE\u63A5
{
  "success": true,
  "safe": true,
  "reason": "\u672A\u53D1\u73B0\u53EF\u7591\u7279\u5F81"
}

// \u53EF\u7591\u94FE\u63A5
{
  "success": true,
  "safe": false,
  "reason": "\u57DF\u540D\u4E0E\u77E5\u540D\u7F51\u7AD9\u76F8\u4F3C\uFF0C\u53EF\u80FD\u662F\u9493\u9C7C\u7F51\u7AD9"
}</code>
                  </div>
              </div>
          </div>

          <div class="endpoint">
              <span class="endpoint-method method-get">GET</span>
              <span class="endpoint-path">/api/links/:code/safety</span>
              <div class="endpoint-desc">
                  \u68C0\u6D4B\u77ED\u94FE\u63A5\u76EE\u6807 URL \u7684\u5B89\u5168\u6027
                  <div class="example">
                      <div class="example-title">\u8BF7\u6C42\u793A\u4F8B</div>
                      <code>curl ${origin}/api/links/abc123/safety</code>
                  </div>
                  <div class="example">
                      <div class="example-title">\u54CD\u5E94\u683C\u5F0F</div>
                      <code>{
  "success": true,
  "code": "abc123",
  "originalUrl": "https://example.com",
  "safe": true,
  "reason": "\u672A\u53D1\u73B0\u53EF\u7591\u7279\u5F81"
}</code>
                  </div>
              </div>
          </div>

          <div style="margin-top: 20px; padding: 20px; background: var(--bg-elevated); border-radius: 8px; border-left: 3px solid var(--secondary);">
              <strong style="color: var(--secondary);">AI \u529F\u80FD\u8BF4\u660E</strong>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                  <div>
                      <p style="color: var(--text-primary); font-weight: 500; margin-bottom: 5px;">\u6A21\u578B</p>
                      <p style="color: var(--text-secondary); font-size: 14px;">Meta Llama 3 8B Instruct</p>
                  </div>
                  <div>
                      <p style="color: var(--text-primary); font-weight: 500; margin-bottom: 5px;">\u81EA\u52A8\u5206\u6790</p>
                      <p style="color: var(--text-secondary); font-size: 14px;">\u6536\u5230\u90AE\u4EF6\u65F6\u81EA\u52A8\u63D0\u53D6\u9A8C\u8BC1\u7801\u3001\u751F\u6210\u6458\u8981\u3001\u68C0\u6D4B\u5783\u573E\u90AE\u4EF6</p>
                  </div>
                  <div>
                      <p style="color: var(--text-primary); font-weight: 500; margin-bottom: 5px;">\u591A\u8BED\u8A00\u652F\u6301</p>
                      <p style="color: var(--text-secondary); font-size: 14px;">\u4E2D\u3001\u82F1\u3001\u65E5\u3001\u97E9\u3001\u6CD5\u3001\u5FB7\u3001\u897F\u3001\u4FC4</p>
                  </div>
                  <div>
                      <p style="color: var(--text-primary); font-weight: 500; margin-bottom: 5px;">\u5907\u7528\u670D\u52A1</p>
                      <p style="color: var(--text-secondary); font-size: 14px;">Workers AI \u4E0D\u53EF\u7528\u65F6\u81EA\u52A8\u5207\u6362 ModelScope</p>
                  </div>
              </div>
          </div>

          <div style="margin-top: 15px; padding: 15px; background: var(--bg-elevated); border-radius: 6px; border-left: 3px solid var(--warning);">
              <strong style="color: var(--warning);">\u9519\u8BEF\u54CD\u5E94</strong>
              <div class="code-block" style="margin-top: 10px; margin-bottom: 0;">
                  <code>// \u53C2\u6570\u7F3A\u5931
{ "success": false, "error": "\u7F3A\u5C11 text \u53C2\u6570" }

// AI \u670D\u52A1\u4E0D\u53EF\u7528
{ "success": false, "error": "AI \u670D\u52A1\u4E0D\u53EF\u7528" }

// \u670D\u52A1\u5668\u9519\u8BEF
{ "success": false, "error": "\u9519\u8BEF\u4FE1\u606F" }</code>
              </div>
          </div>
      </div>

      <div class="card" style="background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%); border: 2px solid var(--primary);">
          <div class="card-title" style="font-size: 20px;">\u5173\u4E8E\u516C\u76CA\u5E73\u53F0</div>
          <p style="color: var(--text-secondary); line-height: 1.8; margin-bottom: 15px;">
              \u6211\u4EEC\u662F\u4E00\u4E2A\u975E\u76C8\u5229\u7684\u516C\u76CA\u9879\u76EE\uFF0C\u81F4\u529B\u4E8E\u4E3A\u5F00\u53D1\u8005\u793E\u533A\u63D0\u4F9B\u514D\u8D39\u3001\u53EF\u9760\u7684\u670D\u52A1\u3002
              \u6240\u6709\u670D\u52A1\u5747\u514D\u8D39\u63D0\u4F9B\uFF0C\u65E0\u4EFB\u4F55\u5546\u4E1A\u76EE\u7684\u3002
          </p>
          <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px;">
              <div style="flex: 1; min-width: 200px;">
                  <p style="color: var(--primary); font-weight: 600; margin-bottom: 8px;">\u670D\u52A1\u7406\u5FF5</p>
                  <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
                      \u514D\u8D39\u3001\u5F00\u653E\u3001\u900F\u660E\uFF0C\u4E3A\u5F00\u53D1\u8005\u63D0\u4F9B\u6700\u4FBF\u6377\u7684\u5DE5\u5177
                  </p>
              </div>
              <div style="flex: 1; min-width: 200px;">
                  <p style="color: var(--primary); font-weight: 600; margin-bottom: 8px;">\u9690\u79C1\u4FDD\u62A4</p>
                  <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
                      \u6240\u6709\u6570\u636E\u81EA\u52A8\u6E05\u7406\uFF0C\u4E0D\u5B58\u50A8\u4EFB\u4F55\u4E2A\u4EBA\u4FE1\u606F
                  </p>
              </div>
          </div>
      </div>

      <div class="footer">
          <p>Powered by <span class="highlight">VioletTeam</span></p>
          <p style="margin-top: 10px; font-size: 14px;">\u516C\u76CA\u5E73\u53F0 - \u514D\u8D39\u516C\u76CA\u670D\u52A1 | \u8BA9\u5F00\u53D1\u66F4\u7B80\u5355</p>
          <div style="margin-top: 15px; display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
              <a href="https://free.violetteam.cloud" style="color: var(--text-secondary);">\u4E3B\u9875</a>
              <a href="https://free.violetteam.cloud/terms.html" style="color: var(--text-secondary);">\u670D\u52A1\u6761\u6B3E</a>
              <a href="https://github.com/violettoolssite/loveFreeTools" target="_blank" style="color: var(--text-secondary);">GitHub</a>
              <a href="mailto:chf@yljdteam.com" style="color: var(--text-secondary);">\u8054\u7CFB\u6211\u4EEC</a>
          </div>
          <p style="margin-top: 15px; font-size: 12px; color: var(--text-muted);">
              \u672C\u5E73\u53F0\u6240\u6709\u670D\u52A1\u5B8C\u5168\u514D\u8D39\uFF0C\u6B22\u8FCE\u4F7F\u7528\u548C\u53CD\u9988
          </p>
      </div>
  </div>
</body>
</html>`;
}
__name(getApiDocumentationHTML, "getApiDocumentationHTML");
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const apiBase = getApiBase(env);
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key"
  };
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const jsonResponse = /* @__PURE__ */ __name((data, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }, "jsonResponse");
  const host = url.hostname;
  const subdomainMatch = host.match(/^([a-z0-9][a-z0-9-]*[a-z0-9]?)\.yljdteam\.com$/i);
  if (subdomainMatch) {
    const subdomain = subdomainMatch[1].toLowerCase();
    if (subdomain !== "www" && subdomain !== "yljdteam") {
      try {
        const redirectResp = await fetch(`${apiBase}/api/subdomains/${subdomain}/redirect`);
        const redirectData = await redirectResp.json();
        if (redirectData.success && redirectData.targetUrl) {
          return new Response(null, {
            status: 302,
            headers: {
              ...corsHeaders,
              "Location": redirectData.targetUrl
            }
          });
        } else {
          return new Response(getSubdomainErrorHTML(subdomain, redirectData.error), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
          });
        }
      } catch (error) {
        console.error(`\u5B50\u57DF\u540D\u91CD\u5B9A\u5411\u5931\u8D25: ${subdomain}`, error);
        return new Response(getSubdomainErrorHTML(subdomain, "\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528"), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
        });
      }
    }
  }
  if (url.pathname === "/api/ai/translate" && request.method === "POST") {
    try {
      const body = await request.json();
      const { text, targetLang = "zh" } = body;
      if (!text) {
        return jsonResponse({ success: false, error: "\u7F3A\u5C11 text \u53C2\u6570" }, 400);
      }
      const result = await AIService.translate(env, text, targetLang);
      if (result) {
        return jsonResponse({ success: true, translation: result, targetLang });
      } else {
        return jsonResponse({ success: false, error: "AI \u670D\u52A1\u4E0D\u53EF\u7528" }, 503);
      }
    } catch (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  }
  if (url.pathname === "/api/ai/summarize" && request.method === "POST") {
    try {
      const body = await request.json();
      const { text, subject = "" } = body;
      if (!text) {
        return jsonResponse({ success: false, error: "\u7F3A\u5C11 text \u53C2\u6570" }, 400);
      }
      const result = await AIService.generateSummary(env, text, subject);
      if (result) {
        return jsonResponse({ success: true, summary: result });
      } else {
        return jsonResponse({ success: false, error: "AI \u670D\u52A1\u4E0D\u53EF\u7528" }, 503);
      }
    } catch (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  }
  if (url.pathname === "/api/ai/extract-code" && request.method === "POST") {
    try {
      const body = await request.json();
      const { text, subject = "" } = body;
      if (!text) {
        return jsonResponse({ success: false, error: "\u7F3A\u5C11 text \u53C2\u6570" }, 400);
      }
      const result = await AIService.extractVerificationCode(env, text, subject);
      return jsonResponse({ success: true, code: result });
    } catch (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  }
  if (url.pathname === "/api/ai/check-url" && request.method === "POST") {
    try {
      const body = await request.json();
      const { url: targetUrl } = body;
      if (!targetUrl) {
        return jsonResponse({ success: false, error: "\u7F3A\u5C11 url \u53C2\u6570" }, 400);
      }
      const result = await AIService.checkUrlSafety(env, targetUrl);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  }
  if (url.pathname.match(/^\/api\/links\/[^/]+\/safety$/) && request.method === "GET") {
    try {
      const code = url.pathname.split("/")[3];
      const linkResponse = await fetch(`${apiBase}/api/links/${code}`);
      const linkData = await linkResponse.json();
      if (!linkData.success) {
        return jsonResponse({ success: false, error: "\u77ED\u94FE\u63A5\u4E0D\u5B58\u5728" }, 404);
      }
      const safetyResult = await AIService.checkUrlSafety(env, linkData.url);
      return jsonResponse({
        success: true,
        code,
        url: linkData.url,
        ...safetyResult
      });
    } catch (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }
  }
  if (url.pathname.startsWith("/api/")) {
    try {
      const headers = new Headers(request.headers);
      headers.delete("host");
      const targetUrl = `${apiBase}${url.pathname}${url.search}`;
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null
      });
      const responseHeaders = new Headers(response.headers);
      Object.keys(corsHeaders).forEach((key) => {
        responseHeaders.set(key, corsHeaders[key]);
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (error) {
      return jsonResponse({
        success: false,
        error: "API \u4EE3\u7406\u5931\u8D25",
        message: error.message
      }, 502);
    }
  }
  if (url.pathname === "/") {
    return new Response(getApiDocumentationHTML(url.origin), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  if (url.pathname === "/proxy/" || url.pathname === "/proxy") {
    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) {
      return jsonResponse({
        error: "\u7F3A\u5C11 url \u53C2\u6570",
        usage: url.origin + "/proxy/?url=https://example.com/file.zip"
      }, 400);
    }
    return handleFileProxy(targetUrl, request);
  }
  if (url.pathname.startsWith("/s/")) {
    const code = url.pathname.slice(3);
    if (code) {
      return handleShortLinkRedirect(code, url.origin, env);
    }
  }
  if (!url.pathname.startsWith("/api/") && !url.pathname.startsWith("/proxy") && !url.pathname.startsWith("/s/") && url.pathname.length > 1) {
    return handleGitHubProxy(request, url);
  }
  return jsonResponse({
    service: "\u516C\u76CA\u5E73\u53F0 - \u514D\u8D39\u516C\u76CA\u670D\u52A1",
    status: "running",
    backend: "MySQL",
    features: ["\u4E34\u65F6\u90AE\u7BB1", "GitHub \u4EE3\u7406", "\u6587\u4EF6\u52A0\u901F\u4E0B\u8F7D", "\u77ED\u94FE\u63A5"],
    endpoints: [
      "GET /api/domains",
      "POST /api/domains",
      "DELETE /api/domains/:name",
      "GET /api/emails/:email",
      "POST /api/emails",
      "DELETE /api/emails/:email/:id",
      "POST /api/send-email",
      "POST /api/links - \u521B\u5EFA\u77ED\u94FE\u63A5",
      "GET /api/links/:code - \u83B7\u53D6\u77ED\u94FE\u63A5\u4FE1\u606F",
      "GET /s/:code - \u77ED\u94FE\u63A5\u8DF3\u8F6C",
      "GET /{user}/{repo}[.git] - GitHub \u4EE3\u7406",
      "GET /proxy/?url={\u6587\u4EF6URL} - \u6587\u4EF6\u52A0\u901F\u4E0B\u8F7D"
    ]
  });
}
__name(handleRequest, "handleRequest");
var GITHUB_PROXY_CONFIG = {
  // 频率限制：每 IP 每分钟最大请求数
  rateLimit: 60,
  rateLimitWindow: 60,
  // 秒
  // User-Agent 白名单（允许的客户端）
  allowedUserAgents: [
    "git/",
    // Git 客户端
    "curl/",
    // curl
    "wget/",
    // wget
    "libcurl/",
    // libcurl
    "Go-http-client",
    // Go HTTP 客户端
    "python-requests",
    // Python requests
    "axios/",
    // Axios
    "node-fetch",
    // Node fetch
    "Mozilla/"
    // 浏览器（用于查看仓库页面）
  ],
  // 路径黑名单（禁止代理的路径）
  blockedPaths: [
    "/login",
    "/logout",
    "/signup",
    "/join",
    "/sessions",
    "/settings",
    "/password_reset",
    "/users/",
    "/orgs/",
    "/.git/config"
    // 防止泄露配置
  ],
  // 禁止的文件扩展名（防止滥用下载大文件）
  blockedExtensions: [
    ".zip",
    ".tar.gz",
    ".tgz",
    ".exe",
    ".dmg",
    ".pkg",
    ".deb",
    ".rpm",
    ".msi",
    ".iso"
  ]
};
var rateLimitMap = /* @__PURE__ */ new Map();
function checkRateLimit(ip) {
  const now = Math.floor(Date.now() / 1e3);
  const windowStart = now - GITHUB_PROXY_CONFIG.rateLimitWindow;
  let data = rateLimitMap.get(ip);
  if (!data) {
    data = { timestamps: [] };
  }
  data.timestamps = data.timestamps.filter((t) => t > windowStart);
  if (data.timestamps.length >= GITHUB_PROXY_CONFIG.rateLimit) {
    return false;
  }
  data.timestamps.push(now);
  rateLimitMap.set(ip, data);
  if (rateLimitMap.size > 1e4) {
    const keysToDelete = [];
    rateLimitMap.forEach((value, key) => {
      if (value.timestamps.length === 0 || value.timestamps[value.timestamps.length - 1] < windowStart) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => rateLimitMap.delete(key));
  }
  return true;
}
__name(checkRateLimit, "checkRateLimit");
function isAllowedUserAgent(userAgent) {
  if (!userAgent) return false;
  return GITHUB_PROXY_CONFIG.allowedUserAgents.some(
    (ua) => userAgent.toLowerCase().includes(ua.toLowerCase())
  );
}
__name(isAllowedUserAgent, "isAllowedUserAgent");
function isBlockedPath(pathname) {
  const lowerPath = pathname.toLowerCase();
  if (GITHUB_PROXY_CONFIG.blockedPaths.some((p) => lowerPath.includes(p.toLowerCase()))) {
    return true;
  }
  if (GITHUB_PROXY_CONFIG.blockedExtensions.some((ext) => lowerPath.endsWith(ext.toLowerCase()))) {
    return true;
  }
  return false;
}
__name(isBlockedPath, "isBlockedPath");
function getClientIP(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Real-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "0.0.0.0";
}
__name(getClientIP, "getClientIP");
var FILE_PROXY_CONFIG = {
  allowedProtocols: ["https:", "http:"],
  blockedDomains: ["localhost", "127.0.0.1", "0.0.0.0", "::1"],
  timeout: 3e5
  // 5分钟超时
};
async function handleFileProxy(targetUrl, request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };
  const errorResponse = /* @__PURE__ */ __name((message, status) => {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: corsHeaders
    });
  }, "errorResponse");
  try {
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return errorResponse("\u65E0\u6548\u7684 URL", 400);
    }
    if (!FILE_PROXY_CONFIG.allowedProtocols.includes(parsedUrl.protocol)) {
      return errorResponse("\u4EC5\u652F\u6301 HTTP/HTTPS \u534F\u8BAE", 400);
    }
    if (FILE_PROXY_CONFIG.blockedDomains.some((d) => parsedUrl.hostname.includes(d))) {
      return errorResponse("\u7981\u6B62\u8BBF\u95EE\u7684\u57DF\u540D", 403);
    }
    const headers = new Headers();
    headers.set("User-Agent", request.headers.get("User-Agent") || "Mozilla/5.0");
    const range = request.headers.get("Range");
    if (range) {
      headers.set("Range", range);
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FILE_PROXY_CONFIG.timeout);
    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
      redirect: "follow",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Expose-Headers", "*");
    const headersToPass = ["Content-Type", "Content-Length", "Content-Disposition", "Accept-Ranges", "Content-Range", "ETag", "Last-Modified"];
    headersToPass.forEach((h) => {
      const value = response.headers.get(h);
      if (value) responseHeaders.set(h, value);
    });
    if (!responseHeaders.get("Content-Disposition")) {
      const filename = parsedUrl.pathname.split("/").pop();
      if (filename && filename.includes(".")) {
        responseHeaders.set("Content-Disposition", 'attachment; filename="' + filename + '"');
      }
    }
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return errorResponse("\u8BF7\u6C42\u8D85\u65F6", 504);
    }
    return errorResponse("\u4EE3\u7406\u8BF7\u6C42\u5931\u8D25: " + error.message, 502);
  }
}
__name(handleFileProxy, "handleFileProxy");
async function handleGitHubProxy(request, url) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get("User-Agent") || "";
  if (!isAllowedUserAgent(userAgent)) {
    return new Response(JSON.stringify({
      error: "\u7981\u6B62\u8BBF\u95EE",
      message: "\u4E0D\u652F\u6301\u7684\u5BA2\u6237\u7AEF\u7C7B\u578B",
      hint: "\u8BF7\u4F7F\u7528 git/curl/wget \u7B49\u5DE5\u5177\u8BBF\u95EE"
    }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
  if (isBlockedPath(url.pathname)) {
    return new Response(JSON.stringify({
      error: "\u7981\u6B62\u8BBF\u95EE",
      message: "\u8BE5\u8DEF\u5F84\u4E0D\u5141\u8BB8\u4EE3\u7406"
    }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
  const withinLimit = checkRateLimit(clientIP);
  if (!withinLimit) {
    return new Response(JSON.stringify({
      error: "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41",
      message: `\u6BCF\u5206\u949F\u6700\u591A ${GITHUB_PROXY_CONFIG.rateLimit} \u6B21\u8BF7\u6C42`,
      retryAfter: GITHUB_PROXY_CONFIG.rateLimitWindow
    }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Retry-After": String(GITHUB_PROXY_CONFIG.rateLimitWindow)
      }
    });
  }
  const githubUrl = `https://github.com${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("User-Agent", userAgent || "git/2.40.0");
  try {
    const response = await fetch(githubUrl, {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
      redirect: "follow"
    });
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set("X-RateLimit-Limit", String(GITHUB_PROXY_CONFIG.rateLimit));
    responseHeaders.set("X-RateLimit-Window", `${GITHUB_PROXY_CONFIG.rateLimitWindow}s`);
    const location = responseHeaders.get("Location");
    if (location && location.includes("github.com")) {
      const newLocation = location.replace("https://github.com", url.origin);
      responseHeaders.set("Location", newLocation);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "GitHub \u4EE3\u7406\u5931\u8D25",
      message: error.message,
      url: githubUrl
    }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(handleGitHubProxy, "handleGitHubProxy");
async function extractEmailContent(rawEmail) {
  let text = "";
  let html = "";
  try {
    const lines = rawEmail.split("\n");
    let inBody = false;
    let currentContentType = "";
    let currentEncoding = "";
    let currentCharset = "utf-8";
    let contentBuffer = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^Content-Type:\s*text\/(plain|html)/i)) {
        const typeMatch = line.match(/text\/(plain|html)/i);
        currentContentType = typeMatch ? typeMatch[1].toLowerCase() : "";
        const charsetMatch = line.match(/charset[=\s]*["']?([^"'\s;]+)/i);
        if (charsetMatch) {
          currentCharset = charsetMatch[1].toLowerCase();
        }
        continue;
      }
      if (line.match(/^Content-Transfer-Encoding:\s*(.+)/i)) {
        const match = line.match(/Content-Transfer-Encoding:\s*(.+)/i);
        currentEncoding = match ? match[1].trim().toLowerCase() : "";
        continue;
      }
      if (!inBody && line === "" && currentContentType) {
        inBody = true;
        continue;
      }
      if (inBody) {
        if (line.startsWith("--")) {
          if (contentBuffer.length > 0) {
            let content = decodeContent(contentBuffer.join("\n"), currentEncoding, currentCharset);
            if (currentContentType === "plain") {
              text = content;
            } else if (currentContentType === "html") {
              html = content;
            }
            contentBuffer = [];
          }
          inBody = false;
          currentContentType = "";
          currentEncoding = "";
          currentCharset = "utf-8";
          continue;
        }
        if (line.match(/^Content-/i)) continue;
        contentBuffer.push(line);
      }
    }
    if (contentBuffer.length > 0) {
      let content = decodeContent(contentBuffer.join("\n"), currentEncoding, currentCharset);
      if (currentContentType === "plain") {
        text = content;
      } else if (currentContentType === "html") {
        html = content;
      }
    }
  } catch (error) {
    console.error("Extract email content error:", error);
  }
  return { text, html };
}
__name(extractEmailContent, "extractEmailContent");
function decodeContent(content, encoding, charset) {
  try {
    charset = charset || "utf-8";
    if (encoding === "base64") {
      const cleaned = content.replace(/\s/g, "");
      const binaryString = atob(cleaned);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decoder = new TextDecoder(charset);
      content = decoder.decode(bytes);
    } else if (encoding === "quoted-printable") {
      content = decodeQuotedPrintable(content, charset);
    }
    return content;
  } catch (e) {
    console.error("Decode content error:", e);
    return content;
  }
}
__name(decodeContent, "decodeContent");
function decodeQuotedPrintable(str, charset = "utf-8") {
  try {
    str = str.replace(/=\r?\n/g, "");
    const bytes = [];
    let i = 0;
    while (i < str.length) {
      if (str[i] === "=" && i + 2 < str.length) {
        const hex = str.substr(i + 1, 2);
        if (/^[0-9A-F]{2}$/i.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 3;
        } else {
          bytes.push(str.charCodeAt(i));
          i++;
        }
      } else {
        bytes.push(str.charCodeAt(i));
        i++;
      }
    }
    const uint8Array = new Uint8Array(bytes);
    const decoder = new TextDecoder(charset);
    return decoder.decode(uint8Array);
  } catch (e) {
    console.error("Decode quoted-printable error:", e);
    return str;
  }
}
__name(decodeQuotedPrintable, "decodeQuotedPrintable");
export {
  workers_mysql_default as default
};
//# sourceMappingURL=workers-mysql.js.map
