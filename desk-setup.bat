@echo off
rem INMUU practice room booking PC (internet): desktop + startup shortcut (Edge app window, full screen)
rem target: https://headoffice-inmuu.github.io/inmuu-room/desk.html
powershell -NoProfile -ExecutionPolicy Bypass -Command "$e=(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe' -ErrorAction SilentlyContinue).'(default)'; if(-not $e){$e='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'}; $n=-join([char[]]@(0xC778,0xC0DD,0xBBA4,0xC9C1,0x20,0xC5F0,0xC2B5,0xC2E4,0x20,0xC608,0xC57D)); $w=New-Object -ComObject WScript.Shell; foreach($p in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Startup'))){ $s=$w.CreateShortcut((Join-Path $p ($n+'.lnk'))); $s.TargetPath=$e; $s.Arguments='--app=https://headoffice-inmuu.github.io/inmuu-room/desk.html --start-fullscreen --no-first-run'; $s.Save() }; Start-Process $e '--app=https://headoffice-inmuu.github.io/inmuu-room/desk.html --start-fullscreen --no-first-run'"
echo.
echo Done. Desktop and startup shortcuts were created.
pause
