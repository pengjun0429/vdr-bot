const logger = require('../utils/logger');

module.exports = {
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    const { cooldowns } = interaction.client;
    if (!cooldowns.has(command.data.name)) cooldowns.set(command.data.name, new Map());
    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        return interaction.reply({ content: `請等待 ${timeLeft} 秒後再使用此指令`, ephemeral: true });
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(`指令執行錯誤 ${interaction.commandName}:`, err.message);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '執行指令時發生錯誤', ephemeral: true });
      } else {
        await interaction.reply({ content: '執行指令時發生錯誤', ephemeral: true });
      }
    }
  },
};
