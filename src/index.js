const client = require('./client');
const config = require('./config');
const logger = require('./utils/logger');
const { deploy } = require('./utils/deploy-commands');
const { registerCommands, registerEvents } = require('./utils/command-handler');
const firebase = require('./services/firebase');
const settings = require('./services/settings');

async function start() {
  await settings.init();
  firebase.init();
  registerCommands(client);
  registerEvents(client);

  await deploy();

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await client.login(config.discord.token);
      logger.info('Bot 啟動完成');
      if (process.env.ADMIN_PORT || process.env.ADMIN_AUTO_START !== 'false') {
        try {
          const { startAdmin } = require('../admin/server');
          startAdmin(client);
        } catch (err) {
          logger.warn('管理員後臺啟動失敗:', err.message);
        }
      }
      return;
    } catch (err) {
      logger.error(`登入失敗 (第 ${attempt} 次):`, err.message);
      if (attempt < 3) {
        const delay = attempt * 5000;
        logger.info(`等待 ${delay/1000} 秒後重試...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  logger.error('連續 3 次登入失敗，結束程序');
  process.exit(1);
}

start();

process.on('unhandledRejection', (err) => {
  logger.error('未捕捉的 Promise 拒絕:', err);
});
