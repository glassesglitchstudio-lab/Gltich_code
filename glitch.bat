@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
bun run "%SCRIPT_DIR%packages\opencode\src\index.ts" %*

endlocal
