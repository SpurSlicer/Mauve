// -----------------------IMPORTS-----------------------
const { readFileSync, readdirSync } = require('node:fs');
const { fork } = require('node:child_process');


// -----------------------GLOBALS-----------------------
/**
 * An array of required JSON files that every guild must have.
 * @type {[String]}
 */
const required_jsons = [ "settings"];

/**
 * Check if a user is in the devs list in main_config.json.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @returns {Boolean} `true` means the user that sent `interaction` is a dev.
 */
function isDev(interaction) {
    const devs = JSON.parse(readFileSync(`./main_config.json`, "utf8")).devs;
    for (const dev of devs) {
        if (dev.user_id == interaction.user.id) return true;
    }
    return false;
}

/**
 * Check if a user is in the owners list for the guild specified by `interaction`.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @returns {Promise<Boolean>} `true` means the user that sent `interaction` is an owner.
 */
async function isOwner(interaction) {
    const position = await interaction.guild.databases.get('admin').getPosition(interaction.user.id);
    if (position == null || position == 'ADMIN') return false;
    else return true;
}

/**
 * Check if a user is the server owner for the guild specified by `interaction`.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @returns {Promise<Boolean>} `true` means the user that sent `interaction` is the server owner.
 */
async function isServerOwner(interaction) {
    return interaction.user.id == interaction.guild.ownerId;
}


/**
 * Check if a user is in the admins list for the guild specified by `interaction`.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @returns {Promise<Boolean>} `true` means the user that sent `interaction` is an admin.
 */
async function isAdmin(interaction) {
    const position = await interaction.guild.databases.get('admin').getPosition(interaction.user.id);
    if (position == null) return false;
    else return true;
}

/**
 * Check if a user is either an admin, owner, or server owner.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @returns {Promise<Boolean>} `true` means the user has sudo perms.
 */
async function checkSudoPerms(interaction) {
    return await isOwner(interaction) || await isAdmin(interaction) || await isServerOwner(interaction);
}

/**
 * Shuts down the bot by throwing a SIGINT signal for the signal listeners
 * in `index.js` to handle.
 */
async function shutdownBot() {
    process.kill(process.pid, "SIGINT");
    await new Promise((resolve) => {
        process.on('exit', resolve);
    });
}

/**
 * Restarts the bot by first throwing a SIGINT signal for the signal listeners
 * in `index.js` to handle followed by spawning a new process on the exit of the 
 * old one to effectively "restart" the bot.
 */
async function restartBot() {
    process.kill(process.pid, "SIGINT");
    await new Promise((resolve) => {
        process.on('exit', () => {
            const child = fork("./index.js"); 
            while (typeof child !== 'number');
            resolve();
        });
    });
}

/**
 * Runs the `update_guilds.js` script by spawning a fork of it and waiting for it to exit.
 * This goes through and ensures all jsons given by any guild passed match the template
 * JSONs found for them. It does the same thing as {@link cleanJsonByComparison} but
 * at a larger scale.
 * @param {([String]|null)} guild_ids An array of guild IDs to be cleaned. A `null` value 
 * will make the script clean every guild the bot is in.
 */
async function fixGuildData(guild_ids=null) {
    if (guild_ids != null) {
        if (!Array.isArray(guild_ids)) guild_ids = [guild_ids];
    }
    const child = (guild_ids != null) ? fork("./src/tools/update_guilds.js", guild_ids) : fork("./src/tools/update_guilds.js");
    await new Promise((resolve) => {
        child.on('exit', resolve);
    });
}

/**
 * Formats `name` by removing underscores and hyphens; it then capitalizes the first character of
 * every word found. This is commonly used for printing to discord and for generating
 * prettier file names for string options in commands.
 * @param {String} name The string to be formatted.
 * @returns {String}
 */
