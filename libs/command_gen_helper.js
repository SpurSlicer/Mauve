// -----------------------IMPORTS-----------------------
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

// ------------------------------------------------------
// @description Add all commands from files. Build commands using build() interface
// @params is_raw_command: this returns the raw, non JSONified command that index.js uses
// @return all of the slash command objects generated from all commands in ../commands/* (this is the only place commands can be added)
// ------------------------------------------------------
function getCommands(is_raw_command=false) {
    const all_commands = [];
    const extCommandsPath = join(__dirname, '../commands');
    const extCommandFiles = readdirSync(extCommandsPath).filter(file => file.endsWith('.js'));
    for (const file of extCommandFiles) {
        const filePath = join(extCommandsPath, file);
        const { build } = require(filePath);
        build().forEach((command) => all_commands.push((is_raw_command) ? command : command.data.toJSON()));
    }
    return all_commands;
}

// ------------------------------------------------------
// @description Convert and process a time value from milliseconds to minutes
// @params time: the time (in milliseconds) to be converted and processed
// @return the converted time (in seconds)
// ------------------------------------------------------
function minitify(time) {
    const time_number = (Number(time)/60000).toFixed(2);
    return ((time_number % 1) === 0) ? (Math.floor(time_number)) : (time_number);
}

// -----------------------EXPORTS-----------------------
module.exports = { 
                    getCommands,
                    minitify 
                };