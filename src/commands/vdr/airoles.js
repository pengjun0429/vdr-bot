const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const vdr = require('../../services/vdr-data');
const aiRole = require('../../services/ai-role');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('vdr-airoles')
    .setDescription('AI 身分組識別與建議（管理員專用）')
    .addSubcommand(sub => sub.setName('analyze').setDescription('分析成員適合的身分組').addUserOption(opt => opt.setName('成員').setDescription('要分析的成員').setRequired(true)))
    .addSubcommand(sub => sub.setName('suggest').setDescription('建議可新增的關鍵字'))
    .addSubcommand(sub => sub.setName('status').setDescription('查看 AI 身分組設定狀態')),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '只有管理員才能使用此指令', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'analyze') {
      const target = interaction.options.getMember('成員');
      if (!target) return interaction.reply({ content: '找不到該成員', ephemeral: true });
      await interaction.deferReply();

      const messages = [];
      for (const ch of interaction.guild.channels.cache.values()) {
        if (ch.type !== 0) continue;
        try {
          const msgs = await ch.messages.fetch({ limit: 20 });
          const userMsgs = msgs.filter(m => m.author.id === target.id);
          userMsgs.forEach(m => messages.push({ content: m.content }));
        } catch {}
      }

      const suggestions = await aiRole.suggestRoles(target, messages.slice(0, 30));
      const embed = new EmbedBuilder()
        .setColor(0x1a2744)
        .setTitle('AI 身分組分析結果')
        .setDescription(`成員：${target.user.tag}`)
        .addFields(
          { name: '分析訊息數', value: messages.length + ' 則', inline: true },
          { name: '建議身分組', value: suggestions.length ? suggestions.join('\n') : '無建議', inline: false },
        )
        .setFooter({ text: '可在管理後臺設定 AI 關鍵字' });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'suggest') {
      const embed = new EmbedBuilder()
        .setColor(0x1a2744)
        .setTitle('AI 身分組設定建議')
        .setDescription('請到管理後臺 → 自動身分組 → AI 關鍵字設定\n\n為每個身分組設定關鍵字後，AI 會根據成員發言自動建議適合的身分組。')
        .addFields({
          name: '建議格式',
          value: '身分組名稱：關鍵字1, 關鍵字2, 關鍵字3\n\n範例：\n外交官：大使, 邦交, 外交, 國際\n技術部：程式, 開發, 機器人, 技術'
        });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'status') {
      const db = vdr.get();
      const config = db.aiRole || { enabled: false, keywords: {} };
      const hasApi = !!process.env.AI_API_KEY;
      const embed = new EmbedBuilder()
        .setColor(0x1a2744)
        .setTitle('AI 身分組設定狀態')
        .addFields(
          { name: '啟用狀態', value: config.enabled ? '✅ 已啟用' : '❌ 未啟用', inline: true },
          { name: 'AI API', value: hasApi ? '✅ 已設定' : '⚠️ 未設定（使用關鍵字比對）', inline: true },
          { name: '已設定關鍵字組數', value: Object.keys(config.keywords || {}).length + ' 組', inline: true },
        )
        .setFooter({ text: '到管理後臺設定關鍵字與啟用 AI' });
      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};
