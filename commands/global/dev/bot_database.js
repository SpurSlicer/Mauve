// -----------------------IMPORTS-----------------------
const { M_BaseDatabase } = require("../../../src/classes/base_database");
const { DataTypes } = require('sequelize');
const { readFileSync, readdirSync, renameSync } = require(`node:fs`);
const { getFoldernameByFilename, getFilename, fixGuildData } = require ('../../../src/helpers/general_helper');
const { M_Guild } = require("../../../src/classes/guild");
const { getPrettyJsonText } = require("../../../src/helpers/json_helper");
const { basename } = require("node:path");

/**
 * Name of the current file script
 * @type {String}
 */
const FILENAME = basename(__filename, '.js');
/**
 * Name of the current script directory.
 * @type {String}
 */
const FOLDERNAME = __filename.match(/.*\/(.*)\/.*/)[1];

/**
 * General purpose database for the bot.
 */
class M_BotDatabase extends M_BaseDatabase {
	constructor(client) {
		super(client, null, FILENAME, FOLDERNAME);
		this.settings = {
			are_messages_visible: false
		};
		this.tables = new Map();
		this.blacklist_table = null;
		// process.on('SIGINT', (code) => this.unwatchAll(true));
		// process.on('SIGTERM', (code) => this.unwatchAll(true));
	}


	async setup() {
		const log_marker_name = 'SETUP';
		this.logger.log(`Starting setup...`, [{ text: log_marker_name, colors: "function"}]);	
		this.tables.set('Blacklist', this.database.define('Blacklist', {   
			guild_id: {
				type: DataTypes.STRING,
				allowNull: false
			},
		}));
		this.blacklist_table = this.tables.get('Blacklist');
		this.logger.log(`Generated "Blacklist" table.`, [{ text: log_marker_name, colors: "function"}]);	
		try {
			await this.database.sync();
			this.logger.log(`Done!`, [{ text: log_marker_name, colors: "function"}]);	
		} catch (e) {
			this.logger.error(`${e}`, [{ text: log_marker_name, colors: "function"}]);
		}
	}

	async takedown() {
		const log_marker_name = 'TAKEDOWN';
		this.logger.log(`Starting takedown...`, [{ text: log_marker_name, colors: "function"}]);	
		await this._close();
		this.logger.log(`Done!`, [{ text: log_marker_name, colors: "function"}]);	
	}

	async blacklist(guild) {
		const log_marker_name = 'BLACKLIST';
		let status = null;
		if ((await this.blacklist_table.findAll({ where: { guild_id: guild.id } })).length > 0) {
			await this.blacklist_table.create({ guild_id: guild.id });
			this.logger.log(`Guild "${guild.name}" (${guild.id}) is already in database. Skipping...` , [{ text: log_marker_name, colors: "function"}]);	
			status = false;
		} else {
			this.logger.log(`Added "${guild.name}" (${guild.id}) to the blacklist.` , [{ text: log_marker_name, colors: "function"}]);	
			status = true;
		}
		await this.processGuild(guild);
		return status;
	}

	async whitelist(guild) {
		const log_marker_name = 'WHITELIST';
		let status = null;
		if ((await this.blacklist_table.findAll({ where: { guild_id: guild.id } })).length == 0) {
			this.logger.log(`Guild "${guild.name}" (${guild.id}) isn't on the blacklist. Skipping...` , [{ text: log_marker_name, colors: "function"}]);	
			status = false;
		} else {
			await this.blacklist_table.destroy({ where: { guild_id: guild.id } });
			this.logger.log(`Removed "${guild.name}" (${guild.id}) from the blacklist.` , [{ text: log_marker_name, colors: "function"}]);	
			status = true;
		}
		// await this.processGuild(guild);
		return status;
	}

