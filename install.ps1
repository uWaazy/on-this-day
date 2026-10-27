<#
  On This Day - instalador / atualizador via RAW (Windows PowerShell)

  Uso (instala ou atualiza):
      irm https://raw.githubusercontent.com/uWaazy/on-this-day/main/install.ps1 | iex

  O que faz (nada além disto):
    1. Localiza o Spicetify e a pasta CustomApps.
    2. Baixa manifest.json, index.js e style.css deste repositório (raw.githubusercontent.com).
    3. Confere se os arquivos são válidos antes de substituir a instalação atual.
    4. Registra o app (spicetify config custom_apps on-this-day) e roda spicetify apply.
  Não coleta dados, não pede senhas e não instala nada fora da pasta do app.
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
    Write-Host "On This Day - instalador" -ForegroundColor Green
    Write-Host "------------------------"

    # PowerShell 5.1 antigo precisa de TLS 1.2 para falar com o GitHub.
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

    # 1) Spicetify
    Write-Step "Procurando o Spicetify..."
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
        Write-Host "  Spicetify nao encontrado." -ForegroundColor Red
        Write-Host "  Instale primeiro: https://spicetify.app/docs/getting-started  e rode este comando de novo." -ForegroundColor Red
        return
    }
    Write-Ok $spicetify

    # 2) Pasta CustomApps
    Write-Step "Localizando a pasta CustomApps..."
    $userData = $null
    try { $userData = (& $spicetify path userdata 2>$null | Select-Object -Last 1).Trim() } catch { }
    if (-not $userData -or -not (Test-Path $userData)) { $userData = Join-Path $env:APPDATA "spicetify" }
    $target = Join-Path $userData "CustomApps\$AppId"
    Write-Ok $target

    # 3) Download para uma pasta temporaria + validacao
    Write-Step "Baixando os arquivos do GitHub..."
    $temp = Join-Path ([IO.Path]::GetTempPath()) ("on-this-day-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $temp -Force | Out-Null
    try {
        $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        foreach ($file in $Files) {
            $url = "$Raw/$file`?t=$stamp"
            Invoke-WebRequest -Uri $url -OutFile (Join-Path $temp $file) -UseBasicParsing -Headers @{ "Cache-Control" = "no-cache" }
        }

        $manifest = Get-Content (Join-Path $temp "manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($manifest.name -ne "On This Day" -or -not $manifest.icon) { throw "manifest.json invalido (o download pode ter falhado)." }
        if ((Get-Item (Join-Path $temp "index.js")).Length -lt 5000) { throw "index.js incompleto." }
        if ((Get-Item (Join-Path $temp "style.css")).Length -lt 1000) { throw "style.css incompleto." }
        Write-Ok ("Versao " + $manifest.version)

        # 4) Instala (substitui a versao anterior)
        Write-Step "Instalando..."
        if (Test-Path $target) { Remove-Item -Recurse -Force $target }
        New-Item -ItemType Directory -Path $target -Force | Out-Null
        Copy-Item (Join-Path $temp "*") $target -Force
        Write-Ok "Arquivos copiados."
    }
    finally {
        Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue
    }

    # 5) Ativa e aplica
    Write-Step "Ativando o app e aplicando no Spotify..."
    & $spicetify config custom_apps $AppId | Out-Null
    & $spicetify apply
    if ($LASTEXITCODE -ne 0) {
        Write-Warn2 "O 'spicetify apply' retornou erro. Se for a primeira vez com Spicetify, rode:  spicetify backup apply"
        return
    }

    Write-Host ""
    Write-Host "Pronto! On This Day v$($manifest.version) instalado. Se o Spotify estava aberto, ele reinicia sozinho." -ForegroundColor Green
}

try { Install-OnThisDay }
catch {
    Write-Host ""
    Write-Host "Falha: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Tente o metodo manual descrito no README do projeto." -ForegroundColor Yellow
}
