const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  category: "管理",
  data: new SlashCommandBuilder()
    .setName("vdr-mod")
    .setDescription("伺服器管理指令（管理員專用）")
    .addSubcommand(sub => sub.setName("kick").setDescription("踢出成員").addUserOption(o => o.setName("成員").setDescription("要踢出的成員").setRequired(true)).addStringOption(o => o.setName("原因").setDescription("原因").setRequired(false)))
    .addSubcommand(sub => sub.setName("ban").setDescription("封鎖成員").addUserOption(o => o.setName("成員").setDescription("要封鎖的成員").setRequired(true)).addStringOption(o => o.setName("原因").setDescription("原因").setRequired(false)))
    .addSubcommand(sub => sub.setName("timeout").setDescription("禁言成員").addUserOption(o => o.setName("成員").setDescription("要禁言的成員").setRequired(true)).addIntegerOption(o => o.setName("分鐘").setDescription("禁言分鐘數").setRequired(true).setMinValue(1).setMaxValue(40320)).addStringOption(o => o.setName("原因").setDescription("原因").setRequired(false)))
    .addSubcommand(sub => sub.setName("untimeout").setDescription("解除禁言").addUserOption(o => o.setName("成員").setDescription("要解除禁言的成員").setRequired(true)))
    .addSubcommand(sub => sub.setName("clear").setDescription("清除訊息").addIntegerOption(o => o.setName("數量").setDescription("要清除的數量").setRequired(true).setMinValue(1).setMaxValue(100))),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "只有管理員才能使用此指令", ephemeral: true });
    }
    const sub = interaction.options.getSubcommand();
    if (sub === "kick") {
      const target = interaction.options.getMember("成員");
      const reason = interaction.options.getString("原因") || "未提供原因";
      if (!target) return interaction.reply({ content: "找不到該成員", ephemeral: true });
      if (!target.kickable) return interaction.reply({ content: "無法踢出該成員", ephemeral: true });
      await target.kick(reason);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xdc2626).setTitle("已踢出成員").setDescription(target.user.tag).addFields({ name: "原因", value: reason }).setFooter({ text: "執行者：" + interaction.user.tag }).setTimestamp()] });
      return;
    }
    if (sub === "ban") {
      const target = interaction.options.getUser("成員");
      const reason = interaction.options.getString("原因") || "未提供原因";
      const member = interaction.guild.members.cache.get(target.id);
      if (member && !member.bannable) return interaction.reply({ content: "無法封鎖該成員", ephemeral: true });
      await interaction.guild.members.ban(target.id, { reason });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xdc2626).setTitle("已封鎖成員").setDescription(target.tag).addFields({ name: "原因", value: reason }).setFooter({ text: "執行者：" + interaction.user.tag }).setTimestamp()] });
      return;
    }
    if (sub === "timeout") {
      const target = interaction.options.getMember("成員");
      const minutes = interaction.options.getInteger("分鐘");
      const reason = interaction.options.getString("原因") || "未提供原因";
      if (!target) return interaction.reply({ content: "找不到該成員", ephemeral: true });
      if (!target.moderatable) return interaction.reply({ content: "無法禁言該成員", ephemeral: true });
      await target.timeout(minutes * 60 * 1000, reason);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle("已禁言成員").setDescription(target.user.tag + " | " + minutes + " 分鐘").addFields({ name: "原因", value: reason }).setFooter({ text: "執行者：" + interaction.user.tag }).setTimestamp()] });
      return;
    }
    if (sub === "untimeout") {
      const target = interaction.options.getMember("成員");
      if (!target) return interaction.reply({ content: "找不到該成員", ephemeral: true });
      if (!target.moderatable) return interaction.reply({ content: "無法解除禁言", ephemeral: true });
      await target.timeout(null);
      await interaction.reply({ content: "已解除 " + target.user.tag + " 的禁言" });
      return;
    }
    if (sub === "clear") {
      const amount = interaction.options.getInteger("數量");
      if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: "機器人沒有管理訊息的權限", ephemeral: true });
      }
      const msgs = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(msgs, true);
      await interaction.reply({ content: "已清除 " + msgs.size + " 則訊息", ephemeral: true });
    }
  },
};
