#Requires -Version 5.1
<#
.SYNOPSIS
    Lance la stack des images publiees M9_TCG de facon fiable sous Windows.

.USAGE
    powershell -ExecutionPolicy Bypass -File .\set-up\Docker-Install\setup-docker-images-windows.ps1
#>

$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/xpelletier07/M9_TCG.git"
$RepoDirName = "M9_TCG"
$ComposeFile = "docker-compose.images.yaml"
$SqlInitFile = "app/Serveur/db/db.sql"
$ComposeProjectName = "m9tcg-images"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    [!!] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    [XX] $msg" -ForegroundColor Red }

function Stop-WithError {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [string]$Hint
    )

    Write-Err $Message
    if ($Hint) {
        Write-Host "    => $Hint" -ForegroundColor Yellow
    }
    exit 1
}

function Test-M9RepoRoot {
    param([Parameter(Mandatory = $true)][string]$Path)

    $composePath = Join-Path $Path $ComposeFile
    $sqlPath = Join-Path $Path $SqlInitFile

    return (Test-Path $composePath -PathType Leaf) -and (Test-Path $sqlPath -PathType Leaf)
}

function Add-CandidateRoot {
    param(
        [System.Collections.Generic.List[string]]$List,
        [string]$Path
    )

    if (-not [string]::IsNullOrWhiteSpace($Path) -and (Test-Path $Path -PathType Container)) {
        $resolved = (Resolve-Path $Path).Path
        if (-not $List.Contains($resolved)) {
            [void]$List.Add($resolved)
        }
    }
}

Write-Step "Verification des prerequis Docker"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Stop-WithError "Docker est introuvable." "Installe Docker Desktop puis relance le script."
}
Write-Ok "Commande docker detectee"

docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Docker Compose (plugin v2) est indisponible." "Mets Docker Desktop a jour puis relance."
}
Write-Ok "Docker Compose detecte"

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Le moteur Docker ne repond pas." "Demarre Docker Desktop et attends l'etat 'Engine running'."
}
Write-Ok "Moteur Docker actif"

Write-Step "Recherche de la racine du depot"
$currentDir = (Get-Location).Path
$candidateRoots = New-Object 'System.Collections.Generic.List[string]'
Add-CandidateRoot -List $candidateRoots -Path $currentDir
Add-CandidateRoot -List $candidateRoots -Path (Join-Path $currentDir $RepoDirName)

if ($PSScriptRoot) {
    Add-CandidateRoot -List $candidateRoots -Path (Join-Path $PSScriptRoot "..\..")
}

$repoRoot = $null
foreach ($candidate in $candidateRoots) {
    if (Test-M9RepoRoot -Path $candidate) {
        $repoRoot = $candidate
        break
    }
}

if (-not $repoRoot) {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Stop-WithError "Depot introuvable et git absent." "Installe Git ou execute ce script depuis un clone M9_TCG."
    }

    $cloneTarget = Join-Path $currentDir $RepoDirName
    if (Test-Path $cloneTarget) {
        Stop-WithError "Le dossier '$cloneTarget' existe deja mais ne contient pas les fichiers attendus." "Supprime/renomme ce dossier ou lance le script depuis la racine du vrai depot."
    }

    Write-Warn "Depot non detecte. Clonage de $RepoUrl dans $cloneTarget..."
    git clone $RepoUrl $cloneTarget
    if ($LASTEXITCODE -ne 0) {
        Stop-WithError "Echec du clonage du depot." "Verifie ta connexion Internet et l'acces a GitHub."
    }
    $repoRoot = (Resolve-Path $cloneTarget).Path
}

Set-Location $repoRoot
Write-Ok "Racine du depot: $repoRoot"

Write-Step "Verification des fichiers de lancement"
if (-not (Test-Path $ComposeFile -PathType Leaf)) {
    Stop-WithError "Fichier '$ComposeFile' manquant a la racine du depot." "Verifie que le depot n'est pas incomplet."
}
if (-not (Test-Path $SqlInitFile -PathType Leaf)) {
    Stop-WithError "Fichier SQL '$SqlInitFile' introuvable." "Verifie que le depot est complet avant de lancer Compose."
}
Write-Ok "Fichiers requis presents"

Write-Step "Lancement de la stack d'images publiees"
docker compose --project-name $ComposeProjectName -f $ComposeFile up -d
if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Echec du demarrage via docker compose." "Si l'erreur mentionne GHCR/access denied, execute 'docker login ghcr.io' (si les images sont privees), puis relance."
}

Write-Host ""
Write-Ok "Stack demarree avec succes."
Write-Ok "Client : http://localhost:5173"
Write-Ok "API    : http://localhost:3000"
Write-Ok "Etat   : docker compose --project-name $ComposeProjectName -f $ComposeFile ps"
Write-Ok "Logs   : docker compose --project-name $ComposeProjectName -f $ComposeFile logs -f"
