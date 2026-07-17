const { EmbedBuilder } = require('discord.js');
const vdr = require('../services/vdr-data');
const logger = require('../utils/logger');

function replaceVars(text, member, guild) {
  return (text || '')
    .replace(/{user}/g, member.toString())
    .replace(/{name}/g, member.user.username)
    .replace(/{tag}/g, member.user.tag)
    .replace(/{server}/g, guild.name)
    .replace(/{count}/g, guild.memberCount)
    .replace(/{channel}/g, guild.systemChannel ? guild.systemChannel.toString() : '');
}

module.exports = {
  async execute(member) {
    try {
      const db = vdr.get();
      if (!db.welcome?.enabled) return;
      const n = db.nation;
      const msg = db.welcome?.message || '歡迎 {user} 加入 {name}！\n請使用 /vdr-register 註冊成為公民。';
      const desc = replaceVars(msg, member, member.guild);
      const embed = new EmbedBuilder()
        .setColor(0x1a2744)
        .setTitle('歡迎來到 ' + n.name + '！')
        .setDescription(desc)
        .addFields(
          { name: '國家格言', value: n.motto, inline: true },
          { name: '首都', value: n.capital, inline: true },
          { name: '貨幣', value: n.currency, inline: true },
        )
        .setFooter({ text: '虛境民主共和國 技術發展部' })
        .setTimestamp();
      const channelId = db.welcome?.channelId;
      const channel = channelId ? member.guild.channels.cache.get(channelId) : member.guild.systemChannel;
      if (channel) channel.send({ embeds: [embed] });
    } catch (err) {
      logger.warn('VDR 歡迎訊息錯誤:', err.message);
    }
  },
};
