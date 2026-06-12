/**
 * Chat Widget Backend Server
 * Express.js API for handling chat messages
 * Run: npm install && node server.js
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'test-key-123';
const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
const LLM_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.GEMINI_MODEL || process.env.OPENAI_MODEL || process.env.LLM_MODEL || 'gemini-3.1-flash-lite';
const GEMINI_FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.1-flash-lite')
  .split(',')
  .map(model => model.trim())
  .filter(Boolean);
const LLM_BASE_URL = (process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const LLM_API_STYLE = (process.env.LLM_API_STYLE || (LLM_PROVIDER === 'gemini' ? 'gemini' : 'responses')).toLowerCase();
const LLM_ENABLED = process.env.USE_LLM !== 'false' && Boolean(LLM_API_KEY);
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 6500);
const SMTP_HOST = process.env.SMTP_HOST || 'sv-mail4.hostsevenplus.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE !== 'false' : SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || 'clients@pksupplychain.com';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || `PK Supply Chain <${SMTP_USER}>`;
const LEAD_TO_EMAIL = process.env.LEAD_TO_EMAIL || 'pongchai@pksupplychain.com';
const MAIL_DAILY_LIMIT = Number(process.env.MAIL_DAILY_LIMIT || 2000);
const MAIL_WARN_THRESHOLD = Number(process.env.MAIL_WARN_THRESHOLD || Math.floor(MAIL_DAILY_LIMIT * 0.9));
const MAX_LEAD_IMAGE_BYTES = Number(process.env.MAX_LEAD_IMAGE_BYTES || 3 * 1024 * 1024);

const corsOptions = {
  origin(origin, callback) {
    const allowedOrigins = [
      'https://pksupplychain.com',
      'https://www.pksupplychain.com',
      'http://localhost:3000',
      'http://localhost:5173'
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
  optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '8mb' }));

// Serve chat widget
app.use(express.static(path.join(__dirname, '../widget')));

// Store conversations (in production, use database)
const conversations = new Map();
const mailUsage = {
  dateKey: getBangkokDateKey(),
  count: 0
};
let mailTransporter = null;

// API Key verification middleware
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Domain lock middleware - only allow pksupplychain.com
const verifyDomain = (req, res, next) => {
  const referer = req.headers.referer || '';
  const allowedDomains = ['pksupplychain.com', 'www.pksupplychain.com', 'localhost'];
  const isAllowed = allowedDomains.some(domain => referer.includes(domain));
  
  if (referer && !isAllowed) {
    return res.status(403).json({ error: 'Access denied: Widget restricted to pksupplychain.com' });
  }
  next();
};

/**
 * POST /chat
 * Main chat endpoint
 * Body: { message: string, sessionId: string, timestamp: string }
 */
app.post('/chat', verifyApiKey, verifyDomain, async (req, res) => {
  const { message, sessionId, language } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: 'Missing message or sessionId' });
  }

  try {
    // Store message
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }
    const conv = conversations.get(sessionId);
    conv.push({
      role: 'user',
      message,
      timestamp: new Date()
    });

    const reply = await generateReply(message, conv, language);

    // Store reply
    conv.push({
      role: 'assistant',
      message: reply,
      timestamp: new Date()
    });

    res.json({ reply, sessionId });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /lead
 * Send visitor contact details to PK Supply Chain.
 * Body: { name, email, message, sessionId, language, image?: { name, type, dataUrl } }
 */
