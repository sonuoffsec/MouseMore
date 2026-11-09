# Builds the portable edition: MouseMore-<version>-portable-win-x64.zip
# Extract, run mousemore.exe. Because portable.flag sits next to the exe, all
# settings are kept in a "data" folder beside it and nothing is written elsewhere.
#
#   ./scripts/package-portable.ps1              build, then package
#   ./scripts/package-portable.ps1 -SkipBuild   package an existing release build
#
# Requires: Rust (MSVC toolchain), Node 20+. Run `npm install` first.
param([switch]$SkipBuild)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    if (-not $SkipBuild) {
        Push-Location "apps/desktop"
        try {
            npx tauri build --no-bundle
            if ($LASTEXITCODE -ne 0) { throw "build failed" }
        } finally { Pop-Location }
    }

    $version = (Get-Content "apps/desktop/src-tauri/tauri.conf.json" | ConvertFrom-Json).version
    $exe = Join-Path $root "target/release/mousemore.exe"
    if (-not (Test-Path $exe)) { throw "expected $exe (run without -SkipBuild)" }

    $stage = Join-Path $root "dist-portable/MouseMore"
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    New-Item -ItemType Directory $stage | Out-Null
    Copy-Item $exe $stage
    Set-Content (Join-Path $stage "portable.flag") "Delete this file to store settings in your user profile instead."
    New-Item -ItemType Directory (Join-Path $stage "data/plugins") | Out-Null
    Copy-Item LICENSE, README.md $stage

    $zip = Join-Path $root "dist-portable/MouseMore-$version-portable-win-x64.zip"
    if (Test-Path $zip) { Remove-Item $zip }
    Compress-Archive -Path $stage -DestinationPath $zip
    $hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
    Set-Content "$zip.sha256" "$hash  $(Split-Path $zip -Leaf)"
    Write-Host "Created $zip"
    Write-Host "SHA256  $hash"
}
finally { Pop-Location }
