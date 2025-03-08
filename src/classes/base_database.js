// -----------------------IMPORTS-----------------------
const { Client, Guild } = require('discord.js');
const { Sequelize, Model } = require('sequelize');
const { M_Base } = require('./base');
const { M_Logger } = require("./logger");

/**
 * Base database class that all other databases inherit from.
 */
class M_BaseDatabase {
    /**
	 * @param {Client} client Discord bot client.
	 * @param {(Guild|null)} [guild=null] The guild the database is for. If the database is for the entire bot (i.e., not command-centered), this should be null.
     * @param {String} filename The filename of the database. [UNUSED]
     * @param {String} foldername The directory name of where the database is. This will eventually become the name used to retrieve the database.
     */
    constructor(client, guild=null, filename, foldername) {
        if (client == null && guild == null) {
			throw new Error("[ERROR] [BASE_DATABASE] Both client and guild cannot be null!");
		}
        /**
         * Discord bot client.
         * @type {Client}
         */
        this.client = client;

		/**
         * The guild the database is for (null if the database is for the entire bot).
         * @type {(Guild|null)}
         */
        this.guild = guild;

        /**
         * The-internally stored database.
         * @type {Sequelize}
         */
        this.database = null;

        /**
         * A map of tables used by the database indexed by a custom name.
         * @type {Map<String, Model>}uml_test
         */
        this.tables = null;

        /**
         * The-internally stored database.
         * @type {String}
         */
        this.filename = filename;

        /**
         * The name of the database.
         * @type {String}
         */
        this.name = foldername;
        if (this.guild == null) {
            this.logger = new M_Logger([
                { text: "BOT", colors: 'bot' },
                { text: this.name.toUpperCase().replaceAll(/_/g, " "), colors: 'database' }
            ], `./data/logs/${this.name}.log`, 4);
        }
        else {
            this.logger = new M_Logger([
                { text: this.guild.name.toUpperCase(), colors: 'guild' },
                { text: this.name.toUpperCase().replaceAll(/_/g, " "), colors: 'database' }
            ], `./guilds/${this.guild.id}/logs/${this.name}.log`, 4);
        }
        this._generateDatabase();
    }

    /**
     * Generates the database object `this.database`.
     */
    _generateDatabase() {
        if (this.guild == null) { // for the general `bot` database
            this.database = new Sequelize({
                host: 'localhost',
                dialect: 'sqlite',
                logging: false,
                storage: `./data/databases/${this.name}.sqlite`,
            });      
        } else {
            this.database = new Sequelize({ // for command-centered databases
                host: 'localhost',
                dialect: 'sqlite',
                logging: false,
                storage: `./guilds/${this.guild.id}/databases/${this.name}.sqlite`,
            });     
        }
    }

    /**
     * Deletes the database. This should be used in the `takedown` implementation. 
     */
    async _close() {
        await this.database.close();
		this.database = null;
        this.tables = null;
    }

    /**
     * Removes unwanted sequelize properties from an object. This is usually used before printing a database.
     * @param {{}} obj the database--in object form--to be modified.
     * @returns {{}}
     */
    cleanDatabaseInfoFromJson(obj) {
        const ignorables = ['id', 'createdAt', 'updatedAt'];
        for (const ignorable of ignorables) obj[ignorable] = undefined;
        return obj;
    }

    /**
	 * Defines the event handler for events the database wants to listen to. \
	 * **Note:** Not required to be overridden.
     */	
    async eventHandler() { }
}

// -----------------------EXPORTS-----------------------
module.exports = { M_BaseDatabase };