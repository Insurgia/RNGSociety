$distRoot = Join-Path $PSScriptRoot '..\ui\dist'
$indexPath = Join-Path $distRoot 'index.html'
if (!(Test-Path $indexPath)) {
  Write-Error "Missing ui/dist/index.html"
  exit 1
}

$html = Get-Content -Path $indexPath -Raw
$matches = [regex]::Matches($html, 'assets/[A-Za-z0-9._-]+') | ForEach-Object { $_.Value } | Select-Object -Unique
if (-not $matches -or $matches.Count -eq 0) {
  Write-Error "No asset references found in ui/dist/index.html"
  exit 1
}

$missing = @()
foreach ($m in $matches) {
  $p = Join-Path $distRoot $m
  if (!(Test-Path $p)) { $missing += $m }
}

if ($missing.Count -gt 0) {
  Write-Error ("Missing dist assets: " + ($missing -join ', '))
  exit 1
}

Write-Host "dist check OK"
exit 0