function formatName(name) {
    const words = name.split(/[_-]/g);
    let formatted_words = [];
    for (const word of words) {
        formatted_words.push(word.charAt(0).toUpperCase() + word.slice(1));
    }
    let formatted_word = "";
    for (let i = 0; i < formatted_words.length; i++) {
        if (i == formatted_words.length - 1) {
            formatted_word += formatted_words[i];
            continue;
        }
        formatted_word += formatted_words[i] + " ";
    }
    return formatted_word;
}

/**
 * Reads all selective commands from `./commands/selective`, formats their names,
 * and returns either an array of either strings or objects: objects are for the slash command
 * builder whereas strings are for general purpose.
 * @param {Boolean} [format=false] `true` means to return an array of objects for a 
 * a slash command builder to interpret. This is `false` by defualt.
 * @returns {([String]|[{}])}
 */
function getSelectiveCommandNames(format=false) {
    const selective_command_names = readdirSync(`./commands/selective`, 'utf8');
    const formatted_selective_command_names = [];
    for (const selective_command_name of selective_command_names) {
        if (selective_command_name == '.gitkeep') continue;
        const formatted_word = formatName(selective_command_name);
        if (format) formatted_selective_command_names.push({ name: formatted_word, value: selective_command_name });
        else formatted_selective_command_names.push(formatted_word);
    }
    return formatted_selective_command_names;
}

/**
 * Returns the filename from a path by removing the entire path and returning
 * just the filename without the extension (unless specified otherwise).
 * @param {String} filename The filename to be extracted.
 * @param {Boolean} [include_extension=false] `true` means include the file extension. This is `false` by default.
 * @returns {String}
 */
function getFilename(filename, include_extension=false) {
    const split_char = (filename.includes("/")) ? "/" : "\\";
    if (include_extension) return filename.split(split_char).pop();
    else return filename.split(split_char).pop().split(/\./g)[0];
}

/**
 * Get's the relative filepath to `filename` from `current_directory`.
 * @param {String} filename The filename to be found.
 * @param {String} current_directory The directory to start searching.
 * @returns {(String|null)} `null` means the file wasn't found.
 */
function getFilePath(filename, current_directory) {
    const dirs = readdirSync(current_directory, 'utf8');
    for (const dir of dirs) {
        if (dir == '.gitkeep') continue;
        if (dir == filename) return `${current_directory}/${filename}`;
        else if (!dir.includes(".")) {
            const discovered_dir = getFilePath(filename,`${current_directory}/${dir}`);
            if (discovered_dir != null) return discovered_dir;
        }
    }
    return null;
}

/**
 * Get's the foldername of whatever directory `filename` is in.
 * @param {String} filename The filename the foldername returned contains.
 * @returns {String}
 */
function getFoldernameByFilename(filename) {
    const split_char = (filename.includes("/")) ? "/" : "\\";
    const paths = filename.split(split_char);
    return paths[paths.length-2];
}

/**
 * Get's all of the current guilds the bot has in its file system.
 * @returns {[String]}
 */
function getCurrentGuildIds() {
    return readdirSync(`./guilds/`, 'utf8').filter(file => !file.includes(".git"));
}

/**
 * Gets all log filenames for a given guild index by `guild_id`. This returns either an
 * array of strings or objects; objects are formatted for the slash command builder.
 * @param {String} guild_id The ID of the guild whose log files are to be searched for.
 * @param {Boolean} [format=false] `true` means to format for the slash command builder (array of objects).
 * This is `false` by default.
 * @returns {([String]|[{}])}
 */
function getLogFilenames(guild_id, format=false) {
    const settings_json = JSON.parse(readFileSync(`./guilds/${guild_id}/jsons/settings.json`));
    if (settings_json.selective_commands == undefined) throw new Error("`settings.json` is broken! Add in the `selective_commands` or fix it with `/sudo-fix`");
    const disabled_logs = [];
    for (const disabled_log_name in settings_json.selective_commands) {
        if (!settings_json.selective_commands[disabled_log_name]) disabled_logs.push(disabled_log_name + ".log");
    }
    const all_log_names = [];
    const extLogFiles = readdirSync(`./guilds/${guild_id}/logs`).filter(file => file.endsWith('.log'));
    for (const file of extLogFiles) {
        if (file == '.gitkeep') continue;
        if (disabled_logs.includes(file)) continue;
        (format) ? all_log_names.push({ name: file, value: file }) : all_log_names.push(toString(file));
    }
    return all_log_names;
}

