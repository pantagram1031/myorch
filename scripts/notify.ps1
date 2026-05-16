param(
  [string]$Title = "myorch",
  [string]$Message = "Human input required",
  [ValidateSet("info", "warn", "critical")]
  [string]$Severity = "info",
  [string]$Dedup = "default",
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = "SilentlyContinue"
$memoryDir = Join-Path $Root ".myorch\memory"
$cacheDir = Join-Path $Root ".myorch\cache"
$cachePath = Join-Path $cacheDir "notify-dedup.json"
$lockPath = Join-Path $cacheDir "notify-dedup.lock"
$logPath = Join-Path $memoryDir "notifications.jsonl"
New-Item -ItemType Directory -Force -Path $memoryDir, $cacheDir | Out-Null

$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$lock = $null
for ($i = 0; $i -lt 20 -and $null -eq $lock; $i++) {
  try {
    $lock = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
  } catch {
    Start-Sleep -Milliseconds 25
  }
}
if ($null -eq $lock) {
  Write-Output "dedup-lock-unavailable: $Dedup"
  exit 0
}

$cache = @{}
try {
  if (Test-Path $cachePath) {
    try {
      $parsed = Get-Content -Raw $cachePath | ConvertFrom-Json
      foreach ($prop in $parsed.PSObject.Properties) {
        $cache[$prop.Name] = [int64]$prop.Value
      }
    } catch {
      $cache = @{}
    }
  }

  $last = if ($cache.ContainsKey($Dedup)) { [int64]$cache[$Dedup] } else { 0 }
  if (($now - $last) -lt 300000) {
    Write-Output "dedup-suppressed: $Dedup"
    exit 0
  }

  $cache[$Dedup] = $now
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($cachePath, ($cache | ConvertTo-Json), $utf8NoBom)
} finally {
  if ($null -ne $lock) {
    $lock.Close()
    $lock.Dispose()
  }
}

$delivered = $false
if ($env:MYORCH_NOTIFY_TRANSPORT -eq "log") {
  $delivered = $true
} elseif (Get-Module -ListAvailable BurntToast) {
  New-BurntToastNotification -Text $Title, $Message | Out-Null
  $delivered = $true
} else {
  Write-Host "${Title}: $Message"
  [Console]::Beep(880, 120)
  $delivered = $true
}

$record = [ordered]@{
  ts = (Get-Date).ToUniversalTime().ToString("o")
  kind = "notifications"
  key = $Dedup
  title = $Title
  message = $Message
  severity = $Severity
  delivered = $delivered
  ms = $now
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::AppendAllText($logPath, (($record | ConvertTo-Json -Compress) + [Environment]::NewLine), $utf8NoBom)
Write-Output "delivered: $Dedup"
