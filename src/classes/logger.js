// -----------------------IMPORTS-----------------------
const { appendFileSync, writeFileSync, existsSync } = require('node:fs');

/**
* Basic logging interface for other classes to compose.
*/ 
class M_Logger {
    /**
     * @param {{text: string, colors?: (string[]|string)}[]} [markers=[]] An array of additional markers to be applied *to all log entries*.
     * @param {(string|null)} [filepath=null] The path to the log file.
     * @param {number} [padding=0] The number of spaces before each log entry.
     * @param {clear_on_start} [clear_on_start=true] Indicates if the log file should be cleard on startup (`true`) or not.
     */
    constructor(markers, filepath=null, padding=0, clear_on_start=true) {
        /** 
         * An ordered array of markers printed when logging.
         * @type {{text: string, colors: string[]=}[]}
         */
        this.markers = markers;
    
        /** 
         * A map for looking up terminal color codes.
         * @type {Map<string, string>} 
         */
        this.colors = new Map(
            [["reset", "\x1b[0m"],
            ["bold", "\x1b[1m"],
            ["dim", "\x1b[2m"], 
            ["italic", "\x1b[3m"], 
            ["underline", "\x1b[4m"],
            ["blink", "\x1b[5m"],
            ["invert", "\x1b[7m"],
            ["hidden", "\x1b[8m"],

            ["function",  "\x1b[33m"], // fg_bright_yellow
            ["name",  "\x1b[32m"], // fg_green
            ["variable",  "\x1b[36m"], // fg_cyan
            ["bot",  "\x1b[90;2m"], // fg_gray && dark
            ["guild",  "\x1b[94m"], // fg_bright_blue
            ["database",  "\x1b[35m"], // fg_magenta
            ["command",  "\x1b[91m"], // fg_bright_red
            ["log",  "\x1b[32;1;2m"], // fg_green && bold && dim
            ["error",  "\x1b[31;1;2m"], // fg_red && bold && dim
            ["debug",  "\x1b[33;1;2m"], // fg_yellow && bold && dim
            ["value",  "\x1b[30;2m"], // fg_black && dim
            ["event",  "\x1b[35;2m"], // fg_magenta && dim

            ["fg_black",  "\x1b[30m"],
            ["fg_red",  "\x1b[31m"],
            ["fg_green",  "\x1b[32m"],
            ["fg_yellow",  "\x1b[33m"],
            ["fg_blue",  "\x1b[34m"],
            ["fg_magenta",  "\x1b[35m"],
            ["fg_cyan",  "\x1b[36m"],
            ["fg_white",  "\x1b[37m"],
            ["fg_gray",  "\x1b[90m"],

            ["fg_bright_red",  "\x1b[91m"],
            ["fg_bright_green",  "\x1b[92m"],
            ["fg_bright_yellow",  "\x1b[93m"],
            ["fg_bright_blue",  "\x1b[94m"],
            ["fg_bright_magenta",  "\x1b[95m"],
            ["fg_bright_cyan",  "\x1b[96m"],
            ["fg_blinding",  "\x1b[97m"],
            ["fg_default",  "\x1b[39m"],

            ["bg_black", "\x1b[40m"],
            ["bg_red", "\x1b[41m"],
            ["bg_green", "\x1b[42m"],
            ["bg_yellow", "\x1b[43m"],
            ["bg_blue", "\x1b[44m"],
            ["bg_magenta", "\x1b[45m"],
            ["bg_cyan", "\x1b[46m"],
            ["bg_white", "\x1b[47m"],
            ["bg_gray", "\x1b[100m"],

            ["bg_light_red", "\x1b[101m"],
            ["bg_light_green", "\x1b[102m"],
            ["bg_light_yellow", "\x1b[103m"],
            ["bg_light_blue", "\x1b[104m"],
            ["bg_light_magenta", "\x1b[105m"],
            ["bg_light_cyan", "\x1b[106m"],
            ["bg_blinding", "\x1b[107m"],
            ["bg_default", "\x1b[109m"]]
        );

        /** 
         * An ordered array of 7 rainbow colors: \
         * `fg_red`, `fg_yellow`, `fg_green`, `fg_cyan`, `fg_blue`, `fg_bright_blue`, `fg_magenta` 
         * @type {string[]}
         */
        this.rainbow = [
            "fg_red",
            "fg_yellow",
            "fg_green",
            "fg_cyan", 
            "fg_blue",
            "fg_bright_blue",
            "fg_magenta"
        ];

        /** 
         * Path to the log file (if specified).
         * @type {(string|null)}
         */
        this.filepath = filepath;

        /** 
         * Path to the log file (if specified).
         * @type {boolean}
         */
        this.are_colors_enabled = true;

        /** 
         * Number of spaces before log entries.
         * @type {number}
         */
        this.padding = padding;
        if (clear_on_start || (filepath != null) && !existsSync(filepath)) this.#resetLogFile();
    }