app.post('/lead', verifyApiKey, verifyDomain, async (req, res) => {
  const { name, email, message = '', sessionId = '', language = 'th', image = null } = req.body;
  const cleanName = normalizeText(name, 120);
  const cleanEmail = normalizeText(email, 180);
  const cleanMessage = normalizeLongText(message, 1600);

  if (!cleanName || !isValidEmail(cleanEmail)) {
    return res.status(400).json({
      success: false,
      code: 'invalid_lead',
      message: language === 'en' ? 'Please enter a valid name and email.' : 'กรุณากรอกชื่อและอีเมลให้ถูกต้องครับ'
    });
  }

  if (!SMTP_PASS) {
    return res.status(503).json({
      success: false,
      code: 'mail_not_configured',
      message: language === 'en'
        ? 'Email sending is not configured yet. Please contact the team directly.'
        : 'ระบบส่งอีเมลยังไม่ได้ตั้งค่า กรุณาติดต่อทีมงานโดยตรงครับ'
    });
  }

  try {
    resetMailUsageIfNeeded();
    if (mailUsage.count >= MAIL_DAILY_LIMIT) {
      return res.status(429).json({
        success: false,
        code: 'send_limit_full',
        message: language === 'en'
          ? 'Email sending limit is full for today. Please contact the team directly.'
          : 'วันนี้ระบบส่งอีเมลถึงขีดจำกัดแล้ว กรุณาติดต่อทีมงานโดยตรงครับ',
        limit: getMailLimitInfo()
      });
    }

    const attachment = parseLeadImage(image);
    const mail = buildLeadMail({
      name: cleanName,
      email: cleanEmail,
      message: cleanMessage,
      sessionId,
      language,
      attachment
    });

    const info = await getMailTransporter().sendMail(mail);
    recordMailSend();

    const limit = getMailLimitInfo();
    res.json({
      success: true,
      messageId: info.messageId,
      message: limit.almostFull
        ? (language === 'en'
          ? 'Your information was sent, but the email sending limit is almost full today.'
          : 'ส่งข้อมูลแล้วครับ แต่วันนี้ระบบส่งอีเมลใกล้ถึงขีดจำกัดแล้ว')
        : (language === 'en'
          ? 'Your information was sent successfully. Our team will contact you soon.'
          : 'ส่งข้อมูลเรียบร้อยครับ ทีมงานจะติดต่อกลับโดยเร็ว'),
      limit
    });
  } catch (error) {
    console.error('Lead mail error:', error.message);
    if (error.statusCode === 400 || error.statusCode === 413) {
      return res.status(error.statusCode).json({
        success: false,
        code: 'invalid_image',
        message: language === 'en'
          ? 'Please upload a PNG, JPG, WebP, or GIF image under 3 MB.'
          : 'กรุณาอัปโหลดรูป PNG, JPG, WebP หรือ GIF ขนาดไม่เกิน 3 MB ครับ'
      });
    }

    res.status(500).json({
      success: false,
      code: 'mail_send_failed',
      message: language === 'en'
        ? 'We could not send the email right now. Please try again or contact the team directly.'
        : 'ตอนนี้ส่งอีเมลไม่ได้ กรุณาลองอีกครั้งหรือติดต่อทีมงานโดยตรงครับ'
    });
  }
});

/**
 * GET /session/:sessionId
 * Get conversation history
 */
app.get('/session/:sessionId', verifyApiKey, (req, res) => {
  const { sessionId } = req.params;
  const conv = conversations.get(sessionId) || [];
  res.json({ sessionId, messages: conv });
});

/**
 * DELETE /session/:sessionId
 * Clear conversation
 */
app.delete('/session/:sessionId', verifyApiKey, (req, res) => {
  const { sessionId } = req.params;
  conversations.delete(sessionId);
  res.json({ success: true, message: 'Session cleared' });
});

