#Requires -Version 5.1
<#
.SYNOPSIS
    Lance la stack des images publiees M9_TCG de facon fiable sous Windows.

.USAGE
    powershell -ExecutionPolicy Bypass -File .\set-up\Docker-Install\setup-docker-images-windows.ps1
#>

$ErrorActionPreference = "Stop"

$ComposeFile = "docker-compose.images.yaml"
$ComposeFileRawUrl = "https://raw.githubusercontent.com/xpelletier07/M9_TCG/main/docker-compose.images.yaml"
$ComposeProjectName = "m9tcg-images"
$DefaultRunDir = Join-Path $Env:LOCALAPPDATA "M9_TCG\images-stack"

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

function Add-CandidatePath {
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

Write-Step "Preparation du fichier Compose (sans code source local)"
$candidateComposePaths = New-Object 'System.Collections.Generic.List[string]'
Add-CandidatePath -List $candidateComposePaths -Path (Join-Path (Get-Location).Path $ComposeFile)
if ($PSScriptRoot) {
    Add-CandidatePath -List $candidateComposePaths -Path (Join-Path (Join-Path $PSScriptRoot "..\..") $ComposeFile)
}

$composePath = $null
foreach ($candidate in $candidateComposePaths) {
    if (Test-Path $candidate -PathType Leaf) {
        $composePath = (Resolve-Path $candidate).Path
        break
    }
}

if ($composePath) {
    Write-Ok "Fichier Compose local detecte: $composePath"
} else {
    $runDir = $DefaultRunDir
    if (-not (Test-Path $runDir -PathType Container)) {
        New-Item -ItemType Directory -Path $runDir -Force | Out-Null
    }
    $composePath = Join-Path $runDir $ComposeFile

    Write-Warn "Fichier Compose local introuvable. Telechargement depuis GitHub..."
    try {
        Invoke-WebRequest -Uri $ComposeFileRawUrl -OutFile $composePath -UseBasicParsing
    } catch {
        Stop-WithError "Impossible de telecharger $ComposeFile." "Verifie l'acces a GitHub (internet/proxy/firewall) puis relance."
    }

    if (-not (Test-Path $composePath -PathType Leaf)) {
        Stop-WithError "Le telechargement de $ComposeFile a echoue." "Relance le script ou recupere manuellement le fichier Compose."
    }
    Write-Ok "Fichier Compose telecharge: $composePath"
}

Write-Step "Lancement de la stack d'images publiees"
docker compose --project-name $ComposeProjectName -f $composePath up -d
if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Echec du demarrage via docker compose." "Si l'erreur mentionne GHCR/access denied, execute 'docker login ghcr.io'."
}

Write-Host ""
Write-Ok "Stack demarree avec succes."
Write-Ok "Client : http://localhost:5173"
Write-Ok "API    : http://localhost:3000"
Write-Ok "Etat   : docker compose --project-name $ComposeProjectName -f `"$composePath`" ps"
Write-Ok "Logs   : docker compose --project-name $ComposeProjectName -f `"$composePath`" logs -f"
