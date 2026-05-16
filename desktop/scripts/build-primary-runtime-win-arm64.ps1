[CmdletBinding()]
param(
  [string] $SourceManifestUrl = "https://persistent.oaistatic.com/codex-primary-runtime/latest/win32-x64/LATEST.json",
  [string] $Arm64ManifestUrl = $env:PRIMARY_RUNTIME_ARM64_MANIFEST_URL,
  [string] $Arm64NodeArchiveUrl = $env:PRIMARY_RUNTIME_ARM64_NODE_ARCHIVE_URL,
  [string] $Arm64PythonArchiveUrl = $env:PRIMARY_RUNTIME_ARM64_PYTHON_ARCHIVE_URL,
  [string] $Repository = $env:GITHUB_REPOSITORY,
  [string] $ReleaseTag = "codex-primary-runtime-win32-arm64",
  [string] $OutputRoot = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Repository)) {
  $Repository = "sliepie/codex-app"
}

$desktopRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $desktopRoot "out\primary-runtime\win32-arm64"
}

$runtimeRootDirectoryName = "codex-primary-runtime"
$targetPlatform = "win32"
$targetArch = "arm64"
$manifestFileName = "LATEST.json"
$githubReleaseBaseUrl = "https://github.com/$Repository/releases/download/$ReleaseTag"
$workRoot = Join-Path $OutputRoot "work"

