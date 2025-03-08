// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder, Client, Guild } = require('discord.js');
const { getMessageContent, reply, editReply, deferReply } = require ('../../../src/helpers/discord_helper');
const { checkSudoPerms, extractIdInfoFromMessage, isServerOwner, isOwner } = require ('../../../src/helpers/general_helper');
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
				.setDescription(`[OWNERS ONLY] appoint or demote moderation positions.`)
				.addStringOption((option) =>
					option.setName('command')
						.setDescription('Choose a command.')
						.setRequired(true)
						.setChoices(
							{ name: 'Add Admin(s)', value: 'add_admin' },
							{ name: 'Remove Admin(s)', value: 'remove_admin' },
							{ name: 'Add Owner(s)', value: 'add_owner' },
							{ name: 'Remove Owner(s)', value: 'remove_owner' }),
				)
				.addStringOption((option) => 
					option.setName('method')
						.setDescription('Choose how you want to appoint/demote.')
						.setRequired(true)
						.setChoices(
							{ name: 'By Role', value: 'role' },
							{ name: 'By User', value: 'user' }),
				)
				.addStringOption((option) => 
					option.setName('handle')
						.setDescription('Enter the user/role you\'d like to appoint/demote.')
						.setRequired(true)
				),
				async execute(interaction) {
					if (!await checkSudoPerms(interaction)) {
						await reply(interaction, { content: `[ERROR] [OWNERS ONLY] missing permission` }, true);
						return;
					}
					try {
						await deferReply(interaction, { content: "Processing..." });
						let option = (await interaction.options.get('command')).value;
						let position = (option.includes("admin")) ? "admin" : "owner";
						let result = null;
						const method = await interaction.options.get('method').value;
						const handle = await interaction.options.get('handle').value;
						const id = await extractIdInfoFromMessage(interaction, await getMessageContent(interaction, handle), method + '_id');
						if (!await isServerOwner(interaction) && option.includes("owner")) {
							throw new Error("only server owners can appoint/demote other owners");
						}
						switch (method) {
							case "role":
							case "user":
								if (option.includes("remove")) {
									if (interaction.guild.ownerId == id) throw new Error("You cannot remove the server owner.");
									if (await this.databases.get(this.database_name).removeGeneralAdminPosition(id))
										await editReply(interaction, { content: `Removed ${method} \`${(method == 'role') ? interaction.guild.roles.cache.get(id).name : interaction.guild.members.cache.get(id).name}\` from ${position}s:\n${await this.databases.get(this.database_name).getAdmins(interaction)}` });
									else {
										if (method == 'role') {
											await editReply(interaction, { content: `The ${method} \`${interaction.guild.roles.cache.get(id).name}\` does not currently give ${position} permissions.` });
										} else if (method == 'user') {
											await editReply(interaction, { content: `The ${method} \`${interaction.guild.members.cache.get(id).name}\` does not currently have ${position} permissions.` });
										} else throw new Error("Weird thing happened");
									}
								} else if (option.includes("add")) {
									if (interaction.guild.ownerId == id) throw new Error("You cannot demote the server owner.");
									switch (position) {
										case "admin":
										case "owner":
											if (position == "admin" && !await isOwner(interaction))
												await editReply(interaction, { content: `[ERROR] [OWNERS ONLY] missing permission` }, true);
											else if (position == "owner" && !await isServerOwner(interaction))
												await editReply(interaction, { content: `[ERROR] [SERVER OWNERS ONLY] missing permission` }, true);
											else {
												result = await this.databases.get(this.database_name).addGeneralAdminPosition(id, position);
												if (result == false) {
													if (method == 'role') {
														await editReply(interaction, { content: `The ${method} \`${interaction.guild.roles.cache.get(id).name}\` already grants ${position} permissions.`});
													} else if (method == 'user') {
														await editReply(interaction, { content: `The ${method} \`${interaction.guild.members.cache.get(id).name}\` already has ${position} permissions.`});
													} else throw new Error("Weird thing happened");
												} else if (result == 'new') {
													if (method == 'role') {
														await editReply(interaction, { content: `The ${method} \`${interaction.guild.roles.cache.get(id).name}\` will now grant ${position} permissions.`});
													} else if (method == 'user') {
														await editReply(interaction, { content: `The ${method} \`${interaction.guild.members.cache.get(id).name}\` will now have ${position} permissions.`});
													} else throw new Error("Weird thing happened");
												} else if (result == 'no_change') { 
													if (method == 'role') {
														await editReply(interaction, { content: `The ${method} \`${interaction.guild.roles.cache.get(id).name }\` already grants ${position} permissions.`});
													} else if (method == 'user') {
														await editReply(interaction, { content: `${method.charAt(0).toUpperCase() + method.slice(1)} \`${interaction.guild.members.cache.get(id).user.name}\` already has ${position} permissions.`});
													} else throw new Error("Weird thing happened");
												} else {
													await editReply(interaction, { content: `The ${method} \`${(method == "role") ? interaction.guild.roles.cache.get(id).name :interaction.guild.members.cache.get(id).user.name }\` has been ${result} to ${position} permissions.`});
												}
											}
											break;
									}
								} else {
									throw new Error(`Wonky method ${method} found`);
								}
								break;
							default:
								throw new Error(`Wonky opetion given: ${option}`);
						}
					} catch (e) { // Jumps here if something weird happens
						await editReply(interaction, { content: `[ERROR] ${e.message}` });
						this.logger.error(e);
					}
				},
			}];
		command_class.setCommands(data);
		return command_class;
	}, __filename)
}