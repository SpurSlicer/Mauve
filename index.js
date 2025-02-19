// -----------------------IMPORTS-----------------------
const { M_Bot } = require("./src/classes/bot");

/**
 * The global bot instance.
 * @type {M_Bot}
 */
const bot = new M_Bot();

/**
 * Exit program that invokes cascading deconstructor (`takedown`) calls for the bot, guilds, and databases.
 * @param {Number} code The exit code (if specified)
 */
const exit = async (code) => {
	await bot.takedown(code);
	console.log(`\nExiting...: ${code}`);
	process.exit(code);
};
process.on('SIGINT', async (code) => await exit(code));
process.on('SIGTERM', async (code) => await exit(code));

/**
 * Starts the bot.
 */
(async () => await bot.setup())();
