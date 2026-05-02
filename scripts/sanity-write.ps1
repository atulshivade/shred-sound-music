param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$tmp = Join-Path $env:TEMP "cp-tmp"
if (-not (Test-Path $tmp)) { New-Item -ItemType Directory -Path $tmp | Out-Null }
$failures = 0

function Login([string]$email, [string]$password) {
  $jar = Join-Path $tmp ("cookies-" + ($email -replace '[^a-z0-9]', '_') + ".txt")
  if (Test-Path $jar) { Remove-Item $jar }
  curl.exe -s -b $jar -c $jar -o "$tmp\csrf.json" "$BaseUrl/api/auth/csrf" | Out-Null
  $csrf = (Get-Content "$tmp\csrf.json" -Raw | ConvertFrom-Json).csrfToken
  $body = "email=$email&password=$password&csrfToken=$csrf&callbackUrl=/challenges"
  curl.exe -s -b $jar -c $jar -X POST -H "Content-Type: application/x-www-form-urlencoded" `
      -d $body -o NUL "$BaseUrl/api/auth/callback/credentials" | Out-Null
  return $jar
}

function Check([string]$label, [bool]$ok, [string]$detail = "") {
  $marker = if ($ok) { "OK " } else { "BAD"; $script:failures++ }
  $extra  = if ($detail) { "  ($detail)" } else { "" }
  "{0}  {1}{2}" -f $marker, $label, $extra
}

# --- Pick a challenge id from the active list as student
Write-Host "=== Setup ===" -ForegroundColor Cyan
$studentJar = Login "alex@portal.dev" "Password123"
curl.exe -s -b $studentJar -o "$tmp\challenges.html" "$BaseUrl/challenges" | Out-Null
$challengeId = (Select-String -Path "$tmp\challenges.html" -Pattern '/challenges/([0-9a-f-]{36})' -AllMatches |
                ForEach-Object { $_.Matches } |
                ForEach-Object { $_.Groups[1].Value } |
                Select-Object -First 1)
Check "Student got a challenge id from /challenges" ($null -ne $challengeId) $challengeId

# --- /api/upload still works for raw image uploads (e.g. cover images)
Write-Host ""
Write-Host "=== Image upload (/api/upload) ===" -ForegroundColor Cyan
$tinyPng = Join-Path $tmp "tiny.png"
$pngBytes = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
[IO.File]::WriteAllBytes($tinyPng, $pngBytes)
$imgUploadCode = curl.exe -s -b $studentJar -X POST -F "file=@$tinyPng;type=image/png" -o "$tmp\upload.json" -w "%{http_code}" "$BaseUrl/api/upload"
Check "POST /api/upload (image) returns 200" ($imgUploadCode -eq "200") $imgUploadCode

# --- /api/upload/video — happy path with a tiny synthetic mp4
Write-Host ""
Write-Host "=== Video upload (/api/upload/video) ===" -ForegroundColor Cyan
# Smallest valid mp4 isn't trivial, but the route only sniffs the content-type
# header (server-side) — a small payload labelled video/mp4 is sufficient for
# the smoke test (LocalVideoProvider just writes the bytes to disk).
$tinyMp4 = Join-Path $tmp "tiny.mp4"
[IO.File]::WriteAllBytes($tinyMp4, $pngBytes)  # reuse 70-byte payload; provider-agnostic
$vidUploadCode = curl.exe -s -b $studentJar -X POST -F "file=@$tinyMp4;type=video/mp4" -o "$tmp\video.json" -w "%{http_code}" "$BaseUrl/api/upload/video"
$videoResp = $null
try { $videoResp = Get-Content "$tmp\video.json" -Raw | ConvertFrom-Json } catch {}
Check "POST /api/upload/video returns 200" ($vidUploadCode -eq "200") $vidUploadCode
Check "Response provider is LOCAL" ($null -ne $videoResp -and $videoResp.provider -eq "LOCAL") $videoResp.provider
Check "Response includes a usable playbackUrl" ($null -ne $videoResp -and $videoResp.playbackUrl -like "/uploads/videos/*") $videoResp.playbackUrl

# --- /api/upload/video rejection paths
$anonVidCode = curl.exe -s -X POST -F "file=@$tinyMp4;type=video/mp4" -o NUL -w "%{http_code}" "$BaseUrl/api/upload/video"
Check "Anonymous video upload rejected (401)" ($anonVidCode -eq "401") $anonVidCode

$wrongTypeCode = curl.exe -s -b $studentJar -X POST -F "file=@$tinyPng;type=image/png" -o NUL -w "%{http_code}" "$BaseUrl/api/upload/video"
Check "Image rejected as video (415)" ($wrongTypeCode -eq "415") $wrongTypeCode

# --- Verify uploaded video is actually served
if ($videoResp -and $videoResp.playbackUrl) {
  $servedCode = curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl$($videoResp.playbackUrl)"
  Check "Uploaded video is served back" ($servedCode -eq "200") $servedCode
}

# --- Music-domain UI rendering checks
Write-Host ""
Write-Host "=== Music-domain UI rendering ===" -ForegroundColor Cyan
$adminJar = Login "admin@portal.dev" "Password123"
$studentDetailHtml = curl.exe -s -b $studentJar "$BaseUrl/challenges/$challengeId"
$adminDetailHtml   = curl.exe -s -b $adminJar   "$BaseUrl/challenges/$challengeId"
$adminEvalHtml     = curl.exe -s -b $adminJar   "$BaseUrl/admin/evaluate"
$feedHtml          = curl.exe -s -b $studentJar "$BaseUrl/feed"

Check "Detail page shows 'Upload video' tab to student" ($studentDetailHtml -match 'Upload video')
Check "Detail page shows instrument selector"          ($studentDetailHtml -match 'Instrument')
Check "Detail page shows 'Skill level' selector"        ($studentDetailHtml -match 'Skill level')
Check "Detail page hides uploader from teacher"        (-not ($adminDetailHtml -match 'Upload video'))
Check "Detail page renders a performance card video"    ($adminDetailHtml -match '<iframe|<video')

Check "/admin/evaluate exposes 'Verify' button"        ($adminEvalHtml -match 'Verify')
Check "/admin/evaluate exposes 'Crown best' button"    ($adminEvalHtml -match 'Crown best|Best Performer')
Check "/admin/evaluate exposes 'Add feedback' dialog"  ($adminEvalHtml -match 'Add feedback')

Check "Feed surfaces Best Performer spotlight"         ($feedHtml -match 'Best Performer spotlight')
Check "Feed exposes instrument filter chip"            ($feedHtml -match 'instrument=')

# --- Like button rendering
Write-Host ""
Write-Host "=== Likes ===" -ForegroundColor Cyan
$anonFeedHtml = curl.exe -s "$BaseUrl/sign-in"  # anon hits /feed → redirected, instead probe student-facing render
Check "Student feed renders interactive like button" ($feedHtml -match 'aria-label="(Like|Unlike)"')
Check "Detail page renders interactive like button"  ($studentDetailHtml -match 'aria-label="(Like|Unlike)"')
Check "Admin evaluate renders like button"           ($adminEvalHtml -match 'aria-label="(Like|Unlike)"')

Write-Host ""
if ($failures -eq 0) {
  Write-Host "ALL GREEN ($failures failures)" -ForegroundColor Green
  exit 0
} else {
  Write-Host "$failures FAILURE(S)" -ForegroundColor Red
  exit 1
}
