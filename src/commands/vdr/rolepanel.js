const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const PANELS_KEY = 'rolePanels';

function getPanels() {
  try {
    const fs = require('fs');
    const path = require('path');
    const f = path.join(__dirname, '..', '..', '..', 'data', 'role-panels.json');
    if (!fs.existsSync(f)) return {};
    return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch { return {}; }
}

function savePanels(data) {
  const fs = require('fs');
  const path = require('path');
  const f = path.join(__dirname, '..', '..', '..', 'data', 'role-panels.json');
  fs.writeFileSync(f, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('vdr-rolepanel')
    .setDescription('建立自助領取身分組面板（管理員專用）')
    .addStringOption(opt => opt.setName('標題').setDescription('面板標題').setRequired(true))
    .addStringOption(opt => opt.setName('說明').setDescription('面板說明文字').setRequired(false))
    .addRoleOption(opt => opt.setName('身分組1').setDescription('可領取的身分組').setRequired(true))
    .addRoleOption(opt => opt.setName('身分組2').setDescription('可領取的身分組').setRequired(false))
    .addRoleOption(opt => opt.setName('身分組3').setDescription('可領取的身分組').setRequired(false))
    .addRoleOption(opt => opt.setName('身分組4').setDescription('可領取的身分組').setRequired(false))
    .addRoleOption(opt => opt.setName('身分組5').setDescription('可領取的身分組').setRequired(false)),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '只有管理員才能使用此指令', ephemeral: true });
    }

    const title = interaction.options.getString('標題');
    const desc = interaction.options.getString('說明') || '點擊下方按鈕領取或移除身分組';
    const roles = [];
    for (let i = 1; i <= 5; i++) {
      const role = interaction.options.getRole('身分組' + i);
      if (role) roles.push(role);
    }
    if (roles.length === 0) return interaction.reply({ content: '請至少選擇一個身分組', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0x1a2744)
      .setTitle(title)
      .setDescription(desc)
      .addFields({ name: '可領取的身分組', value: roles.map(r => r.toString()).join('\n') })
      .setFooter({ text: '虛境民主共和國 技術發展部' });

    const rows = [];
    let row = new ActionRowBuilder();
    for (const role of roles) {
      const btn = new ButtonBuilder()
        .setCustomId('rp_' + role.id)
        .setLabel(role.name.length > 40 ? role.name.slice(0, 37) + '...' : role.name)
        .setStyle(ButtonStyle.Secondary);
      if (row.components.length >= 5) { rows.push(row); row = new ActionRowBuilder(); }
      row.addComponents(btn);
    }
    if (row.components.length > 0) rows.push(row);

    const msg = await interaction.channel.send({ embeds: [embed], components: rows });

    const panels = getPanels();
    if (!panels[interaction.guild.id]) panels[interaction.guild.id] = [];
    panels[interaction.guild.id].push({
      messageId: msg.id,
      channelId: interaction.channel.id,
      title,
      roleIds: roles.map(r => r.id),
    });
    savePanels(panels);

    await interaction.reply({ content: '✅ 身分組面板已建立', ephemeral: true });
  },
};
