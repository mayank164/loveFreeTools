@echo off
echo ========================================
echo   Building Love Free Tools Windows App
echo ========================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

:: Build Windows installer and portable
echo Building Windows application...
call npm run build:win

echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Output files in: electron\dist\
echo.
pause

