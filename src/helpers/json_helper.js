// -----------------------IMPORTS-----------------------
const { CommandInteraction, Client } = require('discord.js');
const { readdirSync, readFileSync, writeFileSync, appendFileSync } = require('node:fs');
const { checkId } = require('./discord_helper');
const { getLogFileContents, formatName, getPrettyTime, getFilename } = require('./general_helper');
const { M_BaseDatabase } = require('../classes/base_database');


/**
 * Searches through `dir` recursively to find .json files. Found files are
 * converted to objects and placed in a map indexed by their filename.
 * This should only ever be called by {@link findAllTemplateJsons}.
 * @todo verify the link statement above
 * @param {String} dir The directory to start searching for jsons in.
 * @param {Map<String, {}>} jsons The map to be modified.
 */
function findJsons(dir, jsons) {
    const files = readdirSync(dir, 'utf8');
    for (const file of files) {
        if (file == '.gitkeep') continue;
        if (file.endsWith(".json")) {
            jsons.set(file, readFileSync(`${dir}/${file}`, 'utf8'));
        } else if (file.includes(".")) continue;
        else findJsons(`${dir}/${file}`, jsons);
    }
}

/**
 * Searches through `./commands/` and the `custom_commands` of the guild that
 * `interaction` was sent from and runs {@link findJsons} to eventually return
 * a map of all found template jsons.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @returns {Map<String, {}>}
 */
function findAllTemplateJsons(interaction) {
    const jsons = new Map();
    findJsons(`./commands`, jsons);
    findJsons(`./guilds/${interaction.guild.id}/custom_commands`, jsons);
    return jsons;
}

/**
 * Goes through an object and orders all properties alphabetically.
 * @param {{}} json The object to be sorted.
 * @returns  {{}}
 */
function sortJson(json) {
    const sorted_json = {};
    for (const child in json) {
        if (Array.isArray(json[child])) {
            const sorted_elements = [];
            for (const element of json[child]) {
                sorted_elements.push(sortJson(element));
            }
            sorted_json[child] = sorted_elements;
        } else if (typeof json[child] == 'object') {
            sorted_json[child] = sortJson(json[child]);
        } else {
            sorted_json[child] = json[child];
        }
    }
    return Object.keys(sorted_json).sort().reduce((result, key) => (result[key] = sorted_json[key], result), {});
}

/**
 * Runs a file-to-json conversion function for the following file types:
 *  - `.sqlite`
 *  - `.json`
 *  - `.log`
 * @param {String} file Path to the file to be converted. 
 * @param {Client} client Discord bot client.
 * @param {{guild_id: (String|null), database: M_BaseDatabase}} params 
 * @returns {Promise<String>}
 */
async function jsonifyFile(file, client, params={ guild_id: null, database: null }) {
    switch (file.split(/\./g).pop()) {
        case "sqlite":
            return await getJsonifiedDatabase(client, params.database, true, params.guild_id);
        case "json":
            return getPrettyJsonText(JSON.parse(readFileSync(file, 'utf8')), client, true, params.guild_id);
        case "log":
            return getLogFileContents(file, client, true, params.guild_id);
        default:
            return "";
    }
}

/**
 * Converts a database table to an object. It filters properties that aren't appropriate
 * (`id` if the table is titled *admins*; `createdAt`; `updatedAt`). If a property is named
 * `id`, it will attempt to label it as a role_id, user_id, or channel_id if it's able.
 * @param {(CommandInteraction|Client)} interaction The command interaction invoked by a user.
 * @param {M_BaseDatabase} database The database class to jsonify.
 * @param {Boolean} is_client Indicates if the interaction is the client object or not. `true` means it's the client.
 * @param {(String|null)} guild_id Used when `is_client = true`. It isn't required (i.e., can be `null`) when that is not the case.
 * @returns {Promise<String>}
 */
