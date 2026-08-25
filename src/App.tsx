import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import "@fontsource-variable/manrope";
import "./App.css";
import Loader from "./components/loader";

type ImageItem = {
  path: string;
  name: string;
  width: number;
  height: number;
  size: number;
  thumbnail: string;
};
type ProcessedItem = {
  sourcePath: string;
  outputPath: string;
  name: string;
  width: number;
  height: number;
  originalSize: number;
  outputSize: number;
};
type ProcessResponse = { outputFolder: string; items: ProcessedItem[] };
type ProgressEvent = { completed: number; total: number; name: string };
type InspectResponse = { items: ImageItem[]; warnings: string[] };
type OutputFormat = "webp" | "avif" | "jpeg" | "png";
type ResizeMode = "percentage" | "width";

type Batch = {
  id: string;
  label: string;
  images: ImageItem[];
  format: OutputFormat;
  resizeMode: ResizeMode;
  scale: number;
  targetWidth: number;
  quality: number;
  isLoading: boolean;
  isProcessing: boolean;
  progress: ProgressEvent | null;
  results: ProcessResponse | null;
  error: string;
};

const createBatch = (number: number): Batch => ({
  id: `batch-${number}`,
  label: `Batch ${number}`,
  images: [],
  format: "webp",
  resizeMode: "percentage",
  scale: 75,
  targetWidth: 1000,
  quality: 88,
  isLoading: false,
  isProcessing: false,
  progress: null,
  results: null,
  error: "",
});

function WindowTitlebar() {
  if (!isTauri()) return null;

  return (
    <div
      className="window-titlebar"
      data-tauri-drag-region
      aria-hidden="true"
    />
  );
}

type IconName = "plus" | "close" | "arrow" | "external" | "check";
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    plus: "M12 5v14M5 12h14",
    close: "M6 6l12 12M18 6 6 18",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    external: "M10 6h8v8M18 6 9 15M18 15v4H5V6h4",
    check: "M5 12l4 4L19 6",
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

const isTauri = () => "__TAURI_INTERNALS__" in window;
const notify = async (title: string, body: string) => {
  if (!isTauri()) return;

  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      permissionGranted = (await requestPermission()) === "granted";
    }
    if (permissionGranted) sendNotification({ title, body });
  } catch (reason) {
    console.warn("Could not send macOS notification", reason);
  }
};

const imageCountLabel = (count: number) =>
  `${count} ${count === 1 ? "image" : "images"}`;

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
};
const reduction = (before: number, after: number) =>
  before > 0 ? Math.max(0, Math.round((1 - after / before) * 100)) : 0;
const targetDimensions = (
  image: ImageItem,
  mode: ResizeMode,
  scale: number,
  targetWidth: number,
) => {
  if (mode === "width")
    return {
      width: targetWidth,
      height: Math.max(
        1,
        Math.round((image.height * targetWidth) / image.width),
      ),
    };
  return {
    width: Math.max(1, Math.round((image.width * scale) / 100)),
    height: Math.max(1, Math.round((image.height * scale) / 100)),
  };
};

