// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { checkSudoPerms } = require ('../../../src/helpers/general_helper');
const { getPrettyJsonText } = require('../../../src/helpers/json_helper');
const { reply } = require (`../../../src/helpers/discord_helper`);
const { readFileSync, writeFileSync } = require('node:fs');
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
				.setDescription(`[ADMINS ONLY] run a general auto-edits management command.`)
				.addStringOption((option) =>
					option.setName('command')
						.setDescription('Choose a command.')
						.setRequired(true)
						.setChoices(
							{ name: 'Pause Auto-Edits', value: "pause_auto_edits" },
							{ name: 'Unpause Auto-Edits', value: "unpause_auto_edits" },
							{ name: 'Unwatch All Messages', value: "clear" },
							{ name: 'See All Watched Messages', value: "see" },
							{ name: 'Get Command Group Info', value: "stats" })
				),
				async execute(interaction) {
					if (!await checkSudoPerms(interaction.member)) {
						await reply(interaction, { content: `[ERROR] [ADMINS/OWNERS ONLY] missing permission` }, true);
						return;
					}
					const option = await interaction.options.get('command');
					try {
						if (option == null) throw new Error("No option selected in sudo command");
						let json = null;
						let num_entries_removed = null;
						let links = null;
						let stats = null;
						switch (option.value) {
							case "unpause_auto_edits":
							case "pause_auto_edits":
								json = JSON.parse(readFileSync(`./guilds/${interaction.guild.id}/jsons/automated_message_editing.json`));
								if (option.value == "pause_auto_edits") {
									if (json.paused === true) {
										await reply(interaction, { content: `Auto edits are already paused` });
										break;
									} else {
										json.paused = true;
										await reply(interaction, { content: `Auto edits are now paused` });
									}
								} else if (option.value == "unpause_auto_edits") {
									if (json.paused == false) {
										await reply(interaction, { content: `Auto edits are already unpaused` });
										break;
									} else {
										json.paused = false;
										await reply(interaction, { content: `Auto edits are now unpaused` });
									}
								}
								writeFileSync(`./guilds/${interaction.guild.id}/jsons/automated_message_editing.json`, JSON.stringify(json, null, 2));
								break;
							case "clear":
								num_entries_removed = await this.databases.get(this.database_name).clearDatabase();
								await reply(interaction, { content: `Stopped watching ${num_entries_removed} ${(num_entries_removed == 1) ? "message" : "messages"}` });
								break;
							case "see":
								links = await this.databases.get(this.database_name).getMessageLinks();
								await reply(interaction, { content: links });
								break;
							case "stats":
								stats = await this.databases.get(this.database_name).getStats();
								await reply(interaction, { content: getPrettyJsonText(stats, interaction) });
								break;
							default:
								throw new Error(`Wonky option given: ${option}`);
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