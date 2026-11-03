<#
  On This Day - installer / updater via RAW (Windows PowerShell)

  Usage (installs or updates):
      irm https://raw.githubusercontent.com/uWaazy/on-this-day/main/install.ps1 | iex

  What it does (nothing else):
    1. Finds Spicetify and the CustomApps folder.
    2. Downloads manifest.json, index.js and style.css from this repository (raw.githubusercontent.com).
    3. Checks that the files are valid before replacing the current installation.
    4. Registers the app (spicetify config custom_apps on-this-day) and runs spicetify apply.
  It does not collect data, ask for passwords or install anything outside the app folder.
#>

$ErrorActionPreference = "Stop"
$Repo   = "uWaazy/on-this-day"
$Branch = "main"
$AppId  = "on-this-day"
$Raw    = "https://raw.githubusercontent.com/$Repo/$Branch"
$Files  = @("manifest.json", "index.js", "style.css")

function Write-Step($text) { Write-Host "  > $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "  OK $text" -ForegroundColor Green }
function Write-Warn2($text){ Write-Host "  ! $text" -ForegroundColor Yellow }

function Install-OnThisDay {
    Write-Host ""
    Write-Host "On This Day - installer" -ForegroundColor Green
    Write-Host "------------------------"

    # Older PowerShell 5.1 needs TLS 1.2 to talk to GitHub.
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

    # 1) Spicetify
    Write-Step "Looking for Spicetify..."
    $spicetify = $null
    $cmd = Get-Command spicetify -ErrorAction SilentlyContinue
    if ($cmd) { $spicetify = $cmd.Source }
    if (-not $spicetify) {
        foreach ($candidate in @(
            (Join-Path $env:LOCALAPPDATA "spicetify\spicetify.exe"),
            (Join-Path $env:APPDATA "spicetify\spicetify.exe")
        )) {
            if (Test-Path $candidate) { $spicetify = $candidate; break }
        }
    }
    if (-not $spicetify) {
        Write-Host ""
        Write-Host "  Spicetify not found." -ForegroundColor Red
        Write-Host "  Install it first: https://spicetify.app/docs/getting-started  then run this command again." -ForegroundColor Red
        return
    }
    Write-Ok $spicetify

    # 2) Pasta CustomApps
    Write-Step "Locating the CustomApps folder..."
    $userData = $null
    try { $userData = (& $spicetify path userdata 2>$null | Select-Object -Last 1).Trim() } catch { }
    if (-not $userData -or -not (Test-Path $userData)) { $userData = Join-Path $env:APPDATA "spicetify" }
    $target = Join-Path $userData "CustomApps\$AppId"
    Write-Ok $target

    # 3) Download to a temporary folder + validation
    Write-Step "Downloading files from GitHub..."
    $temp = Join-Path ([IO.Path]::GetTempPath()) ("on-this-day-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $temp -Force | Out-Null
    try {
        $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        foreach ($file in $Files) {
            $url = "$Raw/$file`?t=$stamp"
            Invoke-WebRequest -Uri $url -OutFile (Join-Path $temp $file) -UseBasicParsing -Headers @{ "Cache-Control" = "no-cache" }
        }

        $manifest = Get-Content (Join-Path $temp "manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($manifest.name -ne "On This Day" -or -not $manifest.icon) { throw "Invalid manifest.json (the download may have failed)." }
        if ((Get-Item (Join-Path $temp "index.js")).Length -lt 5000) { throw "Incomplete index.js." }
        if ((Get-Item (Join-Path $temp "style.css")).Length -lt 1000) { throw "Incomplete style.css." }
        Write-Ok ("Version " + $manifest.version)

        # 4) Install (replaces the previous version)
        Write-Step "Installing..."
        if (Test-Path $target) { Remove-Item -Recurse -Force $target }
        New-Item -ItemType Directory -Path $target -Force | Out-Null
        Copy-Item (Join-Path $temp "*") $target -Force
        Write-Ok "Files copied."
    }
    finally {
        Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue
    }

    # 5) Enable and apply
    Write-Step "Enabling the app and applying it to Spotify..."
    & $spicetify config custom_apps $AppId | Out-Null
    & $spicetify apply
    if ($LASTEXITCODE -ne 0) {
        Write-Warn2 "'spicetify apply' returned an error. If this is your first time with Spicetify, run:  spicetify backup apply"
        return
    }

    Write-Host ""
    Write-Host "Done! On This Day v$($manifest.version) installed. If Spotify was open, it restarts by itself." -ForegroundColor Green
}

try { Install-OnThisDay }
catch {
    Write-Host ""
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Try the manual method described in the project README." -ForegroundColor Yellow
}
