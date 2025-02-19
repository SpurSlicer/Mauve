// -----------------------IMPORTS-----------------------
const { readdirSync, appendFileSync, unlinkSync } = require("node:fs");
const process = require("node:process");

/**
 * The filenames to be deleted from every guild. If nothing is entered, nothing will be deleted.
 * @type {[String]}
 */
const files = (process.argv[2] != undefined) ? process.argv.slice(2) : [];

/**
 * Log function to record what was deleted.
 * @param {String} text 
 * @returns 
 */
const log = (text) => {
    console.log(text);
    appendFileSync(`./data/logs/updates.log`, `${text}\n`);
    return text + "\n";
};

/**
 * Number of files deleted
 * @type {Number}
 */
let deleted_files_cnt = 0;

/**
 * Recursively searches through and deletes all files specified in the command line
 * arguments starting from `./guilds`.
 * @param {String} path The starting path.
 */
const deleteFile = (path=`./guilds`) => {
    const file_names = readdirSync(path, 'utf8');
    for (const file_name of file_names) {
        if (file_name == '.gitkeep') continue;
        if (!file_name.includes(".")) {
            deleteFile(`${path}/${file_name}`);
        } else {
            if (files.includes(file_name)) {
                unlinkSync(`${path}/${file_name}`);
                deleted_files_cnt++;
            }
        }
    }
};
deleteFile();

/**
 * Logs the information accordingly.
 */
log(`[LOG] [MASS DELETE] deleted ${deleted_files_cnt} ${(deleted_files_cnt == 1) ? "file" : "files"}`);