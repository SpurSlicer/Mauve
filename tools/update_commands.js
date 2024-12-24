// -----------------------IMPORTS-----------------------
const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('../jsons/config.json');
const { getCommands } = require('../libs/command_gen_helper.js');

// ------------------------------------------------------
// @description [see below]
// 1. Collect/Generate all commands from ../commands/* and log how many were retrieved
// 2. Setup a REST connection between the bot and discord
// 3. Attempt to update all command information discord displays via a PUT call
// ------------------------------------------------------
(async () => {
	try {
		const commands = getCommands();
		console.log(`[LOG] Started refreshing ${commands.length} (/) commands.`);
		const rest = new REST().setToken(token);
		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log(`[LOG] Successfully reloaded ${data.length} (/) commands.`);
	} catch (e) {
		console.error(`[ERROR] ${e}`);
	}
})()