/**
 * Gets all database filenames for a given guild index by `guild_id`. This returns either an
 * array of strings or objects; objects are formatted for the slash command builder.
 * @param {String} guild_id The ID of the guild whose log files are to be searched for.
 * @param {Boolean} [format=false] `true` means to format for the slash command builder (array of objects).
 * This is `false` by default.
 * @returns {([String]|[{}])}
 */
function getDatabaseFileNames(guild_id, format=false) {
    const settings_json = JSON.parse(readFileSync(`./guilds/${guild_id}/jsons/settings.json`));
    if (settings_json.selective_commands == undefined) throw new Error("`settings.json` is broken! Add in the `selective_commands` or fix it with `/sudo-fix`");
    const disabled_dbs = [];
    for (const disabled_db_name in settings_json.selective_commands) {
        if (!settings_json.selective_commands[disabled_db_name]) disabled_dbs.push(disabled_db_name + ".sqlite");
    }
    const all_database_names = [];
    const extDatabasesFiles = readdirSync(`./guilds/${guild_id}/databases`).filter(file => file.endsWith('.sqlite'));
    for (const file of extDatabasesFiles) {
        if (file == '.gitkeep') continue;
        if (disabled_dbs.includes(file)) continue;
        (format) ? all_database_names.push({ name: file, value: file }) : all_database_names.push(toString(file));
    }
    return all_database_names;
}

/**
 * Gets all JSON filenames for a given guild index by `guild_id`. This returns either an
 * array of strings or objects; objects are formatted for the slash command builder.
 * @param {String} guild_id The ID of the guild whose log files are to be searched for.
 * @param {Boolean} [format=false] `true` means to format for the slash command builder (array of objects).
 * This is `false` by default.
 * @returns {([String]|[{}])}
 */
function getJsonFileNames(guild_id, format=false) {
    const settings_json = JSON.parse(readFileSync(`./guilds/${guild_id}/jsons/settings.json`));
    if (settings_json.selective_commands == undefined) throw new Error("`settings.json` is broken! Add in the `selective_commands` or fix it with `/sudo-fix`");
    const disabled_jsons = [];
    for (const disabled_json_name in settings_json.selective_commands) {
        if (!settings_json.selective_commands[disabled_json_name]) disabled_jsons.push(disabled_json_name + ".json");
    }
    const all_json_names = [];
    const extJsonFiles = readdirSync(`./guilds/${guild_id}/jsons`).filter(file => file.endsWith('.json'));
    for (const file of extJsonFiles) {
        if (file == '.gitkeep') continue;
        if (disabled_jsons.includes(file)) continue;
        (format) ? all_json_names.push({ name: file, value: file }) : all_json_names.push(toString(file));
    }
    return all_json_names;
}

/**
 * Gets all filenames (logs, databases, JSONs) for a given guild index by `guild_id`. This returns either an
 * array of strings or objects; objects are formatted for the slash command builder.
 * @param {String} guild_id The ID of the guild whose log files are to be searched for.
 * @param {Boolean} [format=false] `true` means to format for the slash command builder (array of objects).
 * This is `false` by default.
 * @param {Boolean} [dividers=false] `true` means to add in `"----------"` between file type transitions in the array;
 * this is used for the slash command builder for aesthetic purposes. This is `false` by default.
 * @returns {([String]|[{}])}
 */
