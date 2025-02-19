// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { reply } = require (`../../../src/helpers/discord_helper`);
const { makeCommand, generateAccessor } = require("../../../src/classes/command");

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
				.setDescription(`Manage user preferences.`)
				.addStringOption((option) =>
					option.setName('command')
						.setDescription('Choose a command.')
						.setRequired(true)
						.setChoices(
							{ name: 'Make Bot Responses Invisible', value: "ephemeral" },
							{ name: 'Make Bot Responses Visible', value: "not_ephemeral" },
							{ name: 'View Preferences', value: "view" })
				),
				async execute(interaction) {
					const option = await interaction.options.get('command');
					const database = this.databases.get(this.database_name);
					const setting_name = `are_messages_visible`;
					try {
						let setting = null;
						let setting_value = null;
						if (option == null) throw new Error("no option selected in sudo command");
						switch (option.value) {
							case "ephemeral":
							case "not_ephemeral":
								setting_value = (option.value == 'ephemeral') ? false : true;
								setting = await database.getSetting(interaction, setting_name);
								if ((setting_value != setting) || (setting == undefined)) {
									await database.updateSetting(interaction, setting_name, setting_value);
									await reply(interaction, { content: `Bot responses will now be \`${(setting_value) ? 'visible' : 'invisible'}\`:\n${await database.getSettingsText(interaction)}` });
								} else {
									await reply(interaction, { content: `Bot resposnes are already \`${(option.value == 'ephemeral') ? 'invisible' : 'visible'}\`:\n${await database.getSettingsText(interaction)}` });
								}
								break;
							case "view":	
								await reply(interaction, { content: (await database.getSettingsText(interaction)) });
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