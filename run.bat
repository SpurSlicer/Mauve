@echo off
echo [LOG] [BAT] Running startup script...
node ./src/tools/update_guilds.js
node ./index.js