function App() {
  const [batches, setBatches] = useState<Batch[]>(() => [createBatch(1)]);
  const [activeBatchId, setActiveBatchId] = useState("batch-1");
  const [isDragging, setIsDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const activeBatchIdRef = useRef(activeBatchId);
  const processingBatchIdRef = useRef<string | null>(null);
  const loadingBatchIdsRef = useRef(new Set<string>());
  const nextBatchNumber = useRef(1);

  activeBatchIdRef.current = activeBatchId;

  const activeBatch =
    batches.find((batch) => batch.id === activeBatchId) ?? batches[0];
  const {
    images,
    format,
    resizeMode,
    scale,
    targetWidth,
    quality,
    isLoading,
    isProcessing,
    progress,
    results,
    error,
  } = activeBatch;

  const updateBatch = useCallback(
    (batchId: string, update: (batch: Batch) => Batch) => {
      setBatches((current) =>
        current.map((batch) => (batch.id === batchId ? update(batch) : batch)),
      );
    },
    [],
  );

  const updateActiveBatch = useCallback(
    (update: (batch: Batch) => Batch) =>
      updateBatch(activeBatchIdRef.current, update),
    [updateBatch],
  );

  const addBatch = () => {
    const number = nextBatchNumber.current + 1;
    nextBatchNumber.current = number;
    const batch = createBatch(number);
    setBatches((current) => [...current, batch]);
    setActiveBatchId(batch.id);
    setIsDragging(false);
  };

  const addImages = useCallback(
    (batchId: string, incoming: ImageItem[]) => {
      updateBatch(batchId, (batch) => {
        const seen = new Set(batch.images.map((image) => image.path));
        return {
          ...batch,
          images: [
            ...batch.images,
            ...incoming.filter((image) => !seen.has(image.path)),
          ],
          results: null,
          error: "",
        };
      });
    },
    [updateBatch],
  );

  const acceptInspected = useCallback(
    (batchId: string, response: InspectResponse) => {
      addImages(batchId, response.items);
      if (response.warnings.length) {
        updateBatch(batchId, (batch) => ({
          ...batch,
          error: response.warnings.join(" "),
        }));
      }
    },
    [addImages, updateBatch],
  );

  const inspectPaths = useCallback(
    async (paths: string[], batchId = activeBatchIdRef.current) => {
      if (!paths.length || loadingBatchIdsRef.current.has(batchId)) return;
      loadingBatchIdsRef.current.add(batchId);
      updateBatch(batchId, (batch) => ({
        ...batch,
        isLoading: true,
        error: "",
      }));
      try {
        const response = await invoke<InspectResponse>("inspect_images", {
          paths,
        });
        acceptInspected(batchId, response);
        if (response.items.length) {
          void notify(
            "Images ready to optimize",
            `${imageCountLabel(response.items.length)} finished processing and can now be compressed.`,
          );
        }
      } catch (reason) {
        updateBatch(batchId, (batch) => ({
          ...batch,
          error: String(reason),
        }));
      } finally {
        loadingBatchIdsRef.current.delete(batchId);
        updateBatch(batchId, (batch) => ({ ...batch, isLoading: false }));
      }
    },
    [acceptInspected, updateBatch],
  );

  useEffect(() => {
    if (!isTauri()) return;
    const dragPromise = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") setIsDragging(true);
      if (event.payload.type === "leave") setIsDragging(false);
      if (event.payload.type === "drop") {
        setIsDragging(false);
        void inspectPaths(event.payload.paths);
      }
    });
    const progressPromise = listen<ProgressEvent>(
      "processing-progress",
      (event) => {
        const batchId = processingBatchIdRef.current;
        if (batchId) {
          updateBatch(batchId, (batch) => ({
            ...batch,
            progress: event.payload,
          }));
        }
      },
    );
    return () => {
      void dragPromise.then((unlisten) => unlisten());
      void progressPromise.then((unlisten) => unlisten());
    };
  }, [inspectPaths, updateBatch]);

  const selectImages = async () => {
    const batchId = activeBatchIdRef.current;
    if (!isTauri()) {
      fileInput.current?.click();
      return;
    }
    if (loadingBatchIdsRef.current.has(batchId)) return;
    loadingBatchIdsRef.current.add(batchId);
    updateBatch(batchId, (batch) => ({
      ...batch,
      isLoading: true,
      error: "",
    }));
    try {
      const response = await invoke<InspectResponse>("pick_images");
      acceptInspected(batchId, response);
      if (response.items.length) {
        void notify(
          "Images ready to optimize",
          `${imageCountLabel(response.items.length)} finished processing and can now be compressed.`,
        );
      }
    } catch (reason) {
      updateBatch(batchId, (batch) => ({
        ...batch,
        error: String(reason),
      }));
    } finally {
      loadingBatchIdsRef.current.delete(batchId);
      updateBatch(batchId, (batch) => ({ ...batch, isLoading: false }));
    }
  };

  const handleBrowserFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const batchId = activeBatchIdRef.current;
    if (loadingBatchIdsRef.current.has(batchId)) return;
    loadingBatchIdsRef.current.add(batchId);
    updateBatch(batchId, (batch) => ({
      ...batch,
      isLoading: true,
      error: "",
    }));
    try {
      const supported = Array.from(files).filter((file) =>
        file.type.startsWith("image/"),
      );
      const previewResults = await Promise.allSettled(
        supported.map(
          (file) =>
            new Promise<ImageItem>((resolve, reject) => {
              const url = URL.createObjectURL(file);
              const preview = new Image();
              preview.onload = () =>
                resolve({
                  path: `${file.name}-${file.lastModified}`,
                  name: file.name,
                  width: preview.naturalWidth,
                  height: preview.naturalHeight,
                  size: file.size,
                  thumbnail: url,
                });
              preview.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error(`Could not read ${file.name}`));
              };
              preview.src = url;
            }),
        ),
      );
      const previews = previewResults.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      addImages(batchId, previews);
      const failedCount = previewResults.length - previews.length;
      if (!supported.length || failedCount) {
        updateBatch(batchId, (batch) => ({
          ...batch,
          error: !supported.length
            ? "No supported images were selected."
            : `${failedCount} ${failedCount === 1 ? "image could" : "images could"} not be read.`,
        }));
      }
    } finally {
      loadingBatchIdsRef.current.delete(batchId);
      updateBatch(batchId, (batch) => ({ ...batch, isLoading: false }));
    }
  };

  const removeImage = (path: string) => {
    updateActiveBatch((batch) => ({
      ...batch,
      images: batch.images.filter((image) => image.path !== path),
      results: null,
    }));
  };
  const clearBatch = () => {
    updateActiveBatch((batch) => ({
      ...batch,
      images: [],
      results: null,
      progress: null,
      error: "",
    }));
  };
  const changeResizeMode = (mode: ResizeMode) => {
    updateActiveBatch((batch) => ({
      ...batch,
      resizeMode: mode,
      results: null,
    }));
  };
  const changeScale = (value: number) => {
    updateActiveBatch((batch) => ({
      ...batch,
      scale: value,
      results: null,
    }));
  };
  const changeTargetWidth = (value: number) => {
    updateActiveBatch((batch) => ({
      ...batch,
      targetWidth: Math.min(32768, Math.max(1, value || 1)),
      results: null,
    }));
  };

  const exportImages = async () => {
    if (!images.length) return;
    if (!isTauri()) {
      updateActiveBatch((batch) => ({
        ...batch,
        error:
          "Export is available in the Bulk Image Resizer macOS app. This browser view is a visual preview.",
      }));
      return;
    }
    const batchId = activeBatchIdRef.current;
    processingBatchIdRef.current = batchId;
    updateBatch(batchId, (batch) => ({
      ...batch,
      isProcessing: true,
      progress: {
        completed: 0,
        total: images.length,
        name: "Preparing batch",
      },
      results: null,
      error: "",
    }));
    try {
      const response = await invoke<ProcessResponse>("process_images", {
        paths: images.map((image) => image.path),
        format,
        resizeMode,
        scalePercent: scale,
        targetWidth: resizeMode === "width" ? targetWidth : null,
        quality,
      });
      updateBatch(batchId, (batch) => ({ ...batch, results: response }));
      const outputFolderName = response.outputFolder.split("/").pop();
      void notify(
        "Images optimized",
        `${imageCountLabel(response.items.length)} compressed and ready in ${outputFolderName ?? "the destination folder"}.`,
      );
    } catch (reason) {
      if (String(reason) !== "Export cancelled") {
        updateBatch(batchId, (batch) => ({
          ...batch,
          error: String(reason),
        }));
      }
    } finally {
      processingBatchIdRef.current = null;
      updateBatch(batchId, (batch) => ({ ...batch, isProcessing: false }));
    }
  };

  const revealOutput = async () => {
    if (!results) return;
    try {
      await invoke("reveal_output", { path: results.outputFolder });
    } catch (reason) {
      updateActiveBatch((batch) => ({
        ...batch,
        error: String(reason),
      }));
    }
  };

  const totalOriginal = useMemo(
    () => images.reduce((sum, image) => sum + image.size, 0),
    [images],
  );
  const totalOutput = useMemo(
    () => results?.items.reduce((sum, image) => sum + image.outputSize, 0) ?? 0,
    [results],
  );
  const isAnyBatchProcessing = batches.some((batch) => batch.isProcessing);
  const handleBatchTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % batches.length;
    if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + batches.length) % batches.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = batches.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextBatch = batches[nextIndex];
    setActiveBatchId(nextBatch.id);
    setIsDragging(false);
    requestAnimationFrame(() =>
      document.getElementById(`${nextBatch.id}-tab`)?.focus(),
    );
  };

  const batchTabs = (
    <nav className="batch-tabs" aria-label="Resize batches">
      <div
        className="batch-tab-list"
        role="tablist"
        aria-label="Resize batches"
      >
        {batches.map((batch, index) => (
          <button
            id={`${batch.id}-tab`}
            key={batch.id}
            className={`batch-tab ${batch.id === activeBatchId ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={batch.id === activeBatchId}
            aria-controls={`${batch.id}-panel`}
            tabIndex={batch.id === activeBatchId ? 0 : -1}
            onClick={() => {
              setActiveBatchId(batch.id);
              setIsDragging(false);
            }}
            onKeyDown={(event) => handleBatchTabKeyDown(event, index)}
          >
            <span>{batch.label}</span>
            {batch.images.length > 0 && (
              <span
                className="batch-tab-count"
                aria-label={`${batch.images.length} images`}
              >
                {batch.images.length}
              </span>
            )}
            {batch.isProcessing && (
              <span className="batch-tab-status" aria-label="Processing" />
            )}
          </button>
        ))}
      </div>
      <button
        className="new-batch-button"
        type="button"
        onClick={addBatch}
        aria-label="Start a new resize batch"
        title="New batch"
      >
        <Icon name="plus" />
      </button>
    </nav>
  );

  const loadingOverlay = isLoading ? (
    <div className="loading-overlay" role="status" aria-live="polite">
      <Loader />
      <div className="loading-overlay-copy">
        <strong>Reading your images</strong>
        <span>Large batches may take a moment.</span>
      </div>
    </div>
  ) : null;

  if (!images.length) {
    return (
      <>
        <WindowTitlebar />
        <main
          id={`${activeBatchId}-panel`}
          className={`empty-state ${isDragging ? "is-dragging" : ""}`}
          role="tabpanel"
          aria-labelledby={`${activeBatchId}-tab`}
          aria-busy={isLoading}
          inert={isLoading}
        >
          <header className="app-header empty-header">
            <div className="wordmark" aria-label="Bulk Image Resizer">
              {/* <span className="wordmark-mark" aria-hidden="true" /> */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="#fff"
                viewBox="0 0 256 256"
              >
                <path d="M136,112H48a8,8,0,0,0-8,8v88a8,8,0,0,0,8,8h88a8,8,0,0,0,8-8V120A8,8,0,0,0,136,112Zm-8,88H56V128h72Zm88-16v16a16,16,0,0,1-16,16H176a8,8,0,0,1,0-16h24V184a8,8,0,0,1,16,0Zm0-72v32a8,8,0,0,1-16,0V112a8,8,0,0,1,16,0Zm0-56V72a8,8,0,0,1-16,0V56H184a8,8,0,0,1,0-16h16A16,16,0,0,1,216,56Zm-64-8a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h32A8,8,0,0,1,152,48ZM40,80V56A16,16,0,0,1,56,40H72a8,8,0,0,1,0,16H56V80a8,8,0,0,1-16,0Z"></path>
              </svg>
              <span className="wordmark-label uppercase">
                Bulk Image Resizer
              </span>
            </div>
            {batchTabs}
          </header>
          <button
            className="drop-stage"
            type="button"
            onClick={selectImages}
            disabled={isLoading}
          >
            <span className="drop-title">
              {isDragging ? "Let them go." : "Drop your images here."}
            </span>
            <span className="drop-caption">
              {isLoading
                ? "Reading your images…"
                : "or click anywhere to choose from Finder"}
            </span>
          </button>
          <footer className="empty-footer">
            <span>JPEG · PNG · HEIC · TIFF · WEBP · BMP</span>
            <span>Originals stay untouched</span>
          </footer>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              void handleBrowserFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          {error && (
            <div className="toast error-toast" role="alert">
              {error}
            </div>
          )}
        </main>
        {loadingOverlay}
      </>
    );
  }

  return (
    <>
      <WindowTitlebar />
      <main
        id={`${activeBatchId}-panel`}
        className={`workspace ${isDragging ? "is-dragging" : ""}`}
        role="tabpanel"
        aria-labelledby={`${activeBatchId}-tab`}
        aria-busy={isLoading}
        inert={isLoading}
      >
        <header className="app-header workspace-header">
          <div className="wordmark" aria-label="Bulk Image Resizer">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="#fff"
              viewBox="0 0 256 256"
            >
              <path d="M136,112H48a8,8,0,0,0-8,8v88a8,8,0,0,0,8,8h88a8,8,0,0,0,8-8V120A8,8,0,0,0,136,112Zm-8,88H56V128h72Zm88-16v16a16,16,0,0,1-16,16H176a8,8,0,0,1,0-16h24V184a8,8,0,0,1,16,0Zm0-72v32a8,8,0,0,1-16,0V112a8,8,0,0,1,16,0Zm0-56V72a8,8,0,0,1-16,0V56H184a8,8,0,0,1,0-16h16A16,16,0,0,1,216,56Zm-64-8a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h32A8,8,0,0,1,152,48ZM40,80V56A16,16,0,0,1,56,40H72a8,8,0,0,1,0,16H56V80a8,8,0,0,1-16,0Z"></path>
            </svg>
            <span className="wordmark-label uppercase">Bulk Image Resizer</span>
          </div>
          {batchTabs}
          <div className="header-actions">
            <button
              className="text-button"
              type="button"
              onClick={selectImages}
              disabled={isLoading || isAnyBatchProcessing}
            >
              <Icon name="plus" />{" "}
              <span className="action-label">Add images</span>
            </button>
            <button
              className="text-button muted"
              type="button"
              onClick={clearBatch}
              disabled={isAnyBatchProcessing}
            >
              Clear
            </button>
          </div>
        </header>

        <section className="batch-heading" aria-labelledby="batch-title">
          <h1 id="batch-title">
            {images.length} {images.length === 1 ? "image" : "images"}
          </h1>
          <div className="batch-total">
            <span>Original size</span>
            <strong>{formatBytes(totalOriginal)}</strong>
          </div>
        </section>

        <div className="work-grid">
          <section className="image-list" aria-label="Selected images">
            {images.map((image, index) => {
              const result = results?.items.find(
                (item) => item.sourcePath === image.path,
              );
              const target = targetDimensions(
                image,
                resizeMode,
                scale,
                targetWidth,
              );
              return (
                <article className="image-row" key={image.path}>
                  <span className="row-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <img src={image.thumbnail} alt="" className="thumbnail" />
                  <div className="image-details">
                    <strong title={image.name}>{image.name}</strong>
                    <span>
                      {image.width} × {image.height} px ·{" "}
                      {formatBytes(image.size)}
                    </span>
                  </div>
                  {result ? (
                    <div className="image-result">
                      <strong>
                        −{reduction(result.originalSize, result.outputSize)}%
                      </strong>
                      <span>
                        {result.width} × {result.height} ·{" "}
                        {formatBytes(result.outputSize)}
                      </span>
                    </div>
                  ) : (
                    <div className="target-size">
                      <span>{target.width}</span>
                      <i>×</i>
                      <span>{target.height}</span>
                    </div>
                  )}
                  <button
                    className="remove-button"
                    type="button"
                    onClick={() => removeImage(image.path)}
                    aria-label={`Remove ${image.name}`}
                    disabled={isProcessing}
                  >
                    <Icon name="close" />
                  </button>
                </article>
              );
            })}
          </section>

          <aside className="control-panel" aria-label="Export settings">
            <div className="panel-heading">
              <h2>Batch settings</h2>
            </div>
            <fieldset className="setting-group">
              <legend>Format</legend>
              <div className="segmented-control">
                {(["webp", "avif", "jpeg", "png"] as OutputFormat[]).map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      className={format === option ? "active" : ""}
                      onClick={() =>
                        updateActiveBatch((batch) => ({
                          ...batch,
                          format: option,
                          results: null,
                        }))
                      }
                      disabled={isProcessing}
                    >
                      {option === "jpeg" ? "JPG" : option.toUpperCase()}
                    </button>
                  ),
                )}
              </div>
              <p>
                {format === "png"
                  ? "Lossless, best for transparency."
                  : "Optimized for smaller files with excellent visual quality."}
              </p>
            </fieldset>

            <fieldset className="setting-group resize-setting">
              <legend>Resize</legend>
              <div className="resize-mode-control" aria-label="Resize method">
                <button
                  type="button"
                  className={resizeMode === "percentage" ? "active" : ""}
                  aria-pressed={resizeMode === "percentage"}
                  onClick={() => changeResizeMode("percentage")}
                  disabled={isProcessing}
                >
                  Percentage
                </button>
                <button
                  type="button"
                  className={resizeMode === "width" ? "active" : ""}
                  aria-pressed={resizeMode === "width"}
                  onClick={() => changeResizeMode("width")}
                  disabled={isProcessing}
                >
                  Exact width
                </button>
              </div>
              {resizeMode === "percentage" ? (
                <div className="resize-options">
                  <div className="setting-label-row">
                    <label htmlFor="scale-range">Scale</label>
                    <output htmlFor="scale-range">{scale}%</output>
                  </div>
                  <input
                    id="scale-range"
                    aria-label="Resize scale percentage"
                    className="range-input"
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={scale}
                    onChange={(event) =>
                      changeScale(Number(event.target.value))
                    }
                    disabled={isProcessing}
                  />
                  <div className="preset-row">
                    {[25, 50, 75, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => changeScale(preset)}
                        className={scale === preset ? "active" : ""}
                        disabled={isProcessing}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="resize-options">
                  <label className="width-input-label" htmlFor="target-width">
                    <span>Width</span>
                    <span className="width-input">
                      <input
                        id="target-width"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="32768"
                        step="1"
                        value={targetWidth}
                        onChange={(event) =>
                          changeTargetWidth(Number(event.target.value))
                        }
                        disabled={isProcessing}
                      />
                      <span>px</span>
                    </span>
                  </label>
                  <p>
                    Every image gets this width. Height adjusts to preserve its
                    original proportions.
                  </p>
                </div>
              )}
            </fieldset>

            <fieldset
              className={`setting-group quality-setting ${format === "png" ? "is-disabled" : ""}`}
            >
              <legend className="setting-label-row">
                <span>Quality</span>
                <output htmlFor="quality-range">
                  {format === "png" ? "Lossless" : `${quality}%`}
                </output>
              </legend>
              <input
                id="quality-range"
                aria-label="Compression quality percentage"
                className="range-input"
                type="range"
                min="60"
                max="100"
                value={quality}
                onChange={(event) =>
                  updateActiveBatch((batch) => ({
                    ...batch,
                    quality: Number(event.target.value),
                    results: null,
                  }))
                }
                disabled={isProcessing || format === "png"}
              />
              <div className="quality-scale">
                <span>Smaller</span>
                <span>Sharper</span>
              </div>
            </fieldset>

            {isProcessing && progress ? (
              <div
                className="processing-block"
                role="status"
                aria-live="polite"
              >
                <div className="progress-copy">
                  <strong>
                    Processing{" "}
                    {Math.min(progress.completed + 1, progress.total)} of{" "}
                    {progress.total}
                  </strong>
                  <span>{progress.name}</span>
                </div>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${(progress.completed / progress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ) : results ? (
              <div className="success-block" role="status">
                <span className="success-mark">
                  <Icon name="check" />
                </span>
                <div>
                  <strong>Export complete</strong>
                  <span>
                    {formatBytes(Math.max(0, totalOriginal - totalOutput))}{" "}
                    saved · {reduction(totalOriginal, totalOutput)}% smaller
                  </span>
                </div>
              </div>
            ) : null}

            {results ? (
              <button
                className="primary-button success-button"
                type="button"
                onClick={revealOutput}
              >
                Show in Finder <Icon name="external" />
              </button>
            ) : (
              <button
                className="primary-button"
                type="button"
                onClick={exportImages}
                disabled={isAnyBatchProcessing || isLoading}
              >
                {isProcessing ? "Working…" : "Choose folder & export"}
                {isProcessing ? <Loader /> : <Icon name="arrow" />}
              </button>
            )}
            <p className="preserve-note">
              A new Bulk Image Resizer Export folder will be created. Your
              originals stay untouched.
            </p>
          </aside>
        </div>

        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            void handleBrowserFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
        {error && (
          <div className="toast error-toast" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() =>
                updateActiveBatch((batch) => ({ ...batch, error: "" }))
              }
              aria-label="Dismiss error"
            >
              <Icon name="close" />
            </button>
          </div>
        )}
        {isDragging && (
          <div className="drag-overlay">
            <span>Drop to add images</span>
          </div>
        )}
      </main>
      {loadingOverlay}
    </>
  );
}

export default App;
