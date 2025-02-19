// -----------------------IMPORTS-----------------------
const { Client, CommandInteraction, Guild } = require('discord.js');
const { M_Logger } = require("./logger");
const { reply } = require (`../../src/helpers/discord_helper`);
const { basename } = require('node:path');
const { readdirSync } = require('node:fs');

/**
 * Base command class that all other commands inherit from.
 */
class M_Command {
	/**
	 * @param {Client} client Discord bot client.
	 * @param {(Guild|null)} [guild=null] The guild the command is for. If the command is global, the guild should be null.
	 * @param {String} [command='command'] The name of the command; usually `FILENAME` of the command file unless specified otherwise.
     */
    constructor(client, guild=null, name_info={ command_name: 'command-name', database_name: undefined }) {
		/**
         * Discord bot client.
         * @type {Client}
         */
		this.client = client;
		/**
         * The guild the command is for (null if the command is global).
         * @type {(Guild|null)}
         */
		this.guild = guild;
		if (this.guild != null) {
			this.logger = new M_Logger([
				{ text: this.guild.name.toUpperCase(), colors: "guild" },
				{ text: name_info.command_name.toUpperCase().replaceAll(/[-_]/g, ' '), colors: "command" }
			], `./data/logs/commands.log`, 6);
			this.databases = this.guild.databases;
		} else {
			this.logger = new M_Logger([
				{ text: "BOT", colors: "bot"},
				{ text: name_info.command_name.toUpperCase().replaceAll(/[-_]/g, ' '), colors: "command" }
			], `./data/logs/commands.log`, 6);	
			this.databases = this.client.global_databases;
		}
		this.command_name = name_info.command_name;
		if (name_info.database_name != undefined) this.database_name = name_info.database_name;
		this.command_set = null;
	}

    /**
     * Logs the error `e` and replies to the user who ran the command with the error message.
     * @param {CommandInteraction} interaction The interaction generated when the user ran the command.
     * @param {Error} e The error to be logged and sent in the response message.
     */
	async error(interaction, e) {
		this.logger.error(e, []);
		await reply(interaction, { content: `[ERROR] ${e.message}` }, true);
	}

	/**
	 * Builds the command for Discord to interpret. \
	 * **Note:** Needs to be overidden.
	 * @returns {{data: SlashCommandBuilder}}
     */	

	/**
	 * Sets up the command class. \
	 * **Note:** This is optional and only used for commands that create a database.
     */

	setCommands(commands) { this.command_set = commands; }
	getCommands() { return this.command_set; }


	async setup(database_script_path, client, guild=null) { 
		const log_marker_name = 'SETUP';
		if (this.database_name != undefined) {
			if (this.databases.get(this.database_name) == undefined) {
				const database_imports = require(database_script_path.match(/(.*)\..*/)[1]);
				let database = null;
				for (const property in database_imports) {
					const lower_case_property = property.toLowerCase();
					if (lower_case_property.startsWith("m_") && lower_case_property.endsWith("database")) {
						database = new database_imports[property](client, guild);
						this.logger.debug(`"${this.database_name}" is required but hasn't been made yet.`, {text: log_marker_name, colors: ['function']});
						break;
					}
				}
				if (database == null) throw new Error(`database of name "${this.database_name}" doesn't exist!`)
				this.logger.debug(`Making new database of type "${this.database_name}"...`, {text: log_marker_name, colors: ['function']});
				await database.setup();	
				this.databases.set(this.database_name, database);
				this.logger.debug(`Done`, {text: log_marker_name, colors: ['function']});
			} else {
				this.logger.debug(`Database "${this.database_name}" already exists. Skipping...`, {text: log_marker_name, colors: ['function']});
			}
		} else {
			this.logger.debug(`No database needed.`, {text: log_marker_name, colors: ['function']});
		}
	}
}



function generateAccessor(command_callback, command_filename) {
	const access = { };
	access[basename(command_filename, '.js')] = (client, guild) => command_callback(client, guild);
	return access;
}

async function makeCommand(client, guild=null, filename) {
	const command_filename = basename(filename, '.js');
	const command_dirname =  filename.match(/.*\/(.*)\/.*/)[1];
	let database_script_path = null;
	const filenames = readdirSync(filename.match(/(.*)\/.*\..*/)[1], 'utf8');
	for (const file of filenames) {
		if (file.toLowerCase().includes("_database.js")) {
			database_script_path = `${filename.match(/(.*)\/.*\..*/)[1]}/${file}`;
			break;
		}
	}
	const name_info = (database_script_path != null) 
					? {
						command_name: command_filename,
						database_name: command_dirname
					  }
					: { command_name: command_filename }
	const command_set = new M_Command(client, guild, name_info);
	await command_set.setup(database_script_path, client, guild);
	return command_set;
}

// -----------------------EXPORTS-----------------------
module.exports = { makeCommand, generateAccessor };