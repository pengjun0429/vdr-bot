const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const vdr = require('../../services/vdr-data');
const pkg = require('../../../package.json');

module.exports = {
  category: '國家',
  data: new SlashCommandBuilder()
    .setName('vdr')
    .setDescription('虛境民主共和國國家資訊'),
  async execute(interaction) {
    const db = vdr.get();
    const n = db.nation;
    const embed = new EmbedBuilder()
      .setColor(0x1a2744)
      .setTitle(`${n.name} ${n.nameEn}`)
      .setDescription(`**${n.motto}**`)
      .addFields(
        { name: '簡稱', value: n.short, inline: true },
        { name: '首都', value: n.capital, inline: true },
        { name: '總統', value: n.president, inline: true },
        { name: '官方語言', value: n.language, inline: true },
        { name: '貨幣', value: n.currency, inline: true },
        { name: '領土面積', value: n.area, inline: true },
        { name: '成立日期', value: n.founded, inline: true },
        { name: '加入 ICEA', value: n['icea joined'], inline: true },
        { name: '邦交國數量', value: `${db.allies.length} 國`, inline: true },
        { name: '公民人數', value: `${Object.keys(db.citizens).length} 人`, inline: true },
      )
      .setFooter({ text: `v${pkg.version} ｜ 虛境民主共和國 技術發展部` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};
