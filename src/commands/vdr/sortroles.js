const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const HIERARCHY_FILE = path.join(__dirname, '..', '..', '..', 'data', 'role-order.json');

function loadHierarchy() {
  try {
    if (fs.existsSync(HIERARCHY_FILE)) {
      return JSON.parse(fs.readFileSync(HIERARCHY_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveHierarchy(data) {
  fs.writeFileSync(HIERARCHY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('vdr-sortroles')
    .setDescription('自動排序身分組（管理員專用）')
    .addSubcommand(sub => sub.setName('run').setDescription('依設定重新排序身分組'))
    .addSubcommand(sub => sub.setName('preview').setDescription('預覽目前排序結果'))
    .addSubcommand(sub => sub.setName('reset').setDescription('重置身分組排序設定')),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '只有管理員才能使用此指令', ephemeral: true });
    }
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: '機器人沒有管理身分組的權限', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'reset') {
      saveHierarchy([]);
      return interaction.reply({ content: '已重置排序設定', ephemeral: true });
    }

    if (sub === 'preview') {
      const order = loadHierarchy();
      if (!order.length) {
        return interaction.reply({ content: '尚未設定身分組排序順序。請先在管理後臺設定。', ephemeral: true });
      }
      const roles = interaction.guild.roles.cache;
      const embed = new EmbedBuilder()
        .setColor(0x1a2744)
        .setTitle('身分組排序預覽')
        .setDescription(`共 ${order.length} 個身分組，將依下列順序排列（由上到下：最高 → 最低）`);
      let list = '';
      for (const item of order) {
        const role = roles.get(item.id);
        if (role) list += `${role.toString()} ${item.group ? '(' + item.group + ')' : ''}\n`;
        else list += `❌ ${item.name}（已刪除）\n`;
      }
      if (list.length > 1000) list = list.slice(0, 1000) + `\n...等 ${order.length} 個`;
      embed.addFields({ name: '排序順序', value: list || '無' });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'run') {
      await interaction.deferReply();
      const order = loadHierarchy();
      if (!order.length) {
        return interaction.editReply({ content: '尚未設定身分組排序順序。請先在管理後臺設定。' });
      }

      const botRole = interaction.guild.members.me.roles.highest;
      const roles = interaction.guild.roles.cache;
      let moved = 0;
      let skipped = 0;
      let errors = [];

      // Sort from bottom to top (lowest position first)
      for (let i = order.length - 1; i >= 0; i--) {
        const item = order[i];
        const role = roles.get(item.id);
        if (!role) { skipped++; continue; }
        if (role.id === interaction.guild.id) continue;
        if (role.position >= botRole.position) { skipped++; continue; }

        try {
          await role.setPosition(i + 1, { reason: 'VDR 自動身分組排序' });
          moved++;
        } catch (err) {
          errors.push(role.name);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x1a2744)
        .setTitle('身分組排序完成')
        .addFields(
          { name: '已排序', value: moved + ' 個', inline: true },
          { name: '略過', value: skipped + ' 個（權限不足或不存在）', inline: true },
        );
      if (errors.length) embed.addFields({ name: '失敗', value: errors.join(', '), inline: false });
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
