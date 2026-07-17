const msgLog = require('../services/message-log');

module.exports = {
  async execute(message) {
    if (message.author?.bot) return;
    msgLog.log('delete', {
      guildId: message.guild?.id,
      channelId: message.channel.id,
      channelName: message.channel.name,
      authorId: message.author?.id,
      authorTag: message.author?.tag,
      content: message.content || '(快取已遺失)',
    });
  },
};
