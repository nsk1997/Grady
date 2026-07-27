// Shared gradient model used by both the live DOM preview and PNG export so the
// two always agree. The value shape matches the runtime `gradient` control:
// { gradientType, angle, stops: [{ position, color, opacity }] }.

import BezierEasing from "bezier-easing";
import { converter, formatHex, toGamut } from "culori";
import { createNoise4D } from "simplex-noise";

// Shared Drift easing curve. Using one real cubic-bezier for BOTH the CSS
// preview (as a cubic-bezier() timing function) and the canvas export (as the
// evaluated easing function) guarantees the two drift identically — the old
// code approximated CSS ease-in-out with a cosine, which didn't quite match.
// [0.37, 0, 0.63, 1] is a smooth sine-like ease-in-out that gently rests at the
// sweep extremes.
const DRIFT_BEZIER: readonly [number, number, number, number] = [0.37, 0, 0.63, 1];
export const driftEaseCss = `cubic-bezier(${DRIFT_BEZIER.join(", ")})`;
const driftEase = BezierEasing(...DRIFT_BEZIER);

// culori converters for the perceptually-uniform Oklab space (Ottosson), used
// for banding-free gradient interpolation and palette harmonies. culori handles
// the sRGB <-> linear-light transfer internally.
const toOklab = converter("oklab");
const toRgb = converter("rgb");
const toOklch = converter("oklch");

// Maps an OKLCH color into the sRGB gamut by reducing chroma while preserving
// hue and lightness (CSS Color 4 gamut mapping), instead of the naive per-channel
// RGB clip formatHex does on its own — which shifts hue and muddies vivid colors
// at extreme Recolor/Harmonize values. Returns a gamut-safe #RRGGBB.
const clampOklchToSrgb = toGamut("rgb", "oklch");

function oklchToGamutHex(
  lightness: number,
  chroma: number,
  hue: number | undefined,
): string | undefined {
  return formatHex(
    clampOklchToSrgb({ c: chroma, h: hue, l: lightness, mode: "oklch" }),
  );
}

export type GradientStopValue = {
  color: string;
  opacity?: number;
  position: string;
};

export type GradientValue = {
  angle?: number;
  gradientType?: "linear" | "radial" | "angular" | "diamond";
  stops?: readonly GradientStopValue[];
};

export const defaultGradientValue: GradientValue = {
  angle: 90,
  gradientType: "linear",
  stops: [
    { color: "#6366F1", opacity: 100, position: "0%" },
    { color: "#EC4899", opacity: 100, position: "100%" },
  ],
};

