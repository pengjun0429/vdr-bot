const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const vdr = require('../../services/vdr-data');

module.exports = {
  category: '國家',
  data: new SlashCommandBuilder()
    .setName('vdr-history')
    .setDescription('VDR 歷史事件時間線'),
  async execute(interaction) {
    const db = vdr.get();
    const embed = new EmbedBuilder()
      .setColor(0x1a2744)
      .setTitle('歷史沿革')
      .setDescription('虛境民主共和國重大事件時間線')
      .setFooter({ text: '虛境民主共和國 技術發展部' });
    for (const h of db.history) {
      embed.addFields({ name: h.date, value: h.event, inline: false });
    }
    await interaction.reply({ embeds: [embed] });
  },
};
