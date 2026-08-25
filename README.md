# Bulk Image Resizer

[![CI](https://github.com/AlpineUX/bulk-image-resizer/actions/workflows/ci.yml/badge.svg)](https://github.com/AlpineUX/bulk-image-resizer/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A fast, local-first macOS app for resizing and converting batches of images. Bulk Image Resizer uses a React and TypeScript interface with native Rust image processing through Tauri.

## Features

- Add images with drag and drop or the native file picker.
- Keep multiple batches with independent settings.
- Resize proportionally by percentage or an exact target width.
- Export an entire batch as WebP, AVIF, JPEG, or PNG.
- Adjust lossy output quality from 60–100%; PNG remains lossless.
- Preview dimensions, file sizes, expected output dimensions, progress, and completed savings.
- Preserve source files by exporting into a newly created, uniquely named folder.
- Reveal completed exports in Finder and receive a macOS completion notification.
- Process everything locally—images are never uploaded by the app.

## Supported formats

| Direction | Formats |
| --- | --- |
| Input | JPEG, PNG, HEIC/HEIF, WebP, TIFF, BMP, static GIF, ICO, PNM, HDR |
| Output | WebP, AVIF, JPEG, PNG |

Animated GIFs are intentionally rejected because the app processes static images. HEIC and HEIF decoding uses macOS's built-in image tooling.

## Download and install

Download the appropriate DMG from the [latest GitHub Release](https://github.com/AlpineUX/bulk-image-resizer/releases/latest):

- `aarch64` for Apple Silicon Macs (M1 and newer)
- `x64` for Intel Macs

Open the DMG and drag **Bulk Image Resizer** into Applications.

Current builds are ad-hoc signed until an Apple Developer ID is configured. On first launch, macOS may require approval in **System Settings → Privacy & Security**. Developer ID signing and Apple notarization are required for warning-free public distribution.

## Using the app

1. Drag images into the window or choose them with the file picker.
2. Select an output format.
3. Choose a percentage between 10–100%, or enter an exact width up to 32,768 px.
4. For WebP, AVIF, or JPEG, choose the output quality.
5. Select **Choose folder & export**, then choose the parent destination.
6. Open the generated `Bulk Image Resizer Export` folder from the completion screen.

The app never overwrites the originals. Repeated exports receive numbered folder and file names when needed.

## Requirements for development

- macOS
- Xcode Command Line Tools (`xcode-select --install`)
- Node.js 22 or newer
- pnpm 10
- the stable Rust toolchain from [rustup](https://rustup.rs/)

Install dependencies and start the native development app:

```sh
pnpm install --frozen-lockfile
pnpm macos:dev
```

The main commands are:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run only the Vite frontend preview. Export is unavailable in a browser. |
| `pnpm build` | Type-check and build the frontend. |
| `pnpm macos:dev` | Run the complete Tauri app in development mode. |
| `pnpm macos:build` | Build `.app` and `.dmg` bundles for the current Mac architecture. |
| `pnpm macos:build:universal` | Build a universal macOS bundle for Apple Silicon and Intel. |

## Build a macOS installer

Build for the current architecture:

```sh
pnpm install --frozen-lockfile
pnpm macos:build
```

Outputs are written to:

- `src-tauri/target/release/bundle/macos/Bulk Image Resizer.app`
- `src-tauri/target/release/bundle/dmg/Bulk Image Resizer_<version>_<architecture>.dmg`

For a universal build, install both Rust targets first:

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
pnpm macos:build:universal
```

## Testing and CI

Run the same essential checks used by CI:

```sh
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

Every push to `main` and every pull request runs these checks on macOS through [GitHub Actions](.github/workflows/ci.yml). [Dependabot](.github/dependabot.yml) checks JavaScript, Rust, and GitHub Actions dependencies weekly.

## Publishing a release

The [release workflow](.github/workflows/release-macos.yml) builds separate Apple Silicon and Intel DMGs and attaches them to a public GitHub Release.

1. Update the version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. Commit the version change.
3. Push a matching version tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The workflow can also be started manually from the repository's **Actions** tab. For Developer ID signing and notarization, follow Tauri's [macOS code-signing guide](https://v2.tauri.app/distribute/sign/macos/). `APPLE_SIGNING_IDENTITY` overrides the default ad-hoc identity when a Developer ID certificate is available.

## Project structure

```text
src/                         React interface
src-tauri/src/               Rust image processing and native commands
src-tauri/tauri.conf.json    macOS application and bundle configuration
.github/workflows/ci.yml     pull request and main-branch checks
.github/workflows/release-macos.yml
                             macOS release builds
```

## Contributing

Issues and pull requests are welcome. For code changes:

1. Create a branch from `main`.
2. Keep changes focused and include tests for native processing behavior where practical.
3. Run the frontend build, Rust formatting check, and Rust test suite.
4. Open a pull request describing the user-visible behavior and verification performed.

Please do not commit `node_modules`, `dist`, `src-tauri/target`, signing certificates, or Apple credentials.

## Privacy

Bulk Image Resizer does not upload images or require an account. Selected files are read locally and processed results are written only to the folder chosen during export. The app does not include analytics or telemetry.

## License

Bulk Image Resizer is available under the [MIT License](LICENSE). Copyright © 2026 Jason Leyser.
