$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$dest = 'blackjack-from-grok-build.zip'
if (Test-Path $dest) { Remove-Item $dest -Force }

$temp = Join-Path $env:TEMP ('cq-zip-' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $temp | Out-Null

robocopy . $temp /E /XD node_modules __pycache__ .venv dist .git /XF *.pyc blackjack-from-grok-build.zip | Out-Null

Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $dest -CompressionLevel Optimal
Remove-Item $temp -Recurse -Force

$item = Get-Item $dest
Write-Output "Created $($item.Name) ($([math]::Round($item.Length / 1MB, 2)) MB) at $($item.FullName)"