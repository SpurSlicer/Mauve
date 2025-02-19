// -----------------------IMPORTS-----------------------
const { Client, REST, Routes, Guild } = require('discord.js');
const { M_BaseDatabase } = require('./base_database');
const { readFileSync, readdirSync, writeFileSync, watch, FSWatcher } = require("node:fs");
const { getToken, getClientId } = require("../helpers/discord_helper");
const { checkSudoPerms } = require("../helpers/general_helper");
const { M_Logger } = require('./logger');
const { M_BaseCommand } = require('./command');
const { M_Base } = require('./base');

/**
 * General class for handling guild objects.
 * @implements {M_Base}
 */
class M_Guild extends M_Base {
    /**
	 * @param {Client} client Discord bot client.
	 * @param {Guild} guild The guild to be managed.
     */
    constructor(client, guild) {
        super();
        /**
         * The guild to be managed.
         * @type {Guild} 
         */
        this.guild = guild;

        /**
         * The instance of the `Guild` class tied to the guild object.
         * @type {Guild: M_Guild} 
         */
        this.guild.Guild = this;

        /**
         * Discord bot client.
         * @type {Client}
         */
        this.client = client;

        /**
         * A map of databases indexed by their name (foldername of the database for command-centered databases).
         * @type {Map<string, M_BaseDatabase>}
         */
        this.guild.databases = new Map();

        /**
         * A map of guild commands (local, selective, custom) indexed by their filenames.
         * @type {Map<string, M_BaseCommand>}
         */
        this.guild.commands = new Map();

        /**
         * A map of guild command groups (indexed by foldername of the commands) with another map inside that indexes commands by their filenames.
         * @type {Map<string, Map<String, M_BaseCommand>>}
         */
        this.guild.command_classes = new Map();

        /**
         * A map of all file listeners indexed by custom names.
         * @type {Map<string, FSWatcher>}
         */
        this.observer_fds = new Map();

        /**
         * General purpose logger.
         * @type {M_Logger}
         */
        this.logger = new M_Logger([
            { text: this.guild.name.toUpperCase(), colors: 'guild' }
        ], `./guilds/${this.guild.id}/logs/guild.log`, 2);

        /**
         * Status of whether guild commands (local, selective, custom) are available for general guild memebers to use (`false`) or not.
         * @type {Boolean}
         */
        this.lock = JSON.parse(readFileSync(`./guilds/${this.guild.id}/jsons/settings.json`, 'utf8')).lock;
    }

    /**
     * Deconstructor for the `Guild` class; it removes all file listeners and cascades deconstructor calls
     * it's databases, and commands to do the same.
     * @override
    */ 
    async takedown() {
        const log_marker_name = 'TAKEDOWN';
        this.logger.log(`Starting takedown...`, [{ text: log_marker_name, colors: "function"}]);	
        for (const value of this.guild.databases.values()) {
            this.logger.log(`Deleting database "${value.name}"...`, [{ text: log_marker_name, colors: "function"}]);
            await value.takedown();
        }
        for (const [key, value] of this.observer_fds) {
            this.logger.log(`Deleting observer "${key}"...`, [{ text: log_marker_name, colors: "function"}]);
            value.unref();
        }
        this.client.Bot.guilds.delete(this.guild.id);
        this.logger.log(`Done!`, [{ text: log_marker_name, colors: "function"}]);	
    }

    /**
     * Sets up the guild class by doing the following:
     *  1. Enlists the guild in the `Bot` class.
     *  2. Deletes all current commands, command classes, and databases.
     *  3. Updates all necessary guild caches listed here: {@link Guild.updateCaches}.
     *  4. Updates the stored bot nickname based on the current nickname of the bot.
     *  5. Refreshes all guild commands; this process can be viewed here: {@link Guild.refreshAllCommands}.
     *  6. Starts up all file listeners. To see them, view them here: {@link Guild.setupFileListeners}.
     *  7. Verifies the guild owner is still listed as a server owner internally.
     * @override
    */            
    async setup() {
        const log_marker_name = 'SETUP';
        this.logger.log(`Setting up guild...`, { text: log_marker_name, colors: 'function' });
        this.client.Bot.guilds.set(this.guild.id, this);
        this.guild.commands = new Map();
        this.guild.command_classes = new Map();
        this.guild.databases = new Map();
        await this.updateCaches();
        this.resetDiscordNickname();
        await this.refreshAllCommands();
        this.setupFileListeners();
        await this.verifyOwner();
        this.logger.log(`Done!`, { text: log_marker_name, colors: 'function' });
    }

