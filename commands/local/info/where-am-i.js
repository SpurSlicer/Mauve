// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { reply, getGuildInfoJson } = require (`../../../src/helpers/discord_helper`);
const { generateAccessor} = require("../../../src/classes/command");
const { getPrettyJsonText } = require('../../../src/helpers/json_helper');
const { makeCommand } = require(`../../../src/classes/command`);


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
				.setDescription(`See general discord information about the server you're in.`),
				async execute(interaction) {
					try {
						await reply(interaction, { content: getPrettyJsonText(getGuildInfoJson(interaction), interaction) });
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