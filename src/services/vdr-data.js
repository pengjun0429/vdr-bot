const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const VDR_FILE = path.join(DATA_DIR, 'vdr.json');

const defaults = {
  nation: {
    name: '虛境民主共和國',
    nameEn: 'Veridia Democratic Republic',
    short: 'VDR',
    motto: '虛實共生，技術強國',
    anthem: '繁星都',
    capital: '繁星都 (FanXin Capital)',
    founded: '2025年7月23日',
    'icea joined': '2026年3月15日',
    language: '繁體中文',
    currency: '尐尐幣',
    area: '11,200,000 km²',
    president: '星桉晚 (Kris)',
  },
  citizens: {},
  decrees: [],
  announcements: [],
  allies: [
    { name: '厂万共和國', date: '2026/01/11' },
    { name: '大鮭', date: '2026/03/10' },
    { name: '培根民主共和國', date: '2026/03/10' },
    { name: '堪察家', date: '2026/03/10' },
    { name: '大斯皇帝國', date: '2026/03/13' },
    { name: '北歐聯盟', date: '2026/03/16' },
    { name: '坦克帝國', date: '2026/03/17' },
    { name: '糰糰帝國', date: '2026/03/26' },
    { name: '蕉貓民國', date: '2026/04/06' },
    { name: '青青石共和國', date: '2026/04/06' },
    { name: '斯堪維斯坦公國', date: '2026/04/20' },
    { name: '藍星民國', date: '2026/05/12' },
    { name: '維斯托格勒社會主義共和國', date: '2026/05/16' },
    { name: '西瓦尼亞共和國', date: '2026/05/18' },
    { name: '壅卿社會主義人民共和國', date: '2026/06/05' },
    { name: '楓華民主共和國', date: '2026/06/13' },
    { name: '南江第二共和國', date: '2026/06/21' },
    { name: '荷月聯合帝國', date: '2026/07/06' },
    { name: '雷本民主共和國', date: '2026/07/16' },
  ],
  organizations: [
    { name: '國際文化交流聯盟 (ICEA)', joined: '2026年3月15日' },
    { name: '臺灣眾平台微國家聯盟', joined: '2026年3月16日' },
  ],
  history: [
    { date: '2025年7月23日', event: '虛境民主共和國（VDR）正式成立' },
    { date: '2026年1月11日', event: '與厂万共和國建交，為首個邦交國' },
    { date: '2026年3月9日', event: '正式加入臺灣眾平台微國家聯盟' },
    { date: '2026年3月15日', event: '正式加入 ICEA，升格案以 11 票全數贊成通過' },
    { date: '2026年3月16日', event: '成為臺灣眾平台微國家聯盟正式成員國' },
  ],
  regions: {
    '繁星都': {
      title: '國家直轄中樞區',
      desc: '以總統府所在地為核心，涵蓋周邊高度技術開發之數位與實體聚落。',
      duties: '中央政府運作、核心伺服器維護、外事接待、國家最高防禦指揮',
    },
    '北原省': {
      title: '國土北部平原區',
      desc: '西倚大清溪天然界線，北接中央山脈餘脈之開闊地，首個國內機場所在地。',
      duties: '國家級農業供應鏈中心、大型硬體設施與新技術野外測試場',
    },
    '中京省': {
      title: '國土腹地心臟區',
      desc: '位於中央最肥沃之沖積扇地帶，為本國交通結點匯集處。',
      duties: '民生經濟與商業活動重鎮、內需市場開發、人口居住管理',
    },
    '海晏省': {
      title: '西岸門戶與海權管轄區',
      desc: '擁有綿長海岸線，法定管轄權延伸至領海基線外二十海浬。',
      duties: '對外貿易港務、海洋資源開發、海洋能源技術研究',
    },
    '恆陽省': {
      title: '南疆戰略省',
      desc: '由南部丘陵地帶延伸至國土最南端之「恆陽岬」。',
      duties: '遠程通訊觀測、深海探測據點、熱帶生態保育、南疆防禦',
    },
    '嵐山自治省': {
      title: '東部高海拔原始屏障',
      desc: '以海拔五百公尺等高線為法定界線，由雲霧繚繞的山林組成。',
      duties: '排灣族與阿美族文化保存區、水源保護禁地、國防高地監視哨',
    },
    '西苑省': {
      title: '香蕉軍特殊自治區',
      desc: '為香蕉軍而開立的特殊自治區。',
      duties: '保衛香蕉教',
    },
  },
  announceCount: {},
  welcome: { enabled: true, channelId: '', message: '歡迎 {user} 加入 {name}！\n請使用 /vdr-register 註冊成為公民。' },
  farewell: { enabled: false, channelId: '', message: '{user} 離開了 {name}。' },
  autoRole: { joinRoleId: '', citizenRoleId: '' },
  autoRoleId: '',
  economy: {
    totalSupply: 1000000,
    treasury: 500000,
    transactions: [],
  },
};

