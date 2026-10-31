# -*- coding: utf-8 -*-
<#
.SYNOPSIS
    Build completo: web + desktop.

.DESCRIPTION
    Gera o build de produção do app web, copia para desktop/app e empacota o
    executável Windows com electron-builder.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts/build-all.ps1
    powershell -ExecutionPolicy Bypass -File scripts/build-all.ps1 -SkipInstaller
#>
param(
    [switch]$SkipInstaller
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "==> Web build" -ForegroundColor Cyan
Push-Location (Join-Path $root "web")
try {
    npm run build
} finally {
    Pop-Location
}

Write-Host "==> Copiando dist para desktop/app" -ForegroundColor Cyan
$appDir = Join-Path $root "desktop\app"
if (Test-Path $appDir) { Remove-Item -Recurse -Force $appDir }
Copy-Item -Recurse (Join-Path $root "web\dist") $appDir

Write-Host "==> Desktop build" -ForegroundColor Cyan
Push-Location (Join-Path $root "desktop")
try {
    if (-not (Test-Path "node_modules")) { npm install --no-audit --no-fund }
    if ($SkipInstaller) {
        npx electron-builder --win --dir
    } else {
        npm run dist
    }
} finally {
    Pop-Location
}

Write-Host "==> Pronto" -ForegroundColor Green
Get-ChildItem (Join-Path $root "desktop\release") -Filter *.exe -ErrorAction SilentlyContinue |
    Select-Object Name, Length, LastWriteTime |
    Format-Table -AutoSize
