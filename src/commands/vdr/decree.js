const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const vdr = require('../../services/vdr-data');

module.exports = {
  category: '政府',
  data: new SlashCommandBuilder()
    .setName('vdr-decree')
    .setDescription('發布總統令（總統專用）')
    .addStringOption(opt => opt.setName('標題').setDescription('總統令標題').setRequired(true))
    .addStringOption(opt => opt.setName('內容').setDescription('總統令內容').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const title = interaction.options.getString('標題');
    const content = interaction.options.getString('內容');
    const decree = vdr.addDecree(interaction.user.id, interaction.user.tag, title, content);
    const embed = new EmbedBuilder()
      .setColor(0xc9a84c)
      .setTitle(`總統令 第 ${decree.id} 號`)
      .setDescription(`**${title}**`)
      .addFields({ name: '內容', value: content, inline: false })
      .setFooter({ text: `發布者：${interaction.user.tag} ｜ 虛境民主共和國總統府` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};