/**
 * GET /health
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

function getBangkokDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function resetMailUsageIfNeeded() {
  const dateKey = getBangkokDateKey();
  if (mailUsage.dateKey !== dateKey) {
    mailUsage.dateKey = dateKey;
    mailUsage.count = 0;
  }
}

function recordMailSend() {
  resetMailUsageIfNeeded();
  mailUsage.count += 1;
}

function getMailLimitInfo() {
  resetMailUsageIfNeeded();
  return {
    dateKey: mailUsage.dateKey,
    sent: mailUsage.count,
    limit: MAIL_DAILY_LIMIT,
    remaining: Math.max(MAIL_DAILY_LIMIT - mailUsage.count, 0),
    almostFull: mailUsage.count >= MAIL_WARN_THRESHOLD
  };
}

function normalizeText(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeLongText(value, maxLength) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, maxLength);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseLeadImage(image) {
  if (!image || !image.dataUrl) return null;

  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  const type = normalizeText(image.type, 80);
  if (!allowedTypes.has(type)) {
    const error = new Error('Unsupported image type');
    error.statusCode = 400;
    throw error;
  }

  const match = String(image.dataUrl).match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1] !== type) {
    const error = new Error('Invalid image data');
    error.statusCode = 400;
    throw error;
  }

  const content = Buffer.from(match[2], 'base64');
  if (!content.length || content.length > MAX_LEAD_IMAGE_BYTES) {
    const error = new Error('Image is too large');
    error.statusCode = 413;
    throw error;
  }

  const extension = type.split('/')[1].replace('jpeg', 'jpg');
  const safeName = normalizeText(image.name, 100)
    .replace(/[^a-z0-9._-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `lead-image.${extension}`;

  return {
    filename: safeName.includes('.') ? safeName : `${safeName}.${extension}`,
    content,
    contentType: type
  };
}

function getMailTransporter() {
  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  }

  return mailTransporter;
}

function buildLeadMail({ name, email, message, sessionId, language, attachment }) {
  const submittedAt = new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const safeMessage = normalizeLongText(message, 1600);
  const lines = [
    `New PK Supply Chain website lead`,
    ``,
    `Name: ${name}`,
    `Email: ${email}`,
    `Language: ${language === 'en' ? 'English' : 'Thai'}`,
    `Submitted: ${submittedAt} Bangkok time`,
    `Session: ${sessionId || '-'}`,
    ``,
    `Message:`,
    safeMessage || '-',
    ``,
    attachment ? `Attachment: ${attachment.filename}` : `Attachment: none`
  ];

  const htmlMessage = escapeHtml(safeMessage || '-').replace(/\n/g, '<br>');
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.55;">
      <h2 style="margin: 0 0 12px; color: #b80000;">New PK Supply Chain Website Lead</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tr><td style="padding: 6px 0; font-weight: 700;">Name</td><td style="padding: 6px 0;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 700;">Email</td><td style="padding: 6px 0;">${escapeHtml(email)}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 700;">Language</td><td style="padding: 6px 0;">${language === 'en' ? 'English' : 'Thai'}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 700;">Submitted</td><td style="padding: 6px 0;">${escapeHtml(submittedAt)} Bangkok time</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 700;">Session</td><td style="padding: 6px 0;">${escapeHtml(sessionId || '-')}</td></tr>
      </table>
      <h3 style="margin: 18px 0 8px;">Message</h3>
      <div style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;">${htmlMessage}</div>
      <p style="margin-top: 14px;">${attachment ? `Attached image: ${escapeHtml(attachment.filename)}` : 'No image attached.'}</p>
    </div>
  `;

  return {
    from: MAIL_FROM,
    to: LEAD_TO_EMAIL,
    replyTo: email,
    subject: `Website lead from ${name} - PK Supply Chain`,
    text: lines.join('\n'),
    html,
    attachments: attachment ? [attachment] : []
  };
}

/**
 * PK Supply Chain - Context-aware response generation
 * Handles supply chain, manufacturing, and service inquiries
 */
function detectLanguage(message) {
  return /[\u0E00-\u0E7F]/.test(message) ? 'th' : 'en';
}

function formatBilingualReply(message, thaiText, englishText) {
  return detectLanguage(message) === 'th'
    ? `${thaiText}\n\nEnglish: ${englishText}`
    : `${englishText}\n\nภาษาไทย: ${thaiText}`;
}

function formatLanguageReply(message, language, thaiText, englishText) {
  const selectedLanguage = ['th', 'en'].includes(language) ? language : detectLanguage(message);
  return selectedLanguage === 'th' ? thaiText : englishText;
}

function isModelQuestion(message) {
  return /\b(model|llm|gpt|gemini|ai model|ai)\b|what are you|ใช้โมเดล|โมเดล|เอไอ/i.test(message);
}

function getGeminiModelsToTry() {
  return Array.from(new Set([LLM_MODEL, ...GEMINI_FALLBACK_MODELS]));
}

function getModelLabel() {
  if (LLM_API_STYLE !== 'gemini') return LLM_MODEL;

  const models = getGeminiModelsToTry();
  if (models.length <= 1) return models[0];

  return `${models[0]} with fallback ${models.slice(1).join(', ')}`;
}

