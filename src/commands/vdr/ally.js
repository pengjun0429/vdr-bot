const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const vdr = require('../../services/vdr-data');

module.exports = {
  category: '外交',
  data: new SlashCommandBuilder()
    .setName('vdr-ally')
    .setDescription('查詢邦交國資訊'),
  async execute(interaction) {
    const db = vdr.get();
    const embed = new EmbedBuilder()
      .setColor(0xc9a84c)
      .setTitle('邦交國一覽')
      .setDescription(`虛境民主共和國與 **${db.allies.length}** 個國家維持正式外交關係`)
      .setFooter({ text: '虛境民主共和國 外交部' });
    for (const ally of db.allies) {
      const date = ally.date ? `（${ally.date}）` : '';
      embed.addFields({ name: `${ally.name} ${date}`, value: '大使館運作中', inline: true });
    }
    if (db.organizations.length) {
      let orgText = '';
      for (const org of db.organizations) {
        orgText += `• ${org.name}（${org.joined}加入）\n`;
      }
      embed.addFields({ name: '國際組織', value: orgText, inline: false });
    }
    await interaction.reply({ embeds: [embed] });
  },
};
