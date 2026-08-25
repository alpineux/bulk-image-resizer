# Bulk Image Resizer

A native macOS utility for resizing and converting batches of images locally. The interface is React and TypeScript; the native application and image processing layer use Tauri and Rust.

## Download a macOS build

Published builds appear on the repository's **Releases** page as separate Apple Silicon (`aarch64`) and Intel (`x64`) DMG files. Download the DMG for your Mac, open it, and drag **Bulk Image Resizer** into Applications.

Builds are ad-hoc signed until an Apple Developer ID is configured. On first launch, macOS may ask you to approve the app in **System Settings → Privacy & Security**. A Developer ID signature and Apple notarization are required for a warning-free public distribution.

## Build locally

Prerequisites:

- macOS with Xcode Command Line Tools (`xcode-select --install`)
- Node.js 22 or newer
- pnpm 10
- the stable Rust toolchain from [rustup](https://rustup.rs/)

Install dependencies and create a build for the current Mac architecture:

```sh
pnpm install --frozen-lockfile
pnpm macos:build
```

The outputs are written to:

- `src-tauri/target/release/bundle/macos/Bulk Image Resizer.app`
- `src-tauri/target/release/bundle/dmg/Bulk Image Resizer_<version>_<architecture>.dmg`

To make a single universal app for both Apple Silicon and Intel Macs:

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm macos:build:universal
```

## Development

```sh
pnpm install
pnpm macos:dev
```

`pnpm build` verifies and builds only the web frontend.

## Publish a downloadable release

The GitHub Actions workflow in `.github/workflows/release-macos.yml` builds both Mac architectures. Update the version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`, commit it, then push a matching version tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The workflow creates a GitHub Release and attaches both DMG installers. It can also be run manually from the repository's **Actions** tab.

For public distribution, extend the release workflow with the certificate import and notarization variables from Tauri's [macOS code-signing guide](https://v2.tauri.app/distribute/sign/macos/). `APPLE_SIGNING_IDENTITY` overrides the ad-hoc identity in `tauri.conf.json` when a Developer ID certificate is available.

## GitHub checks

Every push to `main` and every pull request runs `.github/workflows/ci.yml`. It installs dependencies from the lockfiles, builds the frontend, checks Rust formatting, and runs the native test suite. Dependabot checks JavaScript, Rust, and GitHub Actions dependencies weekly.