// Curated starting-point gradients for the Library section. Each is a complete
// GradientValue the user can load and then fine-tune in the Gradient editor.
export const gradientPresets: Record<string, GradientValue> = {
  sunset: {
    angle: 45,
    gradientType: "linear",
    stops: [
      { color: "#FF6B6B", opacity: 100, position: "0%" },
      { color: "#FFD93D", opacity: 100, position: "100%" },
    ],
  },
  ocean: {
    angle: 135,
    gradientType: "linear",
    stops: [
      { color: "#2E3192", opacity: 100, position: "0%" },
      { color: "#1BFFFF", opacity: 100, position: "100%" },
    ],
  },
  aurora: {
    angle: 120,
    gradientType: "linear",
    stops: [
      { color: "#00C9FF", opacity: 100, position: "0%" },
      { color: "#92FE9D", opacity: 100, position: "100%" },
    ],
  },
  ember: {
    angle: 90,
    gradientType: "linear",
    stops: [
      { color: "#F83600", opacity: 100, position: "0%" },
      { color: "#FE8C00", opacity: 100, position: "100%" },
    ],
  },
  berry: {
    angle: 160,
    gradientType: "linear",
    stops: [
      { color: "#8E2DE2", opacity: 100, position: "0%" },
      { color: "#4A00E0", opacity: 100, position: "100%" },
    ],
  },
  mint: {
    angle: 90,
    gradientType: "linear",
    stops: [
      { color: "#11998E", opacity: 100, position: "0%" },
      { color: "#38EF7D", opacity: 100, position: "100%" },
    ],
  },
  cosmic: {
    angle: 90,
    gradientType: "angular",
    stops: [
      { color: "#FC466B", opacity: 100, position: "0%" },
      { color: "#3F5EFB", opacity: 100, position: "50%" },
      { color: "#FC466B", opacity: 100, position: "100%" },
    ],
  },
  dusk: {
    angle: 90,
    gradientType: "radial",
    stops: [
      { color: "#8F94FB", opacity: 100, position: "0%" },
      { color: "#4E54C8", opacity: 100, position: "100%" },
    ],
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const gradientTypes: NonNullable<GradientValue["gradientType"]>[] = [
  "linear",
  "radial",
  "angular",
  "diamond",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = hue / 60;
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = lightness - chroma / 2;
  const [red, green, blue] = (
    huePrime < 1
      ? [chroma, secondary, 0]
      : huePrime < 2
        ? [secondary, chroma, 0]
        : huePrime < 3
          ? [0, chroma, secondary]
          : huePrime < 4
            ? [0, secondary, chroma]
            : huePrime < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary]
  ).map((channel) =>
    Math.round((channel + match) * 255)
      .toString(16)
      .padStart(2, "0"),
  );

  return `#${red}${green}${blue}`.toUpperCase();
}

// Produces a fresh, visually pleasant gradient: a random type/angle and a
// harmonious 2-4 stop color set spread across the full 0-100% range.
export function randomizeGradient(): GradientValue {
  const stopCount = randomInt(2, 4);
  const baseHue = randomInt(0, 359);
  const hueSpread = randomInt(40, 160);
  const stops: GradientStopValue[] = Array.from({ length: stopCount }, (_, index) => {
    const ratio = stopCount === 1 ? 0 : index / (stopCount - 1);
    const hue = (baseHue + hueSpread * ratio) % 360;
    const saturation = randomInt(55, 90) / 100;
    const lightness = randomInt(45, 65) / 100;

    return {
      color: hslToHex(hue, saturation, lightness),
      opacity: 100,
      position: `${Math.round(ratio * 100)}%`,
    };
  });

  return {
    angle: randomInt(0, 359),
    gradientType: gradientTypes[randomInt(0, gradientTypes.length - 1)],
    stops,
  };
}

// Generates a color-theory-harmonious gradient in OKLCH (perceptual hue). A
// random base hue is offset by a harmony rule (analogous / complementary /
// triadic), holding lightness and chroma roughly constant so the stops read as
// a deliberate palette rather than a random pair. culori formats the OKLCH
// colors to gamut-clamped hex.
const harmonyRules: number[][] = [
  [0, 25, 50], // analogous
  [0, 180], // complementary
  [0, 120, 240], // triadic
  [0, 30], // near-analogous pair
];

export function harmonizeGradient(): GradientValue {
  const baseHue = randomInt(0, 359);
  const rule = harmonyRules[randomInt(0, harmonyRules.length - 1)];
  const lightness = randomInt(55, 72) / 100;
  const chroma = randomInt(12, 20) / 100;
  const lastIndex = Math.max(1, rule.length - 1);

  const stops: GradientStopValue[] = rule.map((hueOffset, index) => {
    const ratio = index / lastIndex;
    const stopLightness = clamp(lightness + (ratio - 0.5) * 0.14, 0.35, 0.9);
    const hex = oklchToGamutHex(stopLightness, chroma, (baseHue + hueOffset) % 360);

    return {
      color: (hex ?? "#000000").toUpperCase(),
      opacity: 100,
      position: `${Math.round(ratio * 100)}%`,
    };
  });

  return {
    angle: randomInt(0, 359),
    gradientType: "linear",
    stops,
  };
}

// --- OKLCH recolor -----------------------------------------------------------
// Perceptual palette adjustment: shifts every stop's Hue, scales its Chroma, and
// offsets its Lightness in OKLCH (via culori), so the whole gradient recolors
// coherently while brightness relationships hold. Identity at 0/0/0, so it's
// non-destructive until touched. Applied to the gradient value up front, so the
// gradient, mesh, and Copy CSS all see the recolored palette.
export function hasColorAdjust(
  hue: number | undefined,
  chroma: number | undefined,
  lightness: number | undefined,
): boolean {
  return (hue ?? 0) !== 0 || (chroma ?? 0) !== 0 || (lightness ?? 0) !== 0;
}

export function applyGradientColorAdjust(
  value: GradientValue,
  hue: number | undefined,
  chroma: number | undefined,
  lightness: number | undefined,
): GradientValue {
  if (!hasColorAdjust(hue, chroma, lightness) || !value.stops) {
    return value;
  }

  const hueShift = clamp(hue ?? 0, -180, 180);
  const chromaScale = 1 + clamp(chroma ?? 0, -100, 100) / 100;
  const lightnessOffset = (clamp(lightness ?? 0, -100, 100) / 100) * 0.3;

  const stops = value.stops.map((stop) => {
    const oklch = toOklch(stop.color);

    if (!oklch) {
      return stop;
    }

    const nextLightness = clamp((oklch.l ?? 0) + lightnessOffset, 0, 1);
    const nextChroma = Math.max(0, (oklch.c ?? 0) * chromaScale);
    // Grays have no hue (h undefined); leave them hueless so they stay neutral.
    const nextHue =
      oklch.h === undefined ? undefined : ((oklch.h + hueShift) % 360 + 360) % 360;
    // Gamut-map (chroma reduction) rather than clip, so pushing Chroma/Lightness
    // to the extremes stays hue-true and vivid instead of muddy.
    const hex = oklchToGamutHex(nextLightness, nextChroma, nextHue);

    return { ...stop, color: (hex ?? stop.color).toUpperCase() };
  });

  return { ...value, stops };
}

// --- Palette from image ------------------------------------------------------
// Extracts a representative palette from decoded image pixels using median-cut
// quantization — the standard algorithm behind image color extraction. Unlike
// frequency counting (which just returns the dullest, most common background
// tones and averages vivid colors into mud), median cut recursively splits the
// color space along its widest axis, so distinct colors — including small vivid
// accents — get their own bucket. Colors are ordered light→dark for a ramp.
type Rgb255 = [number, number, number];

function oklabDistance(hexA: string, hexB: string): number {
  const a = rgbToOklab(parseHexRgb(hexA));
  const b = rgbToOklab(parseHexRgb(hexB));

  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

// Returns which channel (0=r,1=g,2=b) spans the widest range in a bucket, plus
// that range — median cut splits along it.
function widestChannel(bucket: readonly Rgb255[]): { channel: number; range: number } {
  const min: Rgb255 = [255, 255, 255];
  const max: Rgb255 = [0, 0, 0];

  for (const pixel of bucket) {
    for (let channel = 0; channel < 3; channel += 1) {
      if (pixel[channel] < min[channel]) {
        min[channel] = pixel[channel];
      }

      if (pixel[channel] > max[channel]) {
        max[channel] = pixel[channel];
      }
    }
  }

  let channel = 0;
  let range = -1;

  for (let index = 0; index < 3; index += 1) {
    const span = max[index] - min[index];

    if (span > range) {
      range = span;
      channel = index;
    }
  }

  return { channel, range };
}

function averagePixel(bucket: readonly Rgb255[]): Rgb255 {
  let red = 0;
  let green = 0;
  let blue = 0;

  for (const pixel of bucket) {
    red += pixel[0];
    green += pixel[1];
    blue += pixel[2];
  }

  const size = bucket.length || 1;

  return [Math.round(red / size), Math.round(green / size), Math.round(blue / size)];
}

function medianCut(pixels: Rgb255[], count: number): Rgb255[][] {
  if (pixels.length === 0) {
    return [];
  }

  let buckets: Rgb255[][] = [pixels];

  while (buckets.length < count) {
    // Split the bucket with the widest color spread — that isolates the most
    // distinct colors rather than repeatedly slicing a uniform background.
    let target = -1;
    let widestRange = 0;

    for (let index = 0; index < buckets.length; index += 1) {
      if (buckets[index].length < 2) {
        continue;
      }

      const { range } = widestChannel(buckets[index]);

      if (range > widestRange) {
        widestRange = range;
        target = index;
      }
    }

    if (target === -1) {
      break;
    }

    const bucket = buckets[target];
    const { channel } = widestChannel(bucket);

    bucket.sort((a, b) => a[channel] - b[channel]);

    const middle = bucket.length >> 1;

    buckets = [
      ...buckets.slice(0, target),
      bucket.slice(0, middle),
      bucket.slice(middle),
      ...buckets.slice(target + 1),
    ];
  }

  return buckets;
}

type PaletteCandidate = { hex: string; oklab: Oklab; size: number };

function oklabDelta(a: Oklab, b: Oklab): number {
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

export function extractPaletteFromImageData(
  data: Uint8ClampedArray,
  count = 4,
): string[] {
  const pixels: Rgb255[] = [];

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 125) {
      continue;
    }

    pixels.push([data[index], data[index + 1], data[index + 2]]);
  }

  if (pixels.length === 0) {
    return [];
  }

  // Over-segment: many tight buckets average to clean, real colors (not mud).
  const oversampled = medianCut(pixels, Math.max(count * 4, 12));
  const candidates: PaletteCandidate[] = [];

  for (const bucket of oversampled) {
    if (bucket.length === 0) {
      continue;
    }

    const [red, green, blue] = averagePixel(bucket);
    const hex =
      formatHex({ b: blue / 255, g: green / 255, mode: "rgb", r: red / 255 })?.toUpperCase() ??
      "#000000";

    // Merge near-identical bucket averages, summing their sizes.
    const existing = candidates.find((candidate) => oklabDistance(candidate.hex, hex) <= 0.02);

    if (existing) {
      existing.size += bucket.length;
    } else {
      candidates.push({ hex, oklab: rgbToOklab({ blue, green, red }), size: bucket.length });
    }
  }

  if (candidates.length <= count) {
    return candidates
      .map((candidate) => candidate.hex)
      .sort((a, b) => rgbToOklab(parseHexRgb(b)).L - rgbToOklab(parseHexRgb(a)).L);
  }

  // Seed with the most dominant color, then farthest-point sampling to pull in
  // the most perceptually distinct colors — this surfaces small vivid accents
  // that pure frequency/median-cut would drown under a large flat background.
  candidates.sort((a, b) => b.size - a.size);

  const selected: PaletteCandidate[] = [candidates[0]];

  while (selected.length < count) {
    let best: PaletteCandidate | null = null;
    let bestDistance = -1;

    for (const candidate of candidates) {
      if (selected.includes(candidate)) {
        continue;
      }

      let nearest = Infinity;

      for (const chosen of selected) {
        nearest = Math.min(nearest, oklabDelta(chosen.oklab, candidate.oklab));
      }

      if (nearest > bestDistance) {
        bestDistance = nearest;
        best = candidate;
      }
    }

    if (!best) {
      break;
    }

    selected.push(best);
  }

  return selected
    .map((candidate) => candidate.hex)
    .sort((a, b) => rgbToOklab(parseHexRgb(b)).L - rgbToOklab(parseHexRgb(a)).L);
}

export function gradientFromColors(colors: readonly string[]): GradientValue {
  const lastIndex = Math.max(1, colors.length - 1);

  return {
    angle: 90,
    gradientType: "linear",
    stops: colors.map((color, index) => ({
      color,
      opacity: 100,
      position: `${Math.round((index / lastIndex) * 100)}%`,
    })),
  };
}

function parseStopPosition(position: string): number {
  const parsed = Number.parseFloat(position);

  return Number.isFinite(parsed) ? clamp(parsed / 100, 0, 1) : 0;
}

function parseStopOpacity(opacity: number | undefined): number {
  return clamp(opacity ?? 100, 0, 100) / 100;
}

function sortedStops(stops: readonly GradientStopValue[]): GradientStopValue[] {
  return [...stops].sort(
    (left, right) => parseStopPosition(left.position) - parseStopPosition(right.position),
  );
}

function stopCssColor(stop: GradientStopValue): string {
  const opacity = parseStopOpacity(stop.opacity);

  if (opacity >= 1) {
    return stop.color;
  }

  return `color-mix(in oklab, ${stop.color} ${Math.round(opacity * 100)}%, transparent)`;
}

// Focal point in 0-1 box fractions (0.5,0.5 = center). Positions the center of
// radial/diamond/angular gradients and the glow bloom.
export type FocalPoint = { x: number; y: number };

export const centerFocalPoint: FocalPoint = { x: 0.5, y: 0.5 };

// Converts a vector control value ({ x, y } strings in -1..1, screen coords)
// into 0-1 box fractions (x: 0=left..1=right, y: 0=top..1=bottom).
export function focalFraction(value: unknown): FocalPoint {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawX = typeof record.x === "string" ? Number.parseFloat(record.x) : Number(record.x);
  const rawY = typeof record.y === "string" ? Number.parseFloat(record.y) : Number(record.y);
  const x = Number.isFinite(rawX) ? rawX : 0;
  const y = Number.isFinite(rawY) ? rawY : 0;

  return { x: (clamp(x, -1, 1) + 1) / 2, y: (clamp(y, -1, 1) + 1) / 2 };
}

export function getGradientCss(
  value: GradientValue,
  focal: FocalPoint = centerFocalPoint,
  spin = false,
): string {
  const stops = sortedStops(value.stops ?? []);

  if (stops.length === 0) {
    return "transparent";
  }

  const stopList = stops
    .map((stop) => `${stopCssColor(stop)} ${Math.round(parseStopPosition(stop.position) * 100)}%`)
    .join(", ");
  const angle = Math.round(value.angle ?? 90);
  // With Spin motion active, the angle is offset by an animatable registered
  // custom property (see getMotionKeyframes); the fallback keeps the gradient
  // static in browsers without @property support.
  const angleCss = spin ? `calc(${angle}deg + var(--gg-spin, 0deg))` : `${angle}deg`;
  const centerX = Math.round(clamp(focal.x, 0, 1) * 100);
  const centerY = Math.round(clamp(focal.y, 0, 1) * 100);

  // Interpolate in oklab for perceptually even color transitions (far less
  // mid-gradient banding/graying than the default sRGB interpolation).
  switch (value.gradientType ?? "linear") {
    case "angular":
      return `conic-gradient(from ${angleCss} at ${centerX}% ${centerY}% in oklab, ${stopList})`;
    case "diamond":
      return `radial-gradient(closest-side at ${centerX}% ${centerY}% in oklab, ${stopList})`;
    case "radial":
      return `radial-gradient(circle at ${centerX}% ${centerY}% in oklab, ${stopList})`;
    default:
      return `linear-gradient(${angleCss} in oklab, ${stopList})`;
  }
}

// --- Premium effect overlays (grain + vignette) ---------------------------
// Both effects are shared by the live DOM preview and the canvas PNG export so
// the two always render the same composition.

// --- Organic film grain (simplex fBm) --------------------------------------
// A single tileable grayscale noise tile, generated once and shared by both the
// live preview (CSS background-image) and the PNG/video/GIF export (canvas
// pattern), so the two always render identical grain. Unlike flat white noise,
// this is fractal Brownian motion over simplex noise — coherent, clumpy, and
// photographic, the way real film grain reads.
export const grainTileSize = 160;

const GRAIN_OCTAVES = 4;
const GRAIN_PERSISTENCE = 0.6; // amplitude falloff per octave
const GRAIN_LACUNARITY = 2.2; // frequency growth per octave
const GRAIN_BASE_FREQUENCY = 5.5; // torus loops across the tile at octave 0

// Tileable fractal noise: sampling 4D simplex on two circles (a torus) makes the
// result seamless when repeated, with no visible tile seams.
function grainFbm(
  noise4D: ReturnType<typeof createNoise4D>,
  u: number,
  v: number,
): number {
  let amplitude = 1;
  let frequency = GRAIN_BASE_FREQUENCY;
  let sum = 0;
  let norm = 0;

  for (let octave = 0; octave < GRAIN_OCTAVES; octave += 1) {
    const angleU = u * 2 * Math.PI;
    const angleV = v * 2 * Math.PI;
    const radius = frequency / (2 * Math.PI);
    const value = noise4D(
      Math.cos(angleU) * radius,
      Math.sin(angleU) * radius,
      Math.cos(angleV) * radius,
      Math.sin(angleV) * radius,
    );

    sum += value * amplitude;
    norm += amplitude;
    amplitude *= GRAIN_PERSISTENCE;
    frequency *= GRAIN_LACUNARITY;
  }

  return sum / norm; // -1..1
}

// Builds the grayscale grain tile onto a canvas. Browser-only (needs a 2D
// context); returns null where the DOM is unavailable (e.g. unit tests).
function buildGrainTileCanvas(): HTMLCanvasElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");

  canvas.width = grainTileSize;
  canvas.height = grainTileSize;

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  // Fixed seed so the grain is stable across renders/exports (deterministic).
  const noise4D = createNoise4D(mulberry32(0x9e3779b9));
  const image = context.createImageData(grainTileSize, grainTileSize);
  const { data } = image;

  for (let y = 0; y < grainTileSize; y += 1) {
    for (let x = 0; x < grainTileSize; x += 1) {
      // fBm plus a touch of white noise keeps fine high-frequency detail so the
      // grain doesn't read as soft blur at small sizes.
      const fractal = grainFbm(noise4D, x / grainTileSize, y / grainTileSize);
      const speckle = (Math.random() * 2 - 1) * 0.35;
      const value = clamp(Math.round(128 + (fractal * 0.65 + speckle) * 127), 0, 255);
      const index = (y * grainTileSize + x) * 4;

      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

  return canvas;
}

let grainTileCanvasMemo: HTMLCanvasElement | null | undefined;
let grainTileDataUriMemo: string | undefined;

// The shared grain tile canvas (memoized) — used by the export's canvas pattern.
export function getGrainTileCanvas(): HTMLCanvasElement | null {
  if (grainTileCanvasMemo === undefined) {
    grainTileCanvasMemo = buildGrainTileCanvas();
  }

  return grainTileCanvasMemo;
}

// The shared grain tile as a CSS `url(...)` value (memoized) — used by the
// preview overlay. Falls back to an empty string where the DOM is unavailable.
export function getGrainTileDataUri(): string {
  if (grainTileDataUriMemo === undefined) {
    const canvas = getGrainTileCanvas();

    grainTileDataUriMemo = canvas ? `url("${canvas.toDataURL("image/png")}")` : "";
  }

  return grainTileDataUriMemo;
}

// How the grain texture blends onto the gradient. Shared by the preview
// (CSS mix-blend-mode) and the export (canvas globalCompositeOperation).
export type GrainBlend = "overlay" | "soft-light" | "screen" | "normal";

// Grain slider (0-100) maps to a capped overlay opacity so even full strength
// reads as texture instead of washing the gradient out to gray.
export function grainOpacity(intensity: number | undefined): number {
  return (clamp(intensity ?? 0, 0, 100) / 100) * 0.55;
}

// One-tap Effects combinations applied from the Presets section. Each sets the
// full effect stack so presets are a starting point the user can then fine-tune.
export type EffectPreset = {
  grain: number;
  grainBlend: GrainBlend;
  grainSize: number;
  vignette: number;
  vignetteSoftness: number;
};

export const effectPresets: Record<string, EffectPreset> = {
  clean: { grain: 0, grainBlend: "overlay", grainSize: 50, vignette: 0, vignetteSoftness: 50 },
  film: { grain: 55, grainBlend: "overlay", grainSize: 45, vignette: 35, vignetteSoftness: 45 },
  poster: { grain: 70, grainBlend: "screen", grainSize: 30, vignette: 22, vignetteSoftness: 40 },
  soft: { grain: 15, grainBlend: "soft-light", grainSize: 60, vignette: 55, vignetteSoftness: 70 },
};

// Grain Size (1-100) scales how coarse the noise reads: ~0.5x (fine) to ~3x
// (chunky). Used for the preview tile size and the export pattern transform.
export function grainScale(size: number | undefined): number {
  return 0.5 + (clamp(size ?? 50, 1, 100) / 100) * 2.5;
}

// Valid CSS mix-blend-mode for the preview grain layer.
export function grainCssBlend(blend: string | undefined): string {
  switch (blend) {
    case "soft-light":
      return "soft-light";
    case "screen":
      return "screen";
    case "normal":
      return "normal";
    default:
      return "overlay";
  }
}

// Canvas globalCompositeOperation matching grainCssBlend ("normal" has no
// canvas op of that name, so it maps to the default source-over).
function grainCanvasBlend(blend: string | undefined): GlobalCompositeOperation {
  switch (blend) {
    case "soft-light":
      return "soft-light";
    case "screen":
      return "screen";
    case "normal":
      return "source-over";
    default:
      return "overlay";
  }
}

// Vignette Softness (0-100) sets where the transparent core ends before the
// dark edge begins: low = the darkening reaches deep in (hard), high = only the
// far corners darken (soft). Expressed as a 0-1 radius fraction.
export function vignetteInnerStop(softness: number | undefined): number {
  return 0.1 + (clamp(softness ?? 50, 0, 100) / 100) * 0.75;
}

// Vignette CSS overlay: transparent core fading to a dark edge. Strength 0-100
// maps to the edge alpha (capped at 0.85 so it deepens without going solid);
// softness moves the transparent core boundary.
export function getVignetteCss(
  strength: number | undefined,
  softness: number | undefined,
): string {
  const alpha = clamp(strength ?? 0, 0, 100) / 100;
  const innerPercent = Math.round(vignetteInnerStop(softness) * 100);

  return `radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0) ${innerPercent}%, rgba(0, 0, 0, ${(
    alpha * 0.85
  ).toFixed(3)}) 120%)`;
}

// Canvas equivalent of getVignetteCss for the PNG export.
export function paintVignette(
  context: CanvasRenderingContext2D,
  strength: number | undefined,
  softness: number | undefined,
  width: number,
  height: number,
): void {
  const alpha = clamp(strength ?? 0, 0, 100) / 100;

  if (alpha <= 0) {
    return;
  }

  const outerRadius = Math.sqrt((width / 2) ** 2 + (height / 2) ** 2);
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    outerRadius * vignetteInnerStop(softness),
    width / 2,
    height / 2,
    outerRadius,
  );

  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(0, 0, 0, ${alpha * 0.85})`);

  context.save();
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

// Canvas equivalent of the preview grain overlay. Fills the target box with the
// shared simplex film-grain tile using the chosen blend, so the grain rides on
// top of the gradient the same way the preview's mix-blend-mode does — and,
// because both use the same tile, looks identical to the preview.
// width/height should be device pixels (call with an identity transform) so the
// grain stays crisp at high export resolutions instead of scaling up blocky.
export function paintGrain(
  context: CanvasRenderingContext2D,
  intensity: number | undefined,
  size: number | undefined,
  blend: string | undefined,
  width: number,
  height: number,
): void {
  const opacity = grainOpacity(intensity);

  if (opacity <= 0) {
    return;
  }

  const noiseCanvas = getGrainTileCanvas();

  if (!noiseCanvas) {
    return;
  }

  const pattern = context.createPattern(noiseCanvas, "repeat");

  if (!pattern) {
    return;
  }

  // Scale the tile so the Grain Size control has a visible effect on export,
  // matching the preview's larger background-size at coarser settings.
  if (typeof pattern.setTransform === "function") {
    pattern.setTransform(new DOMMatrix().scale(grainScale(size)));
  }

  context.save();
  context.globalAlpha = opacity;
  context.globalCompositeOperation = grainCanvasBlend(blend);
  context.fillStyle = pattern;
  context.fillRect(0, 0, width, height);
  context.restore();
}

type Rgb = { blue: number; green: number; red: number };
type Oklab = { L: number; a: number; b: number };

// Parses a #RGB / #RRGGBB string into 0-255 channels.
function parseHexRgb(hex: string): Rgb {
  const normalizedHex = hex.replace("#", "").trim();
  const expanded =
    normalizedHex.length === 3
      ? normalizedHex
          .split("")
          .map((char) => char + char)
          .join("")
      : normalizedHex.padEnd(6, "0").slice(0, 6);

  return {
    blue: Number.parseInt(expanded.slice(4, 6), 16) || 0,
    green: Number.parseInt(expanded.slice(2, 4), 16) || 0,
    red: Number.parseInt(expanded.slice(0, 2), 16) || 0,
  };
}

// Oklab <-> sRGB via culori (Ottosson Oklab; culori does the linear-light
// transfer and gamut handling). We keep 0-255 Rgb / {L,a,b} Oklab shapes so
// callers are unchanged.
function rgbToOklab({ blue, green, red }: Rgb): Oklab {
  const oklab = toOklab({ b: blue / 255, g: green / 255, mode: "rgb", r: red / 255 });

  return { L: oklab.l ?? 0, a: oklab.a ?? 0, b: oklab.b ?? 0 };
}

function oklabToRgb({ L, a, b }: Oklab): Rgb {
  const rgb = toRgb({ a, b, l: L, mode: "oklab" });

  return {
    blue: Math.round(clamp(rgb.b, 0, 1) * 255),
    green: Math.round(clamp(rgb.g, 0, 1) * 255),
    red: Math.round(clamp(rgb.r, 0, 1) * 255),
  };
}

type ResolvedStop = { oklab: Oklab; opacity: number; position: number };

function lerp(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio;
}

// Canvas 2D gradients only interpolate in sRGB, which bands and grays through
// the middle. We instead sample the stop list in Oklab at many closely spaced
// offsets and hand those to the CanvasGradient, so the sRGB interpolation
// between each pair of near-identical samples reproduces a smooth Oklab ramp —
// matching the `in oklab` preview and cutting visible banding.
const OKLAB_SAMPLE_STEPS = 32;

function oklabExpandedStops(
  stops: readonly GradientStopValue[],
): { color: string; offset: number }[] {
  const resolved: ResolvedStop[] = stops.map((stop) => ({
    oklab: rgbToOklab(parseHexRgb(stop.color)),
    opacity: parseStopOpacity(stop.opacity),
    position: parseStopPosition(stop.position),
  }));

  if (resolved.length === 1) {
    const [only] = resolved;
    const { blue, green, red } = oklabToRgb(only.oklab);

    return [{ color: `rgba(${red}, ${green}, ${blue}, ${only.opacity})`, offset: 0 }];
  }

  const samples: { color: string; offset: number }[] = [];

  for (let step = 0; step <= OKLAB_SAMPLE_STEPS; step += 1) {
    const offset = step / OKLAB_SAMPLE_STEPS;

    let lower = resolved[0];
    let upper = resolved[resolved.length - 1];

    for (let index = 0; index < resolved.length - 1; index += 1) {
      if (offset >= resolved[index].position && offset <= resolved[index + 1].position) {
        lower = resolved[index];
        upper = resolved[index + 1];
        break;
      }
    }

    const span = upper.position - lower.position;
    const ratio = span <= 0 ? 0 : clamp((offset - lower.position) / span, 0, 1);
    const { blue, green, red } = oklabToRgb({
      L: lerp(lower.oklab.L, upper.oklab.L, ratio),
      a: lerp(lower.oklab.a, upper.oklab.a, ratio),
      b: lerp(lower.oklab.b, upper.oklab.b, ratio),
    });
    const opacity = lerp(lower.opacity, upper.opacity, ratio);

    samples.push({
      color: `rgba(${red}, ${green}, ${blue}, ${opacity})`,
      offset,
    });
  }

  return samples;
}

// Paints the gradient onto a 2D context filling a width x height box in CSS
// pixels (the context is already scaled by the export helper's pixelRatio).
export function paintGradient(
  context: CanvasRenderingContext2D,
  value: GradientValue,
  width: number,
  height: number,
  focal: FocalPoint = centerFocalPoint,
): void {
  const stops = sortedStops(value.stops ?? []);

  if (stops.length === 0) {
    return;
  }

  const type = value.gradientType ?? "linear";
  const angle = value.angle ?? 90;
  // Linear gradients span the whole box regardless of focal point (matching CSS
  // linear-gradient, which has no center); radial/diamond/angular are centered
  // on the focal point.
  const centerX = type === "linear" ? width / 2 : clamp(focal.x, 0, 1) * width;
  const centerY = type === "linear" ? height / 2 : clamp(focal.y, 0, 1) * height;

  const expandedStops = oklabExpandedStops(stops);
  const addStops = (gradient: CanvasGradient): void => {
    for (const { color, offset } of expandedStops) {
      gradient.addColorStop(offset, color);
    }
  };

  if (type === "linear") {
    // CSS gradient angles: 0deg points up, 90deg points right, clockwise.
    const radians = ((angle - 90) * Math.PI) / 180;
    const halfLength =
      (Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians))) / 2;
    const dirX = Math.cos(radians);
    const dirY = Math.sin(radians);
    const gradient = context.createLinearGradient(
      centerX - dirX * halfLength,
      centerY - dirY * halfLength,
      centerX + dirX * halfLength,
      centerY + dirY * halfLength,
    );

    addStops(gradient);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    return;
  }

  if (type === "angular") {
    const gradient = context.createConicGradient(
      ((angle - 90) * Math.PI) / 180,
      centerX,
      centerY,
    );

    addStops(gradient);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    return;
  }

  // radial + diamond both map to a radial gradient; radial reaches the farthest
  // corner (CSS default) and diamond stops at the closest side. Both are
  // measured from the (possibly off-center) focal point.
  const radius =
    type === "diamond"
      ? Math.min(centerX, width - centerX, centerY, height - centerY)
      : farthestCornerDistance(centerX, centerY, width, height);
  const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

  addStops(gradient);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function farthestCornerDistance(
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  return Math.max(
    Math.hypot(x, y),
    Math.hypot(width - x, y),
    Math.hypot(x, height - y),
    Math.hypot(width - x, height - y),
  );
}

// --- Glow (focal bloom) ----------------------------------------------------
// A soft luminous highlight centered on the focal point, screen-blended so it
// adds light like a lens bloom / light leak. Shared by preview (CSS overlay)
// and export (canvas). The glow color feathers to transparent at 70% of the
// farthest-corner distance in both paths so they match.

function hexToRgba(hex: string, alpha: number): string {
  const { blue, green, red } = parseHexRgb(hex);

  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1)})`;
}

export function getGlowCss(
  intensity: number | undefined,
  color: string,
  focal: FocalPoint,
): string {
  const alpha = clamp(intensity ?? 0, 0, 100) / 100;
  const centerX = Math.round(clamp(focal.x, 0, 1) * 100);
  const centerY = Math.round(clamp(focal.y, 0, 1) * 100);

  return `radial-gradient(circle at ${centerX}% ${centerY}%, ${hexToRgba(
    color,
    alpha * 0.9,
  )} 0%, ${hexToRgba(color, 0)} 70%)`;
}

export function paintGlow(
  context: CanvasRenderingContext2D,
  intensity: number | undefined,
  color: string,
  focal: FocalPoint,
  width: number,
  height: number,
): void {
  const alpha = clamp(intensity ?? 0, 0, 100) / 100;

  if (alpha <= 0) {
    return;
  }

  const centerX = clamp(focal.x, 0, 1) * width;
  const centerY = clamp(focal.y, 0, 1) * height;
  const radius = farthestCornerDistance(centerX, centerY, width, height);
  const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);

  gradient.addColorStop(0, hexToRgba(color, alpha * 0.9));
  gradient.addColorStop(0.7, hexToRgba(color, 0));

  context.save();
  context.globalCompositeOperation = "screen";
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

// --- Faux-mesh (soft color blobs) ------------------------------------------
// The trendy "mesh gradient" look: several soft radial blobs whose colors are
// pulled from the gradient's own stops and whose positions come from a seeded
// PRNG, so the layout is deterministic (and identical in preview + export) yet
// re-rollable via Shuffle. Rendered over the base gradient as a translucent
// color field.

export type MeshBlob = { color: string; radius: number; x: number; y: number };

// --- Manual mesh -----------------------------------------------------------
// "Auto" mesh scatters blobs procedurally (meshBlobs); "manual" mesh lets the
// user place/drag their own blobs on the canvas. Manual points share the exact
// MeshBlob shape, so the same getMeshCss/paintMesh render both.

export type MeshMode = "auto" | "manual";

export function meshModeValue(value: unknown): MeshMode {
  return value === "manual" ? "manual" : "auto";
}

// Parses the persisted manual-points value (an array stored in control state)
// into validated MeshBlobs, dropping anything malformed.
export function readMeshManualPoints(value: unknown): MeshBlob[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const points: MeshBlob[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const x = Number(record.x);
    const y = Number(record.y);
    const radius = Number(record.radius);

    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(radius)) {
      points.push({
        color: typeof record.color === "string" ? record.color : "#FFFFFF",
        radius: clamp(radius, 0.04, 1.5),
        x: clamp(x, 0, 1),
        y: clamp(y, 0, 1),
      });
    }
  }

  return points;
}

