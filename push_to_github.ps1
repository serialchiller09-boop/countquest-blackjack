$ErrorActionPreference = 'Stop'
$gh = 'C:\Program Files\GitHub CLI\gh.exe'
Set-Location $PSScriptRoot

& $gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Browser login — use the code shown below at https://github.com/login/device'
  & $gh auth login --hostname github.com --git-protocol https --web
}

& $gh repo create serialchiller09-boop/countquest-blackjack --public --source=. --remote=origin --push --description 'CountQuest Blackjack'