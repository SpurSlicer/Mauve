// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder } = require('discord.js');
const { isDev, extractIdInfoFromMessage } = require ('../../../src/helpers/general_helper');
const { reply, getMessageContent, deferReply, editReply } = require (`../../../src/helpers/discord_helper`);
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
				.setDescription(`[DEVS ONLY] blacklist servers from being able to use the bot.`)
				.addStringOption((option) =>
					option.setName('command')
						.setDescription('Choose a command.')
						.setRequired(true)
						.setChoices(
							{ name: `Blacklist`, value: `blacklist` },
							{ name: `Whitelist`, value: `whitelist` },
							{ name: `Leave Server`, value: `leave` })
				)
				.addStringOption((option) => 
					option.setName('data')
						.setDescription('Enter an identifier or the data to written.')
						.setRequired(true)
				),
				async execute(interaction) {
					if (!isDev(interaction)) {
						await reply({ content: `[ERROR] [DEVS ONLY] missing permission` }, true);
						return;
					}
					await deferReply(interaction, { content: "Updating guilds..." });
					const option = await interaction.options.get('command');
					const data = await interaction.options.get('data').value;
					const database = this.databases.get(command_class.database_name);
					const guild = { id: await extractIdInfoFromMessage(interaction, await getMessageContent(interaction, data), 'guild_id') };
					let status = null;
					guild.name = interaction.client.guilds.cache.get(guild.id)?.name;
					if (guild.name == undefined) guild.name = '???';
					try {
						if (option == null) throw new Error("no option selected in sudo command");
						switch (option.value) {
							case "blacklist":
								status = await database.blacklist(guild)
								if (status)
									await editReply(interaction, { content: `Blacklisted "${guild.name}" (${guild.id})` });
								else 
									await editReply(interaction, { content: `"${guild.name}" (${guild.id}) is already blacklisted.` });
								break;
							case "whitelist":
								status = await database.whitelist(guild)
								if (status)
									await editReply(interaction, { content: `Whitelisted "${guild.name}" (${guild.id})` });
								else 
									await editReply(interaction, { content: `"${guild.name}" (${guild.id}) is already whitelisted.` });
								break;
							case "leave":
								status = await database.leaveGuild(guild.id);
								if (status)
									await editReply(interaction, { content: `Left "${guild.name}" (${guild.id})` });
								else 
									await editReply(interaction, { content: `The bot isn't in "${guild.name}" (${guild.id}).` });
								break;	
							default:
								throw new Error(`Wonky option given: ${option.value}`);
						}
					} catch (e) { // Jumps here if something weird happens
						await editReply(interaction, { content: `[ERROR] ${e.message}`}, true);
						this.logger.error(e);
					}
				}
			}]	
		command_class.setCommands(data);
		return command_class;
	}, __filename)
}