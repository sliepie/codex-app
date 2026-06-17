param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [string]$TweakFolderName = "codex-app-ui-overrides",

  [string]$TweakId = "dev.sliepie.codex.ui-overrides",

  [string]$InstalledTweakPath,

  [string[]]$SearchRoot = @($env:APPDATA, $env:LOCALAPPDATA, (Join-Path $env:USERPROFILE ".codex")),

  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$Path) {
  return [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path)
}

$repoFullPath = Resolve-FullPath $RepoRoot
$sourcePath = Join-Path $repoFullPath "desktop\codex-plusplus\tweaks\$TweakFolderName"
$sourceManifestPath = Join-Path $sourcePath "manifest.json"

if (-not (Test-Path -LiteralPath $sourceManifestPath)) {
  throw "Source tweak manifest not found: $sourceManifestPath"
}

$sourceManifest = Get-Content -LiteralPath $sourceManifestPath -Raw | ConvertFrom-Json
if ($sourceManifest.id -ne $TweakId) {
  throw "Source tweak id '$($sourceManifest.id)' does not match expected '$TweakId'."
}

$targetPath = $null
if ($InstalledTweakPath) {
  $targetPath = Resolve-FullPath $InstalledTweakPath
} else {
  $manifestMatches = New-Object System.Collections.Generic.List[string]
  foreach ($root in $SearchRoot) {
    if (-not $root -or -not (Test-Path -LiteralPath $root)) {
      continue
    }

    Get-ChildItem -LiteralPath $root -Recurse -Filter manifest.json -File -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch "\\(node_modules|\.git|Cache|Code Cache|GPUCache|Service Worker)\\" } |
      ForEach-Object {
        try {
          $manifest = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
          if ($manifest.id -eq $TweakId) {
            [void]$manifestMatches.Add($_.DirectoryName)
          }
        } catch {
        }
      }
  }

  $uniqueMatches = @($manifestMatches | Sort-Object -Unique)
  if ($uniqueMatches.Count -eq 0) {
    throw "No installed tweak found for '$TweakId'. Re-run with -InstalledTweakPath."
  }
  if ($uniqueMatches.Count -gt 1) {
    $message = "Multiple installed tweaks found for '$TweakId':" + [Environment]::NewLine + ($uniqueMatches -join [Environment]::NewLine)
    throw "$message`nRe-run with -InstalledTweakPath."
  }
  $targetPath = $uniqueMatches[0]
}

$targetManifestPath = Join-Path $targetPath "manifest.json"
if (-not (Test-Path -LiteralPath $targetManifestPath)) {
  throw "Installed tweak manifest not found: $targetManifestPath"
}

$targetManifest = Get-Content -LiteralPath $targetManifestPath -Raw | ConvertFrom-Json
if ($targetManifest.id -ne $TweakId) {
  throw "Installed tweak id '$($targetManifest.id)' does not match expected '$TweakId'."
}

$sourceFullPath = Resolve-FullPath $sourcePath
$targetFullPath = Resolve-FullPath $targetPath

if ($targetFullPath.StartsWith($repoFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to sync into a target inside the repo: $targetFullPath"
}

Write-Host "Source: $sourceFullPath"
Write-Host "Target: $targetFullPath"
Write-Host "Version: $($targetManifest.version) -> $($sourceManifest.version)"

$filesToCopy = @("index.js", "manifest.json")
foreach ($file in $filesToCopy) {
  $from = Join-Path $sourceFullPath $file
  $to = Join-Path $targetFullPath $file

  if (-not (Test-Path -LiteralPath $from)) {
    throw "Source file missing: $from"
  }

  if ($WhatIf) {
    Write-Host "Would copy $file"
  } else {
    Copy-Item -LiteralPath $from -Destination $to -Force
    Write-Host "Copied $file"
  }
}

if ($WhatIf) {
  Write-Host "Dry run complete."
} else {
  Write-Host "Installed tweak synced."
}
