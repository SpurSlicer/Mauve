// -----------------------IMPORTS-----------------------
const { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, appendFileSync } = require("node:fs");
const process = require("node:process");

/**
 * An array of directory names that every guild must have.
 * @type {[String]}
 */
const required_dirs = [ "databases", "jsons", "custom_commands", "logs"];

/**
 * An array of guilds to be updated. If empty, every guild in `./guilds` will be updated.
 * @type {[String]}
 */
const guilds = (process.argv[2] != undefined) ? process.argv.slice(2) : readdirSync("./guilds/", 'utf8');

/**
 * Clears log file.
 */
writeFileSync(`./data/logs/updates.log`, '');

/**
 * Log function to record what was deleted.
 * @param {String} text 
 * @returns 
 */
const log = (text) => {
    // console.log(text);
    appendFileSync(`./data/logs/updates.log`, `${text}\n`);
    return text + "\n";
};

/**
 * Log string used for the log and terminal.
 * @type {String} 
 */
let log_text = "";

/**
 * Checks to make sure `guild_json` has all required properties in the `template_json`.
 * @param {{}} template_json The JSON for `guild_json` to be compared with respect to.
 * @param {{}} guild_json The JSON to be checked.
 * @returns {{}}
 */
const checkJson = (template_json, guild_json) => {
    let fixed_json = guild_json;
    for (const template_json_property in template_json) {
        const guild_json_type = (Array.isArray(guild_json[template_json_property])) ? "array" : typeof guild_json[template_json_property];
        const template_json_type = (Array.isArray(template_json[template_json_property])) ? "array" : typeof template_json[template_json_property];
        if (guild_json[template_json_property] == undefined || guild_json_type != template_json_type) {
            fixed_json[template_json_property] = template_json[template_json_property];
            log_text += log(`  [LOG] [AUDIT] fixing ${template_json_property}`);
        } else {
            if (template_json_type == 'object') {
                fixed_json[template_json_property] = checkJson(template_json[template_json_property], guild_json[template_json_property]);
            } else if (template_json_type == 'array') {
                fixed_json[template_json_property] = guild_json[template_json_property].concat(template_json[template_json_property]);
            }
        }
    }
    return fixed_json;
};

/**
 * Finds all JSON files starting from `dir` and adds them to the map `jsons` indexed by their filenames.
 * @param {String} dir 
 * @param {Map<String,{}>} jsons 
 */
const findJsons = (dir, jsons) => {
    const files = readdirSync(dir, 'utf8');
    for (const file of files) {
        if (file == '.gitkeep') continue;
        if (file.endsWith(".json")) {
            jsons.set(file, readFileSync(`${dir}/${file}`, 'utf8'));
        } else if (file.includes(".")) continue;
        else findJsons(`${dir}/${file}`, jsons);
    }
};

/**
 * Finds all JSONs in `./commands` for the custom commands of `guild_id`.
 * @param {String} guild_id The guild ID for JSONS in that guild's custom commands directory to be searched for.
 * @returns {Map<String,{}>}
 */
const getAllJsons = (guild_id) => {
    const jsons = new Map();
    findJsons(`./commands`, jsons);
    findJsons(`./guilds/${guild_id}/custom_commands`, jsons);
    return jsons;
};

/**
 * Loops through and cleans all JSONs specified in the command line arguments.
 */
for (const guild of guilds) {
    if (guild.includes(".git")) continue;
    log_text += log(`[LOG] [AUDIT] ### AUDIT STARTED FOR [guild_id:${guild}] ###`);
    let guild_dirs = null;
    try {
        guild_dirs = readdirSync(`./guilds/${guild}/`, 'utf8');
    } catch (a) {
        console.log(a);
        log_text += log(`  [LOG] [AUDIT] no guild directory found! Making one...`);
        mkdirSync(`./guilds/${guild}/`);
        guild_dirs = [];
    }
    for (const required_dir of required_dirs) {
        if (!guild_dirs.includes(required_dir)) {
            mkdirSync(`./guilds/${guild}/${required_dir}`);
            log_text += log(`  [LOG] [AUDIT] added directory /${required_dir}/`);
        }
    }
    for (const [template_json_file_name, template_json_string] of getAllJsons(guild)) {
        let lines = template_json_string.split(/\n/g);
        let new_arr = [];
        for (const line of lines) {
            if (line.includes("null")) continue;
            new_arr.push(line);
        }
        lines = new_arr;
        new_arr = [];
        for (let index = 0; index < lines.length; index++) {
            if (lines[index].includes("[") && lines[index+1]?.includes("{") && lines[index+2]?.includes("}") && lines[index+3]?.includes("]")) { index += 3; continue; }
            if (lines[index].includes("{") && lines[index+1]?.includes("}")) { index++; continue; }
            if (lines[index].includes("{") && lines[index].includes("}")) { continue; }
            new_arr.push(lines[index] + "\n");
        }
        for (let index = 0; index < new_arr.length; index++) {
            if (new_arr[index].includes("[") && new_arr[index+1]?.includes("{") && new_arr[index+2]?.includes("}") && new_arr[index+3]?.includes("]")) { new_arr[index+1] = ""; new_arr[index+2] = ""; }
            if (new_arr[index].includes("}") && new_arr[index+1]?.includes("}") && !new_arr[index+1]?.includes("},")) new_arr[index+1] = new_arr[index+1].replace(/\}/g, "},");
        }
        const template_json = JSON.parse((() => { let str = ""; for (const element of new_arr) str += element; return str; })());
        if (existsSync(`./guilds/${guild}/jsons/${template_json_file_name}`)) {
            const guild_json = JSON.parse(readFileSync(`./guilds/${guild}/jsons/${template_json_file_name}`, 'utf8'));
            writeFileSync(`./guilds/${guild}/jsons/${template_json_file_name}`, JSON.stringify(checkJson(template_json, guild_json), null, 2));
        }
        else {
            log_text += log(`  [LOG] [AUDIT] added json /${template_json_file_name}/`);
            writeFileSync(`./guilds/${guild}/jsons/${template_json_file_name}`, JSON.stringify(template_json, null, 2));
        }
    }
    log_text += log(`[LOG] [AUDIT] ### AUDIT COMPLETE FOR [guild_id:${guild}] ###`);
    writeFileSync(`./guilds/${guild}/logs/audit.log`, log_text);
    log_text = "";
}
