# Crée ou met à jour la source PostgreSQL Supabase GED (UID supabase-ged) pour le dashboard BRAGATEST.
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$envPath = Join-Path $here ".env"

function Read-DotEnv($path) {
  $map = @{}
  if (Test-Path $path) {
    Get-Content $path | ForEach-Object {
      if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
      $k, $v = $_ -split '=', 2
      $map[$k.Trim()] = $v.Trim()
    }
  }
  $map
}

if (-not (Test-Path $envPath)) {
  Copy-Item (Join-Path $here ".env.example") $envPath -ErrorAction SilentlyContinue
}

$cfg = Read-DotEnv $envPath
$gUser = $cfg.GRAFANA_ADMIN_USER; if (-not $gUser) { $gUser = "admin" }
$gPass = $cfg.GRAFANA_ADMIN_PASSWORD
if (-not $gPass) {
  Write-Host "Créez grafana\.env à partir de .env.example (GRAFANA_ADMIN_PASSWORD)."
  exit 1
}

$dbPass = $cfg.SUPABASE_DB_PASSWORD
if (-not $dbPass) {
  Write-Host "Ajoutez SUPABASE_DB_PASSWORD dans ged\grafana\.env"
  Write-Host "(Supabase projet GED → Settings → Database → Database password)"
  exit 1
}

$dbHost = if ($cfg.SUPABASE_DB_HOST) { $cfg.SUPABASE_DB_HOST } else { "db.bkjdvdngadytbzgdcuik.supabase.co" }
$port = if ($cfg.SUPABASE_DB_PORT) { [int]$cfg.SUPABASE_DB_PORT } else { 5432 }
$grafanaPort = if ($cfg.GRAFANA_PORT) { $cfg.GRAFANA_PORT } else { "3000" }

$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${gUser}:${gPass}"))
$headers = @{ Authorization = "Basic $auth"; "Content-Type" = "application/json" }
$base = "http://localhost:$grafanaPort"

$payload = @{
  name             = "Supabase GED"
  uid              = "supabase-ged"
  type             = "grafana-postgresql-datasource"
  access           = "proxy"
  url              = $dbHost
  user             = "postgres"
  database         = "postgres"
  jsonData         = @{ sslmode = "require"; postgresVersion = 1500; port = $port }
  secureJsonData   = @{ password = $dbPass }
}

$existing = $null
try {
  $existing = Invoke-RestMethod -Uri "$base/api/datasources/uid/supabase-ged" -Headers $headers -Method Get
} catch { }

if ($existing) {
  $payload.id = $existing.id
  Invoke-RestMethod -Uri "$base/api/datasources/uid/supabase-ged" -Headers $headers -Method Put -Body ($payload | ConvertTo-Json -Depth 6) | Out-Null
  Write-Host "Source supabase-ged mise à jour." -ForegroundColor Green
} else {
  Invoke-RestMethod -Uri "$base/api/datasources" -Headers $headers -Method Post -Body ($payload | ConvertTo-Json -Depth 6) | Out-Null
  Write-Host "Source supabase-ged créée." -ForegroundColor Green
}

try {
  $health = Invoke-RestMethod -Uri "$base/api/datasources/uid/supabase-ged/health" -Headers $headers -Method Get
  Write-Host "Test : $($health.message)"
} catch {
  Write-Warning "Connexion échouée — vérifiez le mot de passe Database ou IPv4/pooler Supabase."
}

Write-Host ""
Write-Host "Dashboard : http://localhost:$grafanaPort/d/bragatest-supervision"