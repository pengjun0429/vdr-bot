const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const pkg = require('../../../package.json');

const CONST_FILE = path.join(__dirname, '..', '..', '..', 'data', 'constitution.json');

function load() {
  try { return JSON.parse(fs.readFileSync(CONST_FILE, 'utf-8')); }
  catch { return null; }
}

module.exports = {
  category: '國家',
  data: new SlashCommandBuilder()
    .setName('vdr-constitution')
    .setDescription('查看虛境民主共和國憲法與法規')
    .addStringOption(opt => opt.setName('法規').setDescription('選擇要查看的法規').setRequired(false)
      .addChoices(
        { name: '憲法全文', value: 'all' },
        { name: '憲法 第一章 總則', value: '憲法-0' },
        { name: '憲法 第二章 國民', value: '憲法-1' },
        { name: '憲法 第三章 政府', value: '憲法-2' },
        { name: '外交官總則', value: '外交官總則' },
        { name: '邦交國入境與居留管理法', value: '邦交國入境與居留管理法' },
        { name: '加盟國及附屬國條約', value: '加盟國及附屬國條約' },
        { name: '主權永久獨立與防衛宣言', value: '主權永久獨立與防衛宣言' },
        { name: '圖文自由與內容界線法', value: '圖文自由與內容界線法' },
        { name: '歡迎創黨', value: '歡迎創黨' },
        { name: '色圖自治條例', value: '色圖自治條例' },
        { name: '音樂自由政策', value: '音樂自由政策' },
      )),
  async execute(interaction) {
    const data = load();
    if (!data) return interaction.reply({ content: '憲法資料讀取失敗', ephemeral: true });

    const choice = interaction.options.getString('法規') || 'all';

    const embed = new EmbedBuilder()
      .setColor(0x1a2744)
      .setFooter({ text: `v${pkg.version} ｜ 虛境民主共和國 技術發展部` })
      .setTimestamp();

    if (choice === 'all') {
      embed.setTitle(data.title);
      let desc = '';
      for (const doc of data.documents) {
        desc += `**${doc.title}**（${doc.type}）\n`;
        if (doc.content) desc += doc.content.slice(0, 100) + '...\n';
        if (doc.articles) desc += `共 ${doc.articles.length} 條\n`;
        if (doc.chapters) desc += `共 ${doc.chapters.length} 章\n`;
        desc += '\n';
      }
      embed.setDescription(desc || '無內容');
      return interaction.reply({ embeds: [embed] });
    }

    const doc = data.documents.find(d => d.title.includes(choice.replace(/-\d+$/, '')) || d.title === choice);
    if (!doc) return interaction.reply({ content: '找不到該法規', ephemeral: true });

    embed.setTitle(doc.title + '（' + doc.type + '）');

    if (doc.content) {
      embed.setDescription(doc.content);
    } else if (doc.articles) {
      let text = '';
      if (doc.preamble) text = '> ' + doc.preamble + '\n\n';
      for (const a of doc.articles) {
        text += `**${a.article}** ${a.content}\n\n`;
      }
      embed.setDescription(text);
    } else if (doc.chapters) {
      let text = '';
      if (doc.preamble) text = '> ' + doc.preamble + '\n\n';
      const idx = parseInt(choice.split('-')[1]) || -1;
      if (idx >= 0 && doc.chapters[idx]) {
        const ch = doc.chapters[idx];
        text += `**${ch.chapter}**\n`;
        for (const a of ch.articles) {
          text += `${a.article} ${a.content}\n\n`;
        }
      } else {
        for (const ch of doc.chapters) {
          text += `**${ch.chapter}**\n`;
          for (const a of ch.articles) {
            text += `${a.article} ${a.content}\n\n`;
          }
        }
      }
      embed.setDescription(text.slice(0, 4000));
    }

    await interaction.reply({ embeds: [embed] });
  },
};