function getAllFilenames(guild_id, format=false, dividers=false) {
    let all_filenames = null;
    let new_filenames = null;
    const addFilenames = () => {
        if (new_filenames.length > 0) {
            if (dividers) {
                if (format) all_filenames.push({"name": "----------", "value": "-"});
                else all_filenames.push("----------");
            }
            all_filenames = all_filenames.concat(new_filenames);
        }
    };
    all_filenames = getJsonFileNames(guild_id, format);
    new_filenames = getDatabaseFileNames(guild_id, format);
    addFilenames();
    new_filenames = getLogFilenames(guild_id,format);
    addFilenames();
    return all_filenames;
}

/**
 * Get's all contents of a log file and formats them to be sent in a Discord message.
 * If a guild_id, role_id, or user_id is found, it will attempt to replace that with the name
 * rather than the ID.
 * @param {String} path Path to the log file to be read.
 * @param {(CommandInteraction|Guild)} interaction The command interaction invoked by a user or the Discord bot client.
 * @param {Boolean} is_client Indicates if the interaction is the client object or not. `true` means it's the client.
 * @param {(String|null)} guild_id Used when `is_client = true`. It isn't required (i.e., can be `null`) when that is not the case.
 * @returns {String}
 */
function getLogFileContents(path, interaction, is_client=false, guild_id=false) {
    if (!path.endsWith(".log")) path = path + ".log";
    let log_data = readFileSync(path, 'utf8');
    try {
        const guild_ids = new Set(log_data.match(/guild_id:(\d*)/).slice(1));
        for (const guild_id of guild_ids) {
            if (is_client) log_data = log_data.replaceAll(`guild_id:${guild_id}`, interaction.guilds.cache.get(guild_id).name);
            else log_data = log_data.replaceAll(`guild_id:${guild_id}`, interaction.client.guilds.cache.get(guild_id).name);
        }
    } catch (e) { e == e;/*console.log(`[ERROR] [LOG CONTENTS] couldn't find guild ids`)*/ }
    try {
        const role_ids = new Set(log_data.match(/role_id:(\d*)/).slice(1));
        for (const role_id of role_ids) {
            if (is_client) log_data = log_data.replaceAll(`role_id:${role_id}`, interaction.guilds.cache.get(guild_id).roles.cache.get(role_id).name);
            else log_data = log_data.replaceAll(`role_id:${role_id}`, interaction.guild.roles.cache.get(role_id).name);
        }
    } catch (e) { e == e;/*console.log(`[ERROR] [LOG CONTENTS] couldn't find role ids`)*/ }
    try {
        const user_ids = new Set(log_data.match(/user_id:(\d*)/).slice(1));
        for (const user_id of user_ids) {
            if (is_client) log_data = log_data.replaceAll(`user_id:${user_id}`, interaction.guilds.cache.get(guild_id).users.cache.get(user_id).name);
            else log_data = log_data.replaceAll(`user_id:${user_id}`, interaction.guild.users.cache.get(user_id).name);
        }
    } catch (e) { e == e;/*console.log(`[ERROR] [LOG CONTENTS] couldn't find user ids`)*/ }
    if (log_data == '') log_data = 'EMPTY';
    return `\`\`\`\n${log_data}\n\`\`\``;
}

/**
 * Finds the ID (specified with `purpose`) in a message to make sure it is a valid id. 
 * @todo maybe add recursive message searching to this.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {String} message The message the ID is to be found.
 * @param {"user_id"|"role_id"|"guild_id"|"channel_id"} purpose The kind of ID `message` is supposed to be. This is
 * `"user_id"` by default.
 * @returns {Promise<String>}
 */
