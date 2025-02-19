// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { getMessageContent, reply, deferReply, editReply } = require ('../../../src/helpers/discord_helper');
const { getJsonFileNames, isServerOwner } = require ('../../../src/helpers/general_helper');
const { modifyJson, doesJsonContainProperty, getPrettyJsonText, textToJson} = require ('../../../src/helpers/json_helper');
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
				.setDescription(`[SERVER OWNER ONLY] [DANGEROUS] choose a file to write data to.`)
				.addStringOption((option) =>
					option.setName('command')
						.setDescription('Choose a file to write to.')
						.setRequired(true)
						.setChoices(
							getJsonFileNames(guild.id, true))
				)
				.addStringOption((option) => 
					option.setName('data')
						.setDescription('Enter an identifier or the data to written.')
						.setRequired(true)
				),
				async execute(interaction) {
					if (!await isServerOwner(interaction)) {
						await reply(interaction, { content: `[ERROR] [SERVER OWNERS ONLY] missing permission` }, true);
						return;
					}
					let option = (await interaction.options.get('command')).value;
					const data = await interaction.options.get('data').value;
					try {
						if (!option.endsWith(".json")) {
							// overwriteAsset(interaction.guild.id, option, data);
							await reply(interaction, { content: `Other things can't be edited yet` });
						} else {
							await deferReply(interaction, { content: "Processing..." });
							option = option.split(".")[0];
							let json = await getMessageContent(interaction, data);
							json = textToJson(json);
							// let should_automate_edits = JSON.parse(readFileSync("./jsons/settings.json", "utf8"))?.automated_message_editing;
							// if (should_automate_edits == null || should_automate_edits == undefined) should_automate_edits = false;
							if (option == null) throw new Error("no option selected in sudo command");
							try {
								if (option == "admins" && doesJsonContainProperty("owners")) throw new Error("owners are unabled to be modified");
								const old_json = JSON.parse(readFileSync(`./guilds/${interaction.guild.id}/jsons/${option}.json`));
								const new_json = modifyJson(json, old_json);
								writeFileSync(`./guilds/${interaction.guild.id}/jsons/${option}.json`, JSON.stringify(new_json, null, 2));
								// await updateMessagesViaEdit(interaction.client, option, true, this.guild.id);
								await editReply(interaction, { content: `The ${option} json has been updated to\n${getPrettyJsonText(new_json, interaction)}` });
							} catch (e) {
								await editReply(interaction, { content: `[ERROR] ${e.message}` });
							}
						}
						// updateAllGuildInfo();
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