	// async leaveGuild(guild) {
	// 	const log_marker_name = 'LEAVE GUILD';
	// 	const guild_to_leave = guild.client.guilds.cache.get(guild.id);
	// 	if (guild_to_leave == undefined) {
	// 		this.logger.log(`The bot currently isn't in "${guild.name}" (${guild.id})` , [{ text: log_marker_name, colors: "function"}]);
	// 		return false;
	// 	}else {
	// 		if (readdirSync(`./guilds`, 'utf8').includes(guild_to_leave.id)) {
	// 			this.logger.log(`Banishing "${guild_to_leave.name}" from guild list...` , [{ text: log_marker_name, colors: "function"}]);
	// 			renameSync(`./guilds/${guild_to_leave.id}`, `./data/banished/${guild_to_leave.id}`);
	// 		}
	// 		if (this.client.Bot.guilds.has(guild_to_leave.id)) {
	// 			this.logger.log(`Deleting "${guild_to_leave.name}" from bot...` , [{ text: log_marker_name, colors: "function"}]);
	// 			await this.client.Bot.guilds.get(guild_to_leave.id).takedown();
	// 			this.client.Bot.guilds.delete(guild_to_leave.id);
	// 		}
	// 		this.logger.log(`Leaving "${guild_to_leave.name}"...` , [{ text: log_marker_name, colors: "function"}]);
	// 		const guild_to_leave_name = guild_to_leave.name;
	// 		await guild_to_leave.leave();
	// 		return guild_to_leave_name;
	// 		return true;
	// 	}
	// }

	async processGuild(guild) {
		let is_guild_cached = this.client.guilds.cache.has(guild.id);
		if (is_guild_cached) guild = this.client.guilds.cache.get(guild.id);
		const log_marker_name = 'PROCESS GUILD';
		const main_config = JSON.parse(readFileSync(`./main_config.json`, 'utf8'));
		const test_guild_id = main_config.test_guild_id;
		let [log_str_upper, log_str_lower] = ["", ""];
		if (typeof guild == 'object') {
			[log_str_upper, log_str_lower] = [`Guild "${guild.name}"`, `guild "${guild.name}"`];
		} else {
			guild = { id: guild };
			[log_str_upper, log_str_lower] = [`Guild (${guild.id})`, `guild (${guild.id})`];
		}
		const deleteGuildFromBot = async (guild_id=guild.id) => {
				await this.client.Bot.guilds.get(guild_id).takedown();
				this.logger.log(`Deleted ${log_str_lower} from guild list.` , [{ text: log_marker_name, colors: "function"}]);
		};
		const banishGuild = async (guild_id=guild.id) => {
			if (this.client.Bot.guilds.has(guild_id)) await deleteGuildFromBot();
			renameSync(`./guilds/${guild_id}`, `./data/banished/${guild_id}`);
			this.logger.log(`Banished ${log_str_lower}.` , [{ text: log_marker_name, colors: "function"}]);
		};
		const unbanishGuild = async (guild_id=guild.id) => {
			renameSync(`./data/banished/${guild_id}`, `./guilds/${guild_id}`);
			if (!this.client.Bot.guilds.has(guild_id)) await makeNewGuild();
			this.logger.log(`Unbanished ${log_str_lower}.` , [{ text: log_marker_name, colors: "function"}]);	
		};
		const makeNewGuild = async (guild_id=guild.id) => {
			this.logger.log(`${log_str_upper} not found in file system. Making new...` , [{ text: log_marker_name, colors: "function"}]);	
			const new_guild = new M_Guild(this.client, this.client.guilds.cache.get(guild_id));
			await new_guild.setup();
		};
		const leaveGuild = async () => {
			if (!is_guild_cached) return;
			await guild.leave();
			await this.client.guilds.fetch();
			this.logger.log(`${log_str_upper} is blacklisted. Leaving...` , [{ text: log_marker_name, colors: "function"}]);
		};
		if (main_config.limit_to_test_server) {
			if (!readdirSync(`./guilds`, 'utf8').includes(test_guild_id)) {
				if (readdirSync(`./data/banished`, 'utf8').includes(test_guild_id)) {
					renameSync(`./data/banished/${test_guild_id}`, `./guilds/${test_guild_id}`);
					this.logger.log(`Unbanished "test guild" (${test_guild_id}) per "limit to test server".` , [{ text: log_marker_name, colors: "function"}]);	
				} else {
					this.logger.log(`"Test guild" (${test_guild_id}) not found in file system. Making new...` , [{ text: log_marker_name, colors: "function"}]);	
					await fixGuildData(test_guild_id);	
				}		
			}
			if (!this.client.guilds.cache.has(test_guild_id)) {
				throw new Error(`Bot is not a member of the test guild! Have them join it.`);
			}
			if (!this.client.Bot.guilds.has(test_guild_id)) {
				await makeNewGuild(test_guild_id);
			}
			return;
		} else if ((await this.blacklist_table.findAll({ where: { guild_id: guild.id } })).length == 0) {
			if (this.client.guilds.cache.has(guild.id)) {
				if (readdirSync(`./guilds`, 'utf8').includes(guild.id)) {
					this.logger.log(`No problems with ${log_str_lower}.` , [{ text: log_marker_name, colors: "function"}]);	
				} else if (readdirSync(`./data/banished`, 'utf8').includes(guild.id)) {
					await unbanishGuild();
				} else {
					await fixGuildData(guild.id);
					if (!this.client.Bot.guilds.has(guild.id)) {
						await makeNewGuild();
					}
				}
			} else {
				if (readdirSync(`./guilds`, 'utf8').includes(guild.id)) {
					await unbanishGuild();
				} else if (!readdirSync(`./guilds/`, 'utf8').includes(guild.id)) {
					await makeNewGuild();
				} 
			}
			if (!this.client.Bot.guilds.has(guild.id)) {
				const new_guild = new M_Guild(this.client, this.client.guilds.cache.get(guild.id));
				await new_guild.setup();
			}
		} else {
			if (this.client.guilds.cache.has(guild.id)) {
				await leaveGuild();
			}
			if (this.client.Bot.guilds.has(guild.id)) {
				await deleteGuildFromBot();
			}
			if (readdirSync(`./guilds`, 'utf8').includes(guild.id)) {
				await banishGuild();
			}
		}
	}

