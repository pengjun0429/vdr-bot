const { EmbedBuilder } = require('discord.js');
const vdr = require('../services/vdr-data');
const logger = require('../utils/logger');

module.exports = {
  async execute(member) {
    try {
      const db = vdr.get();
      if (!db.welcome?.enabled) return;
      const n = db.nation;
      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x1a2744)
        .setTitle(`歡迎來到 ${n.name}！`)
        .setDescription(`歡迎 ${member} 加入虛境民主共和國 Discord 伺服器。\n\n請使用 \`/vdr-register\` 註冊成為公民，展開你的虛境之旅！`)
        .addFields(
          { name: '格言', value: n.motto, inline: true },
          { name: '首都', value: n.capital, inline: true },
          { name: '貨幣', value: n.currency, inline: true },
        )
        .setFooter({ text: '虛境民主共和國 技術發展部' })
        .setTimestamp();
      const channelId = db.welcome?.channelId;
      const channel = channelId ? member.guild.channels.cache.get(channelId) : member.guild.systemChannel;
      if (channel) channel.send({ embeds: [welcomeEmbed] });
    } catch (err) {
      logger.warn('VDR 歡迎訊息錯誤:', err.message);
    }
  },
};
