@echo off
cd /d "%~dp0"
tailscale serve --https=8443 off >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = 5173, 8787; $pids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in $ports } | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($processId in $pids) { taskkill /PID $processId /T /F 2>$null | Out-Null }"
echo Aplikasi dan Tailscale Serve dihentikan.
pause
