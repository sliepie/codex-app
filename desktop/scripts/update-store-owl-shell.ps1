[CmdletBinding()]
param(
    [string] $OutputRoot,
    [string] $MetadataOutputPath
)

$ErrorActionPreference = "Stop"
$ProductId = "9PLM9XGG6VKS"
$PackageName = "OpenAI.Codex"
$PackageFamilyName = "OpenAI.Codex_2p2nqsd0c76g0"
$RequiredArchitecture = "Arm64"
$NativePayloadExtensions = @(".exe", ".dll", ".node")

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $PSScriptRoot "..\.cache\store-owl-shell\package"
}
if ([string]::IsNullOrWhiteSpace($MetadataOutputPath)) {
    $defaultMetadataOutputPath = Join-Path $PSScriptRoot "..\resources\store-owl-shell.json"
    $MetadataOutputPath = $defaultMetadataOutputPath
}

function Invoke-Winget {
    param(
        [string[]] $Arguments,
        [switch] $AllowNoApplicableUpgrade
    )

    & winget @Arguments
    if ($LASTEXITCODE -ne 0) {
        $noApplicableUpgradeExitCode = -1978335189
        if ($AllowNoApplicableUpgrade -and $LASTEXITCODE -eq $noApplicableUpgradeExitCode) {
            Write-Output "No newer Codex Store package is available; using the installed package."
            return
        }

        throw "winget $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

function Get-CodexAppPackages {
    Get-AppxPackage -Name $PackageName -ErrorAction SilentlyContinue |
        Where-Object { $_.PackageFamilyName -eq $PackageFamilyName } |
        Sort-Object -Property Version -Descending
}

function Get-CodexAppPackage {
    Get-CodexAppPackages |
        Where-Object {
            [string] $_.Architecture -eq $RequiredArchitecture
        } |
        Sort-Object -Property Version -Descending |
        Select-Object -First 1
}

function Assert-Arm64Package {
    param($Package)

    if ([string] $Package.Architecture -ne $RequiredArchitecture) {
        throw "Official Codex Store package $($Package.PackageFullName) is $($Package.Architecture); expected $RequiredArchitecture for the Windows ARM64 payload."
    }
}

function Get-Sha256 {
    param([string] $Path)

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha256.ComputeHash([System.IO.File]::ReadAllBytes($Path))
        return ([System.BitConverter]::ToString($hashBytes) -replace "-", "").ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
    }
}

function Get-PeMachine {
    param([string] $Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 0x40 -or $bytes[0] -ne 0x4d -or $bytes[1] -ne 0x5a) {
        throw "Expected a PE executable: $Path"
    }

    $peOffset = [System.BitConverter]::ToInt32($bytes, 0x3c)
    if ($peOffset -lt 0 -or $peOffset + 6 -gt $bytes.Length) {
        throw "Invalid PE header offset in $Path."
    }
    if ($bytes[$peOffset] -ne 0x50 -or $bytes[$peOffset + 1] -ne 0x45 -or $bytes[$peOffset + 2] -ne 0 -or $bytes[$peOffset + 3] -ne 0) {
        throw "Invalid PE signature in $Path."
    }

    return [System.BitConverter]::ToUInt16($bytes, $peOffset + 4)
}

function Get-RelativePath {
    param(
        [string] $BasePath,
        [string] $Path
    )

    $baseUri = [System.Uri]((Join-Path ([System.IO.Path]::GetFullPath($BasePath)) ".") + [System.IO.Path]::DirectorySeparatorChar)
    $pathUri = [System.Uri]([System.IO.Path]::GetFullPath($Path))
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($pathUri).ToString()).Replace("/", "\")
}

function Format-PeMachine {
    param([uint16] $Machine)

    switch ($Machine) {
        0x8664 { "x64" }
        0xaa64 { "arm64" }
        0x014c { "x86" }
        default { "0x{0:x4}" -f $Machine }
    }
}

function Test-PeFile {
    param([string] $Path)

    $stream = [System.IO.File]::OpenRead($Path)
    try {
        if ($stream.Length -lt 2) {
            return $false
        }

        return $stream.ReadByte() -eq 0x4d -and $stream.ReadByte() -eq 0x5a
    }
    finally {
        $stream.Dispose()
    }
}

function Test-NativePayloadCandidate {
    param([string] $Path)

    $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    if ($extension -notin $NativePayloadExtensions) {
        return $false
    }

    if ($extension -eq ".node") {
        return Test-PeFile -Path $Path
    }

    return $true
}

function Get-DirectoryDigest {
    param([string] $Path)

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $entries = Get-ChildItem -LiteralPath $Path -Recurse -File |
            Sort-Object -Property FullName |
            ForEach-Object {
                $relativePath = (Get-RelativePath -BasePath $Path -Path $_.FullName).Replace("\", "/")
                "$relativePath $($_.Length) $(Get-Sha256 -Path $_.FullName)"
            }
        $payload = [System.Text.Encoding]::UTF8.GetBytes(($entries -join "`n"))
        $hashBytes = $sha256.ComputeHash($payload)
        [pscustomobject]@{
            fileCount = @($entries).Count
            sha256 = (([System.BitConverter]::ToString($hashBytes) -replace "-", "").ToLowerInvariant())
        }
    }
    finally {
        $sha256.Dispose()
    }
}

function Get-RepoRelativePathOrNull {
    param(
        [string] $RepoRoot,
        [string] $Path
    )

    $resolvedRepoRoot = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $resolvedPath = [System.IO.Path]::GetFullPath($Path)
    $repoRootWithSeparator = $resolvedRepoRoot + [System.IO.Path]::DirectorySeparatorChar

    if ($resolvedPath.Equals($resolvedRepoRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
        $resolvedPath.StartsWith($repoRootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
        return (Get-RelativePath -BasePath $resolvedRepoRoot -Path $resolvedPath).Replace("\", "/")
    }

    return $null
}

function Copy-StorePath {
    param(
        [string] $SourceRoot,
        [string] $DestinationRoot,
        [string] $RelativePath,
        [string] $Kind,
        [bool] $SelfSignedMutable = $false
    )

    $sourcePath = Join-Path $SourceRoot ($RelativePath -replace "/", "\")
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        throw "Missing Store/Owl shell payload path: $RelativePath"
    }

    $destinationPath = Join-Path $DestinationRoot ($RelativePath -replace "/", "\")
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destinationPath) | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Recurse -Force

    if ($Kind -eq "directory") {
        $digest = Get-DirectoryDigest -Path $destinationPath
        $directoryEntry = [ordered]@{
            sourceRelativePath = $RelativePath
            kind = "directory"
            fileCount = $digest.fileCount
            sha256 = $digest.sha256
        }
        $nestedExecutableEntries = Get-ChildItem -LiteralPath $destinationPath -Recurse -File |
            Where-Object { Test-NativePayloadCandidate -Path $_.FullName } |
            Sort-Object -Property FullName |
            ForEach-Object {
                $nestedRelativePath = (Get-RelativePath -BasePath $DestinationRoot -Path $_.FullName).Replace("\", "/")
                [ordered]@{
                    sourceRelativePath = $nestedRelativePath
                    kind = "nestedExecutable"
                    size = $_.Length
                    sha256 = Get-Sha256 -Path $_.FullName
                    architecture = Format-PeMachine -Machine (Get-PeMachine -Path $_.FullName)
                    containedIn = $RelativePath
                }
            }
        return @($directoryEntry) + @($nestedExecutableEntries)
    }

    $entry = [ordered]@{
        sourceRelativePath = $RelativePath
        kind = "file"
        size = (Get-Item -LiteralPath $destinationPath).Length
        sha256 = Get-Sha256 -Path $destinationPath
    }
    if ($SelfSignedMutable) {
        $entry.selfSignedMutable = $true
    }
    if (Test-NativePayloadCandidate -Path $destinationPath) {
        $entry.architecture = Format-PeMachine -Machine (Get-PeMachine -Path $destinationPath)
    }
    return $entry
}

function Copy-StorePattern {
    param(
        [string] $SourceRoot,
        [string] $DestinationRoot,
        [string] $Pattern,
        [bool] $SelfSignedMutable = $false
    )

    Get-ChildItem -LiteralPath $SourceRoot -Filter $Pattern -File |
        Sort-Object -Property Name |
        ForEach-Object {
            Copy-StorePath -SourceRoot $SourceRoot -DestinationRoot $DestinationRoot -RelativePath $_.Name -Kind "file" -SelfSignedMutable ($SelfSignedMutable -and $_.Name -eq "resources.pri")
        }
}

function Copy-StoreDirectoryFiles {
    param(
        [string] $SourceRoot,
        [string] $DestinationRoot,
        [string] $RelativeDirectory,
        [string] $Pattern
    )

    $sourceDirectory = Join-Path $SourceRoot ($RelativeDirectory -replace "/", "\")
    if (-not (Test-Path -LiteralPath $sourceDirectory)) {
        throw "Missing Store/Owl shell payload directory: $RelativeDirectory"
    }

    Get-ChildItem -LiteralPath $sourceDirectory -Filter $Pattern -File |
        Sort-Object -Property Name |
        ForEach-Object {
            Copy-StorePath -SourceRoot $SourceRoot -DestinationRoot $DestinationRoot -RelativePath "$RelativeDirectory/$($_.Name)" -Kind "file"
        }
}

$payloadPaths = @(
    @{ RelativePath = "AppxManifest.xml"; Kind = "file"; SelfSignedMutable = $true },
    @{ RelativePath = "assets"; Kind = "directory" },
    @{ RelativePath = "app/locales"; Kind = "directory" },
    @{ RelativePath = "app/resources"; Kind = "directory" }
)

$existingOfficialPackages = @(Get-CodexAppPackages)
$existingPackage = Get-CodexAppPackage
$hadOfficialPackageBeforeRun = $existingOfficialPackages.Count -gt 0
$needsArm64Install = $null -eq $existingPackage

try {
    if ($needsArm64Install) {
        Invoke-Winget @(
            "install",
            "--id", $ProductId,
            "--source", "msstore",
            "--exact",
            "--scope", "user",
            "--architecture", "arm64",
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
            "--authentication-mode", "silent",
            "--disable-interactivity"
        )
    }
    else {
        Invoke-Winget -AllowNoApplicableUpgrade -Arguments @(
            "upgrade",
            "--id", $ProductId,
            "--source", "msstore",
            "--exact",
            "--scope", "user",
            "--architecture", "arm64",
            "--silent",
            "--include-unknown",
            "--accept-package-agreements",
            "--accept-source-agreements",
            "--authentication-mode", "silent",
            "--disable-interactivity"
        )
    }

    $package = Get-CodexAppPackage
    if ($null -eq $package) {
        throw "Official Codex Store package family $PackageFamilyName was not found after winget completed."
    }
    Assert-Arm64Package -Package $package

    $repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
    $resolvedOutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
    $metadataPayloadRoot = Get-RepoRelativePathOrNull -RepoRoot $repoRoot -Path $resolvedOutputRoot
    if (Test-Path -LiteralPath $resolvedOutputRoot) {
        Remove-Item -LiteralPath $resolvedOutputRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $resolvedOutputRoot | Out-Null

    $entries = @()
    foreach ($payloadPath in $payloadPaths) {
        $entries += Copy-StorePath -SourceRoot $package.InstallLocation -DestinationRoot $resolvedOutputRoot -RelativePath $payloadPath.RelativePath -Kind $payloadPath.Kind -SelfSignedMutable ([bool] $payloadPath.SelfSignedMutable)
    }
    $entries += Copy-StoreDirectoryFiles -SourceRoot $package.InstallLocation -DestinationRoot $resolvedOutputRoot -RelativeDirectory "app" -Pattern "*"
    $entries += Copy-StorePattern -SourceRoot $package.InstallLocation -DestinationRoot $resolvedOutputRoot -Pattern "resources*.pri" -SelfSignedMutable $true
    if (Test-Path -LiteralPath (Join-Path $package.InstallLocation "priconfig.xml")) {
        $entries += Copy-StorePath -SourceRoot $package.InstallLocation -DestinationRoot $resolvedOutputRoot -RelativePath "priconfig.xml" -Kind "file"
    }

    $runtimeMetadata = [ordered]@{
        productId = $ProductId
        packageName = $package.Name
        packageFullName = $package.PackageFullName
        packageFamilyName = $package.PackageFamilyName
        packageVersion = [string] $package.Version
        architecture = [string] $package.Architecture
        payloadRoot = "store-owl-shell/package"
        entries = $entries
    }

    $runtimeMetadataPath = Join-Path $resolvedOutputRoot "owl-shell-runtime.json"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($runtimeMetadataPath, (($runtimeMetadata | ConvertTo-Json -Depth 8) + [Environment]::NewLine), $utf8NoBom)

    $metadata = [ordered]@{
        productId = $ProductId
        packageName = $package.Name
        packageFullName = $package.PackageFullName
        packageFamilyName = $package.PackageFamilyName
        packageVersion = [string] $package.Version
        architecture = [string] $package.Architecture
        payloadRoot = $metadataPayloadRoot
        runtimeMetadataRelativePath = "owl-shell-runtime.json"
        entries = $entries
    }

    $resolvedMetadataOutputPath = [System.IO.Path]::GetFullPath($MetadataOutputPath)
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedMetadataOutputPath) | Out-Null
    [System.IO.File]::WriteAllText($resolvedMetadataOutputPath, (($metadata | ConvertTo-Json -Depth 8) + [Environment]::NewLine), $utf8NoBom)

    Write-Output "Updated Store/Owl shell payload at $resolvedOutputRoot from $($package.PackageFullName)."
    Write-Output "Wrote Store/Owl shell metadata to $resolvedMetadataOutputPath."
}
finally {
    if (-not $hadOfficialPackageBeforeRun) {
        foreach ($packageToRemove in @(Get-CodexAppPackages)) {
            Remove-AppxPackage -Package $packageToRemove.PackageFullName -ErrorAction Stop
            Write-Output "Uninstalled temporary Codex package $($packageToRemove.PackageFullName)."
        }
    }
}
