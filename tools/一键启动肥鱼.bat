@echo off
chcp 65001 >nul
title 肥鱼一键启动
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-feiyu.ps1"
echo.
echo 按任意键关闭窗口（NapCat 和 DSH 会继续在后台运行）
pause >nul