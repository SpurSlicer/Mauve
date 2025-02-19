// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { checkSudoPerms, getAllFilenames, getLogFileContents } = require ('../../../src/helpers/general_helper');
const { getPrettyJsonText, getJsonifiedDatabase } = require ('../../../src/helpers/json_helper');
const { reply } = require (`../../../src/helpers/discord_helper`);
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
				.setDescription(`[ADMINS ONLY] view any file attributed to your server.`)
				.addStringOption((option) => 
					option.setName('file')
						.setDescription('Choose the file you want to view.')
						.setRequired(true)
						.setChoices(getAllFilenames(guild.id, true, true))
				),
				async execute(interaction) {
					if (!await checkSudoPerms(interaction)) {
						await reply(interaction, { content: `[ERROR] [ADMINS ONLY] missing permission` }, true);
						return;
					}
					try {
						const file = (await interaction.options.get('file')).value;
						let message = "";
						let database = null;
						if (file == "-") throw new Error(`that's a divider for appearance, not a file`);
						switch (file.split(".")[1]) {
							case "sqlite":
								database = this.databases.get(file.replace(".sqlite", ""));
								if (database == undefined) throw new Error(`no database of file name ${file} exists!`);
								message = (database.name == 'admin') ? await database.getAdmins(interaction) : await getJsonifiedDatabase(interaction, database);
								await reply(interaction, { content: message });
								break;
							case "json":
								message = getPrettyJsonText(file, interaction);
								await reply(interaction, { content: message });
								break;
							case "log":
								message = getLogFileContents(`./guilds/${interaction.guild.id}/logs/${file}`, interaction);
								await reply(interaction, { content: message });
								break;
							default:
								throw new Error(`Wonky file type found: ${file.split(".")[1]}`);
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