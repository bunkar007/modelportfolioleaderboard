@echo off
title Daily Model Portfolio Performance - TV Leaderboard
echo ========================================================
echo  DAILY MODEL PORTFOLIO PERFORMANCE - TV LEADERBOARD
echo ========================================================
echo.
echo Starting TradingView Portfolio Server...
echo.
deno run --allow-net --allow-read --allow-write server.ts
pause
