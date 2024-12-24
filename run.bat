@echo off
set param1=%%~1
set cmp=-nc
if %param1% neq %cmp% (
    clear
    ) 
echo [LOG] [BAT] Running startup script...
node ./tools/update_commands.js 
node ./tools/index.js