function getModelInfoReply(message, language) {
  if (!isModelQuestion(message)) return null;

  if (LLM_ENABLED) {
    return formatLanguageReply(
      message,
      language,
      `ตอนนี้ผมเป็น AI Agent สำหรับฝ่ายขายและซัพพอร์ตของ PK Supply Chain โดยตั้งค่าให้ใช้โมเดล ${getModelLabel()} บนฝั่งเซิร์ฟเวอร์ครับ`,
      `I am currently configured as a PK Supply Chain sales and support AI agent using ${getModelLabel()} on the server side.`
    );
  }

  return formatLanguageReply(
    message,
    language,
    `ตอนนี้ระบบยังไม่ได้เปิดใช้ LLM เพราะยังไม่มี GEMINI_API_KEY หรือ LLM_API_KEY ใน Vercel ครับ เมื่อตั้งค่าแล้ว Agent จะใช้โมเดล ${LLM_MODEL}`,
    `The LLM is not active yet because GEMINI_API_KEY or LLM_API_KEY is not set in Vercel. Once configured, the agent will use ${LLM_MODEL}.`
  );
}

function buildAgentInstructions(language = 'th') {
  const languageName = language === 'en' ? 'English' : 'Thai';

  return [
    'You are pk, the official AI sales and support assistant for PK Supply Chain Co., Ltd.',
    `Current selected chat language is ${languageName}. Reply in ${languageName} unless the visitor clearly asks to switch language.`,
    'Use "เรา" in Thai, and "we" in English. Do not use first-person singular.',
    'Answer from the knowledge base below only. If the answer is not available, politely say the support team will contact the customer with more information.',
    'Reply directly to the visitor in a short, clear, professional, and natural sales-support message.',
    'After answering, ask exactly one relevant open-ended question that helps understand the customer need. Do not ask yes/no questions. Do not repeat a question already asked in the conversation.',
    'Never invent prices, discounts, certifications, legal claims, or exact timelines. For quotations, explain that the quotation will be sent by email after the team reviews the details.',
    'For any project/RFQ/consultation request, collect these one at a time when missing: company name, contact name, phone number, email, industry, factory/project location, project type, budget, timeline, existing equipment, and whether drawings/files are available.',
    'When enough lead information is gathered, say the sales team will contact them soon and include #ATP at the end of the project summary.',
    'If a customer mentions drawings or files, tell them the team can receive files by email; do not claim files are stored.',
    'Knowledge base: PK Supply Chain Co., Ltd. has more than 20 years of experience in design, manufacturing, installation, and maintenance of conveyor systems and industrial production systems.',
    'Services: design and engineering consultation, conveyor system design, production line design, production improvement, automation consultation, manufacturing, custom machinery, installation, preventive maintenance, conveyor/machine repair, performance improvement, spare parts sourcing.',
    'Products and solutions: Shooter System, Platform Structure, Main Hopper, Top Chain Conveyor, Press Machine & Conveyor Line, Power Roller Conveyor, Building to Building Conveyor, Belt Incline Conveyor for plastic parts, Assembly Line, Spot Welding Machine.',
    'Conveyor experience includes Top Chain Conveyor, Roller Conveyor, Belt Conveyor, Incline Conveyor, building-to-building conveyor, and custom conveyor systems.',
    'Company address: 22/5 Moo 10, Bueng Thong Lang, Lam Luk Ka, Pathum Thani 12150.',
    'Contact: 02-108-2828, 083-531-0696, 086-688-9799, pongchai@pksupplychain.com.',
    'FAQs: We provide design, manufacturing, installation, maintenance, spare parts, production-line improvement, and custom factory solutions. We can design systems specifically for each factory.',
    `If asked what model you use, say you are configured to use ${getModelLabel()} on the server side. Never reveal API keys or private environment variables.`
  ].join('\n');
}

function toOpenAIMessages(history) {
  return history.slice(-10).map(item => ({
    role: item.role === 'assistant' ? 'assistant' : 'user',
    content: item.message
  }));
}

function toGeminiContents(history) {
  return history.slice(-10).map(item => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.message }]
  }));
}

function extractResponseText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts = [];
  for (const outputItem of data.output || []) {
    for (const contentItem of outputItem.content || []) {
      if (typeof contentItem.text === 'string') parts.push(contentItem.text);
    }
  }

  return parts.join('\n').trim();
}

