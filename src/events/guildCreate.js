const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const HIERARCHY_FILE = path.join(__dirname, '..', '..', 'data', 'role-hierarchy.json');

function loadHierarchy() {
  try { return JSON.parse(fs.readFileSync(HIERARCHY_FILE, 'utf-8')); }
  catch { return []; }
}

function matchRole(roles, keyword) {
  return roles.find(r => r.name.includes(keyword) || keyword.includes(r.name));
}

module.exports = {
  async execute(guild) {
    logger.info('已加入新伺服器：' + guild.name);

    try {
      const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0x1a2744)
          .setTitle('感謝邀請 VDR 政府服務機器人！')
          .setDescription('請使用 `/vdr-autosort` 自動依照設定排序身分組。')
          .addFields(
            { name: '常用指令', value: '`/vdr` 國家資訊\n`/vdr-register` 註冊公民\n`/vdr-autosort` 排序身分組' },
          )
          .setFooter({ text: '虛境民主共和國 技術發展部' });
        channel.send({ embeds: [embed] });
      }
    } catch (err) { logger.warn('加入伺服器歡迎訊息失敗:', err.message); }

    if (!guild.members.me.permissions.has(0x10000000n)) return;

    const hierarchy = loadHierarchy();
    if (!hierarchy.length) return;

    try {
      const roles = guild.roles.cache;
      const botRole = guild.members.me.roles.highest;
      let position = roles.size;

      for (const group of hierarchy) {
        for (const keyword of group.roles) {
          const role = matchRole([...roles.values()], keyword);
          if (!role || role.name === '@everyone') continue;
          if (role.position >= botRole.position) continue;
          if (role.id === guild.id) continue;
          try { await role.setPosition(position--, { reason: 'VDR 自動排序' }); }
          catch {}
        }
      }
      logger.info('已自動排序 ' + guild.name + ' 的身分組');
    } catch (err) { logger.warn('自動排序失敗:', err.message); }
  },
};
