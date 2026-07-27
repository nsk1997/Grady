import { GIFEncoder, applyPalette, quantize } from "gifenc";

import {
  createToolcraftPngExportCanvas,
  getToolcraftVideoExportSize,
} from "@/toolcraft/runtime";
import {
  ToolcraftApp,
  type ToolcraftPanelActionContext,
} from "@/toolcraft/runtime/react";

import {
  appSchema,
  contrastTarget,
  copyCssActionValue,
  exportGifActionValue,
  exportPngActionValue,
  exportVideoActionValue,
  focalTarget,
  glowColorTarget,
  glowTarget,
  grainBlendTarget,
  grainSizeTarget,
  grainTarget,
  gradientPresetPrefix,
  gradientTarget,
  harmonizeActionValue,
  imageFormatTarget,
  imageResolutionTarget,
  meshBlendTarget,
  meshPointsTarget,
  meshSeedTarget,
  meshShuffleActionValue,
  meshSizeTarget,
  meshSoftnessTarget,
  meshSpreadTarget,
  meshTarget,
  motionModeTarget,
  motionSpeedTarget,
  patternBlendTarget,
  patternColorTarget,
  patternScaleTarget,
  patternStyleTarget,
  patternTarget,
  presetActionPrefix,
  randomizeActionValue,
  recolorChromaTarget,
  recolorHueTarget,
  recolorLightnessTarget,
  sizePresetPrefix,
  temperatureTarget,
  vibranceTarget,
  vignetteSoftnessTarget,
  vignetteTarget,
} from "../app/app-schema";
import {
  applyExportGrade,
  applyGradientColorAdjust,
  canvasSizePresets,
  cssGradeFilter,
  defaultGradientValue,
  effectPresets,
  focalFraction,
  getGradientCss,
  getMotionKeyframes,
  getMotionLayerCss,
  gradientPresets,
  harmonizeGradient,
  meshBlobs,
  motionDurationSeconds,
  motionModeValue,
  motionUsesAngle,
  paintGlow,
  paintGradient,
  paintGrain,
  paintMesh,
  paintMotionGradient,
  paintPattern,
  paintTemperature,
  paintVignette,
  patternTilesAcross,
  randomizeGradient,
  type EffectPreset,
  type GradientValue,
} from "../app/gradient";
import { GradientPreview } from "../app/gradient-preview";
import { PaletteImageControl } from "../app/palette-image";

function readColorHex(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "hex" in value) {
    const { hex } = value as { hex?: unknown };

    if (typeof hex === "string") {
      return hex;
    }
  }

  return fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// The gradient with the OKLCH recolor applied — used everywhere the raw gradient
// would be, so the export and Copy CSS match the recolored preview.
function readAdjustedGradient(
  state: ToolcraftPanelActionContext["state"],
): GradientValue {
  const raw =
    (state.values[gradientTarget] as GradientValue | undefined) ?? defaultGradientValue;

  return applyGradientColorAdjust(
    raw,
    readNumber(state.values[recolorHueTarget], 0),
    readNumber(state.values[recolorChromaTarget], 0),
    readNumber(state.values[recolorLightnessTarget], 0),
  );
}

