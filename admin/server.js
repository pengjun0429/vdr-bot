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
  app.set('trust proxy', 1);
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
      const proto = req.headers['x-forwarded-proto'] || req.protocol;
      const redirectUri = proto + '://' + req.get('host') + '/auth/callback';
      const url = `${DISCORD_API}/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify+guilds`;
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
    res.render('login', { error: '帳號或密碼錯誤', discordUrl: '#', useDiscord: false });
  });

  app.get('/auth/callback', async (req, res) => {
    if (!useDiscordAuth) return res.redirect('/login');
    const { code, error: errParam } = req.query;
    if (errParam || !code) {
      return res.render('login', { error: 'Discord 登入失敗：' + (errParam || '無授權碼'), discordUrl: '#', useDiscord: true });
    }
    try {
      const axios = require('axios');
      const tokenRes = await axios.post(`${DISCORD_API}/oauth2/token`,
        new URLSearchParams({
          client_id: config.discord.clientId,
          client_secret: config.discord.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: (req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.get('host') + '/auth/callback',
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
        return res.render('login', { error: '你沒有管理員權限', discordUrl: '#', useDiscord: true });
      }

      req.session.authenticated = true;
      req.session.user = { id: user.id, username: user.username, avatar: user.avatar, global_name: user.global_name };
      const returnTo = req.session.returnTo || '/dashboard';
      delete req.session.returnTo;
      res.redirect(returnTo);
    } catch (err) {
      logger.error('Discord OAuth2 錯誤:', err.message, err.response?.data || '');
      res.render('login', { error: '認證失敗：' + (err.response?.data?.error_description || err.message), discordUrl: '#', useDiscord: true });
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
    for (const d of db.decrees.slice(-3).reverse()) recent.push({ type: '總統令', time: new Date(d.issuedAt).toLocaleString('zh-TW'), text: d.title });
    for (const a of (db.announcements || []).slice(-3).reverse()) recent.push({ type: '公告', time: new Date(a.at).toLocaleString('zh-TW'), text: a.title });
    for (const t of db.economy.transactions.slice(-3).reverse()) recent.push({ type: '交易', time: new Date(t.at).toLocaleString('zh-TW'), text: `${t.amount} 幣` });
    res.render('admin', { ...baseData(), page: 'dashboard', pageTitle: '國家控制臺', user: req.session.user,
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
    res.render('admin', { ...baseData(), page: 'citizens', pageTitle: '公民管理', citizens, user: req.session.user });
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
      decrees: [...db.decrees].reverse(), channels, user: req.session.user,
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
    const decree = vdr.addDecree('admin', req.session.user?.username || '管理員', title, content);
    if (channelId) {
      const { EmbedBuilder } = require('discord.js');
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0xc9a84c)
          .setTitle(`總統令 第 ${decree.id} 號`)
          .setDescription(`**${title}**`)
          .addFields({ name: '內容', value: content, inline: false })
          .setFooter({ text: `發布者：${req.session.user?.username || '管理員'} ｜ 虛境民主共和國總統府` })
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
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const nextNum = (db.announceCount?.[today] || 0) + 1;
    const nextNumber = `${today}-${String(nextNum).padStart(3, '0')}`;
    res.render('admin', { ...baseData(), page: 'announce', pageTitle: '國家公告',
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
      req.session.alert = { type: 'error', text: '請選擇發送頻道' };
      return res.redirect('/admin/announce');
    }
    const num = vdr.nextAnnounceNumber();
    vdr.addAnnouncement(num, title, content, req.session.user?.username || '管理員');
    const publishUnit = unit || '技術發展部';
    const msg = `**【𝐕𝐃𝐑國家發展公告】**\n\n條約編號：虛外字第 ${num} 號\n＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝\n\n${content}\n\n＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝\n發布者：${req.session.user?.username || '管理員'}\n發布單位：${publishUnit}\n公告單位：虛境民主共和國總統府`;
    const channel = client.channels.cache.get(channelId);
    if (channel) channel.send(msg).catch(() => {});
    req.session.alert = { type: 'success', text: `公告 ${num} 已發布至 #${channel?.name || '未知頻道'}` };
    res.redirect('/admin/announce');
  });

  app.get('/admin/economy', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    res.render('admin', { ...baseData(), page: 'economy', pageTitle: '經濟管理', user: req.session.user,
      treasury: db.economy.treasury, totalSupply: db.economy.totalSupply,
      txCount: db.economy.transactions.length,
      txs: [...db.economy.transactions].reverse().slice(0, 50),
    });
  });

  app.get('/admin/diplomacy', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    res.render('admin', { ...baseData(), page: 'diplomacy', pageTitle: '外交邦交', user: req.session.user,
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
      req.session.alert = { type: 'error', text: '請填寫國家名稱' };
      return res.redirect('/admin/diplomacy');
    }
    if (db.allies.find(a => a.name === name)) {
      req.session.alert = { type: 'error', text: '該國家已在邦交列表中' };
      return res.redirect('/admin/diplomacy');
    }
    db.allies.push({ name, date: date || new Date().toLocaleDateString('zh-TW') });
    vdr.save();
    req.session.alert = { type: 'success', text: `已新增邦交國：${name}` };
    res.redirect('/admin/diplomacy');
  });

  app.post('/admin/diplomacy/remove', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const { name } = req.body;
    const idx = db.allies.findIndex(a => a.name === name);
    if (idx === -1) {
      req.session.alert = { type: 'error', text: '找不到該國家' };
      return res.redirect('/admin/diplomacy');
    }
    db.allies.splice(idx, 1);
    vdr.save();
    req.session.alert = { type: 'success', text: `已移除邦交國：${name}` };
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
    res.render('admin', { ...baseData(), page: 'roles', pageTitle: '身分組管理', roles, user: req.session.user, alert: req.session.alert || null });
    req.session.alert = null;
  });

  app.post('/admin/roles/assign', requireAuth, async (req, res) => {
    const { roleId, userId, action } = req.body;
    if (!roleId || !userId) {
      req.session.alert = { type: 'error', text: '請選擇身分組和輸入使用者 ID' };
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
          req.session.alert = { type: 'success', text: '已將 ' + role.name + ' 指派給 ' + member.user.tag };
        } else {
          await member.roles.remove(roleId);
          req.session.alert = { type: 'success', text: '已從 ' + member.user.tag + ' 移除 ' + role.name };
        }
        done = true;
        break;
      }
      if (!done) req.session.alert = { type: 'error', text: '找不到該使用者或身分組' };
    } catch (err) {
      req.session.alert = { type: 'error', text: '操作失敗：' + err.message };
    }
    res.redirect('/admin/roles');
  });

  app.get('/admin/welcome', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const channels = [];
    for (const g of client.guilds.cache.values()) {
      for (const c of g.channels.cache.values()) {
        if (c.type === 0) channels.push({ id: c.id, name: `#${c.name}（${g.name}）` });
      }
    }
    res.render('admin', { ...baseData(), page: 'welcome', pageTitle: '歡迎設定', user: req.session.user,
      welcome: db.welcome || { enabled: true, channelId: '' }, channels,
      alert: req.session.alert || null,
    });
    req.session.alert = null;
  });

  app.post('/admin/welcome/save', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    db.welcome = { enabled: req.body.enabled === '1', channelId: req.body.channelId || '' };
    vdr.save();
    req.session.alert = { type: 'success', text: '歡迎設定已儲存' };
    res.redirect('/admin/welcome');
  });

  app.get('/admin/servers', requireAuth, (req, res) => {
    const guilds = [...client.guilds.cache.values()].map(g => ({
      id: g.id, name: g.name, members: g.memberCount,
      owner: g.members.cache.get(g.ownerId)?.user?.tag || '未知',
    }));
    res.render('admin', { ...baseData(), page: 'servers', pageTitle: '伺服器管理', guilds, user: req.session.user });
  });

  app.get('/admin/logs', requireAuth, (req, res) => {
    const vdr = getVdr();
    const db = vdr.get();
    const systemLogs = [];
    for (const d of db.decrees) systemLogs.push({ time: new Date(d.issuedAt).toLocaleString('zh-TW'), text: `📜 總統令 #${d.id}：${d.title}` });
    for (const a of (db.announcements || [])) systemLogs.push({ time: new Date(a.at).toLocaleString('zh-TW'), text: `📢 公告 ${a.number}：${a.title}` });
    for (const t of db.economy.transactions) systemLogs.push({ time: new Date(t.at).toLocaleString('zh-TW'), text: `💰 ${t.amount} 幣 ${t.from} → ${t.to}` });
    systemLogs.sort((a, b) => new Date(b.time) - new Date(a.time));

    const msgLog = require('../src/services/message-log');
    const messages = msgLog.getRecent(100);

    res.render('admin', { ...baseData(), page: 'logs', pageTitle: '系統日誌', user: req.session.user,
      systemLogs: systemLogs.slice(0, 50),
      messages,
    });
  });

  app.get('/debug-oauth', (req, res) => {
    res.json({
      clientId: config.discord.clientId,
      hasSecret: !!config.discord.clientSecret,
      secretLength: (config.discord.clientSecret || '').length,
      redirectUri: (req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.get('host') + '/auth/callback',
      host: req.get('host'),
      proto: req.protocol,
      forwardedProto: req.headers['x-forwarded-proto'],
    });
  });

  
  app.get('/admin/say', requireAuth, (req, res) => {
    const channels = [];
    for (const g of client.guilds.cache.values()) {
      for (const ch of g.channels.cache.values()) {
        if (ch.type === 0) channels.push({ id: ch.id, name: ch.name + ' (' + g.name + ')' });
      }
    }
    res.render('admin', { ...baseData(), page: 'say', pageTitle: '機器人發言', channels, user: req.session.user, alert: req.session.alert || null });
    req.session.alert = null;
  });

  app.post('/admin/say/send', requireAuth, (req, res) => {
    const { channelId, message } = req.body;
    if (!channelId || !message) {
      req.session.alert = { type: 'error', text: '請選擇頻道並填寫訊息' };
      return res.redirect('/admin/say');
    }
    const channel = client.channels.cache.get(channelId);
    if (channel) {
      channel.send(message).catch(() => {});
      req.session.alert = { type: 'success', text: '已發送訊息至 #' + (channel.name || '頻道') };
    } else {
      req.session.alert = { type: 'error', text: '找不到頻道' };
    }
    res.redirect('/admin/say');
  });

  app.listen(PORT, () => {
    logger.info(`管理後臺已啟動: http://localhost:${PORT}`);
  });
}

module.exports = { startAdmin };
