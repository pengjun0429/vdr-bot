const { EmbedBuilder } = require('discord.js');
const vdr = require('../services/vdr-data');
const logger = require('../utils/logger');

module.exports = {
  async execute(member) {
    try {
      const db = vdr.get();
      if (!db.farewell?.enabled) return;
      const n = db.nation;
      const msg = db.farewell?.message || '{user} 離開了 {server}。';
      const desc = (msg || '')
        .replace(/{user}/g, member.user.tag)
        .replace(/{name}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{count}/g, member.guild.memberCount);
      const embed = new EmbedBuilder()
        .setColor(0x8b826e)
        .setTitle('成員離開')
        .setDescription(desc)
        .setFooter({ text: '虛境民主共和國 技術發展部' })
        .setTimestamp();
      const channelId = db.farewell?.channelId;
      const channel = channelId ? member.guild.channels.cache.get(channelId) : member.guild.systemChannel;
      if (channel) channel.send({ embeds: [embed] });
    } catch (err) {
      logger.warn('VDR 離開訊息錯誤:', err.message);
    }
  },
};
