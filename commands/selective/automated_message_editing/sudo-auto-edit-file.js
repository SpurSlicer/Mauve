// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { checkSudoPerms, getAllFilenames, getFilePath } = require ('../../../src/helpers/general_helper');
const { reply, deferReply, getMessageLocation, editReply } = require (`../../../src/helpers/discord_helper`);
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
				.setDescription(`[ADMINS ONLY] set an auto message edit update for a file.`)
				.addStringOption((option) =>
					option.setName('command')
						.setDescription('Choose a command.')
						.setRequired(true)
						.setChoices(
							{ name: 'Start Auto-Edit', value: "start" },
							{ name: 'Stop Auto-Edit', value: "stop" })
				)
				.addStringOption((option) =>
					option.setName('file')
						.setDescription('Choose a file.')
						.setRequired(true)
						.setChoices(
							getAllFilenames(this.guild.id, true, true))
				)
				.addStringOption((option) => 
					option.setName('identifier')
						.setDescription('Enter an identifier for the message to be auto edited.')
						.setRequired(true)
				),
				async execute(interaction) {
					if (!await checkSudoPerms(interaction.member)) {
						await reply(interaction, { content: `[ERROR] [ADMINS/OWNERS] missing permission` }, true);
						return;
					}
					const option = await interaction.options.get('command');
					const file = await interaction.options.get('file').value;
					const identifier = await interaction.options.get('identifier').value;
					const database = this.databases.get(this.database_name);
					try {
						await deferReply(interaction, { content: "Processing..." });
						if (option == null) throw new Error("no option selected");
						let [guild_id, channel_id, message_id] = [null, null, null];
						let result = false;
						switch (option.value) {
							case "start":
							case "stop":
								[guild_id, channel_id, message_id] = await getMessageLocation(interaction, identifier);
								if (guild_id == null || channel_id == null || message_id == null) throw new Error("could not find a message at that location");
								else if (option.value == "start") {
									if (file == "-") throw new Error(`that's a divider for appearance, not a file`);
									const message_author_id = interaction.client.guilds.cache.get(guild_id).channels.cache.get(channel_id).messages.cache.get(message_id).author.id;
									if (message_author_id != interaction.client.user.id) throw new Error("auto edits can only be applied to messages sent by the bot");
									result = await database.addObservee({message_id: message_id, channel_id: channel_id, guild_id: guild_id, observee: getFilePath(file, `./guilds/${interaction.guild.id}`)});
									if (result) await editReply(interaction, { content: `https://discord.com/channels/${guild_id}/${channel_id}/${message_id} will be updated` });
									else await editReply(interaction, { content: `https://discord.com/channels/${guild_id}/${channel_id}/${message_id} is already being watched` });
								} else if (option.value == "stop") {
									result = await database.removeObservee({message_id: message_id, channel_id: channel_id, observee: getFilePath(file, `./guilds/${guild_id}`)});
									if (result) await editReply(interaction, { content: `https://discord.com/channels/${guild_id}/${channel_id}/${message_id} will no longer be updated` });
									else await editReply(interaction, { content: `https://discord.com/channels/${guild_id}/${channel_id}/${message_id} is not being watched` });
								} else {
									throw new Error("Strange thing happened in auto edit");
								}
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