async function extractIdInfoFromMessage(interaction, message, purpose='user_id') {
    if (/[<@!#&>]*(\d+)[<@!#&>]*/.test(message)) {
        return message.match(/[<@!#&>]*(\d+)[<@!#&>]*/)[1];
    } else {
        let id = null;
        switch (purpose) {
            case "user_id":
                await interaction.guild.members.fetch();
                id =  interaction.guild.members.cache.find(member => member.user.username == message)?.user?.id;
                if (id == undefined) throw new Error(`couldn't find member ${message}. Make sure it's  not their server nickname, that it's spelled correctly, or just use an id or ping`);
                return id;
            case "role_id":await interaction.guild.roles.fetch;
                id =  interaction.guild.roles.cache.find(role => role.name == message)?.id;
                if (id == undefined) throw new Error(`couldn't find role ${message}. Make sure it's spelled correctly or use an id or ping`);
                return id;
            case "guild_id":
                await interaction.client.guilds.fetch();
                id = interaction.client.guilds.cache.find(guild => guild.name == message)?.id;
                if (id == undefined) throw new Error(`couldn't find that guild. It might not exist anymore`);
            case "channel_id":
                await interaction.guild.channels.fetch();
                id = interaction.guild.channels.cache.find(channel => channel.name == message)?.id;
                if (id == undefined) throw new Error(`couldn't find that message. It might not exist anymore`);
                return id;
            default:
                throw new Error("id type not found");
        }
    }
}

/**
 * Formats `time` to be in as many time units as possible. These include the following
 * starting from longest to shortest (All of these are valid to be used in the `percision` array):
 *  - galactic years
 *  - millennia
 *  - centuries
 *  - decades
 *  - years
 *  - months
 *  - weeks
 *  - days
 *  - hours
 *  - minutes
 *  - seconds
 *  - milliseconds
 * `percision` specifies specific time units to be used if a more terse time value is desired.
 * @param {Number} time The time *in Milliseconds* to be converted.
 * @param {([String]|null)} [precision=null] An array of percision strings (see above for valid strings).
 * `null` means every percision value can be used; `null` is the default.
 * @returns {String}
 */
function getPrettyTime(time, precision=null) {
    const times = new Map([
        ["galactic years", 225*10*10*10*12*2629800000],
        ["millennia", 10*10*10*12*2629800000],
        ["centuries", 10*10*12*2629800000],
        ["decades", 10*12*2629800000],
        ["years", 12*2629800000],
        ["months", 2629800000],
        ["weeks", 7*24*60*60*1000],
        ["days", 24*60*60*1000],
        ["hours", 60*60*1000],
        ["minutes", 60*1000],
        ["seconds", 1000],
        ["milliseconds", 1]
    ]);
    const final_times = [];
    for (const [key, value] of times) {
        if (precision != null && !precision.includes(key)) continue;
        const immediate_time_val = Math.floor(time / value);
        time -= immediate_time_val * value;
        if (immediate_time_val != 0 && !Number.isNaN(immediate_time_val)) {
            final_times.push(`${immediate_time_val} ${(immediate_time_val == 1) ? key.substring(0, key.length - 1) : key}`);
        } 
    }
    let final_time = "";
    for (let i = 0; i < final_times.length; i++) {
        if (i == final_times.length-1) {
            if (final_time == "") final_time += final_times[i];
            else final_time += `and ${final_times[i]}`;
        } else {
            final_time += `${final_times[i]}, `;
        }
    }
    if (final_times.length == 2) final_time = final_time.replaceAll(/,/g, "");
    return (final_time == '') ? `Now` : final_time;
}

// -----------------------EXPORTS-----------------------
module.exports = { 
                    required_jsons,
                    isDev,
                    isOwner, 
                    isServerOwner,
                    isAdmin, 
                    checkSudoPerms,
                    shutdownBot,
                    restartBot,
                    fixGuildData,
                    formatName,
                    getSelectiveCommandNames,
                    getFilename,
                    getFilePath,
                    getFoldernameByFilename,
                    getCurrentGuildIds,
                    getLogFilenames,
                    getDatabaseFileNames,
                    getJsonFileNames,
                    getAllFilenames,
                    getLogFileContents,
                    extractIdInfoFromMessage,
                    getPrettyTime,
                };