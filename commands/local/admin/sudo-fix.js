// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { checkSudoPerms } = require ('../../../src/helpers/general_helper');
const { reply, editReply, deferReply } = require (`../../../src/helpers/discord_helper`);
const { generateAccessor, makeCommand } = require("../../../src/classes/command");
const { cleanJsons } = require('../../../src/helpers/json_helper');

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
				.setDescription(`[ADMINS ONLY] fix settings in case something broke.`),
				async execute(interaction) {
					if (!await checkSudoPerms(interaction)) {
						await reply(interaction, { content: `[ERROR] [ADMINS ONLY] missing permission` }, true);
						return;
					}
					try {							
						await deferReply(interaction, { content: "Processing..." });
						const num_properties_removed = await cleanJsons(interaction);
						
						await interaction.guild.Guild.verifyOwner();
						if (num_properties_removed < 0) await editReply(interaction, { content: `JSONs cleaned with ${Math.abs(num_properties_removed)} missing properties added back` });
						else if (num_properties_removed == 0) await editReply(interaction, { content: `JSONs are already clean. No changes made` });
						else await editReply(interaction, { content: `JSONs cleaned with ${num_properties_removed} unused or no-longer-relevant properties removed` });
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