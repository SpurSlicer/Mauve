# run `dos2unix ./run.sh` if \r starts trying to execute
node ./src/tools/update_guilds.js
wait
node --trace-warnings ./index.js