param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [string]$TweakFolderName = "codex-app-ui-overrides",

  [string]$TweakId = "dev.sliepie.codex.ui-overrides",

  [string]$InstalledTweakPath,

  [string]$InstalledVersion,

  [string[]]$SearchRoot = @($env:APPDATA, $env:LOCALAPPDATA, (Join-Path $env:USERPROFILE ".codex")),

  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$Path) {
  return [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path)
}

function Parse-ThreePartVersion([string]$Version) {
  $parts = $Version.Split(".")
  if ($parts.Count -ne 3) {
    throw "Expected a three-part version, got '$Version'."
  }

  return @([int]$parts[0], [int]$parts[1], [int]$parts[2])
}

function Format-ThreePartVersion([int[]]$Parts) {
  return "$($Parts[0]).$($Parts[1]).$($Parts[2])"
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

$manifestRelativePath = "desktop/codex-plusplus/tweaks/$TweakFolderName/manifest.json"
$mainManifestText = git -C $repoFullPath show "origin/main:$manifestRelativePath"
if ($LASTEXITCODE -ne 0 -or -not $mainManifestText) {
  throw "Could not read origin/main:$manifestRelativePath. Re-run with -InstalledVersion."
}

$mainManifest = $mainManifestText | ConvertFrom-Json
if ($mainManifest.id -ne $TweakId) {
  throw "Main branch tweak id '$($mainManifest.id)' does not match expected '$TweakId'."
}

$mainVersionParts = Parse-ThreePartVersion $mainManifest.version
$sourceVersionParts = Parse-ThreePartVersion $sourceManifest.version
$minimumInstalledVersionParts = @($mainVersionParts[0], $mainVersionParts[1], $mainVersionParts[2] + 1)

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

if (-not $InstalledVersion) {
  $targetVersionParts = Parse-ThreePartVersion $targetManifest.version
  if ($targetVersionParts[0] -eq $mainVersionParts[0] -and $targetVersionParts[1] -eq $mainVersionParts[1]) {
    $InstalledVersion = Format-ThreePartVersion @($mainVersionParts[0], $mainVersionParts[1], ([Math]::Max($targetVersionParts[2] + 1, $minimumInstalledVersionParts[2])))
  } else {
    $InstalledVersion = Format-ThreePartVersion $minimumInstalledVersionParts
  }
}

$installedVersionParts = Parse-ThreePartVersion $InstalledVersion
if ($installedVersionParts[0] -ne $mainVersionParts[0] -or $installedVersionParts[1] -ne $mainVersionParts[1]) {
  throw "Installed test copy version '$InstalledVersion' must stay on main minor '$($mainVersionParts[0]).$($mainVersionParts[1])'."
}
if ($installedVersionParts[2] -le $mainVersionParts[2]) {
  throw "Installed test copy version '$InstalledVersion' must increment the main patch '$($mainManifest.version)'."
}
if ($sourceVersionParts[0] -eq $installedVersionParts[0] -and $sourceVersionParts[1] -eq $installedVersionParts[1] -and $sourceVersionParts[2] -le $installedVersionParts[2]) {
  throw "Installed test copy version '$InstalledVersion' must remain lower than bundled PR version '$($sourceManifest.version)'."
}

$sourceFullPath = Resolve-FullPath $sourcePath
$targetFullPath = Resolve-FullPath $targetPath

if ($targetFullPath.StartsWith($repoFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to sync into a target inside the repo: $targetFullPath"
}

Write-Host "Source: $sourceFullPath"
Write-Host "Target: $targetFullPath"
Write-Host "Bundled source version: $($sourceManifest.version)"
Write-Host "Installed version: $($targetManifest.version) -> $InstalledVersion"

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
    if ($file -eq "manifest.json") {
      $installedManifest = Get-Content -LiteralPath $from -Raw | ConvertFrom-Json
      $installedManifest.version = $InstalledVersion
      $installedManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $to
    } else {
      Copy-Item -LiteralPath $from -Destination $to -Force
    }
    Write-Host "Copied $file"
  }
}

if ($WhatIf) {
  Write-Host "Dry run complete."
} else {
  Write-Host "Installed tweak synced."
}
