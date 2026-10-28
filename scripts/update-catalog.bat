@echo off
chcp 65001 >nul
title On This Day - Update Catalog
cd /d "%~dp0.."
echo Updating the catalog of On This Day (new albums only)...
echo.
call npm run catalog:update
echo.
pause
