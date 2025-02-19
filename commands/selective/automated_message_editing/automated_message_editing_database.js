// -----------------------IMPORTS-----------------------
const { M_BaseDatabase } = require("../../../src/classes/base_database");
const { DataTypes } = require('sequelize');
const { watch, readFileSync, FSWatcher } = require(`node:fs`);
const { getFilename, getFilePath } = require ('../../../src/helpers/general_helper');
const { jsonifyFile } = require("../../../src/helpers/json_helper");
const { generateLink } = require("../../../src/helpers/discord_helper");
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
 * Automated message command group database.
 */
class M_AutomatedMessageDatabase extends M_BaseDatabase {
	/**
	 * @param {Client} client 
	 * @param {Guild} guild 
	 */
	constructor(client, guild) {
		super(client, guild, FILENAME, FOLDERNAME);
		this.observers = new Map();
		this.observer_fds = new Map();
		this.is_paused = this.checkPause();
		this.paused_observer_fd = null;
	}

	/**
	 * Sets up the table `Auto-Edits` with the columns: \
	 * | guild_id | channel_id | message_id | observee |
	 */
	async setup() {
		const log_marker_name = 'SETUP';
		this.logger.log(`Starting setup...`, [{ text: log_marker_name, colors: "function"}]);	
		this.table = this.database.define('Auto-Edits', {   
			guild_id: {
				type: DataTypes.STRING,
				allowNull: false
			},
			channel_id: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			message_id: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			observee: {
				type: DataTypes.STRING,
				allowNull: false
			}
		});
		try {
			this.paused_observer_fd = await this.#startPausedObserver();
			await this.database.sync();
			this.logger.log(`Done!`, [{ text: log_marker_name, colors: "function"}]);	
		} catch (e) {
			this.logger.error(`${e}`, [{ text: log_marker_name, colors: "function"}]);
		}
	}

	/**
	 * Removes file watchers and closes the database.
	 */
	async takedown() {
		const log_marker_name = 'TAKEDOWN';
		this.logger.log(`Starting takedown...`, [{ text: log_marker_name, colors: "function"}]);	
		this.unwatchAll(true);
		await this._close();
		this.logger.log(`Done!`, [{ text: log_marker_name, colors: "function"}]);	
	}

	/**
	 * Parses `automated_message_editing.json` and returns it.
	 * @returns {{}}
	 */
	checkPause() {
		return JSON.parse(readFileSync(`./guilds/${this.guild.id}/jsons/automated_message_editing.json`, 'utf8')).paused;
	}

	/**
	 * Manually tells file observee listed in `entry.observee` that it's appointed
	 * file was updated (no actual changes were made). If `entry==null`, it will touch
	 * every file observer stored. 
	 * @param {({observee: String, guild_id?: String, channel_id?: String, message_id?: String}|null)} [entry=null] 
	 */
	async touch(entry=null) {
		const log_marker_name = 'TOUCH';
		if (entry == null) {
			for (const [key, values] of this.observers) {
				const guild_id = key.match(/.*\/guilds\/(\d*).*/)[1];
				const file = await jsonifyFile(key, this.client, {guild_id: guild_id, database: this});
				for (const value of values) {
					const message = await this.client.guilds.cache.get(value.guild_id).channels.cache.get(value.channel_id).messages.fetch(value.message_id);
					await message.edit(file);
					if ((entry == null) || !entry.observee.endsWith(`automated_message_editing.log`)) 
						this.logger.log(`Message (${generateLink(value)}) updated`, [{ text: log_marker_name, colors: "function"}]);	
				}
			}
		} else {
			const guild_id = entry.observee.match(/.*\/guilds\/(\d*).*/)[1];
			const message = await this.client.guilds.cache.get(entry.guild_id).channels.cache.get(entry.channel_id).messages.fetch(entry.message_id);
			await message.edit(await jsonifyFile(entry.observee, this.client, {guild_id: guild_id, database: this}));
			this.logger.log(`Message (${generateLink(entry)}) updated`, [{ text: log_marker_name, colors: "function"}]);	
		}
	}

