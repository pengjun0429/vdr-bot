const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pkg = require('../../../package.json');

module.exports = {
  category: '國家',
  data: new SlashCommandBuilder()
    .setName('vdr-version')
    .setDescription('查看目前機器人版本'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x1a2744)
      .setTitle(`VDR 政府服務機器人 v${pkg.version}`)
      .addFields(
        { name: '版本', value: pkg.version, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'Discord.js', value: pkg.dependencies['discord.js'].replace('^', ''), inline: true },
      )
      .setFooter({ text: `v${pkg.version} ｜ 虛境民主共和國 技術發展部` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};
