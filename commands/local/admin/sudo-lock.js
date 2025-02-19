// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { checkSudoPerms } = require ('../../../src/helpers/general_helper');
const { reply } = require (`../../../src/helpers/discord_helper`);
const { writeFileSync, readFileSync } = require('node:fs');
const { generateAccessor, makeCommand } = require("../../../src/classes/command");


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
				.setDescription(`[ADMINS ONLY] run a bot management command.`)
				.addStringOption((option) =>
					option.setName('command')
						.setDescription('Choose a command.')
						.setRequired(true)
						.setChoices(
							// { name: `Repair Jsons`, value: `repair` },
							// { name: `Clean Jsons`, value: `clean` },
							{ name: `Lock Commands`, value: `lock` },
							{ name: `Unlock Commands`, value: `unlock` },
							{ name: `Are Commands Locked`, value: `check` })
						),
				async execute(interaction) {
					if (!await checkSudoPerms(interaction)) {
						await reply(interaction, { content: `[ERROR] [ADMINS ONLY] missing permission` }, true);
						return;
					}
					const option = await interaction.options.get('command');
					try {
						if (option == null) throw new Error("no option selected in sudo command");
						let settings = null;
						switch (option.value) {
							case "check":
								settings = JSON.parse(readFileSync(`./guilds/${interaction.guild.id}/jsons/settings.json`, 'utf8'));
								if (settings.lock == undefined || settings.lock == false) {
									await reply(interaction, { content: `Commands are currently \`unlocked\`` });
								} else {
									await reply(interaction, { content: `Commands are currently \`locked\`` });
								}
								break;
							case "lock":
							case "unlock":
								settings = JSON.parse(readFileSync(`./guilds/${interaction.guild.id}/jsons/settings.json`));
								if (option.value == "lock") {
									if (settings.lock == true) {
										await reply(interaction, { content: `Commands already locked` });
										break;
									}
									await reply(interaction, { content: `Locking commands...` });
									settings.lock = true;	
								} else if (option.value == "unlock") {
									if (settings.lock == false) {
										await reply(interaction, { content: `Commands already unlocked` });
										break;
									}
									await reply(interaction, { content: `Unlocking commands...` });
									settings.lock = false;	
								}
								writeFileSync(`./guilds/${interaction.guild.id}/jsons/settings.json`, JSON.stringify(settings, null, 2));
								// await cleanAndUpdateAutomatedMessageEditing(interaction);
								break;
							default:
								throw new Error(`Wonky option given: ${option.value}`);
						}
					} catch (e) { // Jumps here if something weird happens
						await reply(interaction, { content: `[ERROR] ${e.message}` });
						this.logger.error(e);
					}
				}
			}];
		command_class.setCommands(data);
		return command_class;
	}, __filename)
}