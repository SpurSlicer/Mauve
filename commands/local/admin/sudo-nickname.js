// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { checkSudoPerms } = require ('../../../src/helpers/general_helper');
const { reply, changeBotName } = require (`../../../src/helpers/discord_helper`);
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
				.setDescription(`[ADMINS ONLY] change the bot nickname or leave blank to reset to default.`)
				.addStringOption((option) =>
					option.setName('nickname')
						.setDescription('Enter in a new nickname or leave blank to reset.')
						.setRequired(false)),
				async execute(interaction) {
					if (!await checkSudoPerms(interaction)) {
						await reply(interaction, { content: `[ERROR] [ADMINS ONLY] missing permission` }, true);
						return;
					}
					const name = await interaction.options.get('nickname')?.value;
					try {
						changeBotName(interaction, name);
						if (name == null || name == undefined || name == '') {
							await reply(interaction, { content: `Reset nickname back to \`${interaction.client.user.username}\`` });
						} else {
							await reply(interaction, { content: `Bot nickname changed to \`${name}\`` });
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