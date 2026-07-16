const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const vdr = require('../../services/vdr-data');

module.exports = {
  category: '公民',
  data: new SlashCommandBuilder()
    .setName('vdr-profile')
    .setDescription('查看公民資料'),
  async execute(interaction) {
    const citizen = vdr.getCitizen(interaction.user.id);
    if (!citizen) {
      return interaction.reply({ content: '你還不是公民，請使用 `/vdr-register` 註冊', ephemeral: true });
    }
    const db = vdr.get();
    const embed = new EmbedBuilder()
      .setColor(0x1a2744)
      .setTitle(`${citizen.name} 的公民資料`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '姓名', value: citizen.name, inline: true },
        { name: '行政區', value: citizen.region, inline: true },
        { name: '錢包餘額', value: `${citizen.wallet} 尐尐幣`, inline: true },
        { name: '註冊時間', value: `<t:${Math.floor(new Date(citizen.registeredAt).getTime() / 1000)}:R>`, inline: false },
        { name: '國家總資產', value: `${db.economy.treasury} 尐尐幣`, inline: true },
        { name: '總流通量', value: `${db.economy.totalSupply} 尐尐幣`, inline: true },
      )
      .setFooter({ text: '虛境民主共和國 技術發展部' });
    await interaction.reply({ embeds: [embed] });
  },
};
