use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{
    codecs::{avif::AvifEncoder, gif::GifDecoder, jpeg::JpegEncoder, png::PngEncoder},
    imageops::FilterType,
    metadata::Orientation,
    AnimationDecoder, DynamicImage, GenericImageView, ImageDecoder, ImageEncoder,
};
use serde::Serialize;
use std::{
    fs::{self, File},
    io::BufReader,
    io::BufWriter,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Emitter};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageItem {
    path: String,
    name: String,
    width: u32,
    height: u32,
    size: u64,
    thumbnail: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InspectResponse {
    items: Vec<ImageItem>,
    warnings: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessedItem {
    source_path: String,
    output_path: String,
    name: String,
    width: u32,
    height: u32,
    original_size: u64,
    output_size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessResponse {
    output_folder: String,
    items: Vec<ProcessedItem>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    completed: usize,
    total: usize,
    name: String,
}

fn needs_macos_decoder(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(str::to_lowercase)
            .as_deref(),
        Some("heic") | Some("heif")
    )
}

fn reject_animated_gif(path: &Path) -> Result<(), String> {
    if path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_lowercase)
        .as_deref()
        != Some("gif")
    {
        return Ok(());
    }
    let file = File::open(path).map_err(|error| error.to_string())?;
    let decoder = GifDecoder::new(BufReader::new(file)).map_err(|error| error.to_string())?;
    let mut frames = decoder.into_frames();
    let _ = frames
        .next()
        .transpose()
        .map_err(|error| error.to_string())?;
    if frames
        .next()
        .transpose()
        .map_err(|error| error.to_string())?
        .is_some()
    {
        return Err("animated GIFs are not supported".to_owned());
    }
    Ok(())
}

fn decode_image(path: &Path) -> Result<DynamicImage, String> {
    reject_animated_gif(path)?;
    if needs_macos_decoder(path) {
        let temporary = tempfile::Builder::new()
            .suffix(".png")
            .tempfile()
            .map_err(|error| format!("Could not prepare image: {error}"))?;
        let output = Command::new("/usr/bin/sips")
            .args(["-s", "format", "png"])
            .arg(path)
            .arg("--out")
            .arg(temporary.path())
            .output()
            .map_err(|error| format!("Could not open image: {error}"))?;
        if !output.status.success() {
            return Err(format!(
                "macOS could not decode {}",
                path.file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("this image")
            ));
        }
        return image::open(temporary.path()).map_err(|error| error.to_string());
    }
    let reader = image::ImageReader::open(path)
        .map_err(|error| error.to_string())?
        .with_guessed_format()
        .map_err(|error| error.to_string())?;
    let mut decoder = reader.into_decoder().map_err(|error| error.to_string())?;
    let orientation = decoder.orientation().map_err(|error| error.to_string())?;
    let image = DynamicImage::from_decoder(decoder).map_err(|error| error.to_string())?;
    Ok(apply_orientation(image, orientation))
}

fn apply_orientation(mut image: DynamicImage, orientation: Orientation) -> DynamicImage {
    image.apply_orientation(orientation);
    image
}

fn make_thumbnail(image: &DynamicImage) -> Result<String, String> {
    let thumbnail = image.thumbnail(220, 160).to_rgb8();
    let mut bytes = Vec::new();
    JpegEncoder::new_with_quality(&mut bytes, 74)
        .encode_image(&DynamicImage::ImageRgb8(thumbnail))
        .map_err(|error| error.to_string())?;
    Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(bytes)))
}

fn inspect_path(path: &Path) -> Result<ImageItem, String> {
    if !path.is_file() {
        return Err(format!("{} is not a file", path.display()));
    }
    let image = decode_image(path)?;
    let (width, height) = image.dimensions();
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    Ok(ImageItem {
        path: path.to_string_lossy().into_owned(),
        name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Untitled image")
            .to_owned(),
        width,
        height,
        size: metadata.len(),
        thumbnail: make_thumbnail(&image)?,
    })
}

