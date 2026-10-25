$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$appPort = 5173
$servePort = 8443

$alreadyRunning = $false
try {
    $probe = Invoke-WebRequest -Uri "http://127.0.0.1:$appPort/" -UseBasicParsing -TimeoutSec 2
    if ($probe.StatusCode -eq 200 -and $probe.Content -match 'Lyric Carousel') {
        $alreadyRunning = $true
    }
} catch {
    # Belum berjalan.
}

if ($alreadyRunning) {
    Write-Host "Lyric Carousel Studio sudah berjalan. Mengaktifkan Tailscale Serve..." -ForegroundColor Cyan
} else {
    Write-Host "Menjalankan Lyric Carousel Studio..." -ForegroundColor Cyan
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/k npm run dev' -WorkingDirectory $root | Out-Null
}

$ready = $alreadyRunning
for ($attempt = 0; $attempt -lt 60 -and -not $ready; $attempt++) {
    Start-Sleep -Milliseconds 500
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$appPort/" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        # Vite belum siap; coba lagi.
    }
}

if (-not $ready) {
    Write-Host "Frontend tidak siap dalam 30 detik. Periksa jendela npm run dev." -ForegroundColor Red
    exit 1
}

$tailscale = Get-Command tailscale -ErrorAction SilentlyContinue
if (-not $tailscale) {
    Write-Host "Tailscale tidak ditemukan. Aplikasi tetap berjalan di http://localhost:$appPort" -ForegroundColor Yellow
    exit 0
}

try {
    $status = tailscale status --json | ConvertFrom-Json
    if ($status.BackendState -ne 'Running') {
        Write-Host "Tailscale belum terhubung (status: $($status.BackendState))." -ForegroundColor Yellow
        Write-Host "Aplikasi tetap berjalan di http://localhost:$appPort" -ForegroundColor Yellow
        exit 0
    }

    $dnsName = $status.Self.DNSName.TrimEnd('.')

    # Bersihkan konfigurasi lama khusus port ini bila ada.
    # Perintah "off" mengembalikan error bila belum ada handler; abaikan.
    $null = tailscale serve --https=$servePort off 2>&1

    $serveOutput = tailscale serve --bg --https=$servePort $appPort 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Tailscale Serve gagal diaktifkan." -ForegroundColor Red
        Write-Host ($serveOutput | Out-String)
        exit 1
    }

    Write-Host ""
    Write-Host "Aplikasi berjalan." -ForegroundColor Green
    Write-Host "  Lokal    : http://localhost:$appPort"
    Write-Host "  Tailnet  : https://${dnsName}:$servePort"
    Write-Host ""
    Write-Host "Buka URL Tailnet dari PC lain yang login ke tailnet yang sama."
    Write-Host "Tekan stop-app.bat untuk menghentikan aplikasi dan Tailscale Serve."
} catch {
    Write-Host "Gagal mengatur Tailscale: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Aplikasi tetap berjalan di http://localhost:$appPort" -ForegroundColor Yellow
}
