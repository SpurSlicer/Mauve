// -----------------------IMPORTS-----------------------
const { SlashCommandBuilder } = require('discord.js');
const { checkSudoPerms, isOwner } = require ('../libs/admin_helper');
const { clearDatabase, printDatabaseToConsole, rescanUserbase, cleanDatabase } = require("../libs/database_helper");
const { spawn } = require('node:child_process');

// -----------------------------------------------------
// ----------------IMPLEMENTED INTERFACE----------------
// @description [see below]
// 1* Create commands for return (ALWAYS array)
// 2* For each role, add in the slash command builder data necessary for the role
// 3* Add in the execute function for the role. 
//	  You have access to the database and the client or interaction
// @return commands per builder
// -----------------------------------------------------
// -----------------------------------------------------
function build() {
	const commands = [];
	commands.push({
		data: new SlashCommandBuilder()
			.setName('sudo')
			.setDescription(`Runs an admin command for database management.`)
			.addStringOption((option) =>
				option.setName('command')
					.setDescription('Run a admin command')
					.setRequired(true)
					.setChoices(
						{ name: 'Print Database', value: "print" },
						{ name: 'Empty Database', value: 'empty' },
						{ name: 'Rescan Userbase', value: 'rescan' },
						{ name: "Clean Database", value: "clean" },
						{ name: `Shutdown Bot`, value: `shutdown` }
					)),
			async execute(database_info, interaction, role_obj=null) {
				if (!checkSudoPerms(interaction.member.id)) {
					await interaction.reply({ content: `[ERROR] missing permission`});
					return;
				}
				const option = await interaction.options.get('command');
				try {
					if (option == null) throw new Error("no option selected in sudo command");
					switch (option.value) {
						case "print":
							await printDatabaseToConsole(database_info, interaction);
							break;
						case "empty":
							if (!isOwner(interaction.member.id)) {
								await interaction.reply({ content: `[ERROR] missing permissions`, ephemeral: true });
								return;
							}
							await rescanUserbase(database_info, interaction.client);
							await cleanDatabase(database_info, interaction.client);
							await clearDatabase(database_info, interaction.client);
							await interaction.reply({ content: `Emptying database...`, ephemeral: true });
							break;
						case "rescan":
							const num_users_added_to_database = await rescanUserbase(database_info, interaction.client);
							await interaction.reply({ content: `Database updated: ${num_users_added_to_database} ${(num_users_added_to_database == 1) ? ('entry') : ('entries')} added`, ephemeral: true });
							break;
						case "clean":
							const num_entries_deleted = await cleanDatabase(database_info, interaction.client);
							await interaction.reply({ content: `Database cleaned: ${num_entries_deleted} ${(num_entries_deleted == 1) ? ('entry') : ('entries')} removed`, ephemeral: true });
							break;
						case "shutdown":
							if (!isOwner(interaction.member.id)) {
								await interaction.reply({ content: `[ERROR] missing permissions`, ephemeral: true });
								return;
							}
							await interaction.reply({ content: `Shutting down...`, ephemeral: true });
							interaction.client.destroy();
							process.exit(0);
						default:
							throw new Error(`Wonky option given: ${option}`);
					}
				} catch (error) { // Jumps here if something weird happens
					await interaction.followUp({ content: `[ERROR] ${error.message}`, ephemeral: true });
				}
			}}
		);
	return commands;
}

// -----------------------EXPORTS-----------------------
module.exports = { build }