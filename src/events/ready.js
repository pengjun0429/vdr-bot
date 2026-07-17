const logger = require('../utils/logger');
const vdr = require('../services/vdr-data');

module.exports = {
  once: true,
  async execute(client) {
    logger.info(`已登入為 ${client.user.tag}`);
    logger.info(`VDR 政府服務機器人 v${require('../../package.json').version} 已就緒`);
  },
};