// Everything the paint pipeline needs, read once from state — shared by the
// still image export and the motion video export so the two always match.
function readGradientScene(state: ToolcraftPanelActionContext["state"]) {
  const gradientValue = readAdjustedGradient(state);
  const mesh = readNumber(state.values[meshTarget], 0);

  return {
    blobs:
      mesh > 0
        ? meshBlobs(
            gradientValue,
            readNumber(state.values[meshPointsTarget], 5),
            readNumber(state.values[meshSeedTarget], 1),
            readNumber(state.values[meshSizeTarget], 100),
            readNumber(state.values[meshSpreadTarget], 100),
          )
        : [],
    contrast: readNumber(state.values[contrastTarget], 0),
    focal: focalFraction(state.values[focalTarget]),
    glow: readNumber(state.values[glowTarget], 0),
    glowColor: readColorHex(state.values[glowColorTarget], "#FFF4E0"),
    gradientValue,
    grain: readNumber(state.values[grainTarget], 0),
    grainBlend:
      typeof state.values[grainBlendTarget] === "string"
        ? (state.values[grainBlendTarget] as string)
        : undefined,
    grainSize: readNumber(state.values[grainSizeTarget], 50),
    mesh,
    meshBlend:
      typeof state.values[meshBlendTarget] === "string"
        ? (state.values[meshBlendTarget] as string)
        : undefined,
    meshSoftness: readNumber(state.values[meshSoftnessTarget], 100),
    motionMode: motionModeValue(state.values[motionModeTarget]),
    motionSpeed: readNumber(state.values[motionSpeedTarget], 50),
    pattern: readNumber(state.values[patternTarget], 0),
    patternBlend:
      typeof state.values[patternBlendTarget] === "string"
        ? (state.values[patternBlendTarget] as string)
        : undefined,
    patternColor: readColorHex(state.values[patternColorTarget], "#FFFFFF"),
    patternScale: readNumber(state.values[patternScaleTarget], 50),
    patternStyle:
      typeof state.values[patternStyleTarget] === "string"
        ? (state.values[patternStyleTarget] as string)
        : "dots",
    temperature: readNumber(state.values[temperatureTarget], 0),
    vibrance: readNumber(state.values[vibranceTarget], 0),
    vignette: readNumber(state.values[vignetteTarget], 0),
    vignetteSoftness: readNumber(state.values[vignetteSoftnessTarget], 50),
  };
}

type GradientScene = ReturnType<typeof readGradientScene>;

// Paints every layer above the gradient base: mesh through temperature in CSS
// space, then grain and pattern at full device resolution (identity transform)
// so the noise/tiles stay crisp instead of scaling up into blocky pixels.
function paintSceneOverlays(
  context: CanvasRenderingContext2D,
  scene: GradientScene,
  cssWidth: number,
  cssHeight: number,
  pixelWidth: number,
  pixelHeight: number,
): void {
  paintMesh(
    context,
    scene.blobs,
    scene.mesh,
    scene.meshBlend,
    scene.meshSoftness,
    cssWidth,
    cssHeight,
  );
  paintGlow(context, scene.glow, scene.glowColor, scene.focal, cssWidth, cssHeight);
  paintVignette(context, scene.vignette, scene.vignetteSoftness, cssWidth, cssHeight);
  paintTemperature(context, scene.temperature, cssWidth, cssHeight);
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  paintGrain(context, scene.grain, scene.grainSize, scene.grainBlend, pixelWidth, pixelHeight);
  paintPattern(
    context,
    scene.patternStyle,
    scene.patternColor,
    scene.pattern,
    scene.patternBlend,
    patternTilesAcross(scene.patternScale),
    pixelWidth,
    pixelHeight,
  );
  context.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Toolcraft gradient export produced an empty image blob."));
        }
      },
      mimeType,
      0.95,
    );
  });
}