    /**
     * Checks to make sure the guild owner is still marked as a server owner internally.
     */
    async verifyOwner() {
        const log_marker_name = 'VERIFY OWNER';
        if ((await this.guild.databases.get('admin').getPosition(this.guild.ownerId)) == null) {
            this.logger.log(`Owner was missing! Adding them...`, [{ text: log_marker_name, colors: "function"}]);
            await this.guild.databases.get('admin').addGeneralAdminPosition(this.guild.ownerId, 'SERVER_OWNER');
        }
    }

    /**
     * Resets all guild level commands (local, selective, custom) by doing the following:
     *  1. Deletes all current databases.
     *  2. Clears `database`, `command`, and `command_class` maps.
     *  3. Refreshes all guild commands; this process can be viewed here: {@link Guild.refreshAllCommands}.
     * This is usually called when a server enables/disables a selective command.
     */
    async resetCommands() {
        const log_marker_name = 'RESET COMMANDS';
        this.logger.log(`Resetting commands...`, [{ text: log_marker_name, colors: "function"}]);
        for (const value of this.guild.databases.values()) {
            this.logger.log(`Deleting database "${value.name}"...`, [{ text: log_marker_name, colors: "function"}]);
            await value.takedown();
        }
        this.guild.databases = new Map();
        this.guild.commands = new Map();
        this.guild.command_classes = new Map();  
        await this.refreshAllCommands();  
        this.logger.log(`Done!`, [{ text: log_marker_name, colors: "function"}]);
    }


    /**
     * Starts the following file listeners:
     *  - **admins**: Runs {@link Guild.verifyOwner} every time the admins database is changed to make sure the guild owner is listed as a server owner internally. 
     *  - **settings**: This checks whether the commands are now locked/unlocked, the bot nickname changed, or a selective command was enabled/disabled. Does nothing when the file is renamed (this should never happen).
     * 
     * All listeners are stored in `this.observer_fds` and are ceased upon the running of {@link Guild.takedown}.
     */
    setupFileListeners() {
        const [admins_listener_name, settings_listener_name] = [`admins`, `settings`];
        const log_marker_name = 'SETUP FILE LISTENERS';
        const log_marker_name_settings = 'OBSERVER ' + settings_listener_name.toUpperCase();
        // admins file listener v
        this.observer_fds.set(admins_listener_name, watch(`./guilds/${this.guild.id}/databases/admin.sqlite`, async () => {
            await this.verifyOwner();
        }));
        // settings file listener v
        this.observer_fds.set(settings_listener_name, watch(`./guilds/${this.guild.id}/jsons/settings.json`, async (eventType) => {
            if (eventType == 'rename') return;
            const json = JSON.parse(readFileSync(`./guilds/${this.guild.id}/jsons/settings.json`, 'utf8'));
            if (this.lock != json.lock) {
                this.lock = json.lock;
                this.logger.log(`Commands are now ${(this.lock) ? "locked" : "unlocked"}.`, [{ text: log_marker_name_settings, colors: "variable"}]);
            }
            if (this.guild.members.cache.get(this.client.user.id).nickname != json.bot_name) {
                await this.guild.members.cache.get(this.client.user.id).setNickname(json.bot_name);
                this.logger.log(`Updated bot name to "${json.bot_name}".`, [{ text: log_marker_name_settings, colors: "variable"}]);
            }
            const selective_commands = json.selective_commands;
            let need_selective_command_update = false;
            for (const child in selective_commands) {
                if (selective_commands[child] === true) {
                    if (!this.guild.command_classes.has(child)) {
                        this.logger.log(`"${child}" is not enabled. Enabling and resetting guild...`, [{ text: log_marker_name_settings, colors: "variable"}]);
                        await this.resetCommands();
                        if (!need_selective_command_update) need_selective_command_update = true;
                        break;
                    }
                } else {
                    if (this.guild.command_classes.has(child)) {
                        this.logger.log(`"${child}" should be disabled. Disabling and resetting guild...`, [{ text: log_marker_name_settings, colors: "variable"}]);
                        await this.resetCommands();
                        if (!need_selective_command_update) need_selective_command_update = true;
                        break;
                    }
                }
            }
            if (need_selective_command_update) this.client.Bot.emit(`settings_update_${this.guild.id}`);
        }));
        for (const key of this.observer_fds.keys()) {
            this.logger.log(`Started observer named "${key}".`, [{ text: log_marker_name, colors: "function"}], [{ text: log_marker_name, colors: "function"}]);
        }
    }

