const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const vdr = require('../../services/vdr-data');

module.exports = {
  category: '經濟',
  data: new SlashCommandBuilder()
    .setName('vdr-economy')
    .setDescription('經濟系統操作')
    .addSubcommand(sub => sub
      .setName('transfer')
      .setDescription('轉帳尐尐幣給其他公民')
      .addUserOption(opt => opt.setName('對象').setDescription('收款人').setRequired(true))
      .addIntegerOption(opt => opt.setName('金額').setDescription('轉帳金額').setRequired(true).setMinValue(1))
      .addStringOption(opt => opt.setName('備註').setDescription('轉帳備註').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('ledger')
      .setDescription('查看交易紀錄')),
  async execute(interaction) {
    if (interaction.options.getSubcommand() === 'transfer') {
      const fromCitizen = vdr.getCitizen(interaction.user.id);
      if (!fromCitizen) {
        return interaction.reply({ content: '你還不是公民，請使用 `/vdr-register` 註冊', ephemeral: true });
      }
      const target = interaction.options.getUser('對象');
      const amount = interaction.options.getInteger('金額');
      const note = interaction.options.getString('備註') || '';
      if (target.id === interaction.user.id) {
        return interaction.reply({ content: '不能轉帳給自己', ephemeral: true });
      }
      const toCitizen = vdr.getCitizen(target.id);
      if (!toCitizen) {
        return interaction.reply({ content: '對方還不是公民', ephemeral: true });
      }
      const result = vdr.transfer(interaction.user.id, target.id, amount, note);
      if (result.error) {
        return interaction.reply({ content: result.error, ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(0x1a2744)
        .setTitle('轉帳成功')
        .setDescription(`${interaction.user.tag} → ${target.tag}`)
        .addFields(
          { name: '金額', value: `${amount} 尐尐幣`, inline: true },
          { name: '備註', value: note || '無', inline: true },
          { name: '你的餘額', value: `${result.from.wallet} 尐尐幣`, inline: true },
        )
        .setFooter({ text: '虛境民主共和國 中央銀行' })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } else if (interaction.options.getSubcommand() === 'ledger') {
      const citizen = vdr.getCitizen(interaction.user.id);
      if (!citizen) {
        return interaction.reply({ content: '你還不是公民', ephemeral: true });
      }
      const db = vdr.get();
      const txs = db.economy.transactions
        .filter(t => t.from === interaction.user.id || t.to === interaction.user.id)
        .slice(-10)
        .reverse();
      const embed = new EmbedBuilder()
        .setColor(0x1a2744)
        .setTitle('交易紀錄')
        .setDescription(`近 ${txs.length} 筆交易`)
        .setFooter({ text: '虛境民主共和國 中央銀行' });
      if (!txs.length) {
        embed.addFields({ name: '尚無交易', value: '使用 `/vdr-economy transfer` 進行轉帳', inline: false });
      }
      for (const tx of txs) {
        const dir = tx.from === interaction.user.id ? '➡️ 轉出' : '⬅️ 收入';
        const other = tx.from === interaction.user.id ? tx.to : tx.from;
        embed.addFields({
          name: `${dir} ${tx.amount} 尐尐幣`,
          value: `<@${other}> ｜ ${tx.note || '無備註'} ｜ <t:${Math.floor(new Date(tx.at).getTime() / 1000)}:R>`,
          inline: false,
        });
      }
      await interaction.reply({ embeds: [embed] });
    }
  },
};