// mulberry32 — a tiny, fast, deterministic PRNG so preview and export generate
// the exact same blob layout from a given seed.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0 || 1;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How the mesh field blends onto the base gradient (preview mix-blend-mode /
// export globalCompositeOperation).
export type MeshBlend = "normal" | "screen" | "overlay";

export function meshCssBlend(blend: string | undefined): string {
  switch (blend) {
    case "screen":
      return "screen";
    case "overlay":
      return "overlay";
    default:
      return "normal";
  }
}

function meshCanvasBlend(blend: string | undefined): GlobalCompositeOperation {
  switch (blend) {
    case "screen":
      return "screen";
    case "overlay":
      return "overlay";
    default:
      return "source-over";
  }
}

export function meshBlobs(
  value: GradientValue,
  points: number | undefined,
  seed: number | undefined,
  size: number | undefined = 100,
  spread: number | undefined = 100,
): MeshBlob[] {
  const colors = (value.stops ?? []).map((stop) => stop.color);

  if (colors.length === 0) {
    return [];
  }

  const count = Math.round(clamp(points ?? 5, 1, 8));
  const sizeScale = clamp(size ?? 100, 20, 200) / 100;
  const spreadScale = clamp(spread ?? 100, 0, 100) / 100;
  const random = mulberry32(Math.round(seed ?? 1));
  const blobs: MeshBlob[] = [];

  for (let index = 0; index < count; index += 1) {
    // Draw x, y, radius in a fixed order so the layout stays deterministic.
    const rawX = 0.12 + random() * 0.76;
    const rawY = 0.12 + random() * 0.76;
    const rawRadius = 0.35 + random() * 0.4;

    blobs.push({
      // Cycle through the gradient's stop colors so the mesh keeps its palette.
      color: colors[index % colors.length],
      // Size scales the radius; spread pulls positions toward center (0) or out
      // to their full random placement (1).
      radius: rawRadius * sizeScale,
      x: 0.5 + (rawX - 0.5) * spreadScale,
      y: 0.5 + (rawY - 0.5) * spreadScale,
    });
  }

  return blobs;
}