fn inspect_all(paths: Vec<String>) -> Result<InspectResponse, String> {
    let mut images = Vec::new();
    let mut failures = Vec::new();
    for raw_path in paths {
        match inspect_path(Path::new(&raw_path)) {
            Ok(image) => images.push(image),
            Err(error) => {
                let name = Path::new(&raw_path)
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("File");
                failures.push(format!("{name}: {error}"));
            }
        }
    }
    if images.is_empty() && !failures.is_empty() {
        return Err(format!(
            "No supported static images were found. {}",
            failures.join(" ")
        ));
    }
    Ok(InspectResponse {
        items: images,
        warnings: failures,
    })
}

#[tauri::command]
async fn pick_images() -> Result<InspectResponse, String> {
    let files = rfd::AsyncFileDialog::new()
        .set_title("Choose images")
        .add_filter(
            "Static images",
            &[
                "jpg", "jpeg", "png", "heic", "heif", "webp", "tif", "tiff", "bmp", "gif", "ico",
                "pnm", "hdr",
            ],
        )
        .pick_files()
        .await;
    let paths = files
        .unwrap_or_default()
        .into_iter()
        .map(|file| file.path().to_string_lossy().into_owned())
        .collect();
    tauri::async_runtime::spawn_blocking(move || inspect_all(paths))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn inspect_images(paths: Vec<String>) -> Result<InspectResponse, String> {
    tauri::async_runtime::spawn_blocking(move || inspect_all(paths))
        .await
        .map_err(|error| error.to_string())?
}

fn unique_export_folder(parent: &Path) -> Result<PathBuf, String> {
    for number in 1..=999 {
        let name = if number == 1 {
            "Bulk Image Resizer Export".to_owned()
        } else {
            format!("Bulk Image Resizer Export {number}")
        };
        let candidate = parent.join(name);
        if !candidate.exists() {
            fs::create_dir_all(&candidate).map_err(|error| error.to_string())?;
            return Ok(candidate);
        }
    }
    Err("Could not create a unique Bulk Image Resizer Export folder".to_owned())
}

fn unique_output_path(folder: &Path, stem: &str, extension: &str) -> PathBuf {
    let clean_stem = if stem.is_empty() { "image" } else { stem };
    let initial = folder.join(format!("{clean_stem}.{extension}"));
    if !initial.exists() {
        return initial;
    }
    for number in 2..=999 {
        let candidate = folder.join(format!("{clean_stem}-{number}.{extension}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    folder.join(format!("{clean_stem}-copy.{extension}"))
}

fn save_image(image: &DynamicImage, path: &Path, format: &str, quality: u8) -> Result<(), String> {
    match format {
        "webp" => {
            let rgba = image.to_rgba8();
            let encoder = webp::Encoder::from_rgba(&rgba, rgba.width(), rgba.height());
            let encoded = encoder.encode(quality as f32);
            fs::write(path, &*encoded).map_err(|error| error.to_string())
        }
        "avif" => {
            let rgba = image.to_rgba8();
            let writer = BufWriter::new(File::create(path).map_err(|error| error.to_string())?);
            AvifEncoder::new_with_speed_quality(writer, 6, quality)
                .write_image(
                    &rgba,
                    rgba.width(),
                    rgba.height(),
                    image::ExtendedColorType::Rgba8,
                )
                .map_err(|error| error.to_string())
        }
        "jpeg" => {
            let writer = BufWriter::new(File::create(path).map_err(|error| error.to_string())?);
            JpegEncoder::new_with_quality(writer, quality)
                .encode_image(image)
                .map_err(|error| error.to_string())
        }
        "png" => {
            let rgba = image.to_rgba8();
            let writer = BufWriter::new(File::create(path).map_err(|error| error.to_string())?);
            PngEncoder::new(writer)
                .write_image(
                    &rgba,
                    rgba.width(),
                    rgba.height(),
                    image::ExtendedColorType::Rgba8,
                )
                .map_err(|error| error.to_string())
        }
        _ => Err("Unsupported output format".to_owned()),
    }
}

fn resize_image(
    image: DynamicImage,
    resize_mode: &str,
    scale_percent: u32,
    target_width: Option<u32>,
) -> Result<(DynamicImage, u32, u32), String> {
    let (source_width, source_height) = image.dimensions();
    let (width, height) = match resize_mode {
        "percentage" => (
            ((source_width as f64 * scale_percent as f64 / 100.0).round() as u32).max(1),
            ((source_height as f64 * scale_percent as f64 / 100.0).round() as u32).max(1),
        ),
        "width" => {
            let width = target_width.ok_or_else(|| "Enter an exact width".to_owned())?;
            let height =
                ((source_height as f64 * width as f64 / source_width as f64).round() as u32).max(1);
            (width, height)
        }
        _ => return Err("Unsupported resize mode".to_owned()),
    };
    if width > 32_768 || height > 32_768 || u64::from(width) * u64::from(height) > 100_000_000 {
        return Err("The resulting image dimensions are too large".to_owned());
    }
    let resized = if (width, height) == (source_width, source_height) {
        image
    } else {
        image.resize_exact(width, height, FilterType::Lanczos3)
    };
    Ok((resized, width, height))
}

fn process_one(
    raw_path: String,
    output_folder: &Path,
    format: &str,
    resize_mode: &str,
    scale_percent: u32,
    target_width: Option<u32>,
    quality: u8,
) -> Result<ProcessedItem, String> {
    let source = PathBuf::from(&raw_path);
    let original_size = fs::metadata(&source)
        .map_err(|error| error.to_string())?
        .len();
    let (resized, width, height) = resize_image(
        decode_image(&source)?,
        resize_mode,
        scale_percent,
        target_width,
    )?;
    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let extension = if format == "jpeg" { "jpg" } else { format };
    let output_path = unique_output_path(output_folder, stem, extension);
    save_image(&resized, &output_path, format, quality)?;
    let output_size = fs::metadata(&output_path)
        .map_err(|error| error.to_string())?
        .len();
    Ok(ProcessedItem {
        source_path: raw_path,
        output_path: output_path.to_string_lossy().into_owned(),
        name: output_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("image")
            .to_owned(),
        width,
        height,
        original_size,
        output_size,
    })
}

fn cleanup_failed_export(output_folder: &Path) {
    let _ = fs::remove_dir_all(output_folder);
}

#[tauri::command]
async fn process_images(
    app: AppHandle,
    paths: Vec<String>,
    format: String,
    resize_mode: String,
    scale_percent: u32,
    target_width: Option<u32>,
    quality: u8,
) -> Result<ProcessResponse, String> {
    if paths.is_empty() {
        return Err("Add at least one image first".to_owned());
    }
    let valid_resize = match resize_mode.as_str() {
        "percentage" => (10..=100).contains(&scale_percent),
        "width" => target_width.is_some_and(|width| (1..=32_768).contains(&width)),
        _ => false,
    };
    if !valid_resize || !(60..=100).contains(&quality) {
        return Err("Invalid resize or quality setting".to_owned());
    }
    if !matches!(format.as_str(), "webp" | "avif" | "jpeg" | "png") {
        return Err("Unsupported output format".to_owned());
    }

    let parent = rfd::AsyncFileDialog::new()
        .set_title("Choose where to create Bulk Image Resizer Export")
        .pick_folder()
        .await
        .ok_or_else(|| "Export cancelled".to_owned())?;
    let parent_path = parent.path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        let output_folder = unique_export_folder(&parent_path)?;
        let total = paths.len();
        let mut processed = Vec::with_capacity(total);
        for (completed, raw_path) in paths.into_iter().enumerate() {
            let source = PathBuf::from(&raw_path);
            let name = source
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("Image")
                .to_owned();
            let _ = app.emit(
                "processing-progress",
                ProgressEvent {
                    completed,
                    total,
                    name: name.clone(),
                },
            );
            match process_one(
                raw_path,
                &output_folder,
                &format,
                &resize_mode,
                scale_percent,
                target_width,
                quality,
            ) {
                Ok(item) => processed.push(item),
                Err(error) => {
                    cleanup_failed_export(&output_folder);
                    return Err(format!("Could not process {name}: {error}"));
                }
            }
        }
        let _ = app.emit(
            "processing-progress",
            ProgressEvent {
                completed: total,
                total,
                name: "Complete".to_owned(),
            },
        );
        Ok(ProcessResponse {
            output_folder: output_folder.to_string_lossy().into_owned(),
            items: processed,
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
fn reveal_output(path: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    if !target.is_dir() {
        return Err("The export folder could not be found".to_owned());
    }
    Command::new("/usr/bin/open")
        .arg(target)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let mut tray = tauri::tray::TrayIconBuilder::new().tooltip("Bulk Image Resizer");
                if let Some(icon) = app.default_window_icon() {
                    tray = tray.icon(icon.clone());
                }
                tray.build(app)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_images,
            inspect_images,
            process_images,
            reveal_output
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{codecs::gif::GifEncoder, Frame, RgbaImage};

    #[test]
    fn inspects_and_encodes_supported_outputs() {
        let folder = tempfile::tempdir().expect("temp folder");
        let source = folder.path().join("sample.png");
        let image = DynamicImage::new_rgba8(64, 32);
        save_image(&image, &source, "png", 100).expect("write source");
        let info = inspect_path(&source).expect("inspect source");
        assert_eq!((info.width, info.height), (64, 32));
        assert!(info.thumbnail.starts_with("data:image/jpeg;base64,"));

        for format in ["webp", "avif", "jpeg", "png"] {
            let extension = if format == "jpeg" { "jpg" } else { format };
            let output = folder.path().join(format!("result.{extension}"));
            save_image(&image, &output, format, 88).expect("encode output");
            assert!(fs::metadata(&output).expect("output metadata").len() > 0);
            if format != "avif" {
                assert_eq!(
                    decode_image(&output).expect("decode output").dimensions(),
                    (64, 32)
                );
            }
        }
    }

    #[test]
    fn applies_orientation_and_resizes_proportionally() {
        let image = DynamicImage::new_rgba8(80, 40);
        let oriented = apply_orientation(image, Orientation::Rotate90);
        assert_eq!(oriented.dimensions(), (40, 80));
        let (resized, width, height) =
            resize_image(oriented, "percentage", 50, None).expect("resize by percentage");
        assert_eq!((width, height), (20, 40));
        assert_eq!(resized.dimensions(), (20, 40));

        let (resized, width, height) =
            resize_image(DynamicImage::new_rgba8(80, 40), "width", 75, Some(1_000))
                .expect("resize to exact width");
        assert_eq!((width, height), (1_000, 500));
        assert_eq!(resized.dimensions(), (1_000, 500));
    }

    #[test]
    fn rejects_animated_gifs_and_reports_mixed_imports() {
        let folder = tempfile::tempdir().expect("temp folder");
        let animated = folder.path().join("animated.gif");
        let mut encoder = GifEncoder::new(File::create(&animated).expect("animated file"));
        encoder
            .encode_frames(
                [
                    Frame::new(RgbaImage::new(2, 2)),
                    Frame::new(RgbaImage::new(2, 2)),
                ]
                .into_iter(),
            )
            .expect("animated gif");
        drop(encoder);
        assert!(reject_animated_gif(&animated)
            .expect_err("animated image should fail")
            .contains("animated GIFs"));

        let still = folder.path().join("still.png");
        save_image(&DynamicImage::new_rgba8(4, 4), &still, "png", 100).expect("still image");
        let response = inspect_all(vec![
            still.to_string_lossy().into_owned(),
            animated.to_string_lossy().into_owned(),
        ])
        .expect("mixed import");
        assert_eq!(response.items.len(), 1);
        assert_eq!(response.warnings.len(), 1);
        assert!(response.warnings[0].contains("animated.gif"));
    }

    #[test]
    fn uses_unique_names_and_cleans_failed_exports() {
        let parent = tempfile::tempdir().expect("temp folder");
        let first = unique_export_folder(parent.path()).expect("first export");
        let second = unique_export_folder(parent.path()).expect("second export");
        assert_eq!(
            first.file_name().and_then(|value| value.to_str()),
            Some("Bulk Image Resizer Export")
        );
        assert_eq!(
            second.file_name().and_then(|value| value.to_str()),
            Some("Bulk Image Resizer Export 2")
        );

        let original = unique_output_path(&first, "photo", "webp");
        fs::write(&original, b"partial").expect("partial file");
        assert_eq!(
            unique_output_path(&first, "photo", "webp")
                .file_name()
                .and_then(|value| value.to_str()),
            Some("photo-2.webp")
        );
        cleanup_failed_export(&first);
        assert!(!first.exists());
    }
}
