const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const HIERARCHY_FILE = path.join(__dirname, '..', '..', '..', 'data', 'role-hierarchy.json');

function loadHierarchy() {
  try { return JSON.parse(fs.readFileSync(HIERARCHY_FILE, 'utf-8')); }
  catch { return []; }
}

function matchRole(roles, keyword) {
  return roles.find(r => r.name.includes(keyword) || keyword.includes(r.name));
}

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('vdr-autosort')
    .setDescription('依照 TXT 設定自動排序身分組（管理員專用）'),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '只有管理員才能使用此指令', ephemeral: true });
    }
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: '機器人沒有管理身分組的權限', ephemeral: true });
    }

    await interaction.deferReply();
    const hierarchy = loadHierarchy();
    if (!hierarchy.length) {
      return interaction.editReply({ content: '尚未設定身分組層級，請先準備好 role-hierarchy.json' });
    }

    const roles = interaction.guild.roles.cache;
    const botRole = interaction.guild.members.me.roles.highest;
    let moved = 0, skipped = 0, notFound = [];
    let position = roles.size;

    for (const group of hierarchy) {
      for (const keyword of group.roles) {
        const role = matchRole([...roles.values()], keyword);
        if (!role || role.name === '@everyone') { notFound.push(keyword); skipped++; continue; }
        if (role.position >= botRole.position) { skipped++; continue; }
        if (role.id === interaction.guild.id) continue;
        try {
          await role.setPosition(position--, { reason: 'VDR 自動身分組排序' });
          moved++;
        } catch { skipped++; }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x1a2744)
      .setTitle('身分組自動排序完成')
      .addFields(
        { name: '已排序', value: moved + ' 個', inline: true },
        { name: '略過', value: skipped + ' 個', inline: true },
      );
    if (notFound.length) embed.addFields({ name: '未找到', value: notFound.slice(0, 10).join(', '), inline: false });
    await interaction.editReply({ embeds: [embed] });
  },
};
