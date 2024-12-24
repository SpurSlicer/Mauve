// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder } = require('discord.js');
const { createOrUpdateDatabase } = require ('../libs/database_helper');
const { minitify } = require('../libs/command_gen_helper');
const { roles } = require ('../jsons/role_info.json');

// -----------------------------------------------------
// ----------------IMPLEMENTED INTERFACE----------------
// @description [see below]
// 1* Create commands for return (ALWAYS array)
// 2. Iterate through the role information in ../jsons/role_info.json
// 3* For each role, add in the slash command builder data necessary for the role
//    If there are qualifiers, add them all
// 4* Add in the execute function for the role. 
//	  You have access to the database and the client or interaction
// @return commands per builder
// -----------------------------------------------------
// -----------------------------------------------------
function build() {
	const commands = [];
	for (const role of roles) {
		const slash_command_build = (role.qualifiers == null)
		? new SlashCommandBuilder() // no qualifiers
			.setName(role.role_name)
			.setDescription(`Gives you the ${role.role_name} role for ${minitify(role.role_duration)} ${(minitify(role.role_duration) == 1) ? 'minute' : 'minutes'}`)
			.addStringOption((option) =>
				option.setName('duration')
					.setDescription('Add or update a role! Select the permanent or remove choice to further modify')
					.setRequired(false)
					.addChoices({ name: 'Permanent', value: 'perma' },
								{ name: 'Remove', value: 'remove' })
				)
		: (() => { // qualifiers
			const choices = [];
			for (const qualifier of role.qualifiers) {
				choices.push({ name: qualifier.qualifier_name,
							   value: String(qualifier.qualifier_duration)})
			}
			return new SlashCommandBuilder()
				.setName(role.role_name)
				.setDescription(`Gives you the ${role.role_name} role for ${minitify(role.role_duration)} ${(minitify(role.role_duration) == 1) ? 'minute' : 'minutes'}`)
				.addStringOption((option) =>
					option.setName('duration')
						.setDescription('Add or update a role! Select the permanent or remove choice to further modify')
						.setRequired(false)
						.addChoices({ name: 'Permanent', value: 'perma' },
									{ name: 'Remove', value: 'remove' })
					)
				.addStringOption((option) => 
					option.setName('qualifier')
						.setDescription('Add a a qualifier to further modify the time of the role')
						.setRequired(false)
						.addChoices(choices)
				);
			})();
		commands.push({
			data: slash_command_build,
				async execute(database_info, interaction, role_obj=role) {
					const option = { duration: await interaction.options.get('duration'), qualifier: await interaction.options.get('qualifier')};
					try {
						if (interaction.guild.roles.cache.get(role_obj.role_id) != null) { // Does the role exist in this server?
							createOrUpdateDatabase(database_info, role_obj, interaction, (option == null) ? null : option);
						} else { // Does the role not exist in this server?
							await interaction.reply({ content: `[ERROR] Role ${role_obj.role_name} (${role_obj.role_id}) doesn't exist in the server anymore :(\n- DM a mod about this please`, ephemeral: true });
						}
					} catch (error) { // Jumps here if something weird happens
						await interaction.reply({ content: `[ERROR] ${error.message}\n- DM this to a mod please`, ephemeral: true });
					}
				}}
			);
	}
	return commands;
}

// -----------------------EXPORTS-----------------------
module.exports = { build }