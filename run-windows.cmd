@echo off
rem  הרצת קובץ .iv ב-Windows: גררו קובץ .iv על הקובץ הזה (או הריצו: run-windows.cmd file.iv)
rem  דורש Node.js מותקן (https://nodejs.org)
chcp 65001 >nul
cd /d "%~dp0"
setlocal

set "FILE=%~1"
if "%FILE%"=="" (
  echo.
  echo   גררו קובץ .iv על הקובץ הזה, או הריצו:  run-windows.cmd myfile.iv
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo צריך להתקין Node.js מהאתר https://nodejs.org ואז לנסות שוב.
  pause
  exit /b 1
)

node "bin\ivrit.js" build "%FILE%" -o "%~dpn1.html"
if errorlevel 1 (
  echo.
  echo נמצאו שגיאות בקובץ. תקנו אותן ונסו שוב.
  pause
  exit /b 1
)

start "" "%~dpn1.html"
endlocal
