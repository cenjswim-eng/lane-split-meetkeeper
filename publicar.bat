@echo off
title Publicando cambios en SwimLaneCoach...
set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%LOCALAPPDATA%\Programs\Git\ucrt64\bin;%PATH%"

echo ========================================================
echo        PUBLICAR CAMBIOS EN SWIMLANECOACH.APP
echo ========================================================
echo.
cd /d "C:\Users\jjseg\Desktop\SwimLaneCoach"

echo 1. Verificando estado local...
git status --short
echo.

echo 2. Guardando cambios pendientes...
git add -A
git commit -m "update: sincronizacion automatica hacia swimlanecoach.app" 2>nul
echo.

echo 3. Enviando a GitHub y Lovable (swimlanecoach.app)...
git push origin main
echo.

if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo  [EXITO] Los cambios han sido subidos correctamente!
    echo  Lovable los detectara y los publicara en vivo en:
    echo  https://swimlanecoach.app
    echo ========================================================
) else (
    echo ========================================================
    echo  [AVISO] Si es la primera vez que subes cambios:
    echo  Se abrira tu navegador web para que inicies sesion
    echo  con tu cuenta de GitHub (cenjswim-eng).
    echo  Una vez iniciada la sesion, vuelve a ejecutar este archivo.
    echo ========================================================
)
echo.
pause