async function handleExportPng({
  reportProgress,
  state,
}: ToolcraftPanelActionContext): Promise<void> {
  const scene = readGradientScene(state);
  const resolution = String(state.values[imageResolutionTarget] ?? "4k");
  const format = String(state.values[imageFormatTarget] ?? "png");

  reportProgress(0.15);

  const canvas = createToolcraftPngExportCanvas({
    render: ({ context, cssHeight, cssWidth, pixelHeight, pixelWidth }) => {
      paintGradient(context, scene.gradientValue, cssWidth, cssHeight, scene.focal);
      paintSceneOverlays(context, scene, cssWidth, cssHeight, pixelWidth, pixelHeight);
      // Final pass over the composite: vibrance + contrast (matching the CSS
      // preview filter) plus neutral anti-banding dither, in one pixel loop.
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      applyExportGrade(context, pixelWidth, pixelHeight, {
        contrast: scene.contrast,
        vibrance: scene.vibrance,
      });
      context.restore();
    },
    resolution,
    state,
  });

  reportProgress(0.6);

  const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
  const extension = format === "jpg" ? "jpg" : "png";
  const blob = await canvasToBlob(canvas, mimeType);

  reportProgress(0.85);
  downloadBlob(blob, `gradient-${canvas.width}x${canvas.height}.${extension}`);
  reportProgress(1);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.download = filename;
  anchor.href = url;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// The WebM/MP4 container this browser can record; Chrome and Firefox take the
// WebM paths, Safari falls through to MP4.
function pickVideoRecordingType(): { extension: string; mimeType: string } | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  const candidates = [
    { extension: "webm", mimeType: "video/webm;codecs=vp9" },
    { extension: "webm", mimeType: "video/webm;codecs=vp8" },
    { extension: "webm", mimeType: "video/webm" },
    { extension: "mp4", mimeType: "video/mp4" },
  ];

  return candidates.find(({ mimeType }) => MediaRecorder.isTypeSupported(mimeType)) ?? null;
}

// Records exactly one animation cycle of the live composition to a video file,
// so the result loops seamlessly. Frames are painted with the same pipeline as
// the PNG export (motion phase drives the gradient layer; grain re-rolls each
// frame like real film grain), then graded through the same saturate/contrast
// filter the preview uses.
async function handleExportVideo({
  reportProgress,
  state,
}: ToolcraftPanelActionContext): Promise<void> {
  const scene = readGradientScene(state);

  if (scene.motionMode === "off") {
    return;
  }

  const recording = pickVideoRecordingType();

  if (!recording) {
    throw new Error("This browser cannot record video (MediaRecorder is unavailable).");
  }

  const { height, pixelRatio, width } = getToolcraftVideoExportSize({
    resolution: "current",
    state,
  });
  const cssWidth = Math.max(1, state.canvas.size.width);
  const cssHeight = Math.max(1, state.canvas.size.height);
  const durationMs = motionDurationSeconds(scene.motionSpeed) * 1000;
  const canvas = document.createElement("canvas");
  const frame = document.createElement("canvas");
  const scratch = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;
  frame.width = width;
  frame.height = height;

  const context = canvas.getContext("2d");
  const frameContext = frame.getContext("2d");

  if (!context || !frameContext) {
    throw new Error("Toolcraft motion export requires a 2D canvas context.");
  }

  const gradeFilter = cssGradeFilter(scene.vibrance, scene.contrast);
  const paintFrame = (phase: number): void => {
    frameContext.save();
    frameContext.clearRect(0, 0, width, height);
    frameContext.scale(pixelRatio, pixelRatio);
    paintMotionGradient(
      frameContext,
      scene.gradientValue,
      scene.motionMode,
      phase,
      cssWidth,
      cssHeight,
      scene.focal,
      scratch,
    );
    paintSceneOverlays(frameContext, scene, cssWidth, cssHeight, width, height);
    frameContext.restore();
    // Grade the composed frame in one pass so blend modes see ungraded layers,
    // exactly like the preview's wrapper filter.
    context.save();
    context.clearRect(0, 0, width, height);
    context.filter = gradeFilter;
    context.drawImage(frame, 0, 0);
    context.restore();
  };

  reportProgress(0.03);

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: recording.mimeType,
    videoBitsPerSecond: 12_000_000,
  });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("Toolcraft motion video recording failed."));
  });

  paintFrame(0);
  recorder.start();

  // Real-time capture: paint phase-accurate frames for one full cycle.
  await new Promise<void>((resolve) => {
    const start = performance.now();
    const tick = (now: number): void => {
      const elapsed = now - start;

      if (elapsed >= durationMs) {
        resolve();

        return;
      }

      paintFrame(elapsed / durationMs);
      reportProgress(0.03 + (elapsed / durationMs) * 0.85);
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });

  // Close the loop on the exact starting frame before stopping.
  paintFrame(0);
  recorder.stop();
  await stopped;

  reportProgress(0.95);
  downloadBlob(
    new Blob(chunks, { type: recording.mimeType }),
    `gradient-motion-${width}x${height}.${recording.extension}`,
  );
  reportProgress(1);
}