    // getDatabaseByFilename(name) {
    //     return this.guild.command_classes.get(name).database;
    // }


    /**
     * Resets the internally-stored bot nickname to the one set in guild.
    */  
    resetDiscordNickname() {
        const log_marker_name = 'RESET DISCORD NICKNAME';
        const settings = JSON.parse(readFileSync(`./guilds/${this.guild.id}/jsons/settings.json`, 'utf8'));
        settings.bot_name = this.guild.members.me.nickname;
        writeFileSync(`./guilds/${this.guild.id}/jsons/settings.json`, JSON.stringify(settings, null, 2));
        this.logger.log(`set bot nickname to "${settings.bot_name}".`, [{ text: log_marker_name, colors: "function"}]);
    }

    /**
     * Changes the bot nickname in the server to the one stored internally.
    */  
    async updateDiscordNickname() {
        const settings = JSON.parse(readFileSync(`./guilds/${this.guild.id}/jsons/settings.json`, 'utf8'));
        if (settings.bot_name == undefined || settings.bot_name == "") return;
        if (typeof settings.bot_name != 'string') settings.bot_name = toString(settings.bot_name);
        await this.guild.members.me.setNickname(settings.bot_name);
    }

    /**
     * Refreshes the following caches:
     *  - Guild memebers
     *  - Guild channels
     *  - Guild roles
     *  - Guild stickers
     *  - Guild emojis
    */  
    async updateCaches() {
        const log_marker_name = 'UPDATE CACHES';
        await this.guild.members.fetch();
        await this.guild.channels.fetch();
        await this.guild.roles.fetch();
        await this.guild.stickers.fetch();
        await this.guild.emojis.fetch();
        this.logger.log(`Refreshing all guild caches...`, [{ text: log_marker_name, colors: "function"}]);
    }

    /**
     * Resets all guild commands by doing the following:
     *  1. Adds all local commands.
     *  2. Adds only the enabled selective commands. 
     *  3. Adds all custom commands for hat guild.
     *  4. Updates all guild level commands with Discord. 
    */  
    async refreshAllCommands() {
        await this.addGuildCommands(`./commands/local`);
        const settings = JSON.parse(readFileSync(`./guilds/${this.guild.id}/jsons/settings.json`, 'utf8'));
        for (const setting in settings.selective_commands) {
            let status = settings.selective_commands[setting];
            if (status == null || status == undefined || !status) continue;
            else if (status == true) await this.addGuildCommands(`./commands/selective/${setting}`);
        }
        await this.addGuildCommands(`./guilds/${this.guild.id}/custom_commands`);
        await this.updateGuildCommands();
    }

    /**
     * Sends discord a request to delete all currently listed guild commands.
     * @todo Finish if needed
    */  
    async unlistGuildCommands() {
        const log_marker_name = 'DELETE GUILD COMMANDS';
        try {
            const rest = new REST().setToken(getToken());
            // const commands = [];
            // for (const [key, value] of this.guild.commands) {
            //     commands.push(value.data.toJSON());
            // }
            /*const data = */await rest.delete(
                Routes.applicationGuildCommands(getClientId(), this.guild.id)
                // { body: [] },
            );
            this.logger.log(`Successfully unlisted ${this.guild.commands.size} (/) ${(this.guild.commands.size == 1) ? "command" : "commands"}.`, [{ text: log_marker_name, colors: "function"}]);
        } catch (e) {
            this.logger.error(`${e}`, [{ text: log_marker_name, colors: "function"}]);
        }

    }