	async orientGuilds() {
		const log_marker_name = 'ORIENT GUILDS';
		const banishGuild = async (guild_id) => {
			renameSync(`./guilds/${guild_id}`, `./data/banished/${guild_id}`);
			this.logger.log(`Banished (${guild_id}).` , [{ text: log_marker_name, colors: "function"}]);
		};
		const deleteGuildFromBot = async (guild_id) => {
			await this.client.Bot.guilds.get(guild_id).takedown();
			this.client.Bot.guilds.delete(guild_id);
			this.logger.log(`Deleted (${guild_id}) from the bot's guild class list.` , [{ text: log_marker_name, colors: "function"}]);
		};
		const main_config = JSON.parse(readFileSync(`./main_config.json`, 'utf8'));
		const test_guild_id = main_config.test_guild_id;
		if (main_config.limit_to_test_server) {
			const guild_ids = readdirSync(`./guilds/`, 'utf8');
			for (const guild_id of guild_ids) {
				if (guild_id == '.gitkeep') continue;
				if (guild_id != test_guild_id) {
					renameSync(`./guilds/${guild_id}`, `./data/banished/${guild_id}`);
					this.logger.log(`Banished (${guild_id}) per "limit to test server".` , [{ text: log_marker_name, colors: "function"}]);		
				}
			}
			for (const [key, value] of this.client.Bot.guilds) {
				if (key != test_guild_id) {
					await value.unlistGuildCommands();
					await value.takedown();
					this.logger.log(`Deleted (${key}) per "limit to test server".` , [{ text: log_marker_name, colors: "function"}]);		
				}
			}
		} else { 
			const guild_ids = readdirSync(`./guilds/`, 'utf8');
			for (const guild_id of guild_ids) {
				if (guild_id == '.gitkeep') continue;
				if (!this.client.guilds.cache.has(guild_id)) {
					await banishGuild(guild_id);
					if (this.client.Bot.guilds.has(guild_id)) {
						await deleteGuildFromBot();
					}		
				}
			}
		}
	}

	async viewBlacklist() {
		const blacklist = [];
		const guilds = (await this.blacklist_table.findAll()).dataValues;
		for (const guild of guilds) {
			blacklist.push({guild_id: guild.guild_id, guild_name: (this.client.guilds.cache.has(guild.guild_id)) ? this.client.guilds.cache.get(guild.guild_id) : undefined });
		}
		return JSON.stringify(blacklist, null, 2);
	}
};


module.exports = { M_BotDatabase };