// GIF is a 256-color format whose file size scales with pixels x frames, so a
// full-resolution capture would be enormous and slow to quantize. Cap the long
// edge and sample a fixed set of frames across one animation cycle instead.
const GIF_MAX_LONG_EDGE = 480;
const GIF_MIN_FRAMES = 8;
const GIF_MAX_FRAMES = 48;
const GIF_TARGET_FPS = 12.5;
// Heavy grain defeats GIF's 256-color quantization (every noisy pixel wants its
// own palette entry), bloating the file and looking muddy. Cap it well below
// the full-strength preview/video value so GIFs stay clean and small.
const GIF_MAX_GRAIN = 15;
// How far each pixel is nudged by the ordered-dither pattern (in 0-255 levels)
// before palette mapping. ~ one quantization step for a 256-colour gradient —
// enough to scatter banding into a smooth blend without adding visible noise.
const GIF_DITHER_STRENGTH = 22;

// 8x8 Bayer threshold matrix, normalised to roughly -0.5..0.5 for symmetric
// dithering. Ordered dithering is deterministic (no per-frame sparkle) and cheap.
const BAYER_8X8 = (() => {
  const base = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ];

  return base.map((row) => row.map((value) => (value + 0.5) / 64 - 0.5));
})();

// Adds the Bayer pattern (scaled by `strength`) to each RGB channel in place, so
// a subsequent nearest-colour palette map alternates between neighbouring
// palette entries and reads as a smooth gradient instead of hard bands.
function orderedDither(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number,
): void {
  for (let y = 0; y < height; y += 1) {
    const row = BAYER_8X8[y & 7];

    for (let x = 0; x < width; x += 1) {
      const threshold = row[x & 7] * strength;
      const index = (y * width + x) * 4;

      // Uint8ClampedArray clamps to 0-255 on assignment.
      data[index] += threshold;
      data[index + 1] += threshold;
      data[index + 2] += threshold;
    }
  }
}

function gifDimensions(cssWidth: number, cssHeight: number): {
  height: number;
  width: number;
} {
  const scale = Math.min(1, GIF_MAX_LONG_EDGE / Math.max(cssWidth, cssHeight));

  return {
    height: Math.max(2, Math.round((cssHeight * scale) / 2) * 2),
    width: Math.max(2, Math.round((cssWidth * scale) / 2) * 2),
  };
}

