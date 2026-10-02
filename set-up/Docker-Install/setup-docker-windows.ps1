#Requires -Version 5.1
<#
.SYNOPSIS
    Full Docker bootstrap for M9_TCG on Windows.
    Safe to re-run: detects existing Docker Desktop / WSL2 and skips what's already there.

.WHAT IT DOES
    1. Re-launches itself elevated (Docker/WSL install needs admin).
    2. Checks Windows build for WSL2 compatibility.
    3. Enables WSL2 (Windows features + kernel update) if missing.
    4. Installs Docker Desktop via winget if missing.
    5. Starts Docker Desktop and waits until the engine responds.
    6. Clones M9_TCG if you're not already inside it.
    7. Creates .env files from .env.example if missing.
    8. Builds and starts the stack with docker compose.

.USAGE
    powershell -ExecutionPolicy Bypass -File setup-docker-windows.ps1
#>

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/xpelletier07/M9_TCG.git"
$RepoDirName = "M9_TCG"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    [XX] $msg" -ForegroundColor Red }

# ---------------------------------------------------------------------------
# 0. Re-launch elevated if needed
# ---------------------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warn "Ce script doit tourner en administrateur. Relance en cours..."
    $argList = "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Start-Process powershell -Verb RunAs -ArgumentList $argList
    exit
}

# ---------------------------------------------------------------------------
# 1. Windows version check (WSL2 requires build 19041+/Win11)
# ---------------------------------------------------------------------------
Write-Step "Verification de la version de Windows"
$build = [System.Environment]::OSVersion.Version.Build
if ($build -lt 19041) {
    Write-Err "Build Windows $build detecte. WSL2 requiert le build 19041 ou plus recent (Windows 10 2004+ / Windows 11)."
    Write-Err "Mets Windows a jour (Windows Update) avant de relancer ce script."
    exit 1
}
Write-Ok "Build Windows $build - compatible WSL2"

# ---------------------------------------------------------------------------
# 2. WSL2 detection / install
# ---------------------------------------------------------------------------
Write-Step "Verification de WSL2"

function Test-Wsl2Ready {
    try {
        $wslStatus = wsl --status 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) { return $false }
        # Default version 2 means WSL2 is fully set up
        return ($wslStatus -match "Version par d.faut\s*:\s*2" -or $wslStatus -match "Default Version:\s*2")
    } catch {
        return $false
    }
}

$wslReady = Test-Wsl2Ready

if (-not $wslReady) {
    Write-Warn "WSL2 non detecte ou non configure par defaut. Installation en cours..."

    # Enable required Windows features
    $features = @("Microsoft-Windows-Subsystem-Linux", "VirtualMachinePlatform")
    $rebootNeeded = $false
    foreach ($feature in $features) {
        $state = (Get-WindowsOptionalFeature -Online -FeatureName $feature).State
        if ($state -ne "Enabled") {
            Write-Host "    Activation de la fonctionnalite: $feature"
            $result = Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart
            if ($result.RestartNeeded) { $rebootNeeded = $true }
        }
    }

    if ($rebootNeeded) {
        Write-Warn "Un redemarrage de Windows est requis pour terminer l'activation de WSL2."
        Write-Warn "Redemarre la machine, puis relance ce script (setup-docker-windows.ps1) pour continuer."
        exit 0
    }

    # Try the one-shot modern installer first (handles kernel update + default version)
    try {
        wsl --install --no-distribution 2>&1 | Out-Null
    } catch {
        Write-Warn "wsl --install a echoue, tentative via le paquet noyau manuel."
    }

    try { wsl --set-default-version 2 2>&1 | Out-Null } catch { }

    $wslReady = Test-Wsl2Ready
    if (-not $wslReady) {
        Write-Warn "WSL2 installe mais pas encore actif. Un redemarrage est probablement necessaire."
        Write-Warn "Redemarre la machine puis relance ce script."
        exit 0
    }
}
Write-Ok "WSL2 est actif et defini par defaut"

# ---------------------------------------------------------------------------
# 3. winget availability
# ---------------------------------------------------------------------------
Write-Step "Verification de winget"
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Err "winget est introuvable. Installe 'App Installer' depuis le Microsoft Store, puis relance ce script."
    Write-Err "https://apps.microsoft.com/detail/9nblggh4nns1"
    exit 1
}
Write-Ok "winget disponible"

# ---------------------------------------------------------------------------
# 4. Docker Desktop detection / install
# ---------------------------------------------------------------------------
Write-Step "Verification de Docker Desktop"

function Test-DockerInstalled {
    return [bool](Get-Command docker -ErrorAction SilentlyContinue)
}

if (Test-DockerInstalled) {
    Write-Ok "Docker (CLI) deja installe - installation ignoree"
} else {
    Write-Warn "Docker Desktop non trouve. Installation via winget..."
    winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
    Write-Ok "Docker Desktop installe"
    Write-Warn "Il se peut qu'une deconnexion/reconnexion Windows soit necessaire pour finaliser le groupe 'docker-users'."
}

# ---------------------------------------------------------------------------
# 5. Start Docker Desktop and wait for the engine
# ---------------------------------------------------------------------------
Write-Step "Demarrage de Docker Desktop"

$dockerExe = "$Env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
if (-not (Get-Process "Docker Desktop" -ErrorAction SilentlyContinue)) {
    if (Test-Path $dockerExe) {
        Start-Process $dockerExe
    } else {
        Write-Warn "Docker Desktop.exe introuvable au chemin par defaut - demarre-le manuellement depuis le menu Demarrer."
    }
}

Write-Host "    Attente que le moteur Docker reponde (jusqu'a 3 minutes)..."
$maxAttempts = 36
$ready = $false
for ($i = 0; $i -lt $maxAttempts; $i++) {
    try {
        docker info 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 5
}

if (-not $ready) {
    Write-Err "Le moteur Docker ne repond pas apres 3 minutes."
    Write-Err "Ouvre Docker Desktop manuellement, verifie qu'il n'y a pas d'erreur, puis relance ce script."
    exit 1
}
Write-Ok "Moteur Docker actif"

# ---------------------------------------------------------------------------
# 6. Get the repo
# ---------------------------------------------------------------------------
Write-Step "Verification du depot M9_TCG"

$inRepo = Test-Path ".git" -PathType Container
if (-not $inRepo) {
    if (Test-Path $RepoDirName) {
        Write-Ok "Dossier $RepoDirName deja present, on y entre"
        Set-Location $RepoDirName
    } else {
        Write-Host "    Clonage de $RepoUrl ..."
        git clone $RepoUrl
        Set-Location $RepoDirName
    }
} else {
    Write-Ok "Deja a la racine du depot"
}

# ---------------------------------------------------------------------------
# 7. .env files
# ---------------------------------------------------------------------------
Write-Step "Verification des fichiers .env"
Get-ChildItem -Recurse -Filter ".env.example" | ForEach-Object {
    $envPath = Join-Path $_.DirectoryName ".env"
    if (-not (Test-Path $envPath)) {
        Copy-Item $_.FullName $envPath
        Write-Ok "Cree: $envPath"
    } else {
        Write-Ok "Deja present: $envPath"
    }
}

# ---------------------------------------------------------------------------
# 8. Build & start the stack
# ---------------------------------------------------------------------------
Write-Step "Build et lancement des containers (client, server, db)"
docker compose build
docker compose up -d

Write-Host ""
Write-Ok "Termine. Verifie l'etat avec: docker compose ps"
Write-Ok "Logs en direct: docker compose logs -f"