function New-CleanDirectory([string] $Path) {
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Save-UrlOrFile([string] $Source, [string] $Destination) {
  if ([string]::IsNullOrWhiteSpace($Source)) {
    throw "Missing source for $Destination."
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
  if ($Source -match "^https?://") {
    Invoke-WebRequest -Uri $Source -Headers @{ "User-Agent" = "codex-primary-runtime-builder" } -OutFile $Destination -TimeoutSec 300
    return
  }

  if (!(Test-Path -LiteralPath $Source)) {
    throw "Input file does not exist: $Source"
  }
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Read-JsonFile([string] $Path) {
  return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
}

function Write-JsonFile([string] $Path, [object] $Value) {
  $json = $Value | ConvertTo-Json -Depth 20
  $encoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
  [System.IO.File]::WriteAllText(
    $Path,
    $json,
    $encoding
  )
}

function Get-Sha256([string] $Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Add-ManifestValue([System.Collections.Specialized.OrderedDictionary] $Manifest, [string] $Name, [object] $Value) {
  if ($null -eq $Value) {
    return
  }

  if ($Value -is [string] -and [string]::IsNullOrWhiteSpace($Value)) {
    return
  }

  $Manifest[$Name] = $Value
}

function Get-ArchiveNameFromUrl([string] $ArchiveUrl) {
  if ([string]::IsNullOrWhiteSpace($ArchiveUrl)) {
    return $null
  }

  if ($ArchiveUrl -match "^https?://") {
    try {
      $uri = [System.Uri] $ArchiveUrl
      return [System.IO.Path]::GetFileName($uri.AbsolutePath)
    }
    catch {
      return $null
    }
  }

  $withoutQuery = ($ArchiveUrl -split "\?", 2)[0]
  return Split-Path -Leaf $withoutQuery
}

function Get-ArchiveExtensionForFormat([string] $Format) {
  if ([string]::IsNullOrWhiteSpace($Format)) {
    return $null
  }

  switch ($Format.ToLowerInvariant()) {
    "zip" { return ".zip" }
    "tar.xz" { return ".tar.xz" }
    default { throw "Unsupported primary runtime archive format: $Format" }
  }
}

function Get-SupportedArchiveExtension([string] $ArchiveName) {
  if ([string]::IsNullOrWhiteSpace($ArchiveName)) {
    return $null
  }

  if ($ArchiveName.EndsWith(".tar.xz", [StringComparison]::OrdinalIgnoreCase)) {
    return ".tar.xz"
  }
  if ($ArchiveName.EndsWith(".zip", [StringComparison]::OrdinalIgnoreCase)) {
    return ".zip"
  }

  return $null
}

function Resolve-ArchiveName([object] $Manifest, [string] $DefaultBaseName) {
  $formatExtension = Get-ArchiveExtensionForFormat -Format ([string] $Manifest.format)

  if (![string]::IsNullOrWhiteSpace($Manifest.archiveName)) {
    $archiveName = [System.IO.Path]::GetFileName([string] $Manifest.archiveName)
    $archiveExtension = Get-SupportedArchiveExtension -ArchiveName $archiveName
    if ($null -ne $archiveExtension) {
      if (![string]::IsNullOrWhiteSpace($formatExtension) -and $archiveExtension -ne $formatExtension) {
        throw "Manifest archiveName extension $archiveExtension does not match format $($Manifest.format)."
      }

      return $archiveName
    }
    if (![string]::IsNullOrWhiteSpace($formatExtension)) {
      return "$archiveName$formatExtension"
    }

    throw "Cannot determine primary runtime archive format for archiveName $archiveName; manifest must provide format or a supported archive extension."
  }

  $archiveName = Get-ArchiveNameFromUrl -ArchiveUrl ([string] $Manifest.archiveUrl)
  if (![string]::IsNullOrWhiteSpace($archiveName)) {
    $archiveExtension = Get-SupportedArchiveExtension -ArchiveName $archiveName
    if ($null -ne $archiveExtension) {
      if (![string]::IsNullOrWhiteSpace($formatExtension) -and $archiveExtension -ne $formatExtension) {
        throw "Manifest archiveUrl extension $archiveExtension does not match format $($Manifest.format)."
      }

      return $archiveName
    }
    if (![string]::IsNullOrWhiteSpace($formatExtension)) {
      return "$archiveName$formatExtension"
    }

    throw "Cannot determine primary runtime archive format for archiveUrl $($Manifest.archiveUrl); manifest must provide format or a supported archive extension."
  }

  if (![string]::IsNullOrWhiteSpace($formatExtension)) {
    return "$DefaultBaseName$formatExtension"
  }

  throw "Cannot determine primary runtime archive name; manifest must provide archiveName, an archiveUrl with a file name, or format."
}

function Expand-InputArchive([string] $ArchivePath, [string] $Destination) {
  New-CleanDirectory $Destination
  if ($ArchivePath.EndsWith(".zip", [StringComparison]::OrdinalIgnoreCase)) {
    Expand-Archive -LiteralPath $ArchivePath -DestinationPath $Destination -Force
    return
  }

  if (
    $ArchivePath.EndsWith(".tar.xz", [StringComparison]::OrdinalIgnoreCase) -or
    $ArchivePath.EndsWith(".tgz", [StringComparison]::OrdinalIgnoreCase) -or
    $ArchivePath.EndsWith(".tar.gz", [StringComparison]::OrdinalIgnoreCase)
  ) {
    tar.exe -xf $ArchivePath -C $Destination
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to extract archive: $ArchivePath"
    }
    return
  }

  throw "Unsupported archive format: $ArchivePath"
}

function Find-ReplacementRoot([string] $ExtractRoot, [string] $Name) {
  $candidates = @(
    (Join-Path $ExtractRoot "$runtimeRootDirectoryName\dependencies\$Name"),
    (Join-Path $ExtractRoot "dependencies\$Name"),
    (Join-Path $ExtractRoot $Name)
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Container) {
      return $candidate
    }
  }

  $directChild = Get-ChildItem -LiteralPath $ExtractRoot -Directory | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
  if ($null -ne $directChild) {
    return $directChild.FullName
  }

  throw "Could not find '$Name' replacement root in $ExtractRoot. Expected $Name, dependencies/$Name, or $runtimeRootDirectoryName/dependencies/$Name."
}

function Replace-DependencyDirectory([string] $ArchiveUrl, [string] $Name, [string] $PayloadRoot) {
  $downloadPath = Join-Path $workRoot "$Name-replacement"
  if ($ArchiveUrl -match "\.zip($|\?)") {
    $downloadPath = "$downloadPath.zip"
  } elseif ($ArchiveUrl -match "\.tar\.xz($|\?)") {
    $downloadPath = "$downloadPath.tar.xz"
  } elseif ($ArchiveUrl -match "\.tgz($|\?)") {
    $downloadPath = "$downloadPath.tgz"
  } elseif ($ArchiveUrl -match "\.tar\.gz($|\?)") {
    $downloadPath = "$downloadPath.tar.gz"
  } else {
    $downloadPath = "$downloadPath.zip"
  }

  Save-UrlOrFile -Source $ArchiveUrl -Destination $downloadPath

  $extractPath = Join-Path $workRoot "$Name-replacement-extract"
  Expand-InputArchive -ArchivePath $downloadPath -Destination $extractPath
  $replacementRoot = Find-ReplacementRoot -ExtractRoot $extractPath -Name $Name
  $targetPath = Join-Path $PayloadRoot "$runtimeRootDirectoryName\dependencies\$Name"

  if (Test-Path -LiteralPath $targetPath) {
    Remove-Item -LiteralPath $targetPath -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetPath) | Out-Null
  Copy-Item -LiteralPath $replacementRoot -Destination $targetPath -Recurse
}

function Get-PortableExecutableMachine([string] $Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    if ($stream.Length -lt 64) {
      return $null
    }

    $reader = New-Object System.IO.BinaryReader($stream)
    if ($reader.ReadUInt16() -ne 0x5A4D) {
      return $null
    }

    $stream.Position = 0x3C
    $peOffset = $reader.ReadInt32()
    if ($peOffset -lt 0 -or $peOffset + 6 -gt $stream.Length) {
      return $null
    }

    $stream.Position = $peOffset
    if ($reader.ReadUInt32() -ne 0x00004550) {
      return $null
    }

    return $reader.ReadUInt16()
  }
  finally {
    $stream.Dispose()
  }
}

function Get-PortableExecutableMachineName([object] $Machine) {
  if ($null -eq $Machine) {
    return $null
  }

  switch ([UInt16] $Machine) {
    0xAA64 { return "arm64" }
    0x8664 { return "x64" }
    0x014C { return "x86" }
    0x01C4 { return "arm" }
    default { return "0x{0:X4}" -f ([UInt16] $Machine) }
  }
}

function Test-IsPythonLauncherTemplate([string] $RelativePath) {
  $normalized = $RelativePath.Replace("\", "/")
  return $normalized -match "^dependencies/python/Lib/site-packages/pip/_vendor/distlib/[tw](32|64|64-arm)\.exe$" -or
    $normalized -match "^dependencies/python/Lib/site-packages/setuptools/(cli|gui)(-32|-64|-arm64)?\.exe$"
}

function Get-RelativeRuntimePath([string] $RuntimeRoot, [string] $Path) {
  $root = [System.IO.Path]::GetFullPath($RuntimeRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $file = [System.IO.Path]::GetFullPath($Path)
  if (!$file.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Path is outside runtime root: $Path"
  }

  return $file.Substring($root.Length + 1)
}

function Assert-NoX64NativePayload([string] $RuntimeRoot) {
  $nativeFiles = Get-ChildItem -LiteralPath $RuntimeRoot -Recurse -File |
    Where-Object {
      $_.FullName -match "win32-x64|x64-msvc|libcrypto-3-x64|libssl-3-x64" -or
      ($_.Extension -in @(".exe", ".dll", ".node", ".pyd") -and $_.Name -match "x64")
    } |
    Select-Object -First 20

  if ($nativeFiles.Count -gt 0) {
    $paths = $nativeFiles | ForEach-Object { $_.FullName }
    throw "Refusing to publish ARM64 runtime bundle because x64 native payloads remain: $($paths -join '; ')"
  }

  $wrongMachineFiles = @()
  $nativePayloads = Get-ChildItem -LiteralPath $RuntimeRoot -Recurse -File |
    Where-Object { $_.Extension -in @(".exe", ".dll", ".node", ".pyd") }
  foreach ($nativePayload in $nativePayloads) {
    $relative = Get-RelativeRuntimePath -RuntimeRoot $RuntimeRoot -Path $nativePayload.FullName
    if (Test-IsPythonLauncherTemplate -RelativePath $relative) {
      continue
    }

    $machine = Get-PortableExecutableMachine -Path $nativePayload.FullName
    $machineName = Get-PortableExecutableMachineName -Machine $machine
    if ($null -eq $machineName) {
      $wrongMachineFiles += "$relative (not a portable executable)"
    } elseif ($machineName -ne "arm64") {
      $wrongMachineFiles += "$relative ($machineName)"
    }
  }

  if ($wrongMachineFiles.Count -gt 0) {
    throw "Refusing to publish ARM64 runtime bundle because non-ARM64 native payloads remain: $($wrongMachineFiles[0..([Math]::Min(19, $wrongMachineFiles.Count - 1))] -join '; ')"
  }
}

function Update-RuntimeJson([string] $RuntimeRoot, [object] $Manifest) {
  $runtimeJsonPath = Join-Path $RuntimeRoot "runtime.json"
  $runtimeJson = Read-JsonFile $runtimeJsonPath
  $runtimeJson.targetPlatform = $targetPlatform
  $runtimeJson.targetArch = $targetArch
  if ($Manifest.bundleVersion) {
    $runtimeJson.bundleVersion = $Manifest.bundleVersion
  }
  Write-JsonFile -Path $runtimeJsonPath -Value $runtimeJson
}

function New-ReleaseManifest(
  [object] $SourceManifest,
  [string] $ArchivePath,
  [string] $Format = $SourceManifest.format
) {
  $archive = Get-Item -LiteralPath $ArchivePath
  $manifest = [ordered]@{
    archiveName = $archive.Name
    archiveSha256 = Get-Sha256 $archive.FullName
    archiveSizeBytes = $archive.Length
    archiveUrl = "$githubReleaseBaseUrl/$($archive.Name)"
    latestManifestFileName = $manifestFileName
    latestManifestUrl = "$githubReleaseBaseUrl/$manifestFileName"
    runtimeRootDirectoryName = $runtimeRootDirectoryName
    targetArch = $targetArch
    targetPlatform = $targetPlatform
  }

  Add-ManifestValue -Manifest $manifest -Name "bundleFormatVersion" -Value $SourceManifest.bundleFormatVersion
  Add-ManifestValue -Manifest $manifest -Name "bundleVersion" -Value $SourceManifest.bundleVersion
  Add-ManifestValue -Manifest $manifest -Name "format" -Value $Format
  Add-ManifestValue -Manifest $manifest -Name "generatedDependencies" -Value $SourceManifest.generatedDependencies
  Add-ManifestValue -Manifest $manifest -Name "nodeVersion" -Value $SourceManifest.nodeVersion
  Add-ManifestValue -Manifest $manifest -Name "pythonVersion" -Value $SourceManifest.pythonVersion

  return $manifest
}

function Publish-MirroredArm64Bundle([string] $ManifestUrl) {
  $manifestPath = Join-Path $workRoot "arm64-source-LATEST.json"
  Save-UrlOrFile -Source $ManifestUrl -Destination $manifestPath
  $manifest = Read-JsonFile $manifestPath

  if ($manifest.targetPlatform -ne $targetPlatform -or $manifest.targetArch -ne $targetArch) {
    throw "ARM64 source manifest target mismatch. Expected $targetPlatform-$targetArch, got $($manifest.targetPlatform)-$($manifest.targetArch)."
  }

  $archiveName = Resolve-ArchiveName -Manifest $manifest -DefaultBaseName "codex-primary-runtime-win32-arm64-$($manifest.bundleVersion)"

  $archivePath = Join-Path $OutputRoot $archiveName
  Save-UrlOrFile -Source $manifest.archiveUrl -Destination $archivePath

  $actualHash = Get-Sha256 $archivePath
  if ($manifest.archiveSha256 -and $actualHash -ne $manifest.archiveSha256.ToLowerInvariant()) {
    throw "Downloaded ARM64 archive hash mismatch. Expected $($manifest.archiveSha256), got $actualHash."
  }

  $payloadRoot = Join-Path $workRoot "arm64-source-payload"
  Expand-InputArchive -ArchivePath $archivePath -Destination $payloadRoot
  $runtimeRoot = Join-Path $payloadRoot $runtimeRootDirectoryName
  if (!(Test-Path -LiteralPath $runtimeRoot -PathType Container)) {
    throw "Mirrored ARM64 archive does not contain $runtimeRootDirectoryName at its root."
  }
  Assert-NoX64NativePayload -RuntimeRoot $runtimeRoot

  $releaseManifest = New-ReleaseManifest -SourceManifest $manifest -ArchivePath $archivePath
  Write-JsonFile -Path (Join-Path $OutputRoot $manifestFileName) -Value $releaseManifest
}

function Publish-ComposedArm64Bundle() {
  if ([string]::IsNullOrWhiteSpace($Arm64NodeArchiveUrl) -or [string]::IsNullOrWhiteSpace($Arm64PythonArchiveUrl)) {
    throw @"
Cannot compose a Windows ARM64 primary runtime from the public x64 bundle without complete ARM64 replacements.

Public OAI win32-arm64 currently has no manifest, and the OAI alpha blob feed is not publicly readable from this environment.
Set PRIMARY_RUNTIME_ARM64_MANIFEST_URL to mirror a private/OAI ARM64 runtime bundle, or set both PRIMARY_RUNTIME_ARM64_NODE_ARCHIVE_URL and PRIMARY_RUNTIME_ARM64_PYTHON_ARCHIVE_URL to archives containing complete dependencies/node and dependencies/python trees.
"@
  }

  $sourceManifestPath = Join-Path $workRoot "source-LATEST.json"
  Save-UrlOrFile -Source $SourceManifestUrl -Destination $sourceManifestPath
  $sourceManifest = Read-JsonFile $sourceManifestPath

  if ($sourceManifest.targetPlatform -ne $targetPlatform -or $sourceManifest.targetArch -ne "x64") {
    throw "Source manifest target mismatch. Expected $targetPlatform-x64, got $($sourceManifest.targetPlatform)-$($sourceManifest.targetArch)."
  }

  $sourceArchiveName = Resolve-ArchiveName -Manifest $sourceManifest -DefaultBaseName "source-primary-runtime"
  $sourceArchivePath = Join-Path $workRoot $sourceArchiveName
  Save-UrlOrFile -Source $sourceManifest.archiveUrl -Destination $sourceArchivePath

  $sourceHash = Get-Sha256 $sourceArchivePath
  if ($sourceHash -ne $sourceManifest.archiveSha256.ToLowerInvariant()) {
    throw "Source archive hash mismatch. Expected $($sourceManifest.archiveSha256), got $sourceHash."
  }

  $payloadRoot = Join-Path $workRoot "payload"
  Expand-InputArchive -ArchivePath $sourceArchivePath -Destination $payloadRoot

  Replace-DependencyDirectory -ArchiveUrl $Arm64NodeArchiveUrl -Name "node" -PayloadRoot $payloadRoot
  Replace-DependencyDirectory -ArchiveUrl $Arm64PythonArchiveUrl -Name "python" -PayloadRoot $payloadRoot

  $runtimeRoot = Join-Path $payloadRoot $runtimeRootDirectoryName
  Update-RuntimeJson -RuntimeRoot $runtimeRoot -Manifest $sourceManifest
  Assert-NoX64NativePayload -RuntimeRoot $runtimeRoot

  $archiveName = "codex-primary-runtime-win32-arm64-$($sourceManifest.bundleVersion).tar.xz"
  $archivePath = Join-Path $OutputRoot $archiveName
  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }

  tar.exe -c -J -f $archivePath -C $payloadRoot $runtimeRootDirectoryName
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create $archivePath."
  }

  $releaseManifest = New-ReleaseManifest -SourceManifest $sourceManifest -ArchivePath $archivePath -Format "tar.xz"
  Write-JsonFile -Path (Join-Path $OutputRoot $manifestFileName) -Value $releaseManifest
}

New-CleanDirectory $OutputRoot
New-CleanDirectory $workRoot

if ([string]::IsNullOrWhiteSpace($Arm64ManifestUrl)) {
  Publish-ComposedArm64Bundle
} else {
  Publish-MirroredArm64Bundle -ManifestUrl $Arm64ManifestUrl
}

Remove-Item -LiteralPath $workRoot -Recurse -Force
Get-ChildItem -LiteralPath $OutputRoot -File | Select-Object FullName, Length
