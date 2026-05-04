# 0002 Use GitHub Pages for self-signed App Installer updates

## Status

Accepted

## Context

The self-signed Windows MSIX package needs a stable App Installer update endpoint. GitHub Releases are useful for archived release assets and manual downloads, but their asset URLs are versioned download endpoints with redirects and GitHub-controlled headers. Windows App Installer expects the `.appinstaller` file and referenced `.msix` package to be reachable through stable HTTP URLs with correct MIME types and `Content-Length`.

GitHub Pages provides stable project URLs under `https://sliepie.github.io/codex-app/`, and GitHub Pages MIME support is derived from `mime-db`, which includes `.appinstaller` as `application/appinstaller` and `.msix` as `application/msix`.

## Decision

Use GitHub Pages as the canonical self-signed App Installer update channel. The main release workflow publishes `Codex.appinstaller`, `Codex-arm64-self-signed.msix`, and the public `CodexSelfSigned.cer` to Pages after building and signing the self-signed MSIX. Keep GitHub Releases as the archive/manual-download location for the same release assets.

The `Codex.appinstaller` file should point its own `Uri` at the stable Pages `.appinstaller` URL and its `MainPackage Uri` at the stable Pages `.msix` URL.

## Consequences

- App Installer update checks use a stable URL instead of a versioned release URL.
- The release workflow needs GitHub Pages permissions and a Pages deployment step.
- Release assets remain available on GitHub Releases for archive and manual download.
- Pages hosting must be verified after deployment by checking `Content-Type`, `Content-Length`, and a real install/update attempt on Windows.
