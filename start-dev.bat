@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend\src\NotSpotify.Api"
set "FRONTEND_DIR=%ROOT%frontend"

echo.
echo Starting not-spotify development servers...
echo.

if not exist "%BACKEND_DIR%\NotSpotify.Api.csproj" (
  echo [error] Backend project not found:
  echo         %BACKEND_DIR%\NotSpotify.Api.csproj
  pause
  exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
  echo [error] Frontend package not found:
  echo         %FRONTEND_DIR%\package.json
  pause
  exit /b 1
)

where dotnet >nul 2>nul
if errorlevel 1 (
  echo [error] dotnet was not found. Install the .NET SDK first.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [error] npm was not found. Install Node.js first.
  pause
  exit /b 1
)

if not exist "%FRONTEND_DIR%\node_modules" (
  echo Frontend dependencies are missing. Running npm install first...
  pushd "%FRONTEND_DIR%"
  call npm install
  if errorlevel 1 (
    popd
    echo [error] npm install failed.
    pause
    exit /b 1
  )
  popd
)

start "not-spotify backend" /D "%BACKEND_DIR%" cmd /k dotnet run
start "not-spotify frontend" /D "%FRONTEND_DIR%" cmd /k npm.cmd run dev

echo Backend and frontend are starting in separate windows.
echo.
echo Backend:  check the backend window for the https://localhost URL
echo Frontend: http://localhost:5173
echo.
pause
