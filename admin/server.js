const express = require('express');
const path = require('path');
const session = require('express-session');
const config = require('../src/config');
const logger = require('../src/utils/logger');

function startAdmin(client) {
  const app = express();
  const PORT = process.env.ADMIN_PORT || 3001;

  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    logger.error('未設定 ADMIN_USERNAME/ADMIN_PASSWORD，管理員後臺啟動終止');
    return;
  }

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
  }));

  function requireAuth(req, res, next) {
    if (req.session.authenticated) return next();
    res.redirect('/login');
  }

  function baseData() {
    return {
      version: require('../package.json').version,
      ping: client.ws.ping,
    };
  }

  app.get('/', (req, res) => {
    if (req.session.authenticated) return res.redirect('/dashboard');
    res.render('landing', {
      guildCount: client.guilds.cache.size,
      userCount: client.guilds.cache.reduce((s, g) => s + g.memberCount, 0),
      ping: client.ws.ping,
      commands: client.commands.size,
    });
  });

  app.get('/login', (req, res) => {
    if (req.session.authenticated) return res.redirect('/dashboard');
    res.render('login', { error: null });
  });

  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      req.session.authenticated = true;
      return res.redirect('/dashboard');
    }
    res.render('login', { error: '帳號或密碼錯誤' });
  });

  app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
  });

  function getVdr() {
    return require('../src/services/vdr-data');
  }

  app.get('/dashboard', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const recent = [];
    for (const d of db.decrees.slice(-3).reverse()) recent.push({ type: '總統令', time: new Date(d.issuedAt).toLocaleString('zh-TW'), text: d.title });
    for (const a of (db.announcements || []).slice(-3).reverse()) recent.push({ type: '公告', time: new Date(a.at).toLocaleString('zh-TW'), text: a.title });
    for (const t of db.economy.transactions.slice(-3).reverse()) recent.push({ type: '交易', time: new Date(t.at).toLocaleString('zh-TW'), text: `${t.amount} 幣` });
    res.render('admin', { ...baseData(), page: 'dashboard', pageTitle: '國家控制臺',
      d: {
        citizens: Object.keys(db.citizens).length,
        decrees: db.decrees.length,
        announcements: (db.announcements || []).length,
        allies: db.allies.length,
        treasury: db.economy.treasury,
        txCount: db.economy.transactions.length,
        servers: client.guilds.cache.size,
        regions: Object.keys(db.regions).length,
        recent: recent.slice(0, 8),
      }
    });
  });

  app.get('/admin/citizens', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const citizens = Object.entries(db.citizens).map(([id, c]) => ({ id, ...c }));
    res.render('admin', { ...baseData(), page: 'citizens', pageTitle: '公民管理', citizens });
  });

  app.get('/admin/decrees', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const channels = [];
    for (const g of client.guilds.cache.values()) {
      for (const c of g.channels.cache.values()) {
        if (c.type === 0) channels.push({ id: c.id, name: `#${c.name}（${g.name}）` });
      }
    }
    res.render('admin', { ...baseData(), page: 'decrees', pageTitle: '總統令',
      decrees: [...db.decrees].reverse(),
      channels,
      alert: req.session.alert || null,
    });
    req.session.alert = null;
  });

  app.post('/admin/decrees/create', requireAuth, (req, res) => {
    const vdr = getVdr();
    const { title, content, channelId } = req.body;
    if (!title || !content) {
      req.session.alert = { type: 'error', text: '請填寫標題和內容' };
      return res.redirect('/admin/decrees');
    }
    const decree = vdr.addDecree('admin', '管理員', title, content);
    if (channelId) {
      const { EmbedBuilder } = require('discord.js');
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0xc9a84c)
          .setTitle(`總統令 第 ${decree.id} 號`)
          .setDescription(`**${title}**`)
          .addFields({ name: '內容', value: content, inline: false })
          .setFooter({ text: '發布者：管理員 ｜ 虛境民主共和國總統府' })
          .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
    req.session.alert = { type: 'success', text: `總統令 #${decree.id} 已發布` };
    res.redirect('/admin/decrees');
  });

  app.get('/admin/announce', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const channels = [];
    for (const g of client.guilds.cache.values()) {
      for (const c of g.channels.cache.values()) {
        if (c.type === 0) channels.push({ id: c.id, name: `#${c.name}（${g.name}）` });
      }
    }
    res.render('admin', { ...baseData(), page: 'announce', pageTitle: '國家公告',
      announcements: [...(db.announcements || [])].reverse(),
      channels,
      alert: req.session.alert || null,
    });
    req.session.alert = null;
  });

  app.post('/admin/announce/send', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const { title, content, channelId } = req.body;
    if (!channelId) {
      req.session.alert = { type: 'error', text: '請選擇發送頻道' };
      return res.redirect('/admin/announce');
    }
    const num = vdr.nextAnnounceNumber();
    vdr.addAnnouncement(num, title, content, '管理員');
    const msg = `**【𝐕𝐃𝐑國家發展公告】**\n\n條約編號：虛外字第 ${num} 號\n＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝\n\n${content}\n\n＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝\n發布者：管理員\n發布單位：技術發展部\n公告單位：虛境民主共和國總統府`;
    const channel = client.channels.cache.get(channelId);
    if (channel) channel.send(msg).catch(() => {});
    req.session.alert = { type: 'success', text: `公告 ${num} 已發布至 #${channel?.name || '未知頻道'}` };
    res.redirect('/admin/announce');
  });

  app.get('/admin/economy', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    res.render('admin', { ...baseData(), page: 'economy', pageTitle: '經濟管理',
      treasury: db.economy.treasury,
      totalSupply: db.economy.totalSupply,
      txCount: db.economy.transactions.length,
      txs: [...db.economy.transactions].reverse().slice(0, 50),
    });
  });

  app.get('/admin/diplomacy', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    res.render('admin', { ...baseData(), page: 'diplomacy', pageTitle: '外交邦交',
      allies: db.allies,
      orgs: db.organizations,
    });
  });

  app.get('/admin/servers', requireAuth, (req, res) => {
    const guilds = [...client.guilds.cache.values()].map(g => ({
      id: g.id, name: g.name, members: g.memberCount,
      owner: g.members.cache.get(g.ownerId)?.user?.tag || '未知',
    }));
    res.render('admin', { ...baseData(), page: 'servers', pageTitle: '伺服器管理', guilds });
  });

  app.get('/admin/logs', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const logs = [];
    for (const d of db.decrees) logs.push({ time: new Date(d.issuedAt).toLocaleString('zh-TW'), text: `📜 總統令 #${d.id}：${d.title}` });
    for (const a of (db.announcements || [])) logs.push({ time: new Date(a.at).toLocaleString('zh-TW'), text: `📢 公告 ${a.number}：${a.title}` });
    for (const t of db.economy.transactions) logs.push({ time: new Date(t.at).toLocaleString('zh-TW'), text: `💰 ${t.amount} 幣 ${t.from} → ${t.to}` });
    logs.sort((a, b) => new Date(b.time) - new Date(a.time));
    res.render('admin', { ...baseData(), page: 'logs', pageTitle: '系統日誌',
      logs: logs.slice(0, 100),
    });
  });

  app.listen(PORT, () => {
    logger.info(`管理後臺已啟動: http://localhost:${PORT}`);
  });
}

module.exports = { startAdmin };
