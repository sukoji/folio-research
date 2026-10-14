@echo off
setlocal
call "%~dp0scripts\ensure.cmd"
if errorlevel 1 goto done
call claude mcp add --scope user --transport stdio folio -- node "%~dp0src\server.mjs" --stdio
if errorlevel 1 goto done
echo.
echo Folio registered for Claude Code. Restart Claude Code and check /mcp.
:done
pause
