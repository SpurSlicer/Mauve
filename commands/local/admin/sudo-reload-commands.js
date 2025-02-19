// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { checkSudoPerms } = require ('../../../src/helpers/general_helper');
const { reply, editReply, deferReply } = require (`../../../src/helpers/discord_helper`);
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
				.setDescription(`[ADMINS ONLY] manually refresh server command list.`),
				async execute(interaction) {
					if (!await checkSudoPerms(interaction)) {
						await reply(interaction, { content: `[ERROR] [ADMINS ONLY] missing permission` }, true);
						return;
					}
					try {
						await deferReply(interaction, { content: "Processing..." });
						await this.guild.Guild.resetCommands();
						await editReply(interaction, { content: `Commands have been reloaded! Please wait a few minutes for changes to appear` });
					} catch (e) { // Jumps here if something weird happens
						await editReply(interaction, { content: `[ERROR] ${e.message}` });
						this.logger.error(e);
					}
				}
			}];
		command_class.setCommands(data);
		return command_class;
	}, __filename)
}