@echo off
echo ==================================================
echo             SONORO MUSIC APK BUILDER
echo ==================================================
echo.
echo Setting JAVA_HOME to Android Studio JBR...
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo Verifying Java Compiler version...
javac -version
if %errorlevel% neq 0 (
    echo Error: Could not locate Java Compiler. Make sure Android Studio is installed in C:\Program Files\Android\Android Studio.
    pause
    exit /b %errorlevel%
)

echo.
echo Stopping active Gradle daemons (forces fresh JDK path mapping)...
call .\gradlew.bat --stop

echo.
echo Starting compilation and building debug APK...
call .\gradlew.bat assembleUniversalFossDebug

if %errorlevel% equ 0 (
    echo.
    echo ==================================================
    echo SUCCESS! The APK has been compiled.
    echo.
    echo Installable APK path:
    echo app\build\outputs\apk\universalFoss\debug\app-universalFoss-universal-debug.apk
    echo ==================================================
) else (
    echo.
    echo Build failed. Please verify configurations and try again.
)
pause
