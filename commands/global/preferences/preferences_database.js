// -----------------------IMPORTS-----------------------
const { M_BaseDatabase } = require("../../../src/classes/base_database");
const { DataTypes } = require('sequelize');
const { getFoldernameByFilename, getFilename } = require ('../../../src/helpers/general_helper');
const { getPrettyJsonText } = require("../../../src/helpers/json_helper");
const { CommandInteraction } = require("discord.js");
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

const settings = {
	are_messages_visible: false
};

/**
 * Preferences database.
 * @todo merge with bot_database maybe
 */
class M_PreferencesDatabase extends M_BaseDatabase {
	constructor(client, guild) {
		super(client, guild, FILENAME, FOLDERNAME);
		this.settings = settings;
		// process.on('SIGINT', (code) => this.unwatchAll(true));
		// process.on('SIGTERM', (code) => this.unwatchAll(true));
	}

	/**
	 * Sets up the table `Preferences` with the columns: \
	 * | settings | user_id |
	 * ```js
	 *   const settings = { are_messages_visible: false };
	 * ```
	 */
	async setup() {
		const log_marker_name = 'SETUP';
		this.logger.log(`Starting setup...`, [{ text: log_marker_name, colors: "function"}]);	
		const table = {};
		table.settings = { type: DataTypes.JSON, allowNull: false };
		table.user_id = { type: DataTypes.STRING, allowNull: false };
		this.table = this.database.define('Preferences', table);
		try {
			await this.database.sync();
			this.logger.log(`Done!`, [{ text: log_marker_name, colors: "function" }]);	
		} catch (e) {
			this.logger.error(`${e}`, [{ text: log_marker_name, colors: "function" }]);
		}
	}

	/**
	 * Removes file watchers and closes the database.
	 */
	async takedown() {
		const log_marker_name = 'TAKEDOWN';
		this.logger.log(`Starting takedown...`, [{ text: log_marker_name, colors: "function"}]);	
		await this._close();
		this.logger.log(`Done!`, [{ text: log_marker_name, colors: "function"}]);	
	}

	/**
	 * Updates the setting `setting` with `value`.
	 * @param {CommandInteraction} interaction The command interaction invoked by a user.
	 * @param {{are_messages_visible: Boolean}} setting 
	 * @param {} value 
	 */
	async updateSetting(interaction, setting, value) {
		let update = await this.table.findAll({ where: { user_id: interaction.user.id } });
		if (update.length == 0) {
			update = { settings: this.settings, user_id: interaction.user.id };
		} else {
			update = update.pop().dataValues;
		}
		update.settings[setting] = value;
		await this.table.upsert(update, { where: { user_id: interaction.user.id } });
	}


	/**
	 * Returns the setting `setting` for the user that sent the interaction.
	 * If no setting exists or the user doesn't have an entry in settings,
	 * it returns the default setting.
	 * @param {CommandInteraction} interaction The command interaction invoked by a user.
	 * @param {String} setting The setting to be searched for
	 * @returns {}
	 */
	async getSetting(interaction, setting) {
		try {
			return (await this.table.findAll({ where: { user_id: interaction.user.id } })).pop().dataValues.settings[setting];
		} catch (e) {
			e == e;
			return this.settings[setting];
		}
	}

	/**
	 * Returns a user's settings formatted to be a discord message.
	 * @param {CommandInteraction} interaction The command interaction invoked by a user.
	 * @returns {String}
	 */
	async getSettingsText(interaction) {
		let settings = await this.table.findAll({ where: { user_id: interaction.user.id }});
		if (settings.length == 0) {
			// await this.table.create(this.settings);
			settings = this.settings;
		} else {
			settings = settings.pop().dataValues.settings;
			const current_settings = Object.keys(settings);
			for (const key in this.settings) {
				if (!current_settings.includes(key)) settings[key] = this.settings[key];
			}
		}
		settings.user_name = `@${interaction.user.username}`;
		return getPrettyJsonText(this.cleanDatabaseInfoFromJson(settings), interaction, false, null, true);
	}

};

// -----------------------EXPORTS-----------------------
module.exports = { m_database: M_PreferencesDatabase };