// Softness 100 = the blob fades straight from its center (softest); lower keeps
// a solid color core out to a fraction of the radius before falling off (more
// defined edge). Returned as that core fraction (0 = no core, softest).
export function meshCoreFraction(softness: number | undefined): number {
  return (1 - clamp(softness ?? 100, 0, 100) / 100) * 0.85;
}

// CSS for the mesh layer: one radial-gradient per blob (first blob paints on
// top), each holding full color to `core`% then feathering to transparent at
// `radius`% of the farthest corner.
export function getMeshCss(
  blobs: readonly MeshBlob[],
  softness: number | undefined = 100,
): string {
  if (blobs.length === 0) {
    return "none";
  }

  const core = meshCoreFraction(softness);

  return blobs
    .map((blob) => {
      const { blue, green, red } = parseHexRgb(blob.color);
      const centerX = Math.round(blob.x * 100);
      const centerY = Math.round(blob.y * 100);
      const edge = Math.round(blob.radius * 100);
      const coreStop =
        core > 0
          ? `rgba(${red}, ${green}, ${blue}, 0.9) ${Math.round(blob.radius * core * 100)}%, `
          : "";

      return `radial-gradient(circle at ${centerX}% ${centerY}%, rgba(${red}, ${green}, ${blue}, 0.9) 0%, ${coreStop}rgba(${red}, ${green}, ${blue}, 0) ${edge}%)`;
    })
    .join(", ");
}

