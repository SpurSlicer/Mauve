// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder } = require('discord.js');
const { isDev, shutdownBot, restartBot, fixGuildData, getLogFileContents } = require ('../../../src/helpers/general_helper');
const { reply, deferReply, editReply, getGuildInfoJson } = require (`../../../src/helpers/discord_helper`);
const { generateAccessor, makeCommand } = require("../../../src/classes/command");
const { getPrettyJsonText } = require('../../../src/helpers/json_helper');
const { readFileSync, writeFileSync } = require(`node:fs`);
const process = require('node:process');

// -----------------------EXPORTS-----------------------
module.exports = {
	access: generateAccessor(async (client, guild) => {
		const command_class = await makeCommand(client, guild, __filename);
		const command_name = command_class.command_name;
		const data = [{
			logger: command_class.logger,
			databases: command_class.databases,
			command_name: command_class.command_name,
			database_name: command_class.database_name,
			data: new SlashCommandBuilder()
				.setName(command_name)
				.setDescription(`[DEVS ONLY] run a bot developer command.`)
				.addStringOption((option) =>
					option.setName('command')
						.setDescription('Choose a command.')
						.setRequired(true)
						.setChoices(
							{ name: `Update All Guilds`, value: `update_all` },
							{ name: `Shutdown Bot`, value: `shutdown` },
							{ name: `Restart Bot`, value: `restart` },
							{ name: `Globally Lock Commands`, value: `lock` },
							{ name: `Globally Unlock Commands`, value: `unlock` },
							{ name: `Restrict to Test Guild`, value: `restrict` },
							{ name: `Open to All Guilds`, value: `unrestrict` },
							{ name: `View Guilds`, value: `guilds` },														
							{ name: `View Blacklist`, value: `view_blacklist` },
							{ name: `View Main Config`, value: `view_main_config` })
						),
				async execute(interaction) {
					if (!isDev(interaction)) {
						await reply({ content: `[ERROR] [DEVS ONLY] missing permission` }, true);
						return;
					}
					const option = await interaction.options.get('command');
					const database = this.databases.get(this.database_name);
					let main_config = null;
					try {
						let main_config_json = null;
						let message = null;
						let guild_info = null;
						if (option == null) throw new Error("no option selected in sudo command");
						switch (option.value) {
							case "update_all":
								await deferReply(interaction, { content: "Updating guilds..." });
								interaction.client.Bot.status = false;
								await fixGuildData();
								await interaction.client.Bot.resetGlobalCommands();
								await interaction.client.Bot.resetAllGuildCommands();
								interaction.client.Bot.status = true;
								await editReply(interaction, { content: `Updates complete:\n${getLogFileContents(`./data/logs/updates.log`, interaction)}` });
								break;
							case "shutdown":
								await reply(interaction, { content: `Shutting down...` });
								await shutdownBot();
								process.exit(0);
								break;
							case "restart":
								await reply(interaction, { content: `Restarting...` });
								await restartBot();
								process.exit(0);
								break;
							case "lock":
							case "unlock":
								main_config = JSON.parse(readFileSync(`./main_config.json`));
								if (option.value == "lock") {
									if (main_config.global_lock == true) {
										await reply(interaction, { content: `Commands already globally locked` });
										break;
									}
									await reply(interaction, { content: `Globally locking commands...` });
									main_config.global_lock = true;	
								} else if (option.value == "unlock") {
									if (main_config.global_lock == false) {
										await reply(interaction, { content: `Commands already globally unlocked` });
										break;
									}
									await reply(interaction, { content: `Globally unlocking commands...` });
									main_config.global_lock = false;	
								}
								writeFileSync(`./main_config.json`, JSON.stringify(main_config, null, 2));
								// await cleanAndUpdateAutomatedMessageEditing(interaction);
								break;
							case "restrict":
								main_config = JSON.parse(readFileSync(`./main_config.json`, 'utf8'));
								if (main_config.limit_to_test_server) {
									await reply(interaction, { content: "Restriction is already emplaced" });	
								} else {
									main_config.limit_to_test_server = true;
									writeFileSync(`./main_config.json`, JSON.stringify(main_config, null, 2));
									await reply(interaction, { content: `Restricting...` });
									await restartBot(interaction);
								}
								break;
							case "unrestrict":
								main_config = JSON.parse(readFileSync(`./main_config.json`, 'utf8'));
								if (!main_config.limit_to_test_server) {
									await reply(interaction, { content: "Guils are already open" });	
								} else {
									main_config.limit_to_test_server = false;
									writeFileSync(`./main_config.json`, JSON.stringify(main_config, null, 2));
									await reply(interaction, { content: `Opening...` });
									await restartBot(interaction);
								}
								break;
							case "guilds":
								message = { 'guilds': [] };
								for (const value of interaction.client.Bot.guilds.values()) {
									guild_info = getGuildInfoJson(value.guild, true); // change to have guild only version
									message.guilds.push(guild_info);
								}
								await reply(interaction, { content: getPrettyJsonText(message, interaction) });
								break;
							case "view_blacklist":
								if (interaction.guild == null) await reply(interaction, { content: await database.viewBlacklist(interaction) });
								else await reply(interaction, { content: await database.viewBlacklist(interaction) });
								
								break;
							case "view_main_config":
								main_config_json = JSON.parse(readFileSync(`./main_config.json`, 'utf8'));
								main_config_json.token = undefined;
								main_config_json.clientId = undefined;
								message = getPrettyJsonText(main_config_json, interaction, false, null, true);
								await reply(interaction, { content: message });
								break;
							default:
								throw new Error(`Wonky option given: ${option.value}`);
						}
					} catch (e) { // Jumps here if something weird happens
						await reply(interaction, { content: `[ERROR] ${e.message}` });
						this.logger.error(e);
					}
				}
			}]	
		command_class.setCommands(data);
		return command_class;
	}, __filename)
}