    /**
     * Sends Discord a request to update all slash commands.
    */     
    async updateGuildCommands() {
        const log_marker_name = 'UPDATE GUILD COMMANDS';
        try {
            const rest = new REST().setToken(getToken());
            const commands = [];
            for (const value of this.guild.commands.values()) {
                commands.push(value.data.toJSON());
            }
            const data = await rest.put(
                Routes.applicationGuildCommands(getClientId(), this.guild.id),
                { body: commands },
            );
            this.logger.log(`Successfully reloaded ${data.length} (/) ${(data.length == 1) ? "command" : "commands"}.`, [{ text: log_marker_name, colors: "function"}]);
        } catch (e) {
            this.logger.error(`${e}`, [{ text: log_marker_name, colors: "function"}]);
        }
    }

    /**
     * Iterates through `dir` to recursively scan every folder and updates every command it can find.
     * This is done through checking all found .js files to see if they export an `access` object.
     * @param {String} dir Path to the directory to be searched for.
    */     
    async addGuildCommands(dir) {
        const log_marker_name = 'ADD GUILD COMMANDS';
        if (dir.endsWith("/")) dir = dir.substring(0, dir.length-2);
        let command_cnt = 0;
        const command_file_names = readdirSync(dir, 'utf8');
        for (const command_file_name of command_file_names) {
            if (command_file_name == '.gitkeep') continue;
            if (!command_file_name.includes(".")) {
                await this.addGuildCommands(`${dir}/${command_file_name}`);
                continue;
            }
            const { access } = require(`../../${dir}/${command_file_name}`);
            if (access == null || access == undefined) continue;
            const filename = command_file_name.split(/\./g)[0];
            this.logger.log(`setting command "${filename}"...`, [{ text: log_marker_name, colors: "function"}]);
            const command_class = await access[filename](this.client, this.guild);
            this.guild.command_classes.set(filename, command_class);
            for (const command of command_class.getCommands()) {
                this.guild.commands.set(command.command_name, command);
                command_cnt++;    
            }
        }
        if (command_cnt > 0) this.logger.log(`Set ${command_cnt} / ${(command_cnt == 1) ? "command" : "commands"} from group "${dir.match(/.*\/([^/]*)/)[1]}"`, [{ text: log_marker_name, colors: "function"}]);
    }

    /**
     * Removes all commands based on foldername of the folder they're in (i.e., the group_name).
     * @todo Finish if needed
     * @param {String} group_name The foldername of commands to be removed.
    */    
    async removeCommandsByGroup(group_name) {
        for (const command_class_command of this.guild.command_classes.get(group_name).commands) {
            this.guild.commands.delete(command_class_command);
        }
        const database = this.guild.databases.get(group_name);
        if (database != undefined) {
            await database.takedown();
            this.guild.databases.delete(group_name);
        }
        this.guild.command_classes.get(group_name).takedown();
        this.guild.command_classes.delete(group_name);
    }

    /**
     * Removes all commands based on foldername of the folder they're in (i.e., the group_name).
     * @todo Finish if needed
     * @param {String} group_name The foldername of commands to be removed.
    */  
    getCommand(command_name) {
        return this.guild.commands.get(command_name);
    }

    /**
     * Checks `settings.json` to see if the commands are locked.
     * @param {CommandInteraction} interaction The command interaction invoked by a user.
     * @throws An error saying that regular server members cannot use commands at the moment.
    */  
    checkForLock(interaction) {
        let settings = JSON.parse(readFileSync(`./guilds/${interaction.guild.id}/jsons/settings.json`, 'utf8'));
        if (settings.lock == undefined) settings = false;
        if (settings && !checkSudoPerms(interaction)) throw new Error("commands are currently unavailable for use");
    }
}

// -----------------------EXPORTS-----------------------
module.exports = { M_Guild };