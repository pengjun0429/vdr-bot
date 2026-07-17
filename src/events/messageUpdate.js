const msgLog = require('../services/message-log');

module.exports = {
  async execute(oldMessage, newMessage) {
    if (newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    msgLog.log('edit', {
      guildId: newMessage.guild?.id,
      channelId: newMessage.channel.id,
      channelName: newMessage.channel.name,
      authorId: newMessage.author.id,
      authorTag: newMessage.author.tag,
      content: `${oldMessage.content || ''} → ${newMessage.content || ''}`,
    });
  },
};
