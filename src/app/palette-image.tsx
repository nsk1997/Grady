import * as React from "react";

import type { ToolcraftCustomControlRendererProps } from "@/toolcraft/runtime/react";
import type { ToolcraftCommand, ToolcraftState } from "@/toolcraft/runtime";

import {
  gradientTarget,
  recolorChromaTarget,
  recolorHueTarget,
  recolorLightnessTarget,
} from "./app-schema";
import { extractPaletteFromImageData, gradientFromColors } from "./gradient";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the image."));
    image.src = dataUrl;
  });
}

// A small JPEG thumbnail data URL for the uploader preview (keeps component
// state light instead of holding the full-resolution image).
function makeThumbnail(image: HTMLImageElement, maxDimension = 96): string {
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    return "";
  }

  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.7);
}

type Upload = { colors: string[]; name: string; thumbnail: string };

type PaletteImageInnerProps = {
  dispatch: React.Dispatch<ToolcraftCommand>;
  state: ToolcraftState;
};

// Inner component so React owns the hooks in a real instance — the runtime calls
// the exported renderer as a plain function, which would make bare hooks fragile.
function PaletteImageInner({ dispatch, state }: PaletteImageInnerProps): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [upload, setUpload] = React.useState<Upload | null>(null);

  const openPicker = (): void => inputRef.current?.click();

  const handleFile = async (file: File): Promise<void> => {
    if (!file.type.startsWith("image/")) {
      setError("That doesn't look like an image.");

      return;
    }

    setError(null);
    setBusy(true);

    try {
      const image = await decodeImage(await readAsDataUrl(file));
      const maxDimension = 160;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas is unavailable.");
      }

      // Nearest-neighbor keeps the image's true pixel colors while downscaling.
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, width, height);

      const { data } = context.getImageData(0, 0, width, height);
      const colors = extractPaletteFromImageData(data, 4);

      if (colors.length < 2) {
        throw new Error("Not enough color in that image.");
      }

      dispatch({
        label: "Palette from image",
        target: gradientTarget,
        type: "controls.setValue",
        value: gradientFromColors(colors),
      });

      // Clear any leftover OKLCH Recolor so the palette shows its true colors.
      const recolorActive = [recolorHueTarget, recolorChromaTarget, recolorLightnessTarget].some(
        (target) => typeof state.values[target] === "number" && state.values[target] !== 0,
      );

      if (recolorActive) {
        for (const target of [recolorHueTarget, recolorChromaTarget, recolorLightnessTarget]) {
          dispatch({ label: "Reset recolor", target, type: "controls.setValue", value: 0 });
        }
      }

      setUpload({ colors, name: file.name, thumbnail: makeThumbnail(image) });
    } catch {
      setError("Couldn't build a palette from that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-md ${
        dragActive ? "outline outline-2 outline-primary/60" : ""
      }`}
      onDragLeave={() => setDragActive(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);

        const file = event.dataTransfer.files?.[0];

        if (file) {
          void handleFile(file);
        }
      }}
    >
      <input
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            void handleFile(file);
          }

          event.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />

      {upload ? (
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={upload.name}
            className="size-10 shrink-0 rounded object-cover ring-1 ring-black/10"
            src={upload.thumbnail}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex gap-1">
              {upload.colors.map((color) => (
                <span
                  className="h-4 flex-1 rounded-sm ring-1 ring-black/10"
                  key={color}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <button
              className="truncate text-left text-xs text-foreground/55 transition-colors hover:text-foreground/90"
              disabled={busy}
              onClick={openPicker}
              type="button"
            >
              {busy ? "Reading image…" : `${upload.name} · Replace`}
            </button>
          </div>
          <button
            aria-label="Remove image"
            className="shrink-0 rounded p-1 text-foreground/45 transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => {
              setUpload(null);
              setError(null);
            }}
            type="button"
          >
            <svg
              aria-hidden
              fill="none"
              height="14"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="14"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border/70 bg-muted/30 px-3 py-2.5 text-sm font-medium text-foreground/90 transition-colors hover:border-border hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={openPicker}
          type="button"
        >
          {busy ? "Reading image…" : "Palette from image"}
        </button>
      )}

      {error ? <span className="px-0.5 text-xs text-rose-500">{error}</span> : null}
    </div>
  );
}

export function PaletteImageControl({
  dispatch,
  state,
}: ToolcraftCustomControlRendererProps): React.ReactNode {
  return <PaletteImageInner dispatch={dispatch} state={state} />;
}
