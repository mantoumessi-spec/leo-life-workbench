@echo off
chcp 65001 >nul
cd /d "%~dp0.."
where node >nul 2>&1
if errorlevel 1 (
  echo 请先从 https://nodejs.org/ 安装 Node.js 24 LTS，然后重新打开此文件。
  pause
  exit /b 1
)
node scripts\local-launcher.mjs backup
pause