async function getJsonifiedDatabase(interaction, database, is_client=false, guild_id=null) {
    const contents = await database.table.findAll();
    const database_obj = { };
    const name = formatName(database.name) + " Database";
    database_obj[name] = [];
    for (const content of contents) {
        const database_entry = {};
        for (const child in content.dataValues) {
            if ((child == 'id' && database.name != 'admins') || child == 'createdAt' || child == 'updatedAt') continue;
            else {if (child == 'id') {
                if (interaction.guild.roles.cache.has(content.dataValues[child]))
                    database_entry['role_id'] = content.dataValues.id;
                else if (interaction.guild.members.cache.has(content.dataValues[child]))
                    database_entry['user_id'] = content.dataValues.id;
                else if (interaction.guild.channels.cache.has(content.dataValues[child]))
                    database_entry['channel_id'] = content.dataValues.id;
                else
                    database_entry[child] = content[child];
            }
                if (`${content[child]}`.includes('/')) database_entry[child] = getFilename(content[child], true);
                else database_entry[child] = content[child];
            }
        }
        database_obj[name].push(database_entry);    
    }
    return `${getPrettyJsonText(database_obj, interaction, is_client, guild_id)}`;
}

/**
 * Formats a JSON to be presentable for sending to discord in a code block.
 * It automatically searches for user, owner, role, channel, and guild IDs
 * and adds in the name if possible as a new property (e.g., user_name = ...)
 * Time is formatted as shown here {@link getPrettyTime}.
 * @param {({}|String)} json_obj_or_file The object or JSON filename to be printed.
 * @param {(CommandInteraction|Guild)} interaction The command interaction invoked by a user or the Discord bot client.
 * @param {Boolean} is_client Whether `interaction` is the client or an interaction. `true` means it's the client. 
 * @param {(String|null)} guild_id The ID to be used for formatting reference when the guild is passed. If the interaction isn't the client
 * this should be `null`.
 * @param {Boolean} boring Determines whether the `nameFormatCallback` should be ran or not. `true` means it will not run. It's `false` by default.
 * @returns {String}
 */
function getPrettyJsonText(json_obj_or_file, interaction, is_client=false, guild_id=null, boring=false) {
    if (is_client && guild_id == null) {
        throw new Error("Cannot get json with null guild id!!");
    }
    let nameFormatCallback = (prefix, id) => {
        try {
            const guild = (is_client) ? interaction.guilds.cache.get(guild_id) : interaction.guild;
            let value = undefined;
            if (prefix.toLowerCase().includes("user")) {
                value = guild.members.cache.get(id)?.user?.username;
                if (value != undefined) {
                    return [prefix + "_name", `@${value}`];
                }
            } else if (prefix.toLowerCase().includes("owner")) {
                value = guild.members.cache.get(guild.ownerId)?.user?.username;
                if (value != undefined) {
                    return [prefix + "_name", `@${value}`];
                }
            } else if (prefix.toLowerCase().includes("role")) {
                value = guild.roles.cache.get(id)?.name;
                if (value != undefined) {
                    return [prefix + "_name", `@${value}`];
                }
            } else if (prefix.toLowerCase().includes("channel")) {
                value = guild.channels.cache.get(id)?.name;
                if (value != undefined) {
                    return [prefix + "_name", `#${value}`];
                }
            } else if (prefix.toLowerCase().includes("guild") || prefix.toLowerCase().includes("server")) {
                value = guild.name;
                if (value != undefined) {
                    return [prefix + "_name", `#${value}`];
                }
            } else if (prefix.toLowerCase().includes("time")) {
                value = getPrettyTime(id - new Date().getTime(), ['seconds', 'minutes', 'hours', 'days']);
                if (value != undefined) {
                    return [prefix + "_name", `${value}`];
                }
            }
            return ["undefined", undefined];
        } catch (e) {
            console.log(e);
            return ["undefined", undefined];
        }
    };
    const name_generator = (obj) => {
        if (Array.isArray(obj)) {
            const obj_array = [];
            for (const child_obj in obj) {
                obj_array.push(name_generator(obj[child_obj]));
            }
            return obj_array;
        } else if (typeof obj == "object") {
            const names_and_ids = new Map();
            for (const child in obj) {
                if (Array.isArray(obj[child])) {
                    obj[child] = name_generator(obj[child]);
                } else {
                    if (child.endsWith("_id")) {
                        const key = child.replace(/_id/g, "");
                        names_and_ids.set(key, obj[child]);
                    }
                }
            }
            if (!boring) {
                for (const [key, value] of names_and_ids) {
                    if (key.endsWith("_name")) continue;
                    const [new_key, new_value] = nameFormatCallback(key, value);
                    obj[new_key] = new_value; 
                }
            }
            return obj;
        } else {
            return obj;
            // throw new Error(`${typeof obj} isn't recognized in json ${JSON.stringify(json_obj_or_file)}`);
        }
    };
    const json = (typeof json_obj_or_file == "object") 
                ? name_generator(json_obj_or_file) 
                : name_generator(JSON.parse(readFileSync(`./guilds/${(is_client) ? guild_id : interaction.guild.id}/jsons/${json_obj_or_file}${(json_obj_or_file.endsWith(".json") ? "" : ".json")}`)));
    return `\`\`\`json\n${JSON.stringify(sortJson(json), null, 2).trim()}\n\`\`\``;
}