// Canvas equivalent. Blobs are alpha-composited on an offscreen canvas (reversed
// so blob 0 ends on top, matching the CSS background-image order), then drawn
// with the group opacity = amount — the exact analog of the preview layer's
// opacity, so overlaps composite identically.
export function paintMesh(
  context: CanvasRenderingContext2D,
  blobs: readonly MeshBlob[],
  amount: number | undefined,
  blend: string | undefined,
  softness: number | undefined,
  width: number,
  height: number,
): void {
  const groupAlpha = clamp(amount ?? 0, 0, 100) / 100;

  if (groupAlpha <= 0 || blobs.length === 0 || width <= 0 || height <= 0) {
    return;
  }

  const core = meshCoreFraction(softness);

  const offscreen = document.createElement("canvas");

  offscreen.width = Math.max(1, Math.round(width));
  offscreen.height = Math.max(1, Math.round(height));

  const offscreenContext = offscreen.getContext("2d");

  if (!offscreenContext) {
    return;
  }

  for (let index = blobs.length - 1; index >= 0; index -= 1) {
    const blob = blobs[index];
    const centerX = blob.x * offscreen.width;
    const centerY = blob.y * offscreen.height;
    const radius = blob.radius * farthestCornerDistance(
      centerX,
      centerY,
      offscreen.width,
      offscreen.height,
    );
    const gradient = offscreenContext.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      radius,
    );

    gradient.addColorStop(0, hexToRgba(blob.color, 0.9));

    if (core > 0) {
      gradient.addColorStop(core, hexToRgba(blob.color, 0.9));
    }

    gradient.addColorStop(1, hexToRgba(blob.color, 0));
    offscreenContext.fillStyle = gradient;
    offscreenContext.fillRect(0, 0, offscreen.width, offscreen.height);
  }

  context.save();
  context.globalAlpha = groupAlpha;
  context.globalCompositeOperation = meshCanvasBlend(blend);
  context.drawImage(offscreen, 0, 0, width, height);
  context.restore();
}

