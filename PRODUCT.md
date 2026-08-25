# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

macOS users who need to prepare many images quickly without learning image-editing software or configuring each file individually.

## Product Purpose

Bulk Image Resizer compresses, reformats, and proportionally resizes a batch of images in one operation. Success means a user can move from selecting images to a clearly named output folder in a few obvious steps.

## Positioning

Bulk Image Resizer is a local-first batch utility: every selected image receives the same simple, visible transformation and is written directly to a folder the user chooses.

## Operating Context

Users drag files from Finder or select them through a native file picker, review the batch, choose an output format and scale percentage, then export the processed images to a new folder.

## Capabilities and Constraints

- Tauri v2 desktop application using React and TypeScript with a Rust processing backend.
- macOS is the initial shipping platform.
- Accept multiple static raster images, including common macOS formats such as HEIC/HEIF. Animated GIF processing is out of scope.
- Convert the entire batch to an optimized output format such as WebP or AVIF.
- Compress at a visually lossless quality level to reduce file size without noticeable degradation.
- Resize every image by the same percentage while preserving aspect ratio.
- Export every result to a folder selected by the user without overwriting source files.

## Brand Commitments

- Product name: Bulk Image Resizer.
- Voice is concise, calm, and direct.
- The first screen follows the supplied reference's stark simplicity: a dark field, very large drop instruction, and one obvious action.

## Evidence on Hand

- User-supplied visual reference in the project conversation.
- No performance benchmarks, testimonials, or commercial claims are available and none should be fabricated.

## Product Principles

- Keep the path from import to export short and self-explanatory.
- Make batch-wide settings explicit before processing begins.
- Preserve originals and make output location unambiguous.
- Prefer local, fast processing with honest progress and error feedback.

## Accessibility & Inclusion

The complete workflow must be keyboard accessible, expose visible focus states, and respect reduced-motion preferences.
