[CmdletBinding()]
param(
    [string] $PackageName,
    [string] $PackageFamilyName,
    [string] $PackageFullName
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
    return [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
}

function Resolve-TargetPackage {
    if ([string]::IsNullOrWhiteSpace($PackageName) -and [string]::IsNullOrWhiteSpace($PackageFamilyName) -and [string]::IsNullOrWhiteSpace($PackageFullName)) {
        throw "Pass -PackageName, -PackageFamilyName, or -PackageFullName."
    }

    if ([string]::IsNullOrWhiteSpace($PackageName)) {
        $packages = @(Get-AppxPackage -ErrorAction Stop)
    }
    else {
        $packages = @(Get-AppxPackage -Name $PackageName -ErrorAction Stop)
    }

    if (-not [string]::IsNullOrWhiteSpace($PackageFullName)) {
        $packages = @($packages | Where-Object { $_.PackageFullName -eq $PackageFullName })
    }
    if (-not [string]::IsNullOrWhiteSpace($PackageFamilyName)) {
        $packages = @($packages | Where-Object { $_.PackageFamilyName -eq $PackageFamilyName })
    }

    if ($packages.Count -eq 0) {
        throw "Package not found: name=$PackageName family=$PackageFamilyName fullName=$PackageFullName"
    }
    if ($packages.Count -gt 1 -and [string]::IsNullOrWhiteSpace($PackageFamilyName) -and [string]::IsNullOrWhiteSpace($PackageFullName)) {
        $matches = $packages | ForEach-Object { "$($_.PackageFullName) [$($_.PackageFamilyName)]" }
        throw "Package name $PackageName matched multiple packages; pass -PackageFamilyName or -PackageFullName.`n$($matches -join [Environment]::NewLine)"
    }

    return $packages |
        Sort-Object -Property Version -Descending |
        Select-Object -First 1
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

function Get-RelativePath {
    param(
        [string] $BasePath,
        [string] $Path
    )

    $baseUri = [System.Uri]((Join-Path ([System.IO.Path]::GetFullPath($BasePath)) ".") + [System.IO.Path]::DirectorySeparatorChar)
    $pathUri = [System.Uri]([System.IO.Path]::GetFullPath($Path))
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($pathUri).ToString()).Replace("/", "\")
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

function Assert-FileEntry {
    param(
        [string] $InstallLocation,
        $Entry
    )

    $relativePath = [string] $Entry.sourceRelativePath
    $packagePath = Join-Path $InstallLocation ($relativePath -replace "/", "\")
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
        throw "Package is missing Store/Owl payload file: $relativePath"
    }

    if ($Entry.selfSignedMutable -eq $true) {
        return
    }

    $file = Get-Item -LiteralPath $packagePath
    if ($null -ne $Entry.size -and $file.Length -ne [int64] $Entry.size) {
        throw "Store/Owl payload file size mismatch for $relativePath`: expected $($Entry.size), got $($file.Length)."
    }

    $actualSha256 = Get-Sha256 -Path $packagePath
    if ($actualSha256 -ne [string] $Entry.sha256) {
        throw "Store/Owl payload SHA-256 mismatch for $relativePath`: expected $($Entry.sha256), got $actualSha256."
    }
}

function Assert-DirectoryEntry {
    param(
        [string] $InstallLocation,
        $Entry
    )

    $relativePath = [string] $Entry.sourceRelativePath
    $packagePath = Join-Path $InstallLocation ($relativePath -replace "/", "\")
    if (-not (Test-Path -LiteralPath $packagePath -PathType Container)) {
        throw "Package is missing Store/Owl payload directory: $relativePath"
    }

    $digest = Get-DirectoryDigest -Path $packagePath
    if ($digest.fileCount -ne [int] $Entry.fileCount) {
        throw "Store/Owl payload directory file count mismatch for $relativePath`: expected $($Entry.fileCount), got $($digest.fileCount)."
    }
    if ($digest.sha256 -ne [string] $Entry.sha256) {
        throw "Store/Owl payload directory SHA-256 mismatch for $relativePath`: expected $($Entry.sha256), got $($digest.sha256)."
    }
}

$repoRoot = Resolve-RepoRoot
$metadataPath = Join-Path $repoRoot "desktop\resources\store-owl-shell.json"
if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) {
    throw "Missing Store/Owl provenance metadata: desktop/resources/store-owl-shell.json"
}

$metadata = Get-Content -Raw -LiteralPath $metadataPath | ConvertFrom-Json
$package = Resolve-TargetPackage
$installLocation = [System.IO.Path]::GetFullPath($package.InstallLocation)

if ([string] $metadata.architecture -ne [string] $package.Architecture) {
    throw "Store/Owl package architecture mismatch: metadata $($metadata.architecture), installed $($package.Architecture)."
}

foreach ($entry in @($metadata.entries)) {
    if ($entry.kind -eq "directory") {
        Assert-DirectoryEntry -InstallLocation $installLocation -Entry $entry
        continue
    }

    Assert-FileEntry -InstallLocation $installLocation -Entry $entry
}

Write-Output "Store/Owl payload ok: $($package.PackageFullName)"
