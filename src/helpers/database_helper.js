// -----------------------IMPORTS-----------------------
// None

/**
 * Turns the `name` of a database into an actual sentence 
 * by removing the file extension and replacing underscores and hyphens with spaces.
 * @param {String} name 
 * @returns {String}
 */
function prettyDatabaseName(name) { 
    return name.replaceAll(/[-_]/g, " ").replace(/\.sqlite/g, "");
}

/**
 * Turns the `name` of a database to be all caps.
 * @param {String} name 
 * @returns {String}
 */
function loudDatabaseName(name) { 
    return name.toUpperCase();
}

// -----------------------EXPORTS-----------------------
module.exports = { 
                    prettyDatabaseName,
                    loudDatabaseName
                };