// --- Patterns (repeating tile overlays) ------------------------------------
// A decorative repeating pattern blended over the composition. The preview
// tiles a CSS gradient sized as a percentage of the element (so density is
// independent of display zoom); the export draws the matching tile at
// width/tilesAcross device pixels — identical tile count, so the two agree.

export type PatternType = "dots" | "grid" | "lines" | "checker";

// Scale 1..100 -> tiles across the width (higher scale = larger pattern = fewer
// tiles). 48 (tiny) down to 6 (large).
export function patternTilesAcross(scale: number | undefined): number {
  return Math.max(4, Math.round(48 - (clamp(scale ?? 50, 1, 100) / 100) * 42));
}

export function patternCssBlend(blend: string | undefined): string {
  switch (blend) {
    case "overlay":
      return "overlay";
    case "normal":
      return "normal";
    default:
      return "soft-light";
  }
}

function patternCanvasBlend(blend: string | undefined): GlobalCompositeOperation {
  switch (blend) {
    case "overlay":
      return "overlay";
    case "normal":
      return "source-over";
    default:
      return "soft-light";
  }
}

// Preview CSS for a pattern: one tile's worth of gradient, tiled via a
// percentage background-size. `aspect` (canvas width/height) keeps tiles square
// even on non-square canvases, since the element preserves the design aspect.
export function getPatternCss(
  type: string,
  color: string,
  tilesX: number,
  aspect: number,
): { backgroundImage: string; backgroundSize: string } {
  const widthPercent = 100 / tilesX;
  const heightPercent = widthPercent * aspect;
  const size = `${widthPercent.toFixed(4)}% ${heightPercent.toFixed(4)}%`;

  switch (type) {
    case "grid":
      return {
        backgroundImage: `linear-gradient(to right, ${color} 0 6%, transparent 6% 100%), linear-gradient(to bottom, ${color} 0 6%, transparent 6% 100%)`,
        backgroundSize: `${size}, ${size}`,
      };
    case "lines":
      return {
        backgroundImage: `linear-gradient(to bottom, ${color} 0 40%, transparent 40% 100%)`,
        backgroundSize: size,
      };
    case "checker":
      return {
        backgroundImage: `conic-gradient(${color} 0 25%, transparent 0 50%, ${color} 0 75%, transparent 0 100%)`,
        backgroundSize: size,
      };
    default:
      return {
        backgroundImage: `radial-gradient(circle at 50% 50%, ${color} 0 22%, transparent 24%)`,
        backgroundSize: size,
      };
  }
}

