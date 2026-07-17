const express = require('express');
const path = require('path');
const session = require('express-session');
const config = require('../src/config');
const logger = require('../src/utils/logger');

function startAdmin(client) {
  const app = express();
  const PORT = process.env.ADMIN_PORT || 3001;

  const useDiscordAuth = !!config.discord.clientSecret;

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
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
  }

  function baseData() {
    return { version: require('../package.json').version, ping: client.ws.ping };
  }

  const DISCORD_API = 'https://discord.com/api/v10';

  app.get('/login', (req, res) => {
    if (req.session.authenticated) return res.redirect('/dashboard');
    if (useDiscordAuth) {
      const url = `${DISCORD_API}/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${encodeURIComponent(config.discord.redirectUri)}&response_type=code&scope=identify+guilds&prompt=none`;
      return res.render('login', { error: null, discordUrl: url, useDiscord: true });
    }
    res.render('login', { error: null, discordUrl: '#', useDiscord: false });
  });

  app.post('/login', (req, res) => {
    if (useDiscordAuth) return res.redirect('/login');
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      req.session.authenticated = true;
      return res.redirect('/dashboard');
    }
    res.render('login', { error: '撣唾???蝣潮隤?, discordUrl: '#', useDiscord: false });
  });

  app.get('/auth/callback', async (req, res) => {
    if (!useDiscordAuth) return res.redirect('/login');
    const { code, error: errParam } = req.query;
    if (errParam || !code) {
      return res.render('login', { error: 'Discord ?餃憭望?', discordUrl: '#', useDiscord: true });
    }
    try {
      const axios = require('axios');
      const tokenRes = await axios.post(`${DISCORD_API}/oauth2/token`,
        new URLSearchParams({
          client_id: config.discord.clientId,
          client_secret: config.discord.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.discord.redirectUri,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const accessToken = tokenRes.data.access_token;
      const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const user = userRes.data;

      const guildsRes = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const guilds = guildsRes.data;

      const adminUserIds = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);
      const adminRoleIds = (process.env.ADMIN_ROLE_IDS || '').split(',').filter(Boolean);
      let isAdmin = adminUserIds.includes(user.id);
      if (!isAdmin) {
        for (const g of client.guilds.cache.values()) {
          const memberGuild = guilds.find(ug => ug.id === g.id);
          if (!memberGuild) continue;
          const permissions = BigInt(memberGuild.permissions);
          if ((permissions & 0x8n) === 0x8n || memberGuild.owner) {
            isAdmin = true;
            break;
          }
          const member = await g.members.fetch(user.id).catch(() => null);
          if (member) {
            if (member.permissions.has(0x8n) || g.ownerId === user.id) {
              isAdmin = true;
              break;
            }
            if (adminRoleIds.length > 0 && member.roles.cache.some(r => adminRoleIds.includes(r.id))) {
              isAdmin = true;
              break;
            }
          }
        }
      }

      if (!isAdmin) {
        return res.render('login', { error: '雿??恣?甈?', discordUrl: '#', useDiscord: true });
      }

      req.session.authenticated = true;
      req.session.user = { id: user.id, username: user.username, avatar: user.avatar, global_name: user.global_name };
      const returnTo = req.session.returnTo || '/dashboard';
      delete req.session.returnTo;
      res.redirect(returnTo);
    } catch (err) {
      logger.error('Discord OAuth2 ?航炊:', err.message);
      res.render('login', { error: '隤?憭望?', discordUrl: '#', useDiscord: true });
    }
  });

  app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
  });

  function getVdr() { return require('../src/services/vdr-data'); }

  app.get('/', (req, res) => {
    if (req.session.authenticated) return res.redirect('/dashboard');
    res.render('landing', {
      guildCount: client.guilds.cache.size,
      userCount: client.guilds.cache.reduce((s, g) => s + g.memberCount, 0),
      ping: client.ws.ping,
      commands: client.commands.size,
    });
  });

  app.get('/dashboard', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const recent = [];
    for (const d of db.decrees.slice(-3).reverse()) recent.push({ type: '蝮賜絞隞?, time: new Date(d.issuedAt).toLocaleString('zh-TW'), text: d.title });
    for (const a of (db.announcements || []).slice(-3).reverse()) recent.push({ type: '?砍?', time: new Date(a.at).toLocaleString('zh-TW'), text: a.title });
    for (const t of db.economy.transactions.slice(-3).reverse()) recent.push({ type: '鈭斗?', time: new Date(t.at).toLocaleString('zh-TW'), text: `${t.amount} 撟ε });
    res.render('admin', { ...baseData(), page: 'dashboard', pageTitle: '?振?批??, user: req.session.user,
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
    res.render('admin', { ...baseData(), page: 'citizens', pageTitle: '?祆?蝞∠?', citizens, user: req.session.user });
  });

  app.get('/admin/decrees', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const channels = [];
    for (const g of client.guilds.cache.values()) {
      for (const c of g.channels.cache.values()) {
        if (c.type === 0) channels.push({ id: c.id, name: `#${c.name}嚗?{g.name}嚗 });
      }
    }
    res.render('admin', { ...baseData(), page: 'decrees', pageTitle: '蝮賜絞隞?,
      decrees: [...db.decrees].reverse(), channels, user: req.session.user,
      alert: req.session.alert || null,
    });
    req.session.alert = null;
  });

  app.post('/admin/decrees/create', requireAuth, (req, res) => {
    const vdr = getVdr();
    const { title, content, channelId } = req.body;
    if (!title || !content) {
      req.session.alert = { type: 'error', text: '隢‵撖急?憿??批捆' };
      return res.redirect('/admin/decrees');
    }
    const decree = vdr.addDecree('admin', req.session.user?.username || '蝞∠???, title, content);
    if (channelId) {
      const { EmbedBuilder } = require('discord.js');
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0xc9a84c)
          .setTitle(`蝮賜絞隞?蝚?${decree.id} ?)
          .setDescription(`**${title}**`)
          .addFields({ name: '?批捆', value: content, inline: false })
          .setFooter({ text: `?澆???${req.session.user?.username || '蝞∠???} 嚚???瘞蜓?勗??蜇蝯勗?` })
          .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
    req.session.alert = { type: 'success', text: `蝮賜絞隞?#${decree.id} 撌脩撣 };
    res.redirect('/admin/decrees');
  });

  app.get('/admin/announce', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const channels = [];
    for (const g of client.guilds.cache.values()) {
      for (const c of g.channels.cache.values()) {
        if (c.type === 0) channels.push({ id: c.id, name: `#${c.name}嚗?{g.name}嚗 });
      }
    }
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const nextNum = (db.announceCount?.[today] || 0) + 1;
    const nextNumber = `${today}-${String(nextNum).padStart(3, '0')}`;
    res.render('admin', { ...baseData(), page: 'announce', pageTitle: '?振?砍?',
      announcements: [...(db.announcements || [])].reverse(), channels, nextNumber, user: req.session.user,
      alert: req.session.alert || null,
    });
    req.session.alert = null;
  });

  app.post('/admin/announce/send', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const { title, content, channelId, unit } = req.body;
    if (!channelId) {
      req.session.alert = { type: 'error', text: '隢???? };
      return res.redirect('/admin/announce');
    }
    const num = vdr.nextAnnounceNumber();
    vdr.addAnnouncement(num, title, content, req.session.user?.username || '蝞∠???);
    const publishUnit = unit || '?銵撅';
    const msg = `**?????摰嗥撅??*\n\n璇?蝺刻?嚗?憭?蝚?${num} ?n嚗?嚗?嚗?嚗?嚗?嚗?嚗?嚗?嚗?嚗?\n\n${content}\n\n嚗?嚗?嚗?嚗?嚗?嚗?嚗?嚗?嚗?嚗?\n?澆???${req.session.user?.username || '蝞∠???}\n?澆??桐?嚗?{publishUnit}\n?砍??桐?嚗?憓?銝餃??蝮賜絞摨;
    const channel = client.channels.cache.get(channelId);
    if (channel) channel.send(msg).catch(() => {});
    req.session.alert = { type: 'success', text: `?砍? ${num} 撌脩撣 #${channel?.name || '?芰?駁?'}` };
    res.redirect('/admin/announce');
  });

  app.get('/admin/economy', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    res.render('admin', { ...baseData(), page: 'economy', pageTitle: '蝬?蝞∠?', user: req.session.user,
      treasury: db.economy.treasury, totalSupply: db.economy.totalSupply,
      txCount: db.economy.transactions.length,
      txs: [...db.economy.transactions].reverse().slice(0, 50),
    });
  });

  app.get('/admin/diplomacy', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    res.render('admin', { ...baseData(), page: 'diplomacy', pageTitle: '憭漱?虫漱', user: req.session.user,
      allies: db.allies, orgs: db.organizations,
      alert: req.session.alert || null,
    });
    req.session.alert = null;
  });

  app.post('/admin/diplomacy/add', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const { name, date } = req.body;
    if (!name) {
      req.session.alert = { type: 'error', text: '隢‵撖怠?摰嗅?蝔? };
      return res.redirect('/admin/diplomacy');
    }
    if (db.allies.find(a => a.name === name)) {
      req.session.alert = { type: 'error', text: '閰脣?摰嗅歇?券鈭文?銵其葉' };
      return res.redirect('/admin/diplomacy');
    }
    db.allies.push({ name, date: date || new Date().toLocaleDateString('zh-TW') });
    vdr.save();
    req.session.alert = { type: 'success', text: `撌脫憓鈭文?嚗?{name}` };
    res.redirect('/admin/diplomacy');
  });

  app.post('/admin/diplomacy/remove', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const { name } = req.body;
    const idx = db.allies.findIndex(a => a.name === name);
    if (idx === -1) {
      req.session.alert = { type: 'error', text: '?曆??啗府?振' };
      return res.redirect('/admin/diplomacy');
    }
    db.allies.splice(idx, 1);
    vdr.save();
    req.session.alert = { type: 'success', text: `撌脩宏?日鈭文?嚗?{name}` };
    res.redirect('/admin/diplomacy');
  });

  app.get('/admin/roles', requireAuth, (req, res) => {
    const roles = [];
    for (const g of client.guilds.cache.values()) {
      for (const r of g.roles.cache.sort((a, b) => b.position - a.position).values()) {
        if (r.name === '@everyone') continue;
        roles.push({ id: r.id, name: r.name, color: r.hexColor === '#000000' ? null : r.hexColor, count: r.members.size, position: r.position, guild: g.name });
      }
    }
    res.render('admin', { ...baseData(), page: 'roles', pageTitle: '頨怠?蝯恣??, roles, user: req.session.user, alert: req.session.alert || null });
    req.session.alert = null;
  });

  app.post('/admin/roles/assign', requireAuth, async (req, res) => {
    const { roleId, userId, action } = req.body;
    if (!roleId || !userId) {
      req.session.alert = { type: 'error', text: '隢?澈???撓?乩蝙?刻?ID' };
      return res.redirect('/admin/roles');
    }
    try {
      let done = false;
      for (const g of client.guilds.cache.values()) {
        const member = await g.members.fetch(userId).catch(() => null);
        if (!member) continue;
        const role = g.roles.cache.get(roleId);
        if (!role) continue;
        if (action === 'add') {
          await member.roles.add(roleId);
          req.session.alert = { type: 'success', text: '撌脣? ' + role.name + ' ?晷蝯?' + member.user.tag };
        } else {
          await member.roles.remove(roleId);
          req.session.alert = { type: 'success', text: '撌脣? ' + member.user.tag + ' 蝘駁 ' + role.name };
        }
        done = true;
        break;
      }
      if (!done) req.session.alert = { type: 'error', text: '?曆??啗府雿輻??頨怠?蝯? };
    } catch (err) {
      req.session.alert = { type: 'error', text: '??憭望?嚗? + err.message };
    }
    res.redirect('/admin/roles');
  });

  app.get('/admin/autorole', requireAuth, (req, res) => {
    const vdr = require('../src/services/vdr-data');
    const db = vdr.get();
    const roles = [];
    for (const g of client.guilds.cache.values()) {
      for (const r of g.roles.cache.sort((a, b) => b.position - a.position).values()) {
        if (r.name === '@everyone') continue;
        roles.push({ id: r.id, name: r.name, guild: g.name });
      }
    }
    res.render('admin', { ...baseData(), page: 'autorole', pageTitle: '?芸?頨怠?蝯?, roles, autoRole: db.autoRole || { joinRoleId: '', citizenRoleId: '' }, user: req.session.user, alert: req.session.alert || null });
    req.session.alert = null;
  });

  app.post('/admin/autorole/save', requireAuth, (req, res) => {
    const vdr = require('../src/services/vdr-data');
    const db = vdr.get();
    db.autoRole = { joinRoleId: req.body.joinRoleId || '', citizenRoleId: req.body.citizenRoleId || '' };
    vdr.save();
    req.session.alert = { type: 'success', text: '?芸?頨怠?蝯身摰歇?脣?' };
    res.redirect('/admin/autorole');
  });

  app.get('/admin/airoles', requireAuth, (req, res) => {
    const vdr = require('../src/services/vdr-data');
    const db = vdr.get();
    const config = db.aiRole || { enabled: false, keywords: {} };
    res.render('admin', { ...baseData(), page: 'airoles', pageTitle: 'AI 身分組', config, user: req.session.user, alert: req.session.alert || null, hasApi: !!process.env.AI_API_KEY });
    req.session.alert = null;
  });

  app.post('/admin/airoles/save', requireAuth, (req, res) => {
    const vdr = require('../src/services/vdr-data');
    const db = vdr.get();
    const keywords = {};
    for (const [key, val] of Object.entries(req.body)) {
      if (key.startsWith('kw_') && val.trim()) {
        keywords[key.slice(3)] = val.split(',').map(w => w.trim()).filter(Boolean);
      }
    }
    db.aiRole = { enabled: req.body.enabled === '1', keywords };
    vdr.save();
    req.session.alert = { type: 'success', text: 'AI 身分組設定已儲存' };
    res.redirect('/admin/airoles');
  });

  app.get('/admin/welcome', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const channels = [];
    const allRoles = [];
    for (const g of client.guilds.cache.values()) {
      for (const c of g.channels.cache.values()) {
        if (c.type === 0) channels.push({ id: c.id, name: `#${c.name}嚗?{g.name}嚗 });
      }
      for (const r of g.roles.cache.sort((a, b) => b.position - a.position).values()) {
        if (r.name === '@everyone') continue;
        allRoles.push({ id: r.id, name: `${r.name}嚗?{g.name}嚗, color: r.hexColor === '#000000' ? null : r.hexColor });
      }
    }
    res.render('admin', { ...baseData(), page: 'welcome', pageTitle: '甇∟?閮剖?', user: req.session.user,
      welcome: db.welcome || { enabled: true, channelId: '' }, channels, allRoles, autoRoleId: db.autoRoleId || '',
      alert: req.session.alert || null,
    });
    req.session.alert = null;
  });

  app.post('/admin/welcome/save', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    db.welcome = { enabled: req.body.enabled === '1', channelId: req.body.channelId || '' };
    db.autoRoleId = req.body.autoRoleId || '';
    vdr.save();
    req.session.alert = { type: 'success', text: '甇∟?閮剖?撌脣摮? };
    res.redirect('/admin/welcome');
  });

  app.get('/admin/servers', requireAuth, (req, res) => {
    const guilds = [...client.guilds.cache.values()].map(g => ({
      id: g.id, name: g.name, members: g.memberCount,
      owner: g.members.cache.get(g.ownerId)?.user?.tag || '?芰',
    }));
    res.render('admin', { ...baseData(), page: 'servers', pageTitle: '隡箸??函恣??, guilds, user: req.session.user });
  });

  app.get('/admin/logs', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const systemLogs = [];
    for (const d of db.decrees) systemLogs.push({ time: new Date(d.issuedAt).toLocaleString('zh-TW'), text: `?? 蝮賜絞隞?#${d.id}嚗?{d.title}` });
    for (const a of (db.announcements || [])) systemLogs.push({ time: new Date(a.at).toLocaleString('zh-TW'), text: `? ?砍? ${a.number}嚗?{a.title}` });
    for (const t of db.economy.transactions) systemLogs.push({ time: new Date(t.at).toLocaleString('zh-TW'), text: `? ${t.amount} 撟?${t.from} ??${t.to}` });
    systemLogs.sort((a, b) => new Date(b.time) - new Date(a.time));

    const msgLog = require('../src/services/message-log');
    const messages = msgLog.getRecent(100);

    res.render('admin', { ...baseData(), page: 'logs', pageTitle: '蝟餌絞?亥?', user: req.session.user,
      systemLogs: systemLogs.slice(0, 50),
      messages,
    });
  });

  app.listen(PORT, () => {
    logger.info(`蝞∠?敺撌脣??? http://localhost:${PORT}`);
  });
}

module.exports = { startAdmin };

