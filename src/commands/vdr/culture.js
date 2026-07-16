const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  category: '國家',
  data: new SlashCommandBuilder()
    .setName('vdr-culture')
    .setDescription('VDR 文化展示'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x1a2744)
      .setTitle('國家文化')
      .setDescription('虛境民主共和國文化資產')
      .addFields(
        { name: '國家格言', value: '「虛實共生，技術強國」', inline: false },
        { name: '國歌', value: '《繁星都》', inline: false },
        { name: '國家貨幣', value: '尐尐幣', inline: true },
        { name: '官方語言', value: '繁體中文', inline: true },
        { name: '🍌 香蕉教', value: '西苑省為香蕉軍特殊自治區，職責：保衛香蕉教', inline: false },
        { name: '🏔️ 原民文化', value: '嵐山自治省為排灣族與阿美族血統之文化保存區', inline: false },
      )
      .setFooter({ text: '虛境民主共和國 技術發展部' });
    await interaction.reply({ embeds: [embed] });
  },
};
