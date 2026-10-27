@echo off
chcp 65001 >nul
title Feiyu Launcher
set "LOG=%TEMP%\feiyu-start.log"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-feiyu.ps1" > "%LOG%" 2>&1
type "%LOG%"
echo.
echo Log file: %LOG%
echo Press any key to close (NapCat and DSH keep running in background)
pause >nul
