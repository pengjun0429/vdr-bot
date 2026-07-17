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

  app.get('/dashboard', requireAuth, (req, res) => {
    const vdr = require('../src/services/vdr-data');
    const db = vdr.get();
    const citizens = Object.entries(db.citizens).map(([id, c]) => ({ id, ...c }));
    res.render('dashboard', {
      online: true,
      ping: client.ws.ping,
      commands: client.commands.size,
      vdrStats: {
        citizens: citizens.length,
        decrees: db.decrees.length,
        announcements: db.announcements ? db.announcements.length : 0,
        allies: db.allies.length,
        treasury: db.economy.treasury,
        transactions: db.economy.transactions.length,
        recentCitizens: citizens.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt)).slice(0, 5),
      },
    });
  });

  app.get('/vdr', requireAuth, (req, res) => {
    const vdr = require('../src/services/vdr-data');
    const db = vdr.get();
    res.render('vdr', {
      nation: {
        citizens: Object.keys(db.citizens).length,
        allies: db.allies.length,
        decrees: db.decrees.length,
        treasury: db.economy.treasury,
        txCount: db.economy.transactions.length,
        regions: Object.keys(db.regions).length,
      },
      citizens: Object.entries(db.citizens).map(([id, c]) => ({ id, ...c })),
      decrees: [...db.decrees].reverse(),
      txs: [...db.economy.transactions].reverse().slice(0, 50),
    });
  });

  app.listen(PORT, () => {
    logger.info(`管理後臺已啟動: http://localhost:${PORT}`);
  });
}

module.exports = { startAdmin };