	/**
	 * Starts an observer watching `automated_message_editing.json` to pause
	 * or unpause all other observers depending on what property `is_paused` is
	 * set to (`true` means paused).
	 * @returns {FSWatcher} The file watcher descriptor of the paused observer
	 */
	async #startPausedObserver() {
		return watch(`./guilds/${this.guild.id}/jsons/automated_message_editing.json`, async (eventType) => {
			if (eventType == 'rename') return;
			this.is_paused = this.checkPause();
			if (!this.is_paused) await this.touch();
		});
	}

	/**
	 * Unwatches all observers unless `on_quit=false`. Then, it keeps
	 * the observer checking whether all observers are paused or not 
	 * according to the `is_paused` setting in `automated_message_editing.json`.
	 * @param {Boolean} [on_quit=false] `true` means to quit all observers--including the "is_paused" observer. Default is `false`) that 
	 */
	unwatchAll(on_quit=false) {
		const log_marker_name = 'UNWATCH ALL';
		for (const [key, value] of this.observer_fds) {
			value.unref();
			this.logger.log(`Stopped watching "${getFilename(key, true)}"`, [{ text: log_marker_name, colors: "function"}]);
		}
		if (on_quit) {
			this.paused_observer_fd.unref();
			this.logger.log(`Stopped watching for paused value`, [{ text: log_marker_name, colors: "function"}]);
		}
	}

	/**
	 * Tells the file observer indexed in a map by `file` to pause.
	 * @param {String} file Observer file to pause watchers.
	 */
	unwatch(file) {
		const log_marker_name = 'UNWATCH';
		if (this.observer_fds.get(file) == undefined) return;
		this.observer_fds.get(file).unref();
		this.logger.log(`Stopped watching "${getFilename(file, true)}"`, [{ text: log_marker_name, colors: "function"}]);
		this.observer_fds.delete(file);
	}

	/**
	 * Starts an observer indicated by `.observee` based on the id information provided.
	 * @param {({observee: String, guild_id: String, channel_id: String, message_id: String}|null)} [entry=null] 
	 */
	async startObserver(entry) {
		if (this.observers.get(entry.observee) == undefined) {
			this.observers.set(entry.observee, [entry]);
			const log_marker_name = "OBSERVER " + getFilename(entry.observee).replace(/\..*/, "").replaceAll("_", "").toUpperCase();
			const fd = watch(entry.observee, async (eventType, filename) => {
				filename = getFilePath(filename, `./guilds/${entry.guild_id}`);
				if (this.is_paused || eventType == 'rename') return;
				const observers = this.observers.get(filename);
				if (observers == undefined || observers.size == 0) {
					this.unwatch(filename);
					return;
				}
				const removables = [];
				for (const entry of observers) {
					try {
						const guild_id = entry.observee.match(/.*\/guilds\/(\d*).*/)[1];
						const message = await this.client.guilds.cache.get(entry.guild_id).channels.cache.get(entry.channel_id).messages.fetch(entry.message_id);
						await message.edit(await jsonifyFile(filename, this.client, {guild_id: guild_id, database: this}));
						if (!filename.endsWith(`automated_message_editing.log`)) 
							this.logger.log(`Updated message ${generateLink(entry)}.`, [{ text: log_marker_name, colors: "variable"}]);
					} catch (e) {
						e == e;
						removables.push(entry);
						this.logger.error(`Couldn't find message ${generateLink(entry)}. Removing watcher...`, [{ text: log_marker_name, colors: "variable"}]);
					}
				}
				for (const removable of removables) await this.removeObservee(removable);
            });
			if (!this.is_paused) this.touch(entry);
			this.observer_fds.set(entry.observee, fd);
		} else {
			this.observers.set(entry.observee, this.observers.get(entry.observee).concat([entry]));
		}
	}

	/**
	 * Returns the message links to all messages currently set 
	 * to auto update in a list for a discord message.
	 * @returns {Promise<String>}
	 */
	async getMessageLinks() {
		const links = [];
		const entries = await this.table.findAll();
		for (const entry of entries) {
			links.push(`${generateLink(entry)} receiving updates from \`${entry.observee.split("/").pop()}\``);
		}
		let links_string = "###LINKS###\n";
		for (const link of links) links_string += `- ${link}\n`;
		return links_string.trim();
	}

	/**
	 * Adds a message to the database and starts an observer for itt.
	 * @param {({observee: String, guild_id: String, channel_id: String, message_id: String}|null)} [entry=null] 
	 * @returns {Promise<Boolean>}
	 */
	async addObservee(entry) {
		if (await this.isBeingObserved(entry)) return false;
		await this.table.create({ 
			"message_id": entry.message_id, 
			"channel_id": entry.channel_id, 
			"guild_id": entry.guild_id,
			"observee": entry.observee });
		await this.startObserver(entry);
		return true;
	}

	/**
	 * Stops an observer for `entry`.
	 * @param {({observee: String, guild_id: String, channel_id: String, message_id: String}|null)} [entry=null] 
	 * @returns {Promise<Boolean>}
	 */
	async stopObserver(entry) {
		if (this.observers.get(entry.observee) == undefined) return;
		const observee_file = this.observers.get(entry.observee).pop().observee;
		this.observers.set(entry.observee, this.observers.get(entry.observee).filter((element) => element.message_id != entry.message_id));
		if (this.observers.get(entry.observee).length == 0) {
			this.observers.delete(observee_file);
			this.unwatch(observee_file);
		}
	}

	/**
	 * Removes a message to the database and stops an observer for itt.
	 * @param {({observee: String, guild_id: String, channel_id: String, message_id: String}|null)} [entry=null] 
	 * @returns {Promise<Boolean>}
	 */
	async removeObservee(entry) {
		const log_marker_name = 'REMOVE OBSERVEE';
		if (!(await this.isBeingObserved(entry))) return false;
		entry.observee = (await this.table.findAll({
			where: {
				message_id: entry.message_id
			},
		})).pop().observee;
		await this.stopObserver(entry);
		await this.table.destroy({
			where: {
				"message_id": entry.message_id, 
			}
		});
		this.logger.log(`Removed observee watching "${getFilename(entry.observee, true)}"`, [{ text: log_marker_name, colors: "function"}]);
		return true;
	}

	/**
	 * Returns whether the message indicated by `.message_id` is in the database or not.
	 * @param {({observee?: String, guild_id?: String, channel_id?: String, message_id?: String}|null)} [entry=null] 
	 * @returns {Promise<Boolean>}
	 */
	async isBeingObserved(entry) {
		const log_marker_name = 'IS BEING OBSERVED';
		try { 
			return (await this.table.findAll({
				where: {
					message_id: entry.message_id
				},
			})).length > 0;
		} catch (e) {
			e == e;
			this.logger.log(`Nothing is currently being watched.`, [{ text: log_marker_name, colors: "function"}]);
			return false;
		}
	}
	/**
	 * Starts all observers for all messages and files in the database.
	 */
	async startAllObservers() {
		const entries = await this.table.findAll();
		for (const entry of entries) {
			await this.startObserver(entry.dataValues);
		}
	}

	/**
	 * Stops all observers.
	 * @returns {Promise<Number>} The amount of observers stopped.
	 */
	async stopAllObservers() {
		const entries = await this.table.findAll();
		for (const entry of entries) {
			await this.stopObserver(entry.dataValues);
		}
		return entries.length;
	}

	/**
	 * Removes every entry from the database (clears the table).
	 * @returns {Promise<Number>} The amount of entries removed.
	 */
	async clearDatabase() {
		const num_entries_removed = await this.stopAllObservers();
		await this.table.truncate();
		return num_entries_removed;
	}

	/**
	 * Gathers and returns a json of database info..
	 * @returns {Promise<{
	 * number_of_messages_being_watched: Number,
	 * number_of_file_observers: Number,
	 * pause: Boolean }>} The amount of observers stopped.
	 */
	async getStats() {
		const stats = {};
		stats['number_of_messages_being_watched'] = (await this.table.findAll()).length;
		stats['number_of_file_observers'] = this.observer_fds.size;
		stats['paused'] = this.is_paused;
		return stats;
	}
};

// -----------------------EXPORTS-----------------------
module.exports = { M_AutomatedMessageDatabase };