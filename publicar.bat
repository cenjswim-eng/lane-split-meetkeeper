@echo off
title Publicando cambios en SwimLaneCoach...
echo ========================================================
echo        PUBLICAR CAMBIOS EN SWIMLANECOACH.APP
echo ========================================================
echo.
cd /d "C:\Users\jjseg\Desktop\SwimLaneCoach"
echo 1. Verificando estado local...
"%LOCALAPPDATA%\Programs\Git\cmd\git.exe" status --short
echo.
echo 2. Guardando cambios pendientes...
"%LOCALAPPDATA%\Programs\Git\cmd\git.exe" add -A
"%LOCALAPPDATA%\Programs\Git\cmd\git.exe" commit -m "update: sincronizacion automatica hacia swimlanecoach.app" 2>nul
echo.
echo 3. Enviando a GitHub y Lovable (swimlanecoach.app)...
"%LOCALAPPDATA%\Programs\Git\cmd\git.exe" push origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo  LISTO! Los cambios han sido subidos exitosamente.
    echo  Lovable los compilara y estaran activos en:
    echo  https://swimlanecoach.app
    echo ========================================================
) else (
    echo ========================================================
    echo  ATENCION: Si es la primera vez, inicia sesion en la
    echo  ventana de GitHub que se abrio en tu navegador.
    echo ========================================================
)
echo.
pause
