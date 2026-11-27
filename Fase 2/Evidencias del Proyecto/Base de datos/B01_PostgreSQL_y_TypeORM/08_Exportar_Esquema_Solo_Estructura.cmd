@echo off
setlocal
set "PGDUMP=C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
set "SALIDA=%USERPROFILE%\Downloads\GMA_ESQUEMA_SOLO_ESTRUCTURA.sql"
echo Exporta SOLO definiciones, NO registros. Confirma credenciales y base LOCAL de QA.
if not exist "%PGDUMP%" (
 echo No se encontro pg_dump: %PGDUMP%
 exit /b 1
)
"%PGDUMP%" --schema-only --no-owner --no-privileges --format=plain --host=127.0.0.1 --port=5432 --username=gma_app --dbname=govmarket_analytics --file="%SALIDA%"
if errorlevel 1 (
 echo ERROR: no se genero esquema. No modificar la base.
 exit /b 1
)
echo Esquema generado en: %SALIDA%
echo REVISA el SQL por contenido sensible antes de subirlo a GitHub.
endlocal
