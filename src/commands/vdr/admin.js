const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const vdr = require('../../services/vdr-data');
const pkg = require('../../../package.json');

module.exports = {
  category: '政府',
  data: new SlashCommandBuilder()
    .setName('vdr-admin')
    .setDescription('國家管理指令（管理員專用）')
    .addSubcommandGroup(group => group
      .setName('citizen').setDescription('公民管理')
      .addSubcommand(sub => sub.setName('list').setDescription('查看公民列表'))
      .addSubcommand(sub => sub
        .setName('remove').setDescription('移除公民')
        .addUserOption(opt => opt.setName('成員').setDescription('要移除的成員').setRequired(true))))
    .addSubcommandGroup(group => group
      .setName('wallet').setDescription('錢包管理')
      .addSubcommand(sub => sub
        .setName('set').setDescription('設定公民錢包金額')
        .addUserOption(opt => opt.setName('成員').setDescription('目標成員').setRequired(true))
        .addIntegerOption(opt => opt.setName('金額').setDescription('新餘額').setRequired(true).setMinValue(0)))
      .addSubcommand(sub => sub
        .setName('give').setDescription('發放尐尐幣給公民')
        .addUserOption(opt => opt.setName('成員').setDescription('目標成員').setRequired(true))
        .addIntegerOption(opt => opt.setName('金額').setDescription('發放金額').setRequired(true).setMinValue(1))))
    .addSubcommand(sub => sub
      .setName('announce').setDescription('發送國家公告')
      .addStringOption(opt => opt.setName('標題').setDescription('公告標題').setRequired(true))
      .addStringOption(opt => opt.setName('內容').setDescription('公告內容').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('export').setDescription('輸出國家資料')),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '只有管理員才能使用此指令', ephemeral: true });
    }

    const db = vdr.get();

    if (interaction.options.getSubcommand() === 'list') {
      const citizens = Object.entries(db.citizens);
      if (!citizens.length) {
        return interaction.reply({ content: '目前沒有註冊公民', ephemeral: true });
      }
      const pages = [];
      let page = '';
      let count = 0;
      for (const [id, c] of citizens) {
        const line = `${c.name}｜${c.region}｜${c.wallet} 幣\n`;
        if ((page + line).length > 1900) { pages.push(page); page = line; }
        else { page += line; }
        count++;
      }
      if (page) pages.push(page);
      const embed = new EmbedBuilder()
        .setColor(0x1a2744)
        .setTitle(`公民列表（共 ${count} 人）`)
        .setDescription(pages[0] || '無')
        .setFooter({ text: `v${pkg.version} ｜ 第 1/${pages.length} 頁` });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.options.getSubcommand() === 'remove') {
      const target = interaction.options.getUser('成員');
      if (!db.citizens[target.id]) {
        return interaction.reply({ content: '該成員不是公民', ephemeral: true });
      }
      delete db.citizens[target.id];
      vdr.save();
      return interaction.reply({ content: `已移除公民 ${target.tag}` });
    }

    if (interaction.options.getSubcommand() === 'set') {
      const target = interaction.options.getUser('成員');
      const amount = interaction.options.getInteger('金額');
      if (!db.citizens[target.id]) {
        return interaction.reply({ content: '該成員不是公民', ephemeral: true });
      }
      db.citizens[target.id].wallet = amount;
      vdr.save();
      return interaction.reply({ content: `已設定 ${target.tag} 的錢包為 ${amount} 尐尐幣` });
    }

    if (interaction.options.getSubcommand() === 'give') {
      const target = interaction.options.getUser('成員');
      const amount = interaction.options.getInteger('金額');
      if (!db.citizens[target.id]) {
        return interaction.reply({ content: '該成員不是公民', ephemeral: true });
      }
      db.citizens[target.id].wallet += amount;
      vdr.save();
      return interaction.reply({ content: `已發放 ${amount} 尐尐幣給 ${target.tag}，目前餘額 ${db.citizens[target.id].wallet} 幣` });
    }

    if (interaction.options.getSubcommand() === 'announce') {
      const title = interaction.options.getString('標題');
      const content = interaction.options.getString('內容');
      const num = vdr.nextAnnounceNumber();
      vdr.addAnnouncement(num, title, content, interaction.user.tag);
      const msg = `**【𝐕𝐃𝐑國家發展公告】**\n\n條約編號：虛外字第 ${num} 號\n＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝\n\n${content}\n\n＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝\n發布者：${interaction.user.tag}\n發布單位：技術發展部\n公告單位：虛境民主共和國總統府`;
      await interaction.reply({ content: '公告已發布', ephemeral: true });
      const channel = interaction.guild.systemChannel;
      if (channel) channel.send(msg);
      return;
    }

    if (interaction.options.getSubcommand() === 'export') {
      const embed = new EmbedBuilder()
        .setColor(0x1a2744)
        .setTitle('國家資料匯出')
        .addFields(
          { name: '公民人數', value: `${Object.keys(db.citizens).length} 人`, inline: true },
          { name: '總統令', value: `${db.decrees.length} 筆`, inline: true },
          { name: '國家公告', value: `${db.announcements.length} 筆`, inline: true },
          { name: '交易紀錄', value: `${db.economy.transactions.length} 筆`, inline: true },
          { name: '國庫總額', value: `${db.economy.treasury} 尐尐幣`, inline: true },
          { name: '總流通量', value: `${db.economy.totalSupply} 尐尐幣`, inline: true },
          { name: '版本', value: `v${pkg.version}`, inline: true },
        )
        .setFooter({ text: '虛境民主共和國 技術發展部' });
      await interaction.reply({ embeds: [embed] });
    }
  },
};
