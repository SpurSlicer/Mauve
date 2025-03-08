// -----------------------IMPORTS-----------------------
const { Client, Events, GatewayIntentBits, REST, Routes, ActivityType, CommandInteraction, CacheType, Guild, GuildEmoji, Role, Sticker, GuildMember, GuildChannel, Partials } = require('discord.js');
const { DefaultWebSocketManagerOptions: { identifyProperties } } = require("@discordjs/ws");
const { getToken, getClientId, reply } = require('../helpers/discord_helper');
const { M_Logger } = require('./logger');
const { readFileSync, readdirSync, watch } = require('node:fs');
const { isDev, getPrettyTime } = require('../helpers/general_helper');
const { EventEmitter } = require('node:events');
const { M_Guild } = require('./guild');
const { M_BaseCommand } = require('./command');
const { M_BaseDatabase } = require('./base_database');
const { M_Base } = require('./base');
const { isNumberObject } = require('node:util/types');

/**
 * Mauve - a customizable general purpose discord bot.
 * @implements {M_Base}
 */
class M_Bot extends M_Base {
    constructor() {
        super();
        /**
         * A map of guild classes (indexed by guild id)
         * @type {Map<string, M_Guild>}
         */
        this.guilds = new Map();

        /**
         * Discord bot client
         * @type {Client}
         */
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions
            ],
            partials: [
                Partials.Message,
                Partials.Channel,
                Partials.Reaction
            ]
        });

        /**
         * The timeout for the status switcher interval
         * @type {NodeJS.Timeout}
         */
        this.presence_interval = null;

        /**
         * Client attribute reference to the Bot class
         * @type {M_Bot}
         */
        this.client.Bot = this;

        /**
         * Client attribute reference to all global command groups
         * @type {Map<string, Map<String, M_BaseCommand>>}
         */
        this.client.global_command_classes = new Map();

        /**
         * Client attribute reference to all global commands
         * @type {Map<string, M_BaseCommand>}
         */
        this.client.global_commands = new Map();
        
        /**
         * Client attribute reference to all global databases
         * @type {Map<string, M_BaseDatabase>}
         */
        this.client.global_databases = new Map();

        /**
         * A boolean where `false` means the bot is busy with something
         * meaning commands cannot be run.
         * @type {Boolean}
         */
        this.status = false;

        /**
         * General purpose bot event emitter. Use cases are:
         *  - `sudo-command` waits for a file modification 
         * signal upon enabling/disabling a command group.
         * @type {EventEmitter}
         */
        this.emitter = new EventEmitter();

        /**
         * The current emitter acknowledgement index. 
         * It will modulo back to 0 upon reaching 2^32.
         * @type {Number}
         */
        this.ack = 0;

        /**
         * A priority queue for acknowledgement requests following FIFO.
         * @type {[Number]}
         */
        this.acks = [];

        /**
         * Mutex locking `ack` value modifications
         * @type {Boolean}
         */
        this.ack_lock = false;

        /**
         * The main_config.json file listener
         * @type {FSWatcher}
         */
        this.main_config_observer = null; 

        this.global_lock = null; 
        this.limited_to_test_server = null;
        this.test_guild_id = (JSON.parse(readFileSync('./main_config.json', 'utf8'))).test_guild_id;

        /**
         * General purpose logger.
         * @type {M_Logger}
         */
        this.logger = new M_Logger([
            { text: "BOT", colors: "bot"}
        ], `./data/logs/bot.log`);
        this.logger.alert(`Bot constructed`);
    }

    /**
     * Deconstructor for the `Bot` class; it removes all file listeners and cascades deconstructor calls
     * to all guilds, databases, and commands to do the same.
     * @override
     * @param {string} code the specified exit code (passed via signal handlers in `index.js`).
    */  
    async takedown(code=null) {
        this.status = false;
        this.logger.alert('Killing bot...');
        const log_marker_name = 'TAKEDOWN';
        const initial_time = new Date();
        this.logger.log(`Starting takedown...`, [{ text: log_marker_name, colors: "function"}]);
        this.logger.log(`Stopping status interval...`, [{ text: log_marker_name, colors: "function"}]);
        clearInterval(this.presence_interval);
        if (this.main_config_observer != null) this.main_config_observer.unref();
        this.emitter.removeAllListeners();
        this.client.user.setPresence({
            status: 'online'
        });
        this.emitter.removeAllListeners();
        console.log(`ALL KEYS IN TAKEDOWN`, this.client.global_databases.keys());
        for (const [key, value] of this.client.global_databases) {
            this.logger.log(`Deleting global database "${key}"...`, [{ text: log_marker_name, colors: "function"}]);
            await value.takedown();
        }
        for (const [key, value] of this.guilds) {
            this.logger.log(`Deleting guild "${this.client.guilds.cache.get(key)?.name}"...`);
            await value.takedown();
        }
        await this.client.destroy();
        this.logger.log(`Completed in ${getPrettyTime(new Date().getTime() - initial_time, ['seconds', 'milliseconds'])}.${(code != null) ? ` Exiting with code "${code}".` : "Exiting..."}`, [{ text: log_marker_name, colors: "function"}]);
        this.logger.alert(`------------------`, { rainbowify_text: true, spacing: false });
    }

    #setupFileListeners() {
        const log_marker_name = 'SETUP FILE LISTENERS'
        const log_marker_name_callback = 'MAIN CONFIG OBSERVER CALLBACK';
        this.logger.log(`Starting "main_config.json" callback...`, [{ text: log_marker_name, colors: "function"}]);
        const main_config_observer_callback = (eventType) => {
            if (eventType == 'rename') return;
            const json = JSON.parse(readFileSync('./main_config.json', 'utf8'));
            this.global_lock = json.global_lock; 
            this.limited_to_test_server = json.limit_to_test_server;
            this.logger.log(`Ran a "main_config.json" read.`, [{ text: log_marker_name_callback, colors: "function"}]);
        }
        this.main_config_observer = watch('./main_config.json', (eventType) => main_config_observer_callback(eventType));
        main_config_observer_callback('');
        this.logger.log(`Done!`, [{ text: log_marker_name, colors: "function"}]);
    }

    /**
     * Deletes and regenerates all global commands by
     * regenerating all commands via reading their respective files in
     * `./commands/global` and sending a PUT request to Discord to update
     * the slash command list.
    */  
    async resetGlobalCommands() {
        this.client.global_commands = new Map();
        this.client.global_command_classes = new Map();
        await this.#addGlobalCommands();
        await this.#updateGlobalCommands();
    }

    /**
     * Runs the `resetCommands` function for every guild the bot is in.
    */      
    async resetAllGuildCommands() {
        for (const guild of this.guilds.values()) {
            await guild.resetCommands();
        }
    }

    /**
     * Starts an interval that cycles through all discord statuses.
     * @todo include mobile via a mobile audio client swap
    */  
    startStatusInterval() {
        const statuses = ['online', 'idle', 'dnd', 'streaming'];
        const statuses_length = statuses.length;
        let index = 0;
        const callback = () => {
            const server_count = this.guilds.size;
            // if (statuses[index] == 'online') {
            //     // compress: require('os').platform() !== 'browser',
            //     identifyProperties.browser = `Discord Android`;
            //     identifyProperties.device = `Discord Android`;
            //     // console.log(identifyProperties);
            // }
            // if (statuses[index] == 'mobile') this.client.ws: { properties: { $browser: "Discord iOS" }}
            this.client.user.setPresence({
                activities: [{
                    name: `Currently inhabiting ${server_count} ${(server_count == 1) ? "server" : "servers"}`,
                    state: `Currently inhabiting ${server_count} ${(server_count == 1) ? "server" : "servers"}`,
                    url: (statuses[index] == 'streaming') ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : undefined,
                    type: (statuses[index] == 'streaming') ? ActivityType.Streaming : ActivityType.Custom
                }],
                status: statuses[index],
            });
            // console.log(identifyProperties);
            index = (index+1) % statuses_length;
        };
        this.presence_interval = setInterval(() => callback(), 10000);
        callback();
    }

    // getGuildClass(guild_id) {
    //     return this.guilds.get(guild_id);
    // }

    /**
     * Enqueues a listener (indexed by `ack`) for the `emitter` to respond to.
     * @returns {Number} The ack appointed to the listener
    */    
    enqueueAck() {
        const log_marker_name = 'ENQUEUE ACK';
        let timer = true;
        const timeout = setTimeout(() => { console.log("TIMEOUT"); timer = false; }, 10000);
        while (this.ack_lock && timer);
        if (!timer) {
            this.logger.error(`Occurred at ack ${this.ack}`, [{ text: log_marker_name, colors: "function"}]);
            return -1;
        }
        clearTimeout(timeout);
        this.ack_lock = true;
        const appointed_ack = this.ack;
        this.acks.push(this.ack);
        this.ack = (this.ack + 1) % (2^32);
        this.ack_lock = false;
        this.logger.debug(`Dispursing ack ${appointed_ack}...`, [{ text: log_marker_name, colors: "function"}]);
        return appointed_ack;
    }

    /**
     * Sends out a response to all listeners listening to event `event`.
     * Only the listener with a matching `ack` will actually listen.
     * @param {String} event The event for responses to be sent to
     * @returns {(Boolean|undefined|Number)} `undefined` when the `ack` list is empty;
     * `true` when the event had listeners; `false` when it had none; and `-1` upon suspected deadlock.
    */    
    emit(event) {
        const log_marker_name = 'EMIT';
        const log_marker_event = event.toUpperCase().replaceAll(/_/g, " ").replaceAll(/\d/g, "").trim();
        let status = undefined;
        let timer = true;
        const timeout = setTimeout(() => { timer = false; }, 10000);
        while (this.ack_lock && timer);
        if (!timer) {
            this.logger.error(`Ack responsible is ${this.ack}`, [{ text: log_marker_name, colors: "function"}, { text: log_marker_event, colors: "event" }]);
            return -1;
        }
        clearTimeout(timeout);
        this.ack_lock = true;
        if (this.acks.length > 0) {
            this.logger.log(`Emitting for ack ${this.acks[0]}`, [{ text: log_marker_name, colors: "function"}, { text: log_marker_event, colors: "event" }]);
            status = this.emitter.emit(event, this.acks[0]);
        }
        this.acks = (this.acks.length < 2) ? [] : this.acks.split(1);
        this.logger.debug(`Remaining acks: [${this.acks.toString()}]`, [{ text: log_marker_name, colors: "function"}, { text: log_marker_event, colors: "event" }]);
        this.ack_lock = false;
        return status;
    }

    /**
     * Checks whether all commands are locked for all users or not via the global lock setting in `./main_config.json`.
     * If the user that invoked a lock check is a dev, the constraint will not be applied (i.e., they can use commands still).
     * @param {CommandInteraction} interaction
     * @throws Trhows an `invalid permission` error if the lock is in place and the user
     * that invoked it isn't a dev.
    */    
    checkGlobalLock(interaction) {
        if (this.global_lock == true && !isDev(interaction)) {
            throw new Error("commands are currently unavailable for use");
        }
    }

    /**
     * Checks whether all commands are locked for all users or not via the global lock setting in `./main_config.json`.
     * If the user that invoked a lock check is a dev, the constraint will not be applied (i.e., they can use commands still).
     * @param {CommandInteraction} interaction
     * @throws Trhows an `invalid permission` error if the lock is in place and the user
     * that invoked it isn't a dev.
    */    
    checkLimitedToTestServer(interaction) {        if (this.limited_to_test_server == true && ((interaction.guild != undefined && interaction.guild != null) ? (interaction.guild.id != this.test_guild_id) : true)) {
            throw new Error("all commands are currently disabled by the developer");
        }
    }

    /**
     * Loops through every directory in `./commands/global` recursively and, with every command
     * file it finds, attempts to retrieve and store the command in `client.global_commands` and `client.global_command_classes`
     * Every command file exports an `access` function, and this is what's used to retrieve an instance of the command class.
     * @param {String} [dir=`./commmands/global`] Used for recursive file searching.
    */    
    async #addGlobalCommands(dir=`./commands/global`) {
        const log_marker_name = 'ADD GLOBAL COMMANDS';
        let command_cnt = 0;
        const command_file_names = readdirSync(dir, 'utf8');
        const global_command_class_dir = dir.match(/.*\/([^/]*)/)[1];
        this.client.global_command_classes.set(global_command_class_dir, []);
        for (const command_file_name of command_file_names) {
            if (command_file_name == '.gitkeep') continue;
            if (!command_file_name.includes(".")) {
                await this.#addGlobalCommands(`${dir}/${command_file_name}`);
                continue;
            }
            const { access } = require(`../../${dir}/${command_file_name}`);
            if (access == null || access == undefined) continue;
            const filename = command_file_name.split(/\./g)[0];
            this.logger.log(`setting global command "${filename}"...`, [{ text: log_marker_name, colors: "function"}]);
            const command_set = await access[filename](this.client, null);
            this.client.global_command_classes.set(global_command_class_dir, this.client.global_command_classes.get(global_command_class_dir).concat(command_set));
            for (const command of command_set.getCommands()) {
                this.client.global_commands.set(command.command_name, command);
                command_cnt++;    
            }
        }
        if (command_cnt > 0) this.logger.log(`Set ${command_cnt} global / ${(command_cnt == 1) ? "command" : "commands"} from group "${dir.match(/.*\/([^/]*)/)[1]}"`, [{ text: log_marker_name, colors: "function"}]);
    }

    /**
     * Loops through every directory in `./commands/global` recursively and, with every command
     * file it finds, attempts to retrieve and store the command in `client.global_commands` and `client.global_command_classes`
     * Every command file exports an `access` function, and this is what's used to retrieve an instance of the command class.
     * @param {String} [dir=`./commmands/global`] Used for recursive file searching.
    */    
    async #updateGlobalCommands() {
        const log_marker_name = 'UPDATE GLOBAL COMMANDS';
        try {
            const rest = new REST().setToken(getToken());
            const commands = [];
            for (const global_command of this.client.global_commands.values()) {
                commands.push(global_command.data.toJSON());
            }
            const data = await rest.put(
                Routes.applicationCommands(getClientId()),
                { body: commands },
            );
            this.logger.log(`Registered ${data.length} (/) global ${(data.length == 1) ? "command" : "commands"} on discord`, [{ text: log_marker_name, colors: "function"}]);
        } catch (e) {
            this.logger.error(e, [{ text: log_marker_name, colors: "function"}]);
        }
    }

    /**
     * Starts the following bot event listeners:
     *  - Guild create or delete
     *  - Emoji create, delete, or update
     *  - Member add or remove
     *  - Role create or delete
     *  - Channel create or delete
     *  - Sticker create or delete
     *  - **Client Ready* runs once the client is finished being initialized on discord's end and
     * runs the general `setup` function that constructs all client and general bot properties.
     *  - **Interaction Create** runs upon every slash command execution. 
     *
     * All event listeners run a specific callback with all specific callbacks running the general callback.
     * Event Listener -> Specific Callback -> General Callback
     * 
    */    
    #startBotEventListeners() {

        /**
         * Runs the specific callback and then runs all database event handlers subscribed to 
         * the event passed.
         * @param {function} callback The selective callback.
         * @param {CacheType} discord_obj The discord obj generated from the Discord event handler.
         * @param {Events} event The event the Discord event listener is listening to.
        */    
        const generalEventCallback = async (callback, discord_obj, event) => {
            try {
                const new_discord_obj = await callback(discord_obj, event);
                let databases = new Map();
                this.client.global_databases.forEach((value, key) => databases.set(key, value));
                if (new_discord_obj.guild != undefined && new_discord_obj.guild != null) {
                    if (new_discord_obj.guild.databases != undefined) new_discord_obj.guild.databases.forEach((value, key) => databases.set(key, value));
                }
                for (const value of databases.values()) {
                    await value.eventHandler(discord_obj, event);
                }
            } catch (e) { 
                this.logger.error(e, [{ text: event.toUpperCase(), colors: "variable" }]); 
            }
        };


        /**
         * Refreshes guild cache and tells the `bot` database (general bot database)
         * to handle the guild that was either added or removed based on how the
         * refreshed cache looks.
         * @param {M_Guild} guild The guild the event was triggered in.
         * @param {Events} event Either `GuildCreate` or `GuildDelete`.
        */  
        const guildCreateDeleteCallback = async (guild, event) => {
            await generalEventCallback(
                async () => {
                    this.logger.log(`Event triggered in "${guild.name}". Running...`, [{ text: event.toUpperCase(), colors: "variable" }]);        
                    await this.client.guilds.fetch();
                    await this.client.global_databases.get('dev').processGuild(guild);  
                    return guild;  
                }, guild, event);
        };
        this.client.on(Events.GuildCreate, async (guild) => await guildCreateDeleteCallback(guild, Events.GuildCreate));
        this.client.on(Events.GuildDelete, async (guild) => await guildCreateDeleteCallback(guild, Events.GuildDelete));
        /**
         * Refreshes emoji cache for the guild the event was triggered in.
         * @param {GuildEmoji} emoji The emoji that has undergone some sort of change.
         * @param {Events} event Either `GuildEmojiCreate`, `GuildEmojiDelete`, or `GuildEmojiUpdate`.
        */  
        const emojiCallback = async (emoji, event) => {
            await generalEventCallback(
                async () => {
                    this.logger.log(`Event triggered in "${emoji.guild.name}". Running...`, [{ text: event.toUpperCase(), colors: "variable" }]);        
                    await this.client.guilds.cache.get(emoji.guild.id).emojis.fetch();
                    return emoji;
                }, emoji, event);
        };
        this.client.on(Events.GuildEmojiCreate, async (emoji) => await emojiCallback(emoji, Events.GuildEmojiCreate));
        this.client.on(Events.GuildEmojiDelete, async (emoji) => await emojiCallback(emoji, Events.GuildEmojiDelete));
        this.client.on(Events.GuildEmojiUpdate, async (emoji) => await emojiCallback(emoji, Events.GuildEmojiUpdate));
        /**
         * Refreshes member cache for the guild the event was triggered in.
         * @param {GuildMember} member The member that has undergone some sort of change.
         * @param {Events} event Either `GuildEmojiCreate`, `GuildEmojiDelete`, or `GuildEmojiUpdate`.
        */          
       const memberCallback = async (member, event) => {
            await generalEventCallback(
                async () => {
                    this.logger.log(`Event triggered in "${member.guild.name}". Running...`, [{ text: event.toUpperCase(), colors: "variable" }]);        
                    await this.client.guilds.cache.get(member.guild.id).members.fetch();
                    return member;
                }, member, event);
        };
        this.client.on(Events.GuildMemberAdd, async (member) => await memberCallback(member, Events.GuildMemberAdd));
        this.client.on(Events.GuildMemberRemove, async (member) => await memberCallback(member, Events.GuildMemberRemove));
        /**
         * Refreshes roles cache for the guild the event was triggered in.
         * @param {Role} role The role that has undergone some sort of change.
         * @param {Events} event Either `GuildEmojiCreate`, `GuildEmojiDelete`, or `GuildEmojiUpdate`.
        */          
        const roleCallback = async (role, event) => {
            await generalEventCallback(
                async () => {
                    this.logger.log(`Event triggered in "${role.guild.name}". Running...`, [{ text: event.toUpperCase(), colors: "variable" }]);        
                    await this.client.guilds.cache.get(role.guild.id).roles.fetch();
                    return role;
                }, role, event);
        };
        this.client.on(Events.GuildRoleCreate, async (role) => await roleCallback(role, Events.GuildRoleCreate));
        this.client.on(Events.GuildRoleDelete, async (role) => await roleCallback(role, Events.GuildRoleDelete));
        /**
         * Refreshes channels cache for the guild the event was triggered in.
         * @param {GuildChannel} channel The channel that has undergone some sort of change.
         * @param {Events} event Either `GuildEmojicommandCreate`, `GuildEmojiDelete`, or `GuildEmojiUpdate`.
        */          
        const channelCallback = async (channel, event) => {
            await generalEventCallback(
                async () => {
                    this.logger.log(`Event triggered in "${channel.guild.name}". Running...`, [{ text: event.toUpperCase(), colors: "variable" }]);        
                    await this.client.guilds.cache.get(channel.guild.id).channels.fetch();
                    return channel;
                }, channel, event);     
        };
        this.client.on(Events.ChannelCreate, async (channel) => await channelCallback(channel, Events.ChannelCreate));
        this.client.on(Events.ChannelDelete, async (channel) => await channelCallback(channel, Events.ChannelDelete));
        /**
         * Refreshes stickers cache for the guild the event was triggered in.
         * @param {Sticker} sticker The sticker that has undergone some sort of change.
         * @param {Events} event Either `GuildEmojiCreate`, `GuildEmojiDelete`, or `GuildEmojiUpdate`.
        */            
        const stickerCallback = async (sticker, event) => {
            await generalEventCallback(
                async () => {
                    this.logger.log(`Event triggered in "${sticker.guild.name}". Running...`, [{ text: event.toUpperCase(), colors: "variable" }]);        
                    await this.client.guilds.cache.get(sticker.guild.id).channels.fetch();
                    return sticker;
                }, sticker, event);  
        };   
        this.client.on(Events.GuildStickerCreate, async (sticker) => await stickerCallback(sticker, Events.GuildStickerCreate));
        this.client.on(Events.GuildStickerDelete, async (sticker) => await stickerCallback(sticker, Events.GuildStickerDelete));
        /**
         * Refreshes stickers cache for the guild the event was triggered in.
         * @param {Sticker} sticker The sticker that has undergone some sort of change.
         * @param {Events} event Either `GuildEmojiCreate`, `GuildEmojiDelete`, or `GuildEmojiUpdate`.
        */            
        const messageCallback = async (message, event) => {
            await generalEventCallback(
                async () => {
                    /*await*/ this.#parseMessageForAction(message, event);
                    // this.logger.log(`Event triggered in "${message.guild.name}". Running...`, [{ text: event.toUpperCase(), colors: "variable" }]);        
                    // if (message.guild != null && message.guild != undefined) await message.guild.channels.cache.get(message.channelId).messages.fetch();
                    return message;
                }, message, event);  
        };   
        this.client.on(Events.MessageCreate, async (message) => await messageCallback(message, Events.MessageCreate));
        this.client.on(Events.MessageDelete, async (message) => await messageCallback(message, Events.MessageDelete));
        this.client.on(Events.MessageUpdate, async (message) => await messageCallback(message, Events.MessageUpdate));
        /**
         * Refreshes stickers cache for the guild the event was triggered in.
         * @param {Sticker} sticker The sticker that has undergone some sort of change.
         * @param {Events} event Either `GuildEmojiCreate`, `GuildEmojiDelete`, or `GuildEmojiUpdate`.
        */            
        const reactCallback = async (message_reaction, event) => {
            await generalEventCallback(
                async () => {
                    /*await*/ this.#messageReactHandler(message_reaction, event);
                    // this.logger.log(`Event triggered in "${message.guild.name}". Running...`, [{ text: event.toUpperCase(), colors: "variable" }]);        
                    // if (message.guild != null && message.guild != undefined) await message.guild.channels.cache.get(message.channelId).messages.fetch();
                    return message_reaction;
                }, message_reaction, event);  
        };   
        this.client.on(Events.MessageReactionAdd, async (message_reaction) => await reactCallback(message_reaction, Events.MessageReactionAdd));
        this.client.on(Events.MessageReactionRemove, async (message_reaction) => await reactCallback(message_reaction, Events.MessageReactionRemove));
        /**
         * Runs once the client is finished setting up on Discord's end. It does the following:
         *  1. Refreshes guild cache
         *  2. Generates all global commands
         *  3. Update global commands with Discord
         *  4. Checks all guilds in the cache with the `bot` database to see if the
         * guild should still be handled by the bot.
         * 5. Cleans up with by checking which guild classes should be deleted internally.
         * 6. Starts the status-change interval.
         * **Note:** This event listener only runs once.
         * @param {Client} client The freshly assembled client (same as `this.client`).
         * @param {Events} event The `ClientReady` event.
        */            
        const clientReadyCallback = async (client, event) => {
            await generalEventCallback(
                async () => {
                    this.logger.log(`Starting setup process...`, [{ text: event.toUpperCase(), colors: "variable" }]);   
                    const initial_time = new Date().getTime();
                    this.#setupFileListeners();
                    await this.client.guilds.fetch();
                    await this.#addGlobalCommands();
                    await this.#updateGlobalCommands();
                    for (const value of this.client.guilds.cache.values()) {
                        await this.client.global_databases.get('dev').processGuild(value);    
                    }
                    await this.client.global_databases.get('dev').orientGuilds();    
                    this.startStatusInterval();

                    this.logger.log(`Completed in ${getPrettyTime(new Date().getTime() - initial_time, ['seconds', 'milliseconds'])}.`, [{ text: event.toUpperCase(), colors: "variable" }]);
                    this.status = true;        
                    return client;
                }, client, event);  
        };   
        this.client.once(Events.ClientReady, async (client) => await clientReadyCallback(client, Events.ClientReady));
        /**
         * Runs for every slash command sent to the bot. It does the following:
         *  1. Checks if the bot is busy and can't run commands (when `this.status = false`)
         *  2. Checks whether the command is a global or guild (local, selective, or custom) command or not.
         *      - If the command is a global command, it just retrieves it and moves on.
         *      - Else (the command is a guild command) then it checks if the server has a lock in place. If it does, `guild_class.checkForLock` throws an error.
         *  3. Checks whether the command by `interaction.commandName` actually exists or not.
         *  4. Checks if commands are globally locked. If they are, `checkGlobalLock` will throw an error.
         *  5. Executes the command.
         * @param {CommandInteraction} interaction The interaction generated by the user whom ran the command.
         * @param {Events} event The `InteractionCreate` event.
        */            
        const interactionCreateCallback = async (interaction, event) => {
            await generalEventCallback(
                async () => {
                    this.logger.log(`Event triggered. Running...`, [{ text: event.toUpperCase(), colors: "variable" }, ((interaction.guild == undefined) ? { text: 'DMs', colors: "fg_bright_blue" } : { text: interaction.guild.name.toUpperCase(), colors: "guild" }), { text: interaction.user.username.toUpperCase(), colors: "fg_bright_green" }]);        
                    if (!interaction.isChatInputCommand()) return;
                    try {
                        if (!this.status) throw new Error("Bot is being setup right now. Try again in a few seconds");
                        let command = null;
                        this.checkLimitedToTestServer(interaction);
                        if (this.client.global_commands.get(interaction.commandName) != undefined) {
                            command = this.client.global_commands.get(interaction.commandName);
                        } else {
                            const guild_class = this.guilds.get(interaction.guild.id);
                            command = guild_class.getCommand(interaction.commandName);   
                            guild_class.checkForLock(interaction); 
                        }
                        if (command == undefined || command == null) {
                            throw new Error(`no command matching ${interaction.commandName} was found.`);
                        } else {
                            this.checkGlobalLock(interaction);
                        }
                        const initial_time = new Date();
                        this.logger.log(`Executing...`, [{ text: event.toUpperCase(), colors: "variable" }, ((interaction.guild == undefined) ? { text: 'DMs', colors: "fg_bright_blue" } : { text: interaction.guild.name.toUpperCase(), colors: "guild" }), { text: interaction.user.username.toUpperCase(), colors: "fg_bright_green" }, { text: interaction.commandName.toUpperCase().replaceAll(/[-_]/g, " "), colors: "command" }]);
                        await command.execute(interaction);
                        this.logger.log(`Finished in  ${getPrettyTime(new Date().getTime() - initial_time, ['seconds', 'milliseconds'])}.`, [{ text: event.toUpperCase(), colors: "variable" }, ((interaction.guild == undefined) ? { text: 'DMs', colors: "fg_bright_blue" } : { text: interaction.guild.name.toUpperCase(), colors: "guild" }), { text: interaction.user.username.toUpperCase(), colors: "fg_bright_green" }, { text: interaction.commandName.toUpperCase().replaceAll(/[-_]/g, " "), colors: "command" }]);
                    } catch (e) {
                        await reply(interaction, { content: `${e}` }, true);
                        throw e;
                    }
                    return interaction;
                }, interaction, event);  
        };   
        this.client.on(Events.InteractionCreate, async (interaction) => await interactionCreateCallback(interaction, Events.InteractionCreate));
    }

    /**
     * Sets up and runs the bot by doing the following:
     *  1. Starts all event listeners.
     *  2. Logs into discord with it's token.
     * @override
    */            
    async setup() {
        this.#startBotEventListeners();
        await this.client.login(getToken());
    } 

    /*eslint no-fallthrough: "off"*/
    async #parseMessageForAction(message, event) {
        if (event == Events.MessageDelete || message.webhookId != null) return;
        this.logger.log(message.content, { text: 'PARSE MESSAGE FOR ACTION', colors: ['function']});
        const dev_database = this.client.global_databases.get('dev');
        let message_content_cpy = message.content;
        let emoji_info = null;
        let emoji_match = null;
        let emoji_obj = null;
        let emoji_res = null;
        let prev_send_loc = null;
        let was_something_sent = false;
        let needs_webhook = false;
        let webhook = null;
        let send = async () => {};
        let checkIfNeedsWebhook = () => {};
        // console.log(message.content);
        try {
            switch (true) {

            // CARET REACTIOnS
                case message.content.startsWith('^'):
                    emoji_match = message.content.slice(1).matchAll(/[^\s<>^]*/g);
                    emoji_match = [...emoji_match].filter(el => el != '' && el?.[0]).map(el => el[0]);
                    // console.log("EMOJI MATCH", emoji_match);
                    if (emoji_match.length == 0) return;
                    send = async () => {
                        if (emoji_obj == null) return;
                        if (!was_something_sent) was_something_sent = true;
                        console.log(`Attempting to send ${emoji_obj} to ${prev_send_loc}`);
                        try {
                            if (prev_send_loc == null) /*await*/ [...(await message.channel.messages.fetch({limit: 2}))].pop().pop().react(emoji_obj);
                            else /*await*/ /*console.log((await message.channel.messages.fetch(prev_send_loc.trim())))*/ (await message.channel.messages.fetch(prev_send_loc.trim())).react(emoji_obj);
                        } catch (e) {
                            this.logger.error(e, [{ text: `Cannot find message ${prev_send_loc}`, colors: "fun" }]); /*throw new Error('❔');*/
                        }
                    }
                    for (const em of emoji_match) {
                        emoji_info = em.match(/([\d:]+)/)?.[0];
                        // console.log("1::::::::", em, emoji_info);
                        if (emoji_info != undefined && emoji_info.length > 0) {
                            if (!isNaN(parseInt(emoji_info.replaceAll(":", "").trim(), 10))) {
                                if (emoji_info.includes(":")) {
                                    try { const temp = await dev_database.getEmojiById(emoji_info.replaceAll(":", "").trim()); 
                                          emoji_obj = temp; }
                                    catch (e) {this.logger.error(e, [{ text: 'PARSE MESSAGE FOR ACTION', colors: "fun" }]); /*throw new Error('❔');*/ }
                                    await send();
                                    continue
                                } else {
                                    prev_send_loc = emoji_info.trim();
                                    continue;
                                }
                            }
                        }
                        emoji_info = em.match(/(?:\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g)?.[0];
                        // console.log("1.5::::::", em, emoji_info);
                        if (emoji_info != undefined && emoji_info.length > 0) {
                            emoji_obj = emoji_info;
                            await send();
                            continue;
                        }
                        emoji_info = em.match(/[^:\s]+/)?.[0];
                        // console.log("2::::::", em, emoji_info);
                        if (emoji_info != undefined && emoji_info.length > 0) {
                            try { const temp = await dev_database.getEmojiByName(emoji_info.trim(), false); 
                                  emoji_obj = temp; }
                            catch (e) {this.logger.error(e, [{ text: 'PARSE MESSAGE FOR ACTION', colors: "fun" }]); /*throw new Error('❔');*/ }
                            await send();
                            continue;
                        }
                        if (emoji_obj != null) await send();
                    }
                    if (was_something_sent) await message.delete();
                    break;
            
            // WEBHOOK REACTIONS
                case /(?:(?::[^:\s]+:)|(?:\d+))/.test(message.content):
                    if (message.member?.premiumSince != null) return;
                    checkIfNeedsWebhook = (emoji_info_v) => {
                        const result = emoji_info_v.animated || emoji_info_v.guild_id != message?.guild?.id;
                        if (!needs_webhook && result) needs_webhook = true;
                        return result;
                    }
                    emoji_match = [...message.content.matchAll(/(?:<?a?:(?:[^:\s]+:\d*:?>?)|(?:\d+))/g)].map(el => el[0]).filter(el => el.length > 0).reduce((acc, el) => {
                        if (!acc.includes(el)) acc.push(el); return acc;
                    }, []);
                    // console.log(`${message.content} passed with matches ${emoji_match}!`);
                    for (const emoji of emoji_match) {
                        try {
                            // console.log("current str:", message_content_cpy);
                            if (/<a?:[^\s:]+:\d+>/.test(emoji)) {
                                emoji_info = await dev_database.getEmojiById(emoji.match(/\d+/)[0]);
                                checkIfNeedsWebhook(emoji_info);
                            }
                            if (!isNaN(parseInt(emoji.replaceAll(":", "").trim(), 10))) {
                                emoji_info = await dev_database.getEmojiById(emoji.replaceAll(":", "").trim());
                                emoji_res = checkIfNeedsWebhook(emoji_info);
                                if (emoji_res) {
                                    message_content_cpy = message_content_cpy.replaceAll(emoji, `<${(emoji_info.animated) ? "a" : ""}:${emoji_info.name}:${emoji_info.id}>`);
                                }
                                // console.log(`found emoji by Id`, emoji_info.name);
                            } else {
                                emoji_info = await dev_database.getEmojiByName(emoji.replaceAll(":", "").trim());
                                emoji_res = checkIfNeedsWebhook(emoji_info);
                                if (emoji_res) {
                                    message_content_cpy = message_content_cpy.replaceAll(emoji, `<${(emoji_info.animated) ? "a" : ""}:${emoji_info.name}:${emoji_info.id}>`);
                                }
                                // console.log(`found emoji by Name`, emoji_info.name);
                            }
                        } catch (e) {
                           this.logger.error(e, [{ text: 'PARSE MESSAGE FOR ACTION', colors: "fun" }]); /*throw new Error('❔');*/
                        }
                    }
                    // console.log(`RESULTS: needs webhook? ${needs_webhook}`, message_content_cpy);
                    if (!needs_webhook) break;
                    webhook = await message.channel.createWebhook({
                        name: message.member.displayName,
                        avatar: message.member.user.avatarURL(),
                    });
                    console.log(webhook);
                    await message.delete();
                    await webhook.send({
                        content: message_content_cpy,
                    })
                    await webhook.delete();
            }
        } catch (e) {
            // await message.react(e.message);
            this.logger.error(e, [{ text: 'PARSE MESSAGE FOR ACTION', colors: "fun" }]); }
    }
    async #messageReactHandler(message_reaction, event) {
        // const message_reaction_emoji = message_reaction.emoji;
        const is_x = (msg=message_reaction.emoji.name) => {
            return (
                (msg == '❌') ||
                (msg == '❎') ||
                (msg == '✖️') ||
                (msg == '🗑️')
            );
        }
        const is_spoiled = (msg=message_reaction.emoji.name) => {
            return (
                (msg == '⬛') ||
                (msg == '◼️') ||
                (msg == '◾') ||
                (msg == '▪️')
            );
        }
        const message = await this.client.guilds.cache.get(message_reaction.message.guildId).channels.cache.get(message_reaction.message.channelId).messages.fetch(message_reaction.message.id);
        if (is_x() && event != Events.MessageReactionRemove) {
            if (message.webhookId != null || message.author.id == this.client.user.id) {
                await message.delete();
                return;
            }
            // console.log(message_reaction.message.reactions);
            // console.log((await message.reactions.cache.get(message_reaction.emoji.name).users.fetch()));
        } else if (is_spoiled()) {
            if (message.author.id == this.client.user.id) {
                console.log("spoiling with", event)
                if (event == Events.MessageReactionAdd) {
                    console.log("doing stuff in spoil");
                    if (message.content.startsWith('||') && message.content.endsWith('||')) return;
                    await message.edit(`||${message.content}||`);
                } else if (event == Events.MessageReactionRemove) {
                    console.log("doing stuff in unspoil");
                    let [start_index, end_index] = [0, message.content.length-1];
                    for (let i = 0; i < message.content.length; i++) {
                        let edit_flag = false;
                        if (message.content[start_index] == '|') {
                            start_index++;
                            edit_flag = true;
                        }
                        if (message.content[end_index] == '|') {
                            end_index--;
                            edit_flag = true;
                        }
                        if (!edit_flag) break;
                    }
                    await message.edit(message.content.slice(start_index, end_index));
                }
            }
        }
    }
}

// -----------------------EXPORTS-----------------------
module.exports = { M_Bot };