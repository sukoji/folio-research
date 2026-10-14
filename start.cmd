@echo off
setlocal
call "%~dp0scripts\ensure.cmd"
if errorlevel 1 goto done
echo.
echo Open http://127.0.0.1:4317 in your browser.
echo Keep this window open while using the editor. Press Ctrl+C to stop.
node src\server.mjs
:done
pause
