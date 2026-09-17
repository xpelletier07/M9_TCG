#Requires -Version 5.1
<#
.SYNOPSIS
    Toggle script for M9_TCG (Windows).
    - Aucun container existant -> build + up  (creation)
    - Containers existants mais arretes       -> start (ouverture)
    - Containers existants et en cours        -> stop  (fermeture)

.USAGE
    powershell -ExecutionPolicy Bypass -File docker-toggle-windows.ps1
#>

$ErrorActionPreference = "Stop"
$RepoDirName = "M9_TCG"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    [XX] $msg" -ForegroundColor Red }

# ---------------------------------------------------------------------------
# 0. Se positionner a la racine du depot
# ---------------------------------------------------------------------------
if (-not (Test-Path ".git" -PathType Container)) {
    if (Test-Path $RepoDirName) {
        Set-Location $RepoDirName
    } else {
        Write-Err "Pas dans le depot et dossier '$RepoDirName' introuvable ici."
        Write-Err "Lance ce script depuis la racine du repo, ou a cote du dossier $RepoDirName."
        exit 1
    }
}

# ---------------------------------------------------------------------------
# 1. Verifier que le moteur Docker repond
# ---------------------------------------------------------------------------
Write-Step "Verification du moteur Docker"
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "not ready" }
} catch {
    Write-Err "Le moteur Docker ne repond pas. Demarre Docker Desktop et reessaie."
    exit 1
}
Write-Ok "Moteur Docker actif"

# ---------------------------------------------------------------------------
# 2. Etat actuel de la stack
# ---------------------------------------------------------------------------
$allContainers = (docker compose ps -a -q) | Where-Object { $_ -ne "" }
$runningContainers = (docker compose ps -q) | Where-Object { $_ -ne "" }

$totalCount = ($allContainers | Measure-Object).Count
$runningCount = ($runningContainers | Measure-Object).Count

# ---------------------------------------------------------------------------
# 3. Action selon l'etat
# ---------------------------------------------------------------------------
if ($totalCount -eq 0) {
    Write-Step "Aucun container trouve - creation et lancement de la stack"
    docker compose up -d --build
    Write-Ok "Stack creee et demarree"
}
elseif ($runningCount -eq 0) {
    Write-Step "Containers presents mais arretes - ouverture"
    docker compose start
    Write-Ok "Stack demarree"
}
else {
    Write-Step "Containers en cours d'execution - fermeture"
    docker compose stop
    Write-Ok "Stack arretee"
}

Write-Host ""
docker compose ps
