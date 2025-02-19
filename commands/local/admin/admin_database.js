// -----------------------IMPORTS-----------------------
const { M_BaseDatabase } = require("../../../src/classes/base_database");
const { DataTypes } = require('sequelize');
const { getFoldernameByFilename, getFilename } = require ('../../../src/helpers/general_helper');
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

const ADMIN_POSITIONS = ['ADMIN', 'OWNER', 'SERVER_OWNER'];

/**
 * Admin perms database.
 */
class AdminDatabase extends M_BaseDatabase {
	/**
	 * @param {Client} client 
	 * @param {Guild} guild 
	 */
	constructor(client, guild) {
		super(client, guild, FILENAME, FOLDERNAME);
		this.tables = new Map();
		this.admin_table = null;
		// process.on('SIGINT', (code) => this.unwatchAll(true));
		// process.on('SIGTERM', (code) => this.unwatchAll(true));
	}

	/**
	 * Sets up the table `Auto-Edits` with the columns: \
	 * | _id | position |
	 */
	async setup() {
		const log_marker_name = 'SETUP';
		this.logger.log(`Starting setup...`, [{ text: log_marker_name, colors: "function"}]);
		this.tables.set('Admins', this.database.define('Admins', {
			_id: { type: DataTypes.STRING, allowNull: false },
			position: { type: DataTypes.ENUM(ADMIN_POSITIONS), allowNull: false }
		}));
		this.admin_table = this.tables.get('Admins');
		try {
			await this.database.sync();
			this.logger.log(`Done!`, [{ text: log_marker_name, colors: "function"}]);	
		} catch (e) {
			this.logger.error( e, [{ text: log_marker_name, colors: "function"}]);
		}
	}


	/**
	 * closes the database.
	 */
	async takedown() {
		const log_marker_name = 'TAKEDOWN';
		this.logger.log(`Starting takedown...`, [{ text: log_marker_name, colors: "function" }]);	
		await this._close();
		this.logger.log(`Done!`, [{ text: log_marker_name, colors: "function" }]);	
	}

	/**
	 * Adds user/role with id `id` to position `position` in the database. Should that
	 * user/role already exist somewhere, it's either promoted/demoted or an error
	 * is thrown saying that specific id/role cannot be promoted/demoted (this happens
	 * when you try to demote the server owner).
	 * @param {String} id 
	 * @param {'ADMIN'|'OWNER'|'SERVER_OWNER'} position 
	 * @returns 
	 */
	async addGeneralAdminPosition(id, position) {
		let current_position = await this.admin_table.findAll({ where: { _id: id } });
		console.log(id, position, current_position);
		let status = 'demoted';
		if (current_position.length == 0) {
			current_position = { _id: id, position: position.toUpperCase() };
			status = 'new';
		} else {
			current_position = current_position.pop().dataValues;
			if (current_position._id == id && current_position.position == position.toUpperCase()) return false;
		}
		const old_position = current_position.position;
		current_position.position = position.toUpperCase();
		console.log(current_position, old_position);
		await this.admin_table.upsert(current_position, { where: { _id: id } });
		if (old_position == current_position.position && status != "new") return 'no_change';
		else if (old_position == 'ADMIN') return "promoted";
		else return status;
	}

	/**
	 * Removes `id` from the database.
	 * @param {String} id 
	 * @returns {Boolea} `true` means the removal was successful.
	 */
	async removeGeneralAdminPosition(id) {
		let current_position = await this.admin_table.findAll({ where: { _id: id } });
		if (current_position.length == 0) {
			return false;
		} else {
			await this.admin_table.destroy({ where: { _id: id } });
			return true;
		}
	}

	/**
	 * Returns the permission level of `id` or `null` if the id isn't in the
	 * database.
	 * @param {String} id To search the database for.
	 * @returns {'ADMIN'|'OWNER'|'SERVER_OWNER'|null}
	 */
	async getPosition(id) {
		try {
			const entry =  await this.admin_table.findAll({ where: { _id: id } });
			if (entry.length == 0) {
				return null;
			} else {
				return entry.pop().dataValues.position;
			}
		} catch (e) {
			e == e;
			return null;
		}
	}

	/**
	 * Returns a message formatted for discord of all users/roles in each
	 * permission level.
	 * @param {CommandInteraction} interaction The command interaction invoked by a user.
	 * @returns {String}
	 */
	async getAdmins(interaction) {
		let positions = await this.admin_table.findAll();
		const roles = interaction.guild.roles.cache;
		const users = interaction.guild.members.cache;
		const positions_json = {
			admins: [],
			owners: [],
			server_owners: []
		};
		for (let current_position of positions) {
			current_position = current_position.dataValues;
			if (roles.has(current_position._id)) positions_json[current_position.position.toLowerCase() + 's'].push({ role_id: current_position._id });
			if (users.has(current_position._id)) positions_json[current_position.position.toLowerCase() + 's'].push({ user_id: current_position._id });
		}
		return getPrettyJsonText(positions_json, interaction, false, null, false);
	}

};

// -----------------------EXPORTS-----------------------
module.exports = { 
				   m_database: AdminDatabase,
				   ADMIN_POSITIONS
				};