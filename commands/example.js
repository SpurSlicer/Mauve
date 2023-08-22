/* 
Note: If the bot crashes or restarts for any reason, all current timeouts will be cancelled!
	- The try catch blocks aim to minimize crashes, but they still happen every now and then.
Note: I made the error messages not ephemeral (meaning everyone can see them) to make it easier to find the problem. To change this, just set ephemeral to true.
*/

const { SlashCommandBuilder } = require('discord.js');

const roleID = "enter role id here"; // This has to be a string and should only consist of numbers
const time = 1000*60*30; // The time by defualt is in milliseconds and is entered in as 30 minutes right now. Change it to whatever you'd like

module.exports = {
	data: new SlashCommandBuilder()
		.setName(`example`)
		.setDescription(`Gives the <insert role name> for <insert time>.`),
	async execute(interaction) {
		try {
			role = interaction.guild.roles.cache.get(roleID); // This gets the role object from the server. If the role is not found, null is returned.
			if (role != null) { // Does the role exist in this server?
				if (interaction.member.roles.cache.get(roleID) != null) { // Does the member already have this role?
					await interaction.member.roles.remove(roleID);
					await interaction.reply({content: `The ${role} role is already present and has been removed`, ephemeral: true});
				} else { // Does the member need the role?
					await interaction.member.roles.add(roleID);
					await interaction.reply({content: `The ${role} role has been added for ${time / 60000} minutes!`, ephemeral: true});
						// Feel free to change the denominator in the little time section in the string to whatever unit of time you want! Remember that it is originally in milliseconds.
					setTimeout(() => { //This sets the timeout for "time" amount of milliseconds. The code passed into setTimeout executes after "time" miliseconds pass
						if (interaction.member.roles.cache.get(roleID) != null) { // Does the member still have the role?
							interaction.followUp({content: `Time's up! The ${role} role has been removed.`, ephemeral: true});
							interaction.member.roles.remove(roleID);
						}
					}, time);
				}
			} else { // Does the role not exist in this server?
				await interaction.reply({content: `hmm I couldn't find that role listed for this server`, ephemeral: false});
			}
		} catch(error) { // Jumps here if something weird happens
			await interaction.reply({content: `Something went wrong: ${error.message}`, ephemeral: false});
		}
	},
};