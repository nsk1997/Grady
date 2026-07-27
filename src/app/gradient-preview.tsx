import * as React from "react";

import { useToolcraft } from "@/toolcraft/runtime/react";

import {
  contrastTarget,
  focalTarget,
  glowColorTarget,
  glowTarget,
  grainBlendTarget,
  grainSizeTarget,
  grainTarget,
  gradientTarget,
  meshBlendTarget,
  meshPointsTarget,
  meshSeedTarget,
  meshSizeTarget,
  meshSoftnessTarget,
  meshSpreadTarget,
  meshTarget,
  motionModeTarget,
  motionSpeedTarget,
  recolorChromaTarget,
  recolorHueTarget,
  recolorLightnessTarget,
  patternBlendTarget,
  patternColorTarget,
  patternScaleTarget,
  patternStyleTarget,
  patternTarget,
  temperatureTarget,
  vibranceTarget,
  vignetteSoftnessTarget,
  vignetteTarget,
} from "./app-schema";
import {
  applyGradientColorAdjust,
  cssGradeFilter,
  defaultGradientValue,
  focalFraction,
  getGlowCss,
  getGradientCss,
  getMeshCss,
  getMotionKeyframes,
  getMotionLayerCss,
  getPatternCss,
  getVignetteCss,
  grainCssBlend,
  grainOpacity,
  grainScale,
  getGrainTileDataUri,
  grainTileSize,
  meshBlobs,
  meshCssBlend,
  motionDurationSeconds,
  motionModeValue,
  motionUsesAngle,
  patternCssBlend,
  patternTilesAcross,
  temperatureFill,
  type GradientValue,
} from "./gradient";

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

export function GradientPreview(): React.JSX.Element {
  const { state } = useToolcraft();
  const rawGradientValue =
    (state.values[gradientTarget] as GradientValue | undefined) ?? defaultGradientValue;
  const gradientValue = applyGradientColorAdjust(
    rawGradientValue,
    readNumber(state.values[recolorHueTarget], 0),
    readNumber(state.values[recolorChromaTarget], 0),
    readNumber(state.values[recolorLightnessTarget], 0),
  );
  const grain = readNumber(state.values[grainTarget], 0);
  const grainSize = readNumber(state.values[grainSizeTarget], 50);
  const grainBlend = grainCssBlend(
    typeof state.values[grainBlendTarget] === "string"
      ? (state.values[grainBlendTarget] as string)
      : undefined,
  );
  const vignette = readNumber(state.values[vignetteTarget], 0);
  const vignetteSoftness = readNumber(state.values[vignetteSoftnessTarget], 50);
  const grainTilePx = grainTileSize * grainScale(grainSize);
  const focal = focalFraction(state.values[focalTarget]);
  const glow = readNumber(state.values[glowTarget], 0);
  const glowColor = readColorHex(state.values[glowColorTarget], "#FFF4E0");
  const temperature = readNumber(state.values[temperatureTarget], 0);
  const vibrance = readNumber(state.values[vibranceTarget], 0);
  const contrast = readNumber(state.values[contrastTarget], 0);
  const temperatureLayer = temperatureFill(temperature);
  const mesh = readNumber(state.values[meshTarget], 0);
  const meshPoints = readNumber(state.values[meshPointsTarget], 5);
  const meshSeed = readNumber(state.values[meshSeedTarget], 1);
  const meshSize = readNumber(state.values[meshSizeTarget], 100);
  const meshSpread = readNumber(state.values[meshSpreadTarget], 100);
  const meshSoftness = readNumber(state.values[meshSoftnessTarget], 100);
  const meshBlend = meshCssBlend(
    typeof state.values[meshBlendTarget] === "string"
      ? (state.values[meshBlendTarget] as string)
      : undefined,
  );
  const blobs =
    mesh > 0 ? meshBlobs(gradientValue, meshPoints, meshSeed, meshSize, meshSpread) : [];
  const pattern = readNumber(state.values[patternTarget], 0);
  const patternStyle =
    typeof state.values[patternStyleTarget] === "string"
      ? (state.values[patternStyleTarget] as string)
      : "dots";
  const patternScale = readNumber(state.values[patternScaleTarget], 50);
  const patternColor = readColorHex(state.values[patternColorTarget], "#FFFFFF");
  const patternBlend = patternCssBlend(
    typeof state.values[patternBlendTarget] === "string"
      ? (state.values[patternBlendTarget] as string)
      : undefined,
  );
  const canvasAspect =
    state.canvas.size.height > 0
      ? state.canvas.size.width / state.canvas.size.height
      : 16 / 9;
  const patternCss =
    pattern > 0
      ? getPatternCss(patternStyle, patternColor, patternTilesAcross(patternScale), canvasAspect)
      : null;
  const motionMode = motionModeValue(state.values[motionModeTarget]);
  const motionSpeed = readNumber(state.values[motionSpeedTarget], 50);
  const spinsAngle = motionUsesAngle(gradientValue.gradientType);
  const motionKeyframes = getMotionKeyframes(motionMode, spinsAngle);
  const motionLayer = getMotionLayerCss(
    motionMode,
    spinsAngle,
    motionDurationSeconds(motionSpeed),
  );

  return (
    <div
      className="absolute inset-0 h-full w-full"
      data-toolcraft-product-output=""
      style={{ filter: cssGradeFilter(vibrance, contrast) }}
    >
      {motionKeyframes ? <style>{motionKeyframes}</style> : null}
      <div
        className="absolute inset-0 h-full w-full"
        style={{
          backgroundImage: getGradientCss(
            gradientValue,
            focal,
            motionMode === "spin" && spinsAngle,
          ),
          ...(motionLayer ?? {}),
        }}
      />
      {blobs.length > 0 ? (
        <div
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            backgroundImage: getMeshCss(blobs, meshSoftness),
            mixBlendMode: meshBlend as React.CSSProperties["mixBlendMode"],
            opacity: mesh / 100,
          }}
        />
      ) : null}
      {glow > 0 ? (
        <div
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            backgroundImage: getGlowCss(glow, glowColor, focal),
            mixBlendMode: "screen",
          }}
        />
      ) : null}
      {vignette > 0 ? (
        <div
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ backgroundImage: getVignetteCss(vignette, vignetteSoftness) }}
        />
      ) : null}
      {temperatureLayer ? (
        <div
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            backgroundColor: temperatureLayer.rgb,
            mixBlendMode: "soft-light",
            opacity: temperatureLayer.alpha,
          }}
        />
      ) : null}
      {grain > 0 ? (
        <div
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            backgroundImage: getGrainTileDataUri(),
            backgroundRepeat: "repeat",
            backgroundSize: `${grainTilePx}px ${grainTilePx}px`,
            mixBlendMode: grainBlend as React.CSSProperties["mixBlendMode"],
            opacity: grainOpacity(grain),
          }}
        />
      ) : null}
      {patternCss ? (
        <div
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            backgroundImage: patternCss.backgroundImage,
            backgroundRepeat: "repeat",
            backgroundSize: patternCss.backgroundSize,
            mixBlendMode: patternBlend as React.CSSProperties["mixBlendMode"],
            opacity: pattern / 100,
          }}
        />
      ) : null}
    </div>
  );
}
