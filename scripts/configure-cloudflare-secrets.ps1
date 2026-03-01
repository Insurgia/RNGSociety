param(
  [Parameter(Mandatory=$true)] [string]$ProjectName,
  [Parameter(Mandatory=$true)] [string]$CloudflareApiToken,
  [string]$OpenRouterKey,
  [string]$RapidApiKey,
  [string]$Env = 'production'
)

$ErrorActionPreference = 'Stop'

if (-not $OpenRouterKey -or -not $RapidApiKey) {
  $envPath = 'D:\Software\RNGSociety\.secrets\rapidapi.env'
  if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
      if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
      $k,$v = $_.Split('=',2)
      $k = $k.Trim(); $v = $v.Trim().Trim('"')
      if (-not $OpenRouterKey -and $k -in @('OPENROUTER_API_KEY','RNG_OPENROUTER_API_KEY')) { $OpenRouterKey = $v }
      if (-not $RapidApiKey -and $k -in @('RAPIDAPI_KEY','RNG_RAPIDAPI_KEY')) { $RapidApiKey = $v }
    }
  }
}

if (-not $OpenRouterKey) { throw 'Missing OpenRouter key (pass -OpenRouterKey or set OPENROUTER_API_KEY in .secrets\rapidapi.env)' }
if (-not $RapidApiKey) { throw 'Missing RapidAPI key (pass -RapidApiKey or set RAPIDAPI_KEY in .secrets\rapidapi.env)' }

$env:CLOUDFLARE_API_TOKEN = $CloudflareApiToken

function Put-Secret([string]$Name, [string]$Value) {
  $tmp = New-TemporaryFile
  try {
    Set-Content -Path $tmp -Value $Value -NoNewline
    Get-Content $tmp | npx wrangler pages secret put $Name --project-name $ProjectName --env $Env
    if ($LASTEXITCODE -ne 0) { throw "Failed putting secret $Name" }
  } finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
  }
}

Put-Secret -Name 'OPENROUTER_API_KEY' -Value $OpenRouterKey
Put-Secret -Name 'RAPIDAPI_KEY' -Value $RapidApiKey

Write-Host "Done. Secrets configured for project '$ProjectName' env '$Env'." -ForegroundColor Green
