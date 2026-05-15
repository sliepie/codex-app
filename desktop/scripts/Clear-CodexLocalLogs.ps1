[CmdletBinding()]
param(
    [string] $CodexHome = (Join-Path $HOME ".codex"),
    [string] $ArchiveRoot,
    [switch] $Preview
)

$ErrorActionPreference = "Stop"

function Get-CodexProcess {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -eq "Codex.exe" -or $_.Name -eq "codex.exe"
        } |
        Select-Object -Property Name, ProcessId
}

function Format-BytesAsMb {
    param([long] $Bytes)

    return "{0:n1}" -f ($Bytes / 1MB)
}

$runningCodex = @(Get-CodexProcess)
if ($runningCodex.Count -gt 0) {
    $summary = ($runningCodex | ForEach-Object { "$($_.Name) pid=$($_.ProcessId)" }) -join ", "
    throw "Codex is still running ($summary). Close Codex, then run this helper again."
}

if (-not (Test-Path -LiteralPath $CodexHome -PathType Container)) {
    throw "Codex home does not exist: $CodexHome"
}

$codexHomePath = (Resolve-Path -LiteralPath $CodexHome).ProviderPath
if ([string]::IsNullOrWhiteSpace($ArchiveRoot)) {
    $ArchiveRoot = Join-Path $codexHomePath "archived_logs"
}

$logFiles = @(
    Get-ChildItem -LiteralPath $codexHomePath -Filter "logs_2.sqlite*" -File -ErrorAction SilentlyContinue |
        Sort-Object -Property Name
)

if ($logFiles.Count -eq 0) {
    Write-Output "No logs_2.sqlite* files found in $codexHomePath."
    return
}

$totalBytes = ($logFiles | Measure-Object -Property Length -Sum).Sum
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archivePath = Join-Path $ArchiveRoot "manual-log-cleanup-$stamp"

Write-Output ("Found {0} logs_2.sqlite* file(s), {1} MB total." -f $logFiles.Count, (Format-BytesAsMb $totalBytes))
Write-Output "Archive target: $archivePath"
Write-Output "No backups are created; files are moved, not copied."

if ($Preview) {
    foreach ($file in $logFiles) {
        Write-Output ("Preview move: {0} ({1} MB)" -f $file.Name, (Format-BytesAsMb $file.Length))
    }

    return
}

New-Item -ItemType Directory -Path $archivePath -Force | Out-Null

foreach ($file in $logFiles) {
    $destination = Join-Path $archivePath $file.Name
    Move-Item -LiteralPath $file.FullName -Destination $destination -Force
    Write-Output ("Moved {0} ({1} MB)" -f $file.Name, (Format-BytesAsMb $file.Length))
}

Write-Output "Done. Codex will create fresh log files the next time it starts."
