param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Email = "admin@portal.dev",
  [string]$Password = "Password123",
  [string]$Role = "ADMIN"
)

$ErrorActionPreference = "Stop"
$jar = Join-Path $env:TEMP "cp-cookies.txt"
$tmp = Join-Path $env:TEMP "cp-tmp"
if (Test-Path $jar) { Remove-Item $jar }
if (-not (Test-Path $tmp)) { New-Item -ItemType Directory -Path $tmp | Out-Null }
$failures = 0

function Probe([string]$path, [string]$expect = "200") {
  $out  = Join-Path $tmp ("body_" + ($path -replace "[^a-z0-9]", "_") + ".html")
  $hdr  = Join-Path $tmp ("hdrs_" + ($path -replace "[^a-z0-9]", "_") + ".txt")
  curl.exe -s -b $jar -c $jar -o $out -D $hdr "$BaseUrl$path" | Out-Null
  $status = (Get-Content $hdr | Select-Object -First 1) -replace '^HTTP/[\d.]+\s+', ''
  $loc    = (Get-Content $hdr | Select-String '^location:' | ForEach-Object { ($_ -split ': ',2)[1].Trim() })
  $code   = ($status -split ' ')[0]
  $marker = if ($code -eq $expect) { "OK " } else { "BAD"; $script:failures++ }
  $extra  = if ($loc) { "  -> $loc" } else { "" }
  "{0}  {1,-40}  {2}{3}" -f $marker, $path, $status, $extra
}

Write-Host "=== Anon ===" -ForegroundColor Cyan
Probe "/" "200"
Probe "/sign-in" "200"
Probe "/sign-up" "200"
Probe "/challenges" "307"
Probe "/admin" "307"

Write-Host ""
Write-Host "=== Sign in as $Email ($Role) ===" -ForegroundColor Cyan
curl.exe -s -b $jar -c $jar -o "$tmp\csrf.json" "$BaseUrl/api/auth/csrf" | Out-Null
$csrf = (Get-Content "$tmp\csrf.json" -Raw | ConvertFrom-Json).csrfToken
$body = "email=$Email&password=$Password&csrfToken=$csrf&callbackUrl=/challenges"
curl.exe -s -b $jar -c $jar -X POST -H "Content-Type: application/x-www-form-urlencoded" `
    -d $body -o "$tmp\signin.html" -D "$tmp\signin.hdr" `
    "$BaseUrl/api/auth/callback/credentials" | Out-Null
$signinStatus = (Get-Content "$tmp\signin.hdr" | Select-Object -First 1)
"  POST credentials -> $signinStatus"
$hasSession = (Get-Content $jar) -match 'authjs.session-token'
"  session-token cookie set: $($hasSession.Length -gt 0)"
if ($hasSession.Length -eq 0) { $script:failures++ }

Write-Host ""
Write-Host "=== Authed common ===" -ForegroundColor Cyan
Probe "/challenges" "200"
Probe "/feed" "200"

Write-Host ""
Write-Host "=== Admin paths (expect role-based) ===" -ForegroundColor Cyan
$adminExpect = if ($Role -eq "ADMIN") { "200" } else { "307" }
Probe "/admin" $adminExpect
Probe "/admin/challenges/new" $adminExpect
Probe "/admin/evaluate" $adminExpect

Write-Host ""
Write-Host "=== Challenge detail (clicking a card) ===" -ForegroundColor Cyan
$listFile = Join-Path $tmp "body__challenges.html"
$ids = Select-String -Path $listFile -Pattern '/challenges/([0-9a-f-]{36})' -AllMatches |
       ForEach-Object { $_.Matches } |
       ForEach-Object { $_.Groups[1].Value } |
       Sort-Object -Unique
foreach ($id in $ids) { Probe "/challenges/$id" "200" }

Write-Host ""
if ($failures -eq 0) {
  Write-Host "ALL GREEN" -ForegroundColor Green
  exit 0
} else {
  Write-Host "$failures FAILURE(S)" -ForegroundColor Red
  exit 1
}
