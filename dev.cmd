@echo off
REM ===================================================================
REM  dev.cmd - launch the not-spotify dev stack in three terminals.
REM  DOUBLE-CLICK this file in Explorer, or run  dev.cmd  from a prompt.
REM
REM  Opens three windows:
REM    1. ASP.NET Core backend    (https://localhost:7045)
REM    2. Stripe webhook listener (forwards to /stripe/webhook)
REM    3. Vite frontend           (http://localhost:5173)
REM
REM  Requires .NET SDK, npm, and the Stripe CLI on PATH
REM  (run "stripe login" once before first use).
REM ===================================================================

REM %~dp0 = folder this script lives in, with a trailing backslash.
set "ROOT=%~dp0"

REM Explorer can launch this with a stale PATH (tools added after it started),
REM so prepend the known tool dirs. The spawned windows inherit this PATH.
REM   dotnet -> C:\Program Files\dotnet
REM   node/npm/stripe -> C:\nvm4w\nodejs (nvm-for-windows current symlink)
set "PATH=C:\Program Files\dotnet;C:\nvm4w\nodejs;%PATH%"

echo Starting not-spotify dev stack...

echo   -^> Backend   (dotnet run)
start "not-spotify: backend" /D "%ROOT%backend\src\NotSpotify.Api" cmd /k dotnet run

REM Give the API a head start so Stripe attaches to a live endpoint.
timeout /t 3 /nobreak >nul

echo   -^> Stripe    (stripe listen)
start "not-spotify: stripe" /D "%ROOT%backend\src\NotSpotify.Api" cmd /k stripe listen --forward-to https://localhost:7045/stripe/webhook

echo   -^> Frontend  (npm run dev)
start "not-spotify: frontend" /D "%ROOT%frontend" cmd /k npm run dev

echo.
echo All three terminals launched.
echo   Frontend: http://localhost:5173    Backend: https://localhost:7045
echo (If the frontend opens on 5174+, that's fine - CORS now allows 5173-5176.)
echo.
echo You can close this window.
timeout /t 5 /nobreak >nul
