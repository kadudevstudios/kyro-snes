# -*- coding: utf-8 -*-
<#
.SYNOPSIS
    Re-vendoriza o runtime do emulador (EmulatorJS + núcleo snes9x).

.DESCRIPTION
    Baixa os arquivos do runtime para web/public/emu. O repositório já inclui
    esses arquivos; este script existe para atualizar a versão.

.NOTES
    O núcleo snes9x é distribuído sob GPL. Veja docs/ARQUITETURA.md.
#>
param(
    [string]$Version = "stable"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$emu = Join-Path $root "web\public\emu"
$cores = Join-Path $emu "cores"

New-Item -ItemType Directory -Force -Path $cores, (Join-Path $cores "reports"), (Join-Path $emu "localization") | Out-Null

$base = "https://cdn.emulatorjs.org/$Version/data"
$files = @(
    @{ url = "$base/loader.js"; out = "$emu\loader.js" },
    @{ url = "$base/emulator.min.js"; out = "$emu\emulator.min.js" },
    @{ url = "$base/emulator.min.css"; out = "$emu\emulator.min.css" },
    @{ url = "$base/localization/pt-BR.json"; out = "$emu\localization\pt-BR.json" }
)

foreach ($file in $files) {
    Write-Host "baixando $($file.url)"
    Invoke-WebRequest -Uri $file.url -OutFile $file.out -UseBasicParsing
}

Write-Host "baixando núcleo snes9x via npm"
Push-Location $root
try {
    npm pack "@emulatorjs/core-snes9x" --silent | Out-Null
    $tgz = Get-ChildItem -Filter "emulatorjs-core-snes9x-*.tgz" | Select-Object -First 1
    $tmp = Join-Path $env:TEMP "kyro-core-extract"
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    tar -xzf $tgz.FullName -C $tmp
    Copy-Item "$tmp\package\snes9x-wasm.data" $cores -Force
    Copy-Item "$tmp\package\snes9x-legacy-wasm.data" $cores -Force
    Copy-Item "$tmp\package\reports\snes9x.json" (Join-Path $cores "reports") -Force
    Remove-Item $tgz.FullName
} finally {
    Pop-Location
}

Write-Host "runtime atualizado em $emu" -ForegroundColor Green