// Encodes one seamless animation cycle as an animated, looping GIF. Frames are
// painted with the same pipeline as the PNG/video exports, then quantized to a
// per-frame 256-color palette via gifenc.
async function handleExportGif({
  reportProgress,
  state,
}: ToolcraftPanelActionContext): Promise<void> {
  const fullScene = readGradientScene(state);

  if (fullScene.motionMode === "off") {
    return;
  }

  // Cap grain for the GIF so the limited palette isn't wasted on noise.
  const scene = { ...fullScene, grain: Math.min(fullScene.grain, GIF_MAX_GRAIN) };
  const cssWidth = Math.max(1, state.canvas.size.width);
  const cssHeight = Math.max(1, state.canvas.size.height);
  const { height, width } = gifDimensions(cssWidth, cssHeight);
  const durationMs = motionDurationSeconds(scene.motionSpeed) * 1000;
  const frameCount = Math.min(
    GIF_MAX_FRAMES,
    Math.max(GIF_MIN_FRAMES, Math.round((durationMs / 1000) * GIF_TARGET_FPS)),
  );
  const delay = Math.round(durationMs / frameCount);
  const pixelRatio = width / cssWidth;

  const frame = document.createElement("canvas");
  const graded = document.createElement("canvas");
  const scratch = document.createElement("canvas");

  frame.width = width;
  frame.height = height;
  graded.width = width;
  graded.height = height;

  const frameContext = frame.getContext("2d");
  const gradedContext = graded.getContext("2d", { willReadFrequently: true });

  if (!frameContext || !gradedContext) {
    throw new Error("Toolcraft GIF export requires a 2D canvas context.");
  }

  const gradeFilter = cssGradeFilter(scene.vibrance, scene.contrast);
  const gif = GIFEncoder();

  reportProgress(0.03);

  for (let index = 0; index < frameCount; index += 1) {
    const phase = index / frameCount;

    frameContext.save();
    frameContext.clearRect(0, 0, width, height);
    frameContext.scale(pixelRatio, pixelRatio);
    paintMotionGradient(
      frameContext,
      scene.gradientValue,
      scene.motionMode,
      phase,
      cssWidth,
      cssHeight,
      scene.focal,
      scratch,
    );
    paintSceneOverlays(frameContext, scene, cssWidth, cssHeight, width, height);
    frameContext.restore();

    // Grade the composed frame so blend layers stay ungraded, like the preview.
    gradedContext.save();
    gradedContext.clearRect(0, 0, width, height);
    gradedContext.filter = gradeFilter;
    gradedContext.drawImage(frame, 0, 0);
    gradedContext.restore();

    const { data } = gradedContext.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    // Ordered-dither toward the palette before mapping so smooth gradients don't
    // band into flat 256-colour steps (gifenc's applyPalette is nearest-colour,
    // no dithering of its own).
    orderedDither(data, width, height, GIF_DITHER_STRENGTH);
    const indexed = applyPalette(data, palette);

    gif.writeFrame(indexed, width, height, { delay, palette });

    reportProgress(0.03 + ((index + 1) / frameCount) * 0.9);
    // Yield so the panel's progress UI can paint between heavy frames.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  gif.finish();

  reportProgress(0.97);
  // Copy into a fresh ArrayBuffer-backed view so the Blob part type is exact
  // (gifenc's view may be typed as SharedArrayBuffer-backed).
  downloadBlob(
    new Blob([new Uint8Array(gif.bytesView())], { type: "image/gif" }),
    `gradient-motion-${width}x${height}.gif`,
  );
  reportProgress(1);
}

function buildGradientCssSnippet({ state }: ToolcraftPanelActionContext): string {
  const gradientValue = readAdjustedGradient(state);
  const motionMode = motionModeValue(state.values[motionModeTarget]);
  const spinsAngle = motionUsesAngle(gradientValue.gradientType);
  const lines: string[] = [];
  const focal = focalFraction(state.values[focalTarget]);

  lines.push(
    `background-image: ${getGradientCss(gradientValue, focal, motionMode === "spin" && spinsAngle)};`,
  );

  // Motion ships as plain CSS: the animation declarations plus the exact
  // keyframes the live preview runs, so the copied snippet matches the app.
  const motionLayer = getMotionLayerCss(
    motionMode,
    spinsAngle,
    motionDurationSeconds(readNumber(state.values[motionSpeedTarget], 50)),
  );

  if (motionLayer) {
    if (motionLayer.backgroundSize) {
      lines.push(`background-size: ${motionLayer.backgroundSize};`);
    }

    if (motionLayer.backgroundPosition) {
      lines.push(`background-position: ${motionLayer.backgroundPosition};`);
    }

    lines.push(`animation: ${motionLayer.animation};`);
    lines.push("", "/* Place outside the rule: */");
    lines.push(getMotionKeyframes(motionMode, spinsAngle));
  }

  return lines.join("\n");
}

async function handleCopyCss(context: ToolcraftPanelActionContext): Promise<void> {
  context.reportProgress(0.4);
  await navigator.clipboard.writeText(buildGradientCssSnippet(context));
  context.reportProgress(1);
}

function applyEffectPreset(
  context: ToolcraftPanelActionContext,
  preset: EffectPreset,
): void {
  const entries: [string, number | string][] = [
    [grainTarget, preset.grain],
    [grainSizeTarget, preset.grainSize],
    [grainBlendTarget, preset.grainBlend],
    [vignetteTarget, preset.vignette],
    [vignetteSoftnessTarget, preset.vignetteSoftness],
  ];

  for (const [target, value] of entries) {
    context.dispatch({
      label: "Apply effect preset",
      target,
      type: "controls.setValue",
      value,
    });
  }
}

// Clears the OKLCH Recolor so a freshly loaded palette shows its true colors
// rather than being silently transformed by leftover Recolor slider positions
// (which would mismatch the gradient editor's stops).
function resetRecolor(context: ToolcraftPanelActionContext): void {
  const active =
    readNumber(context.state.values[recolorHueTarget], 0) !== 0 ||
    readNumber(context.state.values[recolorChromaTarget], 0) !== 0 ||
    readNumber(context.state.values[recolorLightnessTarget], 0) !== 0;

  if (!active) {
    return;
  }

  for (const target of [recolorHueTarget, recolorChromaTarget, recolorLightnessTarget]) {
    context.dispatch({
      label: "Reset recolor",
      target,
      type: "controls.setValue",
      value: 0,
    });
  }
}

function onPanelAction(context: ToolcraftPanelActionContext): Promise<void> | void {
  const { value } = context.action;

  if (value === exportPngActionValue) {
    return handleExportPng(context);
  }

  if (value === exportVideoActionValue) {
    return handleExportVideo(context);
  }

  if (value === exportGifActionValue) {
    return handleExportGif(context);
  }

  if (value === copyCssActionValue) {
    return handleCopyCss(context);
  }

  if (value === randomizeActionValue) {
    context.dispatch({
      label: "Randomize gradient",
      target: gradientTarget,
      type: "controls.setValue",
      value: randomizeGradient(),
    });
    resetRecolor(context);

    return;
  }

  if (value === meshShuffleActionValue) {
    context.dispatch({
      label: "Shuffle mesh layout",
      target: meshSeedTarget,
      type: "controls.setValue",
      value: Math.floor(Math.random() * 1_000_000_000) + 1,
    });

    return;
  }

  if (value === harmonizeActionValue) {
    context.dispatch({
      label: "Harmonize palette",
      target: gradientTarget,
      type: "controls.setValue",
      value: harmonizeGradient(),
    });
    resetRecolor(context);

    return;
  }

  if (typeof value === "string" && value.startsWith(sizePresetPrefix)) {
    const sizePreset = canvasSizePresets[value.slice(sizePresetPrefix.length)];

    if (sizePreset) {
      context.dispatch({
        size: { height: sizePreset.height, unit: "px", width: sizePreset.width },
        type: "canvas.setSize",
      });
      // Recenter so the resized canvas stays in view.
      context.dispatch({ type: "canvas.center" });
    }

    return;
  }

  if (typeof value === "string" && value.startsWith(gradientPresetPrefix)) {
    const gradientPreset = gradientPresets[value.slice(gradientPresetPrefix.length)];

    if (gradientPreset) {
      context.dispatch({
        label: "Load gradient preset",
        target: gradientTarget,
        type: "controls.setValue",
        value: gradientPreset,
      });
      resetRecolor(context);
    }

    return;
  }

  if (typeof value === "string" && value.startsWith(presetActionPrefix)) {
    const preset = effectPresets[value.slice(presetActionPrefix.length)];

    if (preset) {
      applyEffectPreset(context, preset);
    }
  }
}

const controlRenderers = {
  paletteImage: PaletteImageControl,
};

export function AppHome(): React.JSX.Element {
  return (
    <ToolcraftApp
      canvasContent={<GradientPreview />}
      className="h-dvh min-h-dvh"
      controlRenderers={controlRenderers}
      onPanelAction={onPanelAction}
      renderDefaultCanvasMedia={false}
      schema={appSchema}
    />
  );
}
