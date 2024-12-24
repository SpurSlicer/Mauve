// -----------------------IMPORTS-----------------------
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token, guildId } = require('../jsons/config.json');
const { getDatabase, checkDatabase, rescanUserbase, clearDatabase, cleanDatabase } = require('../libs/database_helper');
const { getCommands } = require('../libs/command_gen_helper');

// ------------------------------------------------------
// @description Generate the discord client with the appropriate intents
// ------------------------------------------------------
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessages,
	],
});

// ------------------------------------------------------
// @description Get the database reference
// ------------------------------------------------------
let database_info = null;
(async () =>  {
	database_info = await getDatabase();
})();

// ------------------------------------------------------
// @description Collect/Generate all commands from ../commands/*
// ------------------------------------------------------
const commands = getCommands(true);
client.commands = new Collection();
for (const command of commands) {
	client.commands.set(command.data.name, command);
}

// ------------------------------------------------------
// @description Generate althe guild, role, and fetch caches.
// Refresh the database by checking for untracked users and deleting entries of users who left the server
// ------------------------------------------------------
client.once(Events.ClientReady, async (readyClient) => {
	await client.guilds.fetch();
	await client.guilds.cache.get(guildId).roles.fetch();
	await client.guilds.cache.get(guildId).members.fetch();
	const num_users_added_to_database = await rescanUserbase(database_info, client);
	const num_entries_deleted = await cleanDatabase(database_info, client);
	console.log(`[LOG] Logged in as ${readyClient.user.tag}`);
	console.log(`[LOG] Loaded ${num_users_added_to_database} new entries`);
	console.log(`[LOG] Removed ${num_entries_deleted} unneeded entries`);	
})

// ------------------------------------------------------
// @description [see below]
// 1st Interval: Start the interval to check for expired roles every second
// 2nd Interval: It then starts another interval to remove users who left the server from the database
// 				 and add users who applied a timed role without the bot every 10 seconds
// ------------------------------------------------------
client.on('ready', () => {
	setInterval(async () => { // check for expired roles
		await checkDatabase(database_info, client);
	}, 1000);
	setInterval(async () => { // clean and update database
		await rescanUserbase(database_info, client);
		await cleanDatabase(database_info, client);
	}, 10000);
})

// ------------------------------------------------------
// @description [see below]
// 1. Check if the whether the input is a command or not. If not, do nothing.
// 2. Check if the entered command is indexed by the bot or not. If not, print an error message to the console and do nothing.
// 3. Attempt to execute the command. If execution fails, alert the user
// ------------------------------------------------------
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);
	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}
	try {
		await command.execute(database_info, interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: `[CONNECTION ERROR] ${error}`, ephemeral: true });
		} else {
			await interaction.reply({ content: `[CONNECTION ERROR] ${error}`, ephemeral: true });
		}
	}
});

// ------------------------------------------------------
// @description Login
// ------------------------------------------------------
client.login(token);