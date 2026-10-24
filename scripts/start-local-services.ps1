# scripts/start-local-services.ps1
# Helper script to launch local PostgreSQL (port 5433) and Redis (port 6379) for local development on Windows

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$pgBin = "C:\Program Files\PostgreSQL\18\bin\postgres.exe"
$pgData = Join-Path $root ".local_postgres_data"
$redisBin = "C:\Users\sachin\AppData\Local\Microsoft\WinGet\Packages\taizod1024.redis-windows-fork_Microsoft.Winget.Source_8wekyb3d8bbwe\Redis-8.10.2-Windows-x64-msys2\redis-server.exe"

# 1. Check & Start PostgreSQL on port 5433
$pgConn = Get-NetTCPConnection -State Listen -LocalPort 5433 -ErrorAction SilentlyContinue
if (-not $pgConn) {
    Write-Host "Starting local PostgreSQL on port 5433..." -ForegroundColor Cyan
    Start-Process -FilePath $pgBin -ArgumentList "-D `"$pgData`" -p 5433" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Host "PostgreSQL started on port 5433." -ForegroundColor Green
} else {
    Write-Host "PostgreSQL is already running on port 5433." -ForegroundColor Green
}

# 2. Check & Start Redis on port 6379
$redisConn = Get-NetTCPConnection -State Listen -LocalPort 6379 -ErrorAction SilentlyContinue
if (-not $redisConn) {
    if (Test-Path $redisBin) {
        Write-Host "Starting Redis on port 6379..." -ForegroundColor Cyan
        Start-Process -FilePath $redisBin -ArgumentList "--port 6379" -WindowStyle Hidden
        Start-Sleep -Seconds 2
        Write-Host "Redis started on port 6379." -ForegroundColor Green
    } else {
        Write-Host "Redis binary not found at $redisBin" -ForegroundColor Yellow
    }
} else {
    Write-Host "Redis is already running on port 6379." -ForegroundColor Green
}
