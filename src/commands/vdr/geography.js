const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const vdr = require('../../services/vdr-data');

module.exports = {
  category: '國家',
  data: new SlashCommandBuilder()
    .setName('vdr-geography')
    .setDescription('VDR 行政區介紹')
    .addStringOption(opt => opt
      .setName('行政區')
      .setDescription('要查詢的行政區')
      .setRequired(false)
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
    const db = vdr.get();
    const selected = interaction.options.getString('行政區');
    if (selected) {
      const r = db.regions[selected];
      if (!r) return interaction.reply({ content: '找不到該行政區', ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(0x1a2744)
        .setTitle(`📍 ${selected}`)
        .setDescription(r.title)
        .addFields(
          { name: '定義', value: r.desc, inline: false },
          { name: '職能', value: r.duties, inline: false },
        )
        .setFooter({ text: '虛境民主共和國 技術發展部' });
      return interaction.reply({ embeds: [embed] });
    }
    const embed = new EmbedBuilder()
      .setColor(0x1a2744)
      .setTitle('行政區劃')
      .setDescription('虛境民主共和國共劃分為 7 個行政區')
      .setFooter({ text: '使用 /vdr-geography 行政區:名稱 查看詳細資訊' });
    for (const [name, data] of Object.entries(db.regions)) {
      embed.addFields({ name, value: data.title, inline: true });
    }
    await interaction.reply({ embeds: [embed] });
  },
};