let cache = null;

function load() {
  if (cache) return cache;
  try {
    if (fs.existsSync(VDR_FILE)) {
      const raw = fs.readFileSync(VDR_FILE, 'utf-8');
      cache = JSON.parse(raw);
    } else {
      cache = JSON.parse(JSON.stringify(defaults));
      save();
    }
  } catch {
    cache = JSON.parse(JSON.stringify(defaults));
    save();
  }
  return cache;
}

function save() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(VDR_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

function get() {
  if (!cache) load();
  return cache;
}

function nextAnnounceNumber() {
  const db = get();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  if (!db.announceCount[today]) db.announceCount[today] = 0;
  db.announceCount[today]++;
  save();
  return `${today}-${String(db.announceCount[today]).padStart(3, '0')}`;
}

function addAnnouncement(number, title, content, author) {
  const db = get();
  db.announcements.push({ number, title, content, author, at: new Date().toISOString() });
  save();
  sheetAppend('addAnnouncement', { number, title, content, author });
}

function registerCitizen(userId, data) {
  const db = get();
  db.citizens[userId] = {
    ...data,
    registeredAt: new Date().toISOString(),
    wallet: 100,
  };
  save();
  sheetAppend('registerCitizen', { userId, name: data.name, region: data.region, wallet: 100 });
  return db.citizens[userId];
}

function getCitizen(userId) {
  const db = get();
  return db.citizens[userId] || null;
}

function addDecree(authorId, authorName, title, content) {
  const db = get();
  const decree = {
    id: db.decrees.length + 1,
    authorId,
    authorName,
    title,
    content,
    issuedAt: new Date().toISOString(),
  };
  db.decrees.push(decree);
  save();
  sheetAppend('addDecree', { id: decree.id, title, content, authorName });
  return decree;
}

function transfer(fromId, toId, amount, note) {
  const db = get();
  const from = db.citizens[fromId];
  const to = db.citizens[toId];
  if (!from || !to) return { error: '找不到使用者' };
  if (from.wallet < amount) return { error: '餘額不足' };
  from.wallet -= amount;
  to.wallet += amount;
  const tx = { from: fromId, to: toId, amount, note: note || '', at: new Date().toISOString() };
  db.economy.transactions.push(tx);
  save();
  sheetAppend('addTransaction', { from: fromId, to: toId, amount, note: note || '' });
  return { from, to, tx };
}

function sheetAppend(action, data) {
  const sheetUrl = process.env.VDR_SHEET_URL;
  const sheetToken = process.env.VDR_SHEET_TOKEN;
  if (!sheetUrl || !sheetToken) return;
  const axios = require('axios');
  axios.post(sheetUrl, { token: sheetToken, action, ...data }, { timeout: 5000 })
    .catch(() => {});
}

async function syncToSheet() {
  const sheetUrl = process.env.VDR_SHEET_URL;
  const sheetToken = process.env.VDR_SHEET_TOKEN;
  if (!sheetUrl || !sheetToken) return;
  const db = get();
  try {
    const axios = require('axios');
    await axios.post(sheetUrl, {
      token: sheetToken,
      action: 'syncAll',
      data: {
        citizens: Object.entries(db.citizens).map(([userId, c]) => ({ userId, ...c })),
        decrees: db.decrees,
        announcements: db.announcements,
        transactions: db.economy.transactions,
      },
    }, { timeout: 10000 });
    console.log('[VDR] Google Sheets 同步成功');
  } catch (err) {
    console.warn('[VDR] Google Sheets 同步失敗:', err.message);
  }
}

setInterval(syncToSheet, 5 * 60 * 1000);

load();

module.exports = {
  load, save, get,
  registerCitizen, getCitizen,
  addDecree, transfer,
  nextAnnounceNumber, addAnnouncement,
  syncToSheet,
  defaults,
};
