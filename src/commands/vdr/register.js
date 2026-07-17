const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const vdr = require('../../services/vdr-data');

module.exports = {
  category: '公民',
  data: new SlashCommandBuilder()
    .setName('vdr-register')
    .setDescription('註冊為 VDR 公民')
    .addStringOption(opt => opt.setName('姓名').setDescription('你的姓名').setRequired(true))
    .addStringOption(opt => opt
      .setName('行政區')
      .setDescription('所屬行政區')
      .setRequired(true)
      .addChoices(
        { name: '繁星都', value: '繁星都' },
        { name: '北原省', value: '北原省' },
        { name: '中京省', value: '中京省' },
        { name: '海晏省', value: '海晏省' },
        { name: '恆陽省', value: '恆陽省' },
        { name: '嵐山自治省', value: '嵐山自治省' },
        { name: '西苑省', value: '西苑省' },
      )),
  async execute(interaction) {
    const existing = vdr.getCitizen(interaction.user.id);
    if (existing) {
      return interaction.reply({ content: '你已經註冊過了', ephemeral: true });
    }
    const name = interaction.options.getString('姓名');
    const region = interaction.options.getString('行政區');
    const citizen = vdr.registerCitizen(interaction.user.id, { name, region });

    const db = vdr.get();
    const citizenRoleId = db.autoRole?.citizenRoleId;
    if (citizenRoleId) {
      const role = interaction.guild.roles.cache.get(citizenRoleId);
      if (role && role.position < interaction.guild.members.me.roles.highest.position) {
        await interaction.member.roles.add(role).catch(() => {});
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x1a2744)
      .setTitle('公民註冊成功')
      .setDescription(`歡迎加入虛境民主共和國，${name}！`)
      .addFields(
        { name: '公民名稱', value: citizen.name, inline: true },
        { name: '行政區', value: citizen.region, inline: true },
        { name: '開局資金', value: `${citizen.wallet} 尐尐幣`, inline: true },
        { name: '註冊時間', value: `<t:${Math.floor(new Date(citizen.registeredAt).getTime() / 1000)}:F>`, inline: false },
      )
      .setFooter({ text: '虛境民主共和國 技術發展部' });
    await interaction.reply({ embeds: [embed] });
  },
};