// Draws one pattern tile (s×s) — the canvas analog of getPatternCss's tile.
function drawPatternTile(
  context: CanvasRenderingContext2D,
  type: string,
  color: string,
  size: number,
): void {
  context.clearRect(0, 0, size, size);
  context.fillStyle = color;

  switch (type) {
    case "grid":
      context.fillRect(0, 0, size * 0.06, size);
      context.fillRect(0, 0, size, size * 0.06);
      break;
    case "lines":
      context.fillRect(0, 0, size, size * 0.4);
      break;
    case "checker":
      context.fillRect(0, 0, size / 2, size / 2);
      context.fillRect(size / 2, size / 2, size / 2, size / 2);
      break;
    default:
      // Dot radius matches the CSS `circle` 22%: 22% of the tile's
      // farthest-corner distance (≈0.707·s) ≈ 0.156·s.
      context.beginPath();
      context.arc(size / 2, size / 2, size * 0.156, 0, Math.PI * 2);
      context.fill();
  }
}

export function paintPattern(
  context: CanvasRenderingContext2D,
  type: string,
  color: string,
  amount: number | undefined,
  blend: string | undefined,
  tilesX: number,
  width: number,
  height: number,
): void {
  const alpha = clamp(amount ?? 0, 0, 100) / 100;

  if (alpha <= 0 || width <= 0 || height <= 0) {
    return;
  }

  const tileSize = Math.max(2, Math.round(width / tilesX));
  const tile = document.createElement("canvas");

  tile.width = tileSize;
  tile.height = tileSize;

  const tileContext = tile.getContext("2d");

  if (!tileContext) {
    return;
  }

  drawPatternTile(tileContext, type, color, tileSize);

  const pattern = context.createPattern(tile, "repeat");

  if (!pattern) {
    return;
  }

  context.save();
  context.globalAlpha = alpha;
  context.globalCompositeOperation = patternCanvasBlend(blend);
  context.fillStyle = pattern;
  context.fillRect(0, 0, width, height);
  context.restore();
}

// --- Color grade (temperature / vibrance / contrast) -----------------------
// Global finishing adjustments applied to the whole composition. The preview
// uses a CSS `filter` (saturate + contrast) plus a temperature overlay; the
// export replicates the exact same math on the final pixels, so what you see is
// what you get. Saturate/contrast use the CSS Filter Effects formulas so the
// two paths match precisely.

// Vibrance -100..100 -> CSS saturate() factor (0 = grayscale, 1 = neutral, 2 = doubled).
export function saturateFactor(vibrance: number | undefined): number {
  return clamp(1 + clamp(vibrance ?? 0, -100, 100) / 100, 0, 2);
}

// Contrast -100..100 -> CSS contrast() factor (kept within a tasteful 0.2..1.8).
export function contrastFactor(contrast: number | undefined): number {
  return clamp(1 + (clamp(contrast ?? 0, -100, 100) / 100) * 0.8, 0.2, 1.8);
}

export function cssGradeFilter(
  vibrance: number | undefined,
  contrast: number | undefined,
): string {
  return `saturate(${saturateFactor(vibrance).toFixed(3)}) contrast(${contrastFactor(
    contrast,
  ).toFixed(3)})`;
}

// Temperature -100 (cool) .. 100 (warm) -> a soft-light color wash. Warm pushes
// amber, cool pushes blue; amount scales the overlay alpha.
export function temperatureFill(
  temperature: number | undefined,
): { alpha: number; rgb: string } | null {
  const amount = clamp(temperature ?? 0, -100, 100) / 100;

  if (amount === 0) {
    return null;
  }

  const rgb = amount > 0 ? "rgb(255, 138, 40)" : "rgb(40, 130, 255)";

  return { alpha: Math.abs(amount) * 0.35, rgb };
}

export function paintTemperature(
  context: CanvasRenderingContext2D,
  temperature: number | undefined,
  width: number,
  height: number,
): void {
  const fill = temperatureFill(temperature);

  if (!fill) {
    return;
  }

  context.save();
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = fill.alpha;
  context.fillStyle = fill.rgb;
  context.fillRect(0, 0, width, height);
  context.restore();
}

// Single final pixel pass over the composited canvas: applies vibrance
// (saturate) and contrast using the CSS Filter Effects formulas so the export
// matches the preview's CSS `filter`, then adds a sub-visible neutral dither to
// kill 8-bit banding. Combining them means one getImageData/putImageData round
// trip. Runs at device resolution; alpha is left untouched.
export function applyExportGrade(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: { contrast?: number; ditherAmplitude?: number; vibrance?: number } = {},
): void {
  const { contrast = 0, ditherAmplitude = 2, vibrance = 0 } = options;

  if (width <= 0 || height <= 0) {
    return;
  }

  const saturate = saturateFactor(vibrance);
  const contrastAmount = contrastFactor(contrast);
  const gradeNeeded = saturate !== 1 || contrastAmount !== 1;

  if (!gradeNeeded && ditherAmplitude <= 0) {
    return;
  }

  const image = context.getImageData(0, 0, width, height);
  const { data } = image;

  for (let index = 0; index < data.length; index += 4) {
    let red = data[index];
    let green = data[index + 1];
    let blue = data[index + 2];

    if (saturate !== 1) {
      // CSS saturate(): out = luminance + s * (channel - luminance).
      const luminance = 0.213 * red + 0.715 * green + 0.072 * blue;

      red = luminance + saturate * (red - luminance);
      green = luminance + saturate * (green - luminance);
      blue = luminance + saturate * (blue - luminance);
    }

    if (contrastAmount !== 1) {
      // CSS contrast(): out = (channel - 0.5) * c + 0.5, on 0-255 → pivot 127.5.
      red = (red - 127.5) * contrastAmount + 127.5;
      green = (green - 127.5) * contrastAmount + 127.5;
      blue = (blue - 127.5) * contrastAmount + 127.5;
    }

    if (ditherAmplitude > 0) {
      // Triangular-PDF neutral dither (same value per channel = no color speckle).
      const noise = (Math.random() + Math.random() - 1) * ditherAmplitude;

      red += noise;
      green += noise;
      blue += noise;
    }

    // Uint8ClampedArray rounds and clamps to 0-255 on assignment.
    data[index] = red;
    data[index + 1] = green;
    data[index + 2] = blue;
  }

  context.putImageData(image, 0, 0);
}

