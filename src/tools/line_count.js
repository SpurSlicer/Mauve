// -----------------------IMPORTS-----------------------
const { readFileSync, readdirSync } = require('node:fs');

/**
 * An array of directories to be ignored.
 * @type {[String]}
 */
const ignorable_dirs = ['node_modules']

/**
 * Checks whether `filename` is in `ignorable_dirs`.
 * @param {String} filename The filename to be checked.
 * @returns {Boolean} `true` means the directory should be ignored.
 */
const isIgnorable = (filename) => {
    for (const ignorable of ignorable_dirs) {
        if (filename.includes(ignorable)) return true;
    }
    return false;
} 

/**
 * Finds the number of lines in every .js file that the dev has written.
 * @param {*} [dir='\.'] The starting directory. This is used for recursion and is the relative root by default.
 * @returns 
 */
const findNumberOfLines = (dir='./') => {
    let line_count = 0;
    const filenames = readdirSync(dir, 'utf8');
    for (const filename of filenames) {
        if (isIgnorable(filename)) continue;
        if (/[^.]*?\..*/.test(filename)) {
            if (filename.endsWith(`.js`)) 
                line_count += readFileSync(`${dir}/${filename}`, 'utf8').match(/\n/g).length;
        } else line_count += findNumberOfLines(`${dir}/${filename}`);
    }
    return line_count;
}

/**
 * Logs the information accordingly.
 * @todo maybe find a log file for this to go into.
 */
console.log(`${findNumberOfLines()} lines found`);