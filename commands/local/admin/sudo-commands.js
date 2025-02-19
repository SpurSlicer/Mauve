// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { reply, deferReply, editReply } = require ('../../../src/helpers/discord_helper');
const { checkSudoPerms, getSelectiveCommandNames, formatName } = require ('../../../src/helpers/general_helper');
const { writeFileSync, readFileSync } = require('node:fs');
const { generateAccessor, makeCommand } = require("../../../src/classes/command");
const { searchAndOverwriteJsonValue } = require('../../../src/helpers/json_helper');
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
				.setDescription(`[ADMINS ONLY] view or modify log files.`)
				.addStringOption((option) =>
					option.setName('command')
						.setDescription('Choose a command.')
						.setRequired(true)
						.setChoices(
							{ name: 'Enable Command Group', value: 'add_command' },
							{ name: 'Disable Command Group', value: 'remove_command' })
				)
				.addStringOption((option) => 
					option.setName('group')
						.setDescription('Choose the command group you\'d like to add or remove.')
						.setRequired(true)
						.setChoices(
							getSelectiveCommandNames(true))
				),
				async execute(interaction) {
					if (!await checkSudoPerms(interaction)) {
						await reply(interaction, { content: `[ERROR] [ADMINS ONLY] missing permission` }, true);
						return;
					}
					let deferred = false;
					try {
						let option = (await interaction.options.get('command')).value;
						const group = (await interaction.options.get('group')).value;
						let settings = JSON.parse(readFileSync(`./guilds/${interaction.guild.id}/jsons/settings.json`, 'utf8'));
						let log_marker_event = ``;
						switch (option) {
							case "add_command": 
							case "remove_command":
								if (option.includes("add")) option = true;
								else if (option.includes("remove")) option = false;
								else throw new Error(`Unknown option: ${option}`);
								if (option && settings.selective_commands[group] === true) {
									await reply(interaction, { content: `The command group \`${formatName(group)}\` has already been added.` });
									break;
								} else if (!option && settings.selective_commands[group] === false) {
									await reply(interaction, { content: `The command group \`${formatName(group)}\` is not currently added.` });
									break;
								}
								deferred = true;
								await deferReply(interaction, { content: "Updating guilds..." });
								settings = searchAndOverwriteJsonValue(group, option, settings);
								log_marker_event = `SETTINGS UPDATE`;
								await new Promise((resolve) => {
									const appointed_ack = interaction.client.Bot.enqueueAck();
									this.logger.debug(`Expecting ack ${appointed_ack}`, [{ text: log_marker_event, colors: "event" }]);
									interaction.client.Bot.emitter.on(`settings_update_${interaction.guild.id}`, (ack) => {
										this.logger.log(`Ack ${ack} received. Expecting ${appointed_ack}`,  [{ text: log_marker_event, colors: "event" }]);
										if (appointed_ack == ack)
											resolve();
									})
									writeFileSync(`./guilds/${interaction.guild.id}/jsons/settings.json`, JSON.stringify(settings, null, 2));
								});
								interaction.client.Bot.emitter.removeAllListeners(`settings_update_${interaction.guild.id}`);
								this.logger.debug(`Stopped listening to event`,  [{ text: log_marker_event, colors: "event" }]);
								await editReply(interaction, { content: `The command group \`${formatName(group)}\` has been ${(option) ? "added" : "removed"}.` });
								break;
							default:
								throw new Error(`Wonky opetion given: ${option}`);
						}
					} catch (e) { // Jumps here if something weird happens
						if (deferred)	
							await editReply(interaction, { content: `[ERROR] ${e.message}` });
						else 
							await reply(interaction, { content: `[ERROR] ${e.message}` });
						this.logger.error(e);
					}
				},
			}];
		command_class.setCommands(data);
		return command_class;
	}, __filename)
}