    /**
     * Clears all text in the specified log file (if one was provided).
    */ 
    #resetLogFile() {
        if (this.filepath == null) return;
        else writeFileSync(this.filepath, '');
    }

    /**
     * Writes `data` to the log file `path` (if possible).
     * @param {string} path The path to the log file.
     * @param {string} data The data to be written to the log file.
     * @param {WriteFileOptions} [options=undefined] Standard file write options. By default, no options are set.
     */
    #appendLogFile(path, data, options=undefined) {
        if (this.filepath == null) return;
        appendFileSync(path, data, options);
    }


    /**
     * Enables/disables colored text outputs in the terminal.
     * @param {boolean} [toggle=true] `true` enables colored logging and `false` disables it.
    */  
    toggleColors(toggle=true) {
        this.are_colors_enabled = toggle;
    }

    /**
     * Colors `text` according to `colors`. If using inside a formatted string, \
     * the succeeding portion of that string will not be colored.
     * @param {string} text The text to be colored.
     * @param {String[]} [colors=undefined] The array of colors to be applied. If the array is empty or `undefined`, no colors will be applied.
     * @returns {string}
    */  
    #colorText(text, colors=undefined) {
        if (colors == undefined) return text;
        else if (!Array.isArray(colors)) colors = [colors];
        let color_str = '\x1b[';
        for (const color of colors) {
            const new_color = this.colors.get(color.toLowerCase().trim());
            if (new_color == undefined) continue;
            else color_str += new_color.match(/\x1b\[([\d;]+)m/)[1]+';';
        }
        color_str = color_str.slice(0, color_str.length-1) + 'm';
        return `${color_str}${text}${this.colors.get("reset")}`;
    }

    /**
     * Searches for a flag property in the provided object.
     * @param {{}} object The object to find the property from.
     * @param {string} flag The flag to be searched for.
    */  
    #getFlag(object, flag) {
        const value = object[flag];
        return value;
    }

    /**
     * Colors `text` with repeated rainbow coloring per-character (ignoring whitespace).
     * 
     * Rainbow color sequence:
     * ```js 
     * const rainbow_colors = [
     *    "fg_red",  
     *    "fg_yellow", 
     *    "fg_green", 
     *    "fg_cyan", 
     *    "fg_blue",   
     *    "fg_light_blue", 
     *    "fg_magenta"
     * ];
     * ```
     * 
     * @param {string} text The text to be rainbowified.
     * @returns {string}
    */  
    #rainbowify(text) {
        let rainbowified_string = this.colors.get("reset");
        let index = 0;
        while (index < text.length) {
            this.rainbow.forEach((element) => {
                if (index < text.length) {
                    rainbowified_string += `${this.colors.get(element)}${text.charAt(index)}`;
                    index++;
                } 
            });
        }
        return rainbowified_string + this.colors.get("reset");
    }

    /**
     * Formats `text` in the following ways:
     * 
     * - "*text in quotes*"      => the color 'value'
     * - (*text in parenthesis*) => the color 'value'
     * - [https://link.com](https://tinyurl.com/yken4w4s)   => the colors 'fg_blue && dim'
     * - *1234* (numbers)        => the color 'value'
     * 
     * @param {string} text The text to be formatted. 
     * @returns {string}
    */  
    #formatDetails(text) {
        const instance = this;
        const formatters = [
            function quotes(text, self=instance) {
                if (text == '') return text;
                let parsed_text = text.match(/^([^"]*)("[^"]*")?((?:.|\n)*)$/);
                if (parsed_text == null || parsed_text == undefined || parsed_text[2] == undefined || parsed_text[2] == '') return text;
                else if (parsed_text.length < 2) return text;
                else if (parsed_text.length < 3) return quotes(text, self) + `"${self.#colorText(parsed_text[2].replaceAll(/"/g, ""), 'value')}"`;
                return parsed_text[1] + `"${self.#colorText(parsed_text[2].replaceAll(/"/g, ""), 'value')}"` + quotes(parsed_text[3]);        
            },
            function parenthesis(text, self=instance) {
                if (text == '') return text;
                let parsed_text = text.match(/^([^(]*)(\([^"()]*\))?((?:.|\n)*)$/);
                if (parsed_text == null || parsed_text == undefined || parsed_text[2] == undefined || parsed_text[2] == '') return text;
                else if (parsed_text.length < 2) return text;
                else if (parsed_text.length < 3) return parenthesis(text, self) + `"${self.#colorText(parsed_text[2].replaceAll(/[()]/g, ""), 'value')}"`;
                return parsed_text[1] + `(${self.#colorText(parsed_text[2].replaceAll(/[()]/g, ""), 'value')})` + parenthesis(parsed_text[3]);        
            },
            function numbers(text, self=instance) {
                if (text == '') return text;
                let parsed_text = text.match(/^((?:[^\d\x1b]*(?:\x1b\[[\d;]*m)?)*)(\d*)((?:.|\n)*)$/);
                if (parsed_text == null || parsed_text == undefined || parsed_text[2] == '') return text;
                else if (parsed_text.length < 2) return text;
                else if (parsed_text.length < 3) return text + self.#colorText(parsed_text[2], ['value', 'bold']);
                return parsed_text[1] + self.#colorText(parsed_text[2], ['value', 'bold']) + numbers(parsed_text[3]);        
            },
            function links(text, self=instance) {
                if (text == '') return text;
                let parsed_text = text.match(/^([^/]*?(?=(?:(?:(?:\x1b\[[\d;]*m)*(?:https?:\/\/))|(?:(?:\x1b\[[\d;]*m)*(?:\/)))))([^\s)]*)((?:\n|.)*)$/);
                if (parsed_text == null || parsed_text == undefined || parsed_text[2] == undefined || parsed_text[2] == '') return text;
                else if (parsed_text.length < 2) return text;
                else if (parsed_text.length < 3) {
                    const parsed_text_2 = parsed_text[2].replaceAll(/\x1b\[[\d;]*m/g, '');
                    if (parsed_text_2 == '/') return links(text, self) + self.#colorText(parsed_text_2, 'value');
                    else return links(text, self) + self.#colorText(parsed_text[2].replaceAll(/\x1b\[[\d;]*m/g, ''), ['fg_bright_cyan', 'italic', 'dim']);
                }
                let parsed_text_2 = parsed_text[2].replaceAll(/\x1b\[[\d;]*m/g, '');
                if (parsed_text_2 == '/') return parsed_text[1] + self.#colorText(parsed_text_2, 'value') + links(parsed_text[3]);
                else return parsed_text[1] + self.#colorText(parsed_text[2].replaceAll(/\x1b\[[\d;]*m/g, ''), ['fg_bright_cyan', 'italic', 'dim']) + links(parsed_text[3]);        
            }
        ];
        for (const formatter of formatters) {
            text = formatter(text);
        }
        return text;
    }

    /**
     * The main logging routine that all means of logging (log, error, debug) run.
     * @param {string} entry The log entry.
     * @param {{text: string, colors?: string[]=}} starting_marker The initial marker (log, error, or debug).
     * @param {{text: string, colors?: string[]=}[]} [markers=[]] An array of additional markers to be applied to *just this log entry*.
     * @param {{write_to_file: boolean}} [flags={{}}] An object of flags to modify the logging process.
     */
    #logRoutine(entry, starting_marker, markers=[], flags={}) {
        starting_marker.text = starting_marker.text.toUpperCase();
        let [unmarked_str, marked_str] = [' '.repeat(this.padding), ' '.repeat(this.padding)];
        unmarked_str += `[${starting_marker.text}]`; 
        marked_str += `[${this.#colorText(starting_marker.text, starting_marker.colors)}]`;
        for (const marker of this.markers.concat(markers)) {
            marked_str += ` [${this.#colorText(marker.text, marker.colors)}]`;
            unmarked_str += ` [${marker.text}]`;
        }
        marked_str += ` ${entry}`;
        unmarked_str += ` ${entry}`;
        if (this.#getFlag(flags, 'write_to_file') === true && this.filepath != null) this.#appendLogFile(this.filepath, `${unmarked_str}\n`);
        console.log((this.are_colors_enabled) 
            ? (() => {
                const split_marked_str = marked_str.match(/((?:.|\n)*\])?((?:.|\n)*)/);
                return split_marked_str[1] + this.#formatDetails(split_marked_str[2]); 
            })()
            : unmarked_str);
    }

    /**
     * Logs a string to the console and/or log file starting with the marker `[LOG]` of color `fg_green && bold && dim`.
     * ```js 
     * const colors = [
     *   // FX
     *    "reset", "bold", "dim", "italic", "underline", "blink", "invert", "hidden"
     *   // Foreground
     *    "fg_black",        "fg_red",            "fg_green", 
     *    "fg_yellow",       "fg_blue",           "fg_magenta", 
     *    "fg_cyan",         "fg_white",          "fg_gray",
     *    "fg_bright_red",   "fg_bright_green",   "fg_bright_yellow",
     *    "fg_bright_blue",  "fg_bright_magenta", "fg_bright_cyan",
     *    "fg_bright_white", "fg_bright_gray",    "fg_default",
     *   // Background
     *    "bg_black",        "bg_red",            "bg_green", 
     *    "bg_yellow",       "bg_blue",           "bg_magenta", 
     *    "bg_cyan",         "bg_white",          "bg_gray",
     *    "bg_bright_red",   "bg_bright_green",   "bg_bright_yellow",
     *    "bg_bright_blue",  "bg_bright_magenta", "bg_bright_cyan",
     *    "bg_bright_white", "bg_bright_gray",    "bg_default",
     *   // Special
     *    "function", // fg_bright_yellow
     *    "name",     // fg_green
     *    "variable", // fg_cyan
     *    "bot",      // fg_gray && dark
     *    "guild",    // fg_bright_blue
     *    "database", // fg_magenta
     *    "command",  // fg_bright_red
     *    "log",      // fg_green && bold && dim 
     *    "error",    // fg_red && bold && dim 
     *    "debug",    // fg_yellow && bold && dim 
     *    "value",    // fg_black && dim
     *    "event"     // fg_magenta && dim
     * ];
     * ```
     * @param {Any} entry The log entry. 
     * @param {{text: string, colors?: (string[]|string)=}[]} [markers=[]] An array of additional markers to be applied to *just this log entry*.
     * @param {{write_to_file?: boolean}} [flags={write_to_file: true}] An object of flags to modify the logging process.
    */    
    log(entry, markers=[], flags={}) {
        if (typeof entry == 'object') {
            entry = '\n' + JSON.stringify(entry, null, 2);
        }
        entry = entry.replaceAll(/\n/g, `\n${' '.repeat(this.padding+4)}`);
        this.#logRoutine(entry.toString(), { text: 'LOG', colors: 'log' }, markers, flags);
    }

    /**
     * Logs a string to the console and/or log file starting with the marker `[ERROR]` of colors `fg_red && bold && dim`.
     * ```js 
     * const colors = [
     *   // FX
     *    "reset", "bold", "dim", "italic", "underline", "blink", "invert", "hidden"
     *   // Foreground
     *    "fg_black",        "fg_red",            "fg_green", 
     *    "fg_yellow",       "fg_blue",           "fg_magenta", 
     *    "fg_cyan",         "fg_white",          "fg_gray",
     *    "fg_bright_red",   "fg_bright_green",   "fg_bright_yellow",
     *    "fg_bright_blue",  "fg_bright_magenta", "fg_bright_cyan",
     *    "fg_bright_white", "fg_bright_gray",    "fg_default",
     *   // Background
     *    "bg_black",        "bg_red",            "bg_green", 
     *    "bg_yellow",       "bg_blue",           "bg_magenta", 
     *    "bg_cyan",         "bg_white",          "bg_gray",
     *    "bg_bright_red",   "bg_bright_green",   "bg_bright_yellow",
     *    "bg_bright_blue",  "bg_bright_magenta", "bg_bright_cyan",
     *    "bg_bright_white", "bg_bright_gray",    "bg_default",
     *   // Special
     *    "function", // fg_bright_yellow
     *    "name",     // fg_green
     *    "variable", // fg_cyan
     *    "bot",      // fg_gray && dark
     *    "guild",    // fg_bright_blue
     *    "database", // fg_magenta
     *    "command",  // fg_bright_red
     *    "log",      // fg_green && bold && dim 
     *    "error",    // fg_red && bold && dim 
     *    "debug",    // fg_yellow && bold && dim 
     *    "value",    // fg_black && dim
     *    "event"     // fg_magenta && dim
     * ];
     * ```
     * @param {Any} entry The log entry. 
     * @param {{text: string, colors?: (string[]|string)=}[]} [markers=[]] An array of additional markers to be applied to *just this log entry*.
     * @param {{write_to_file?: boolean}} [flags={write_to_file: true}] An object of flags to modify the logging process.
    */
    error(entry, markers=[], flags={}) {
        if (typeof entry == 'object') {
            if (entry.stack != undefined) {
                entry = entry.stack;
                this.#logRoutine(entry.toString(), { text: 'ERROR', colors: 'error' }, markers, flags);    
                return;
            }
            else entry = '\n' + JSON.stringify(entry, null, 2);
        }
        entry = entry.replaceAll(/\n/g, `\n${' '.repeat(this.padding+4)}`);
        this.#logRoutine(entry.toString(), { text: 'ERROR', colors: 'error' }, markers, flags);     
    }

    /**
     * Logs a string to the console and/or log file starting with the marker `[DEBUG]` of colors `fg_yellow && bold && dim`.
     * ```js 
     * const colors = [
     *   // FX
     *    "reset", "bold", "dim", "italic", "underline", "blink", "invert", "hidden"
     *   // Foreground
     *    "fg_black",        "fg_red",            "fg_green", 
     *    "fg_yellow",       "fg_blue",           "fg_magenta", 
     *    "fg_cyan",         "fg_white",          "fg_gray",
     *    "fg_bright_red",   "fg_bright_green",   "fg_bright_yellow",
     *    "fg_bright_blue",  "fg_bright_magenta", "fg_bright_cyan",
     *    "fg_bright_white", "fg_bright_gray",    "fg_default",
     *   // Background
     *    "bg_black",        "bg_red",            "bg_green", 
     *    "bg_yellow",       "bg_blue",           "bg_magenta", 
     *    "bg_cyan",         "bg_white",          "bg_gray",
     *    "bg_bright_red",   "bg_bright_green",   "bg_bright_yellow",
     *    "bg_bright_blue",  "bg_bright_magenta", "bg_bright_cyan",
     *    "bg_bright_white", "bg_bright_gray",    "bg_default",
     *   // Special
     *    "function", // fg_bright_yellow
     *    "name",     // fg_green
     *    "variable", // fg_cyan
     *    "bot",      // fg_gray && dark
     *    "guild",    // fg_bright_blue
     *    "database", // fg_magenta
     *    "command",  // fg_bright_red
     *    "log",      // fg_green && bold && dim 
     *    "error",    // fg_red && bold && dim 
     *    "debug",    // fg_yellow && bold && dim 
     *    "value"     // fg_black && dim
     * ];
     * ```
     * @param {Any} entry the log entry 
     * @param {{text: string, colors?: (string[]|string)=}[]} [markers=[]] list of additional markers to be applied to *just this log entry*
     * @param {{write_to_file?: boolean}} [flags={write_to_file: true}] object of flags to modify the logging process:
    */
    debug(entry, markers=[], flags={}) {
        if (typeof entry == 'object') {
            entry = '\n'+ JSON.stringify(entry, null, 2);
        } else if (Array.isArray(entry)) {
            entry = entry.toString();
        } else entry = `${entry}`;
        entry = entry.replaceAll(/\n/g, `\n${' '.repeat(this.padding+4)}`);
        this.#logRoutine(entry, { text: 'DEBUG', colors: 'debug' }, markers, flags);
    }


    /**
     * Prints an emphasized message to console and log file (if possible). \
     * The entered `text` will take this form:
     * ```js
     * const alert = `-------------- ${text} --------------\n`
     * ```
     * @param {string} text The text to be send in the alert.
     * @param {{write_to_file?: boolean, rainbowify_text?: boolean, rainbowify_borders?: boolean, spacing?: boolean, border_length?: number}} [flags={write_to_file: true, rainbowify_text: true, rainbowify_borders: true, spacing: true, border_length: 14}] Allows you to further modify the alerting process if desired.
    */    
    alert(text, flags={}) {
        const border = (flags.border_length != undefined && Number.isInteger(flags.border_length))
            ? `-`.repeat(flags.border_length)
            : `-`.repeat(14);
        if (this.are_colors_enabled) {
            let formatted_border = null;
            let formatted_text = null;
            if (flags?.rainbowify_borders === false) formatted_border = this.#colorText(border, ['bold', 'dim']);
            else formatted_border = this.#rainbowify(border);
            if (flags?.rainbowify_text === true) formatted_text = this.#rainbowify(text); 
            else formatted_text = this.#colorText(text, ['bold', 'dim']);
            if (flags?.spacing === false) console.log(`${formatted_border}${formatted_text}${formatted_border}`);
            else console.log(`${formatted_border} ${formatted_text} ${formatted_border}`);
        } else {
            if (flags?.spacing === false) console.log(`${border}${text}${border}`);
            else console.log(`${border} ${text} ${border}`);
        }
        if (this.#getFlag(flags, 'write_to_file') === true && this.filepath != null) {
            if (flags?.spacing === false) this.#appendLogFile(this.filepath, `${border}${text}${border}\n`);
            else this.#appendLogFile(this.filepath, `${border} ${text} ${border}\n`);
            
        }
    }
}

// -----------------------EXPORTS-----------------------
module.exports = { M_Logger };