function extractGeminiText(data) {
  return (data.candidates || [])
    .flatMap(candidate => candidate.content?.parts || [])
    .map(part => part.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

function sanitizeLLMReply(reply) {
  if (!reply || typeof reply !== 'string') return null;

  const cleaned = reply
    .replace(/^answer:\s*/i, '')
    .trim();

  if (!cleaned || cleaned.length < 24) return null;

  const internalPattern = /count check|word count|draft|perfect\s*\(|under\s+\d+\s+words?|internal check|prompt/i;
  if (internalPattern.test(cleaned)) return null;

  const sentenceLike = /[.!?。！？ครับค่ะ]$/.test(cleaned);
  const looksCutOff = cleaned.length < 180 && !sentenceLike;
  if (looksCutOff) return null;

  return cleaned.slice(0, 1400);
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function generateLLMReply(message, history, language = 'th') {
  if (!LLM_ENABLED) return null;

  try {
    if (LLM_API_STYLE === 'gemini') {
      let lastGeminiError = null;

      for (const model of getGeminiModelsToTry()) {
        const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': LLM_API_KEY
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: buildAgentInstructions(language) }]
            },
            contents: toGeminiContents(history),
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 700
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          return extractGeminiText(data) || null;
        }

        lastGeminiError = new Error(`Gemini request failed: ${response.status} (${model})`);
        if (![400, 404, 429, 500, 503].includes(response.status)) break;
      }

      throw lastGeminiError || new Error('Gemini request failed');
    }

    if (LLM_API_STYLE === 'chat') {
      const response = await fetchWithTimeout(`${LLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LLM_API_KEY}`
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: buildAgentInstructions(language) },
            ...toOpenAIMessages(history)
          ],
          temperature: 0.4,
          max_tokens: 700
        })
      });

      if (!response.ok) throw new Error(`LLM chat request failed: ${response.status}`);
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }

    const response = await fetchWithTimeout(`${LLM_BASE_URL}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        instructions: buildAgentInstructions(language),
        input: toOpenAIMessages(history),
        max_output_tokens: 700,
        store: false
      })
    });

    if (!response.ok) throw new Error(`LLM responses request failed: ${response.status}`);
    const data = await response.json();
    return extractResponseText(data) || null;
  } catch (error) {
    console.error('LLM agent error:', error.message);
    return null;
  }
}

async function generateReply(message, history = [], language = 'th') {
  const modelInfoReply = getModelInfoReply(message, language);
  if (modelInfoReply) return modelInfoReply;

  const llmReply = await generateLLMReply(message, history, language);
  const cleanLLMReply = sanitizeLLMReply(llmReply);
  if (cleanLLMReply) return cleanLLMReply;

  return generateRuleBasedReply(message, language);
}

function generateRuleBasedReply(message, language = 'th') {
  const msg = message.toLowerCase();

  if (/\b(model|llm|gpt|gemini|ai model|ai)\b|what are you|ใช้โมเดล|โมเดล|เอไอ/i.test(message)) {
    return formatLanguageReply(
      message,
      language,
      'ตอนนี้แชทบอทนี้ยังไม่ได้ใช้ LLM เช่น GPT-OSS 120B หรือ Gemini 3 Flash ครับ เป็นระบบตอบกลับตามกฎที่ตั้งไว้สำหรับข้อมูลของ PK Supply Chain หากต้องการ ผมสามารถเชื่อมต่อ LLM ให้เป็น AI Agent ได้ในขั้นถัดไป',
      'This chatbot is not currently using an LLM such as GPT-OSS 120B or Gemini 3 Flash. It is a rule-based PK Supply Chain assistant. If needed, it can be upgraded next to use an LLM as a real AI agent.'
    );
  }

  const replies = [
    {
      keywords: /hello|hi|hey|สวัสดี|หวัดดี/i,
      th: 'สวัสดีครับ เราเป็นผู้ช่วยของ PK Supply Chain สำหรับงานขายและซัพพอร์ตด้านระบบลำเลียงและระบบการผลิต อยากให้เราช่วยดูโครงการหรือปัญหาส่วนไหนก่อนครับ',
      en: 'Hello, we are the PK Supply Chain sales and support assistant for conveyor and production systems. What project or issue would you like us to help with first?'
    },
    {
      keywords: /service|services|conveyor|belt|roller|top chain|บริการ|ทำอะไร|รับทำ|สายพาน|ลำเลียง|ระบบลำเลียง/i,
      th: 'PK Supply Chain ให้บริการออกแบบ ผลิต ติดตั้ง และซ่อมบำรุงระบบลำเลียงและไลน์การผลิต รวมถึง Belt, Roller, Top Chain และระบบสั่งทำเฉพาะโรงงานครับ ตอนนี้โรงงานของคุณต้องการปรับปรุงหรือสร้างระบบส่วนไหนเป็นหลักครับ',
      en: 'PK Supply Chain provides design, manufacturing, installation, and maintenance for conveyor and production systems, including belt, roller, top chain, and custom factory solutions. Which part of your factory process do you want to improve or build?'
    },
    {
      keywords: /price|cost|quote|fee|quotation|ราคา|ใบเสนอราคา|ค่าใช้จ่าย/i,
      th: 'สำหรับราคาและใบเสนอราคา ทีมงานจะประเมินตามรายละเอียดโครงการและส่งกลับทางอีเมลครับ ช่วยเล่าประเภทงาน พื้นที่ติดตั้ง และช่วงเวลาที่ต้องการใช้งานให้เราทราบหน่อยครับ',
      en: 'For pricing and quotations, our team estimates based on project details and can send the quotation by email. Please share the project type, installation location, and target timeline.'
    },
    {
      keywords: /contact|address|phone|email|ติดต่อ|ที่อยู่|เบอร์|โทร|อีเมล/i,
      th: 'ติดต่อ PK Supply Chain ได้ที่ 02-108-2828, 083-531-0696, 086-688-9799 หรือ pongchai@pksupplychain.com ที่อยู่ 22/5 หมู่ 10 ตำบลบึงทองหลาง อำเภอลำลูกกา จังหวัดปทุมธานี 12150 ต้องการให้ทีมงานติดต่อกลับเรื่องโครงการประเภทไหนครับ',
      en: 'You can contact PK Supply Chain at 02-108-2828, 083-531-0696, 086-688-9799, or pongchai@pksupplychain.com. Address: 22/5 Moo 10, Bueng Thong Lang, Lam Luk Ka, Pathum Thani 12150. What project should our team follow up on?'
    },
    {
      keywords: /production|manufacturing|factory|ผลิต|โรงงาน/i,
      th: 'เรามีบริการผลิตเครื่องจักรและระบบตามความต้องการของโครงการ พร้อมดูแลคุณภาพและกระบวนการทำงานอย่างเป็นระบบครับ โครงการนี้เกี่ยวกับสินค้า ชิ้นงาน หรือกระบวนการผลิตประเภทไหนครับ',
      en: 'We provide project-based manufacturing for machines and systems with quality control and a systematic process. What product, part, or production process is this project for?'
    },
    {
      keywords: /installation|setup|install|ติดตั้ง/i,
      th: 'ทีมงานสามารถให้บริการติดตั้งหน้างานได้ โดยประเมินจากพื้นที่ ขอบเขตงาน และระบบที่ต้องติดตั้งครับ พื้นที่ติดตั้งอยู่จังหวัดไหนและเป็นระบบประเภทใดครับ',
      en: 'Our team can provide on-site installation based on the site, scope, and system type. Where is the installation site, and what system needs to be installed?'
    },
    {
      keywords: /maintenance|repair|fix|ซ่อม|ซ่อมบำรุง|บำรุง/i,
      th: 'เรามีบริการซ่อมบำรุง ดูแลระบบ และจัดหาอะไหล่สำหรับสายพานหรือเครื่องจักรครับ อาการที่พบเกิดกับระบบไหนและเริ่มเป็นตั้งแต่เมื่อไหร่ครับ',
      en: 'We provide maintenance, repair, and spare parts support for conveyors and machinery. Which system has the issue, and when did it start?'
    },
    {
      keywords: /experience|background|ประสบการณ์|กี่ปี/i,
      th: 'PK Supply Chain มีประสบการณ์มากกว่า 20 ปีด้านการออกแบบ ผลิต ติดตั้ง และซ่อมบำรุงระบบลำเลียงและระบบการผลิตครับ คุณกำลังมองหาประสบการณ์ในระบบหรืออุตสาหกรรมประเภทไหนครับ',
      en: 'PK Supply Chain has more than 20 years of experience in design, manufacturing, installation, and maintenance for conveyor and production systems. What type of system or industry experience are you looking for?'
    },
    {
      keywords: /thanks|thank you|ขอบคุณ/i,
      th: 'ยินดีครับ หากต้องการข้อมูลเพิ่มเติมสามารถพิมพ์ถามได้ทั้งภาษาไทยหรือ English เลยครับ',
      en: 'You are welcome. You can ask more questions in either Thai or English.'
    }
  ];

  const matchedReply = replies.find(reply => reply.keywords.test(msg));
  if (matchedReply) {
    return formatLanguageReply(message, language, matchedReply.th, matchedReply.en);
  }

  return formatLanguageReply(
    message,
    language,
    'ขอบคุณสำหรับคำถามครับ หากเป็นงานออกแบบ ผลิต ติดตั้ง หรือซ่อมบำรุง ทีมงานสามารถช่วยประเมินให้ได้ กรุณาเล่ารายละเอียดโครงการหรือปัญหาที่ต้องการให้เราช่วยดูเพิ่มเติมครับ',
    'Thank you for your inquiry. For design, manufacturing, installation, or maintenance work, our team can help review the details. Please describe the project or issue you want us to look at.'
  );
}

function legacyGenerateReply(message) {
  const msg = message.toLowerCase();

  const responses = {
    'hello|hi|hey|สวัสดี': 'สวัสดีครับ! ยินดีต้อนรับเข้าสู่ PK Supply Chain\nWelcome to PK Supply Chain! How can we assist you with your supply chain needs?',
    'how are you|how\'s it going|คุณสบายดีหรือ': 'เราสบายดีครับ ขอบคุณที่ถาม!\nWe\'re doing great! Thanks for asking. How can we help you today?',
    'service|บริการ': 'PK Supply Chain offers professional services in:\n• Design (ออกแบบ)\n• Manufacturing (ผลิต)\n• Installation (ติดตั้ง)\n• Maintenance & Repair (บำรุงซ่อม)\n\nWith 20+ years of experience! What service interests you?',
    'price|cost|quote|fee|ราคา': 'For pricing and quotation requests, please contact our team:\n📧 pongchai@pksupplychain.com\n📞 02-1082828\n\nOr fill out the contact form on our website. We\'ll get back to you promptly!',
    'contact|address|ติดต่อ|ที่อยู่': '📍 Address: 22/5 หมู่ที่ 10 ตำบลบึงทองหลาง อำเภอลำลูกกา จังหวัรปทุมธานี 12150\n📧 Email: pongchai@pksupplychain.com\n📞 Phone: 02-1082828',
    'production|manufacturing|ผลิต': 'We specialize in professional manufacturing services with quality assurance. Our team has extensive experience in production processes. Would you like to discuss a specific project?',
    'installation|setup|install|ติดตั้ง': 'Our installation team can handle complete setup services. Please contact us with project details for a quote and timeline.',
    'maintenance|repair|maintenance|ซ่อม|บำรุง': 'We provide comprehensive maintenance and repair services. Contact our team to schedule service or discuss your maintenance needs.',
    'experience|background|experience|ประสบการณ์': 'PK Supply Chain has been operating for over 20 years with professional expertise in design, production, installation, and maintenance services.',
    'thanks|thank you|ขอบคุณ': 'You\'re welcome! Is there anything else we can help you with?',
    'bye|goodbye|see you|ลาก่อน': 'Thank you for reaching out! Feel free to contact us anytime at 02-1082828 or pongchai@pksupplychain.com',
  };

  for (const [keywords, response] of Object.entries(responses)) {
    const pattern = new RegExp(keywords, 'i');
    if (pattern.test(msg)) {
      return response;
    }
  }

  // Default fallback with contact info
  return 'Thank you for your inquiry! For detailed information, please contact our team:\n📧 pongchai@pksupplychain.com\n📞 02-1082828\n\nOr visit https://www.pksupplychain.com';
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server locally. Vercel imports the Express app as a serverless function.
if (require.main === module) {
  app.listen(PORT, () => {
  console.log(`🚀 Chat Widget Server running on http://localhost:${PORT}`);
  console.log(`📝 API Key: ${API_KEY}`);
  console.log(`💬 Widget available at: http://localhost:${PORT}/chat-widget.js`);
  });
}

module.exports = app;
