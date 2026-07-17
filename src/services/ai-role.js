const vdr = require('./vdr-data');
const logger = require('../utils/logger');

function analyzeMessage(content) {
  const db = vdr.get();
  const keywords = db.aiRole?.keywords || {};
  const matched = [];
  for (const [roleId, words] of Object.entries(keywords)) {
    for (const word of words) {
      if (content.includes(word)) {
        matched.push(roleId);
        break;
      }
    }
  }
  return matched;
}

async function suggestRoles(member, recentMessages) {
  const db = vdr.get();
  if (!db.aiRole?.enabled) return [];

  const apiKey = process.env.AI_API_KEY;
  const apiUrl = process.env.AI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  if (apiKey) {
    try {
      const axios = require('axios');
      const roles = db.allies.map(a => a.name).join(', ');
      const text = recentMessages.slice(0, 20).map(m => m.content).join('\n');
      const prompt = `根據以下聊天內容，判斷使用者適合哪些角色（可選：${roles}）。請只回覆角色名稱，用逗號分隔。如果都不適合請回覆「無」。\n\n聊天內容：\n${text}`;
      const res = await axios.post(`${apiUrl}?key=${apiKey}`, {
        contents: [{ parts: [{ text: prompt }] }]
      }, { timeout: 10000 });
      const result = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return result.split(',').map(r => r.trim()).filter(Boolean);
    } catch (err) {
      logger.warn('AI 角色建議失敗:', err.message);
    }
  }

  const dbRoles = db.aiRole?.roleKeywords || {};
  const suggestions = [];
  for (const [roleId, words] of Object.entries(dbRoles)) {
    for (const msg of recentMessages) {
      if (words.some(w => (msg.content || '').includes(w))) {
        if (!suggestions.includes(roleId)) suggestions.push(roleId);
        break;
      }
    }
  }
  return suggestions;
}

module.exports = { analyzeMessage, suggestRoles };
