# Signs one file with signtool (SHA-256, RFC 3161 timestamp). Used by release.yml.
# Expects PFX_PATH (path to a .pfx) and CERT_PASSWORD in the environment.
# The password is passed to signtool but never printed.
param([Parameter(Mandatory)][string]$Path)
$ErrorActionPreference = "Stop"
if (-not $env:PFX_PATH -or -not (Test-Path $env:PFX_PATH)) { throw "PFX_PATH not set or missing" }
$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" |
    Sort-Object FullName -Descending | Select-Object -First 1
if (-not $signtool) { throw "signtool.exe not found" }
$ts = if ($env:TIMESTAMP_URL) { $env:TIMESTAMP_URL } else { "http://timestamp.digicert.com" }
& $signtool.FullName sign /f $env:PFX_PATH /p $env:CERT_PASSWORD /fd SHA256 /tr $ts /td SHA256 /d "MouseMore" $Path
if ($LASTEXITCODE -ne 0) { throw "signtool sign failed for $Path" }
& $signtool.FullName verify /pa $Path
if ($LASTEXITCODE -ne 0) { throw "signtool verify failed for $Path" }
