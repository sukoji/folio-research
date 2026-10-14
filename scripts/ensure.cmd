@echo off
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 or newer first.
  exit /b 1
)
node scripts\check-runtime.mjs
if errorlevel 1 exit /b 1
node --input-type=module -e "await import('@modelcontextprotocol/sdk/server/mcp.js'); await import('pdfjs-dist/legacy/build/pdf.mjs'); await import('@napi-rs/canvas'); await import('tesseract.js'); await import('@tesseract.js-data/eng'); await import('@tesseract.js-data/kor')" >nul 2>nul
if errorlevel 1 (
  call npm ci --no-fund --no-audit
  if errorlevel 1 exit /b 1
)
node scripts\configure.mjs
exit /b %errorlevel%