// --- Animated gradient motion ---------------------------------------------
// Motion is a CSS-only feature: the live preview and the Copy CSS snippet use
// the exact same keyframes, so shipped CSS matches what users see. Image
// export is unaffected — it captures the resting (non-animated) frame.

export type MotionMode = "drift" | "hue" | "off" | "spin";

export function motionModeValue(value: unknown): MotionMode {
  return value === "drift" || value === "hue" || value === "spin" ? value : "off";
}

// Speed slider (0-100) → seconds per animation cycle: 0 → 30s, 100 → 2s.
export function motionDurationSeconds(speed: number | undefined): number {
  const clamped = clamp(
    typeof speed === "number" && Number.isFinite(speed) ? speed : 50,
    0,
    100,
  );

  return Math.round((30 - (clamped * 28) / 100) * 10) / 10;
}

// Linear and angular gradients have a real angle Spin can rotate; radial and
// diamond gradients spin by orbiting the (oversized) gradient image instead.
export function motionUsesAngle(type: GradientValue["gradientType"]): boolean {
  const resolved = type ?? "linear";

  return resolved === "linear" || resolved === "angular";
}

export type MotionLayerCss = {
  animation: string;
  backgroundPosition?: string;
  backgroundSize?: string;
};

// The @keyframes rules (plus the @property registration Spin needs) for the
// active motion mode. Empty string when motion is off.
export function getMotionKeyframes(mode: MotionMode, usesAngle: boolean): string {
  switch (mode) {
    case "hue":
      return "@keyframes gg-hue { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }";
    case "spin":
      if (usesAngle) {
        return [
          '@property --gg-spin { syntax: "<angle>"; inherits: false; initial-value: 0deg; }',
          "@keyframes gg-spin { from { --gg-spin: 0deg; } to { --gg-spin: 360deg; } }",
        ].join("\n");
      }

      return "@keyframes gg-orbit { 0% { background-position: 0% 0%; } 25% { background-position: 100% 0%; } 50% { background-position: 100% 100%; } 75% { background-position: 0% 100%; } 100% { background-position: 0% 0%; } }";
    case "drift":
      return "@keyframes gg-drift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }";
    default:
      return "";
  }
}

// Style declarations the gradient layer needs while the animation runs.
export function getMotionLayerCss(
  mode: MotionMode,
  usesAngle: boolean,
  durationSeconds: number,
): MotionLayerCss | null {
  switch (mode) {
    case "hue":
      return { animation: `gg-hue ${durationSeconds}s linear infinite` };
    case "spin":
      if (usesAngle) {
        return { animation: `gg-spin ${durationSeconds}s linear infinite` };
      }

      return {
        animation: `gg-orbit ${durationSeconds}s linear infinite`,
        backgroundPosition: "0% 0%",
        backgroundSize: "160% 160%",
      };
    case "drift":
      return {
        animation: `gg-drift ${durationSeconds}s ${driftEaseCss} infinite`,
        backgroundPosition: "0% 50%",
        backgroundSize: "200% 200%",
      };
    default:
      return null;
  }
}

// --- Motion video frames ----------------------------------------------------
// Canvas equivalents of the CSS motion animations, used by the video export to
// paint the gradient layer at an arbitrary phase (0-1 through one cycle). Each
// mode replicates its keyframes exactly so the recorded loop matches the live
// preview.

// The exact cubic-bezier the CSS Drift animation uses, so the canvas export
// eases identically to the live preview.
export function motionEase(x: number): number {
  return driftEase(clamp(x, 0, 1));
}

// The gg-orbit keyframes: background-position walks the four corners linearly.
export function motionOrbitPosition(phase: number): FocalPoint {
  const t = ((phase % 1) + 1) % 1;
  const leg = Math.min(3, Math.floor(t * 4));
  const local = t * 4 - leg;

  switch (leg) {
    case 0:
      return { x: local, y: 0 };
    case 1:
      return { x: 1, y: local };
    case 2:
      return { x: 1 - local, y: 1 };
    default:
      return { x: 0, y: 1 - local };
  }
}

// The gg-drift keyframes: 0% -> 50% -> 100% sweep with ease-in-out per segment.
export function motionDriftPosition(phase: number): FocalPoint {
  const t = ((phase % 1) + 1) % 1;

  return { x: t < 0.5 ? motionEase(t * 2) : 1 - motionEase(t * 2 - 1), y: 0.5 };
}

// Paints the gradient layer mid-animation. Orbit and Drift replicate the CSS
// oversized background-size by painting into a larger scratch canvas and
// blitting it at the keyframed offset; `scratch` lets a per-frame render loop
// reuse one allocation.
export function paintMotionGradient(
  context: CanvasRenderingContext2D,
  value: GradientValue,
  mode: MotionMode,
  phase: number,
  width: number,
  height: number,
  focal: FocalPoint = centerFocalPoint,
  scratch?: HTMLCanvasElement,
): void {
  if (mode === "off") {
    paintGradient(context, value, width, height, focal);

    return;
  }

  if (mode === "hue") {
    // Matches the preview's animated hue-rotate() filter on the gradient layer.
    context.save();
    context.filter = `hue-rotate(${Math.round(phase * 360)}deg)`;
    paintGradient(context, value, width, height, focal);
    context.restore();

    return;
  }

  if (mode === "spin" && motionUsesAngle(value.gradientType)) {
    paintGradient(
      context,
      { ...value, angle: (value.angle ?? 90) + phase * 360 },
      width,
      height,
      focal,
    );

    return;
  }

  // Orbit (Spin on radial/diamond, background-size 160%) or Drift (200%).
  const scale = mode === "drift" ? 2 : 1.6;
  const position = mode === "drift" ? motionDriftPosition(phase) : motionOrbitPosition(phase);
  const oversized = scratch ?? document.createElement("canvas");
  const oversizedWidth = Math.ceil(width * scale);
  const oversizedHeight = Math.ceil(height * scale);

  if (oversized.width !== oversizedWidth || oversized.height !== oversizedHeight) {
    oversized.width = oversizedWidth;
    oversized.height = oversizedHeight;
  }

  const oversizedContext = oversized.getContext("2d");

  if (!oversizedContext) {
    paintGradient(context, value, width, height, focal);

    return;
  }

  oversizedContext.clearRect(0, 0, oversizedWidth, oversizedHeight);
  paintGradient(oversizedContext, value, oversizedWidth, oversizedHeight, focal);
  // CSS background-position p%: offset = -(image - box) * p.
  context.drawImage(
    oversized,
    -(oversizedWidth - width) * position.x,
    -(oversizedHeight - height) * position.y,
  );
}

// --- Canvas size presets ---------------------------------------------------
// Real-world output dimensions (the runtime's canvas is sized in px and the
// image export scales the long edge to the chosen 2K/4K/8K resolution while
// preserving this aspect ratio).

export type CanvasSizePreset = { height: number; label: string; width: number };

export const canvasSizePresets: Record<string, CanvasSizePreset> = {
  banner: { height: 500, label: "X banner", width: 1500 },
  desktop: { height: 1080, label: "Desktop wallpaper", width: 1920 },
  og: { height: 630, label: "OG image", width: 1200 },
  phone: { height: 2532, label: "Phone wallpaper", width: 1170 },
  post: { height: 1350, label: "Portrait post", width: 1080 },
  square: { height: 1080, label: "Square", width: 1080 },
  story: { height: 1920, label: "Story", width: 1080 },
};
