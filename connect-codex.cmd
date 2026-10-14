@echo off
setlocal
call "%~dp0scripts\ensure.cmd"
if errorlevel 1 goto done
call codex mcp add folio -- node "%~dp0src\server.mjs" --stdio
if errorlevel 1 goto done
echo.
echo Folio registered for Codex. Restart Codex or open a new session.
:done
pause
