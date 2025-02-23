// -----------------------IMPORTS-----------------------
const { writeFileSync, existsSync } = require('node:fs');

/**
 * If the main config already exists, do nothing.
 * Else, create a new one.
 */
if (existsSync(`./main_config.json`)) {
    console.log( 'ERROR: main_config already exists!');
    return;
} else {
    writeFileSync(`./main_config.json`, JSON.stringify({
        "token": "<TOKEN>",
        "clientId": "<CLIENT_ID>",
        "devs": [
          {
            "user_id": "<USER_ID>"
          }
        ],
        "global_lock": false,
        "limit_to_test_server": false,
        "test_guild_id": "<GUILD_ID>"
    }, null, 2));
    console.log( './main_config.json has been generated.');
}
