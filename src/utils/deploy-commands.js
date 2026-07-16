const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const config = require('../config');

function loadCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');
  const categories = fs.readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
      const command = require(path.join(categoryPath, file));
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
      } else {
        logger.warn(`指令 ${file} 缺少 data 或 execute 屬性`);
      }
    }
  }

  return commands;
}

async function deploy() {
  const commands = loadCommands();
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    const guildId = process.env.DISCORD_GUILD_ID;

    if (guildId) {
      await rest.put(Routes.applicationCommands(config.discord.clientId), {
        body: commands,
      });
      await rest.put(Routes.applicationGuildCommands(config.discord.clientId, guildId), {
        body: [],
      });
      logger.info(`已將 ${commands.length} 個指令註冊到全域，並清除測試伺服器的舊快取`);
    } else {
      await rest.put(Routes.applicationCommands(config.discord.clientId), {
        body: commands,
      });
      logger.info(`已註冊 ${commands.length} 個全域指令（可能需要 1 小時同步）`);
    }
  } catch (err) {
    logger.error('指令註冊失敗:', err);
  }
}

module.exports = { deploy, loadCommands };
