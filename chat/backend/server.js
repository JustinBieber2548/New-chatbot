/**
 * Chat Widget Backend Server
 * Express.js API for handling chat messages
 * Run: npm install && node server.js
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'test-key-123';

// Middleware
app.use(cors());
app.use(express.json());

// Serve chat widget
app.use(express.static(path.join(__dirname, '../widget')));

// Store conversations (in production, use database)
const conversations = new Map();

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
app.post('/chat', verifyApiKey, verifyDomain, (req, res) => {
  const { message, sessionId } = req.body;

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

    // Generate reply (simple rule-based for now)
    const reply = generateReply(message);

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

function generateReply(message) {
  const msg = message.toLowerCase();

  if (/\b(model|llm|gpt|gemini|ai model|ai)\b|what are you|ใช้โมเดล|โมเดล|เอไอ/i.test(message)) {
    return formatBilingualReply(
      message,
      'ตอนนี้แชทบอทนี้ยังไม่ได้ใช้ LLM เช่น GPT-OSS 120B หรือ Gemini 3 Flash ครับ เป็นระบบตอบกลับตามกฎที่ตั้งไว้สำหรับข้อมูลของ PK Supply Chain หากต้องการ ผมสามารถเชื่อมต่อ LLM ให้เป็น AI Agent ได้ในขั้นถัดไป',
      'This chatbot is not currently using an LLM such as GPT-OSS 120B or Gemini 3 Flash. It is a rule-based PK Supply Chain assistant. If needed, it can be upgraded next to use an LLM as a real AI agent.'
    );
  }

  const replies = [
    {
      keywords: /hello|hi|hey|สวัสดี|หวัดดี/i,
      th: 'สวัสดีครับ ยินดีต้อนรับสู่ PK Supply Chain ต้องการสอบถามเรื่องบริการ ออกแบบ ผลิต ติดตั้ง หรือซ่อมบำรุงใช่ไหมครับ',
      en: 'Hello, welcome to PK Supply Chain. Would you like help with design, manufacturing, installation, or maintenance services?'
    },
    {
      keywords: /service|services|บริการ|ทำอะไร|รับทำ/i,
      th: 'PK Supply Chain ให้บริการออกแบบ ผลิต ติดตั้ง และซ่อมบำรุง โดยทีมงานมืออาชีพที่มีประสบการณ์มากกว่า 20 ปีครับ',
      en: 'PK Supply Chain provides design, manufacturing, installation, and maintenance services with more than 20 years of professional experience.'
    },
    {
      keywords: /price|cost|quote|fee|quotation|ราคา|ใบเสนอราคา|ค่าใช้จ่าย/i,
      th: 'สำหรับราคาและใบเสนอราคา กรุณาติดต่อทีมงานที่อีเมล pongchai@pksupplychain.com หรือโทร 02-1082828 เพื่อประเมินตามรายละเอียดงานครับ',
      en: 'For pricing and quotations, please contact pongchai@pksupplychain.com or call 02-1082828 so the team can estimate based on your project details.'
    },
    {
      keywords: /contact|address|phone|email|ติดต่อ|ที่อยู่|เบอร์|โทร|อีเมล/i,
      th: 'ติดต่อ PK Supply Chain ได้ที่ โทร 02-1082828 อีเมล pongchai@pksupplychain.com ที่อยู่ 22/5 หมู่ 10 ตำบลบึงทองหลาง อำเภอลำลูกกา จังหวัดปทุมธานี 12150',
      en: 'You can contact PK Supply Chain at 02-1082828 or pongchai@pksupplychain.com. Address: 22/5 Moo 10, Bueng Thong Lang, Lam Luk Ka, Pathum Thani 12150.'
    },
    {
      keywords: /production|manufacturing|factory|ผลิต|โรงงาน/i,
      th: 'เรามีบริการผลิตตามความต้องการของโครงการ พร้อมดูแลคุณภาพและกระบวนการทำงานอย่างเป็นระบบครับ',
      en: 'We provide project-based manufacturing services with quality control and a systematic working process.'
    },
    {
      keywords: /installation|setup|install|ติดตั้ง/i,
      th: 'ทีมงานสามารถให้บริการติดตั้งหน้างานได้ กรุณาส่งรายละเอียดพื้นที่และขอบเขตงานเพื่อประเมินเวลาและราคา',
      en: 'Our team can provide on-site installation. Please share the site details and scope so we can estimate timeline and cost.'
    },
    {
      keywords: /maintenance|repair|fix|ซ่อม|ซ่อมบำรุง|บำรุง/i,
      th: 'เรามีบริการซ่อมบำรุงและดูแลระบบ กรุณาแจ้งอาการหรือรายละเอียดงานเพื่อให้ทีมงานแนะนำขั้นตอนถัดไป',
      en: 'We provide maintenance and repair services. Please describe the issue or service details so our team can recommend the next step.'
    },
    {
      keywords: /experience|background|ประสบการณ์|กี่ปี/i,
      th: 'PK Supply Chain มีประสบการณ์ด้านงานบริการ ออกแบบ ผลิต ติดตั้ง และซ่อมบำรุงมากกว่า 20 ปีครับ',
      en: 'PK Supply Chain has more than 20 years of experience in design, manufacturing, installation, and maintenance services.'
    },
    {
      keywords: /thanks|thank you|ขอบคุณ/i,
      th: 'ยินดีครับ หากต้องการข้อมูลเพิ่มเติมสามารถพิมพ์ถามได้ทั้งภาษาไทยหรือ English เลยครับ',
      en: 'You are welcome. You can ask more questions in either Thai or English.'
    }
  ];

  const matchedReply = replies.find(reply => reply.keywords.test(msg));
  if (matchedReply) {
    return formatBilingualReply(message, matchedReply.th, matchedReply.en);
  }

  return formatBilingualReply(
    message,
    'ขอบคุณสำหรับคำถามครับ กรุณาฝากรายละเอียดเพิ่มเติม หรือ ติดต่อทีมงานที่ pongchai@pksupplychain.com โทร 02-1082828',
    'Thank you for your inquiry. Please share more details, or contact our team at pongchai@pksupplychain.com or 02-1082828.'
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
