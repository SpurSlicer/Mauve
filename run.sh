command > /dev/null 2>&1
param1="$1"
cmp="-nc"
if [[ "$param1" != "$cmp" ]]; then 
    clear
fi
echo [LOG] [BAT] Running startup script...
node ./tools/update_commands.js 
node ./tools/index.js