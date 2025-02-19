// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { reply } = require (`../../../src/helpers/discord_helper`);
const { getPrettyTime } = require("../../../src/helpers/general_helper");
const { generateAccessor, makeCommand } = require('../../../src/classes/command');


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
				.setDescription(`Ping the bot and view command arrival latency.`),
				async execute(interaction) {
					try {
						const time_elapsed = new Date().getTime() - interaction.createdAt.getTime();
						await reply(interaction, { content: `ping received in ${getPrettyTime(time_elapsed, ['seconds', 'milliseconds'])}` });
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