/**
 * Recursively searches through an object and replaces all instances of the property
 * `property` with `value`. If `outer_most_flag` is `true`, it will add the property to
 * the base object.
 * @param {String} property The property to be searched for.
 * @param {*} value The value to be assigned to `property`.
 * @param {{}} json The object to be modified.
 * @param {Boolean} [outer_most_flag=true] `true` means the value will be appended to the base
 * of the object if the value isn't found. 
 * @returns {{}}
 */
function searchAndOverwriteJsonValue(property, value, json, outer_most_flag=true) {
    for (const child in json) {
        // console.log("CHILD", child);
        if (child == property) {
            // console.log("PROPERTY", json[child]);
            if (Array.isArray(value)) {
                if (!Array.isArray(json[child])) json[child] = [];
                else if (value.length == 0) json[child] = [];
                // console.log("PROPERTY_ARR", json[child].concat(value));
                json[child] = json[child].concat(value);
            }
            else if (typeof value == 'object') {
                // console.log("PROPERTY_OBJECT", json[child]);
                json[child] = modifyJson(value, json[child], false);
            } else {
                json[child] = (value == "undefined") ? undefined : value;
            }
        } else if (Array.isArray(json[child])) {
            // console.log("ARRARY", json[child]);
            const new_array = [];
            for (const element of json[child]) {
                // console.log("ELEMENT", element);
                new_array.push(searchAndOverwriteJsonValue(property, value, element, false));
            }
            json[child] = new_array;
        } else if (typeof json[child] == 'object') {
            // console.log("OBJECT", json[child]);
            json[child] = searchAndOverwriteJsonValue(property, value, json[child], false);
        }
    }
    if (!doesJsonContainProperty(property, json) && outer_most_flag) {
        json[property] = value;
    }
    return json;
}                

/**
 * Takes every property from `json_to_append` and adds it into or replaces the property in `json`.
 * If `outer_most_flag` is `true`, then properties that don't already exist in `json` but do in
 * `json_to_append` will be added to the base object.
 * @param {{}} json_to_append The object read from
 * @param {{}} json The object written to
 * @param {Boolean} [outer_most_flag=true] `true` means non existant properties in
 * in `json` that exist in `json_to_append` are added to the base object of `json`.
 * @returns  {{}}
 */
function modifyJson(json_to_append, json, outer_most_flag=true) {
    let appended_json = json;
    for (const append_child in json_to_append) {
        appended_json = searchAndOverwriteJsonValue(append_child, json_to_append[append_child], appended_json, outer_most_flag);
    }
    return appended_json;
}

/**
 * Checks whether an object has a certain property or not.
 * @param {String} property The property to be searched for. 
 * @param {{}} json The object to be searched. 
 * @returns {Boolean}
 */
function doesJsonContainProperty(property, json) {
    let does_json_contain_property = false;
    for (const child in json) {
        if (property == child) {
            does_json_contain_property = true;
            break;
        }
        else {
            if (Array.isArray(json[child])) {
                for (const element of json[child]) {
                    does_json_contain_property ||= doesJsonContainProperty(property, element);
                }
            } else if (typeof json[child] == 'object') {
                does_json_contain_property ||= doesJsonContainProperty(property, json[child]);
            }
        }
    }
    return does_json_contain_property;
}

/**
 * Attempts to convert `text` to JSON format.
 * @param {String} text The string to be converted 
 * @returns  {{}}
 */
function textToJson(text) {
    if (!text.includes("{") && !text.includes("}")) text = `{${text}}`;
    text = text.match(/(?:.|\s)*?(\{(?:.|\s)*\})(?:.|\s)*/)[1];
    return JSON.parse(text);
}

/**
 * Checks every property in an object to see if it's null; if it is, then
 * it removes the property.
 * @param {{}} json 
 * @returns {{}}
 */
function clearNullsFromJson(json) {
    // if (json == null) return null;
    if (Array.isArray(json) || typeof json == 'object') return json;
    for (const child in json) {
        if (Array.isArray(json[child])) {
            const new_arr = [];
            for (const element of json[child]) {
                const new_element = clearNullsFromJson(element);
                if (new_element == null) continue;
                new_arr.push(new_element);
            }
            json[child] = new_arr;
        } else if (typeof json[child] == 'object') {
            const new_json = clearNullsFromJson(json[child]);
            if (new_json == null) delete json[child];
        } else {
            if (json[child] == null) delete json[child];
        }
    }
    if (Object.keys(json).length == 0) return null;
    return json;
}
 
/**
 * Checks every element in `comparee` and ensures it has all
 * properties in the array of `comparor`. 
 * @todo this might be broken
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {[*]} comparee Thearray to be checked.
 * @param {[*]} comparor The template array to check `comparee` with respect to.
 * @param {String} filename The name of the file `comparee` is from.
 * @returns {Promise<[*]>}
 */
async function checkJsonByArrayTesting(interaction, comparee, comparor, filename) {
    if (!Array.isArray(comparee) || !Array.isArray(comparor)) console.log("IT HAPPENED", comparee, comparor);
    const fixed_array = [];
    for  (const comparee_element of comparee) {
        let fixed_comparee_element = {};
        for (const comparor_element of comparor) {
            let test_comparee_fixed_element = null;
            let contains_all_properties = true;
            for (const child in comparor_element) {
                if (comparee_element[child] == undefined) {
                    contains_all_properties = false;
                    break;
                }
                test_comparee_fixed_element = await cleanJsonByComparison(interaction, comparee_element, comparor_element, filename);
            }
            if (!contains_all_properties) continue;
            else {
                if (Object.keys(test_comparee_fixed_element).length > Object.keys(fixed_comparee_element).length) {
                    fixed_comparee_element = test_comparee_fixed_element;
                }
            } 
        }
        if (Object.keys(fixed_comparee_element).length > 0) {
            fixed_array.push(fixed_comparee_element);
        }
    }
    return fixed_array;
}

/**
 * Counts how many properties there are in an object.
 * @param {} json The object to have its properties counted.
 * @returns {Number}
 */
function getNumberOfJSONProperties(json) {
    let number_of_properties = 0;
    for (const child in json) {
        if (Array.isArray(json[child])) {
            for (const element of json[child]) {
                number_of_properties += getNumberOfJSONProperties(element);
            }
        } else if (typeof json[child] == 'object') {
            number_of_properties += getNumberOfJSONProperties(json[child]);
        } 
        number_of_properties++;
    }
    return number_of_properties;
}

/**
 * Compares every property from `comparor` to those in `comparee`; if a property is found
 * in `comparee` that isn't in `comparor`, it is deleted. If a property in `comparor` is not in
 * `comparee`, it is added to `comparee`.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {{}} comparee The object to be cleaned.
 * @param {{}} comparor The template object that `comparee` is cleaned with respect to.
 * @param {String} filename The filename `comparee` is from.
 * @returns  {Promise<{}>}
 */
async function cleanJsonByComparison(interaction, comparee, comparor, filename) {
    let fixed_comparee = {};
    for (const comparor_property in comparor) {
        if (!(comparor_property in comparee)) {
            if (comparor[comparor_property] == null) continue;
            fixed_comparee[comparor_property] = comparor[comparor_property];
            appendFileSync(`./guilds/${interaction.guild.id}/logs/audit.log`, `[LOG] [JSON_CLEANSE] added ${comparor_property} back to ${filename}:  ${comparor_property}: ${JSON.stringify(comparor[comparor_property])}\n`);
        } else if (Array.isArray(comparor[comparor_property])) {
            const fixed_comparee_array = await checkJsonByArrayTesting(interaction, comparee[comparor_property], comparor[comparor_property]);
            if (fixed_comparee_array.length > 0) {
                // console.log("AWRAEW", JSON.stringify(fixed_comparee_array), JSON.stringify(comparee[comparor_property]));
                if (JSON.stringify(fixed_comparee_array) != JSON.stringify(comparee[comparor_property])) {
                    appendFileSync(`./guilds/${interaction.guild.id}/logs/audit.log`, `[LOG] [JSON_CLEANSE] fixed ${comparor_property} from ${filename} to value:  ${comparor_property}: ${JSON.stringify(comparee[comparor_property])}\n`);    
                }
                fixed_comparee[comparor_property] = fixed_comparee_array; 
                continue;   
            } 
            fixed_comparee[comparor_property] = comparee[comparor_property];
            // appendFileSync(`./guilds/${interaction.guild.id}/logs/audit.log`, `[LOG] [JSON_CLEANSE] reset ${comparor_property} from ${filename} to template value:  ${comparor_property}: ${JSON.stringify(comparor[comparor_property])}\n`);
        } else if (typeof comparee[comparor_property] == 'object') {
            if (typeof comparee[comparor_property] == 'object') {
                fixed_comparee[comparor_property] = await cleanJsonByComparison(interaction, comparee[comparor_property], comparor[comparor_property], filename);
            } else { 
                fixed_comparee[comparor_property] = comparor[comparor_property];
                appendFileSync(`./guilds/${interaction.guild.id}/logs/audit.log`, `[LOG] [JSON_CLEANSE] reset ${comparor_property} from ${filename} to template value:  ${comparor_property}: ${JSON.stringify(comparor[comparor_property])}\n`);
            }
        } else {
            if (comparor_property.includes("_id")) {
                const checked_value = await checkId(interaction, comparee[comparor_property], comparor_property);
                if (!checked_value) {
                    continue;
                }
                // console.log("ID FOUND:", comparee[comparor_property]);
            }
            if (comparee[comparor_property] == null || comparee[comparor_property] == undefined) continue;
            fixed_comparee[comparor_property] = comparee[comparor_property];
            appendFileSync(`./guilds/${interaction.guild.id}/logs/audit.log`, `[LOG] [JSON_CLEANSE] no changes made to ${comparor_property} from ${filename}: ${JSON.stringify(comparee[comparor_property])}\n`);
        }
    }
    return fixed_comparee;
}

/**
 * For every JSON in the guild indicated by `interaction`, this removes all properties
 * in all files that aren't in the template files and adds in properties that must
 * be included.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @returns {Promise<Number>} The number of properties removed.
 */
async function cleanJsons(interaction) {
    const guild_jsons = readdirSync(`./guilds/${interaction.guild.id}/jsons`, 'utf8').filter((json) => !json.includes(".git"));
    const template_jsons = findAllTemplateJsons(interaction);
    // const template_jsons = readdirSync(`./teools/template_jsons`, 'utf8');
    let properties_removed = 0;
    for (const [key, value] of template_jsons) {
        // console.log(key, guild_jsons);
        if (!guild_jsons.includes(key)) {
            writeFileSync(`./guilds/${interaction.guild.id}/jsons/${key}`, value);
            appendFileSync(`./guilds/${interaction.guild.id}/logs/audit.log`, `[LOG] [JSON_CLEANSE] ${key} is missing. Adding a fresh copy...\n`);
            continue;
        }
        appendFileSync(`./guilds/${interaction.guild.id}/logs/audit.log`, `### ${key.toUpperCase()} ###\n`);
        const guild_json_data = JSON.parse(readFileSync(`./guilds/${interaction.guild.id}/jsons/${key}`, 'utf8'));
        const template_json_data = clearNullsFromJson(JSON.parse(value));
        const fixed_json = await cleanJsonByComparison(interaction, guild_json_data, template_json_data, key);
        properties_removed += (getNumberOfJSONProperties(guild_json_data) - getNumberOfJSONProperties(fixed_json));
        writeFileSync(`./guilds/${interaction.guild.id}/jsons/${key}`, JSON.stringify(fixed_json, null, 2));        
    }
    return properties_removed;
}

// -----------------------EXPORTS-----------c------------
module.exports = { 
                    findJsons,
                    findAllTemplateJsons,
                    sortJson,
                    jsonifyFile,
                    getJsonifiedDatabase,
                    getPrettyJsonText,
                    searchAndOverwriteJsonValue,
                    modifyJson,
                    doesJsonContainProperty,
                    textToJson,
                    clearNullsFromJson,
                    checkJsonByArrayTesting,
                    cleanJsonByComparison,
                    cleanJsons
                };