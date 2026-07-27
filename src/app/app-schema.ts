import { defineToolcraft } from "@/toolcraft/runtime";

import { defaultGradientValue } from "./gradient";

export const gradientTarget = "gradient.value";
export const grainTarget = "effects.grain";
export const grainSizeTarget = "effects.grainSize";
export const grainBlendTarget = "effects.grainBlend";
export const vignetteTarget = "effects.vignette";
export const vignetteSoftnessTarget = "effects.vignetteSoftness";
export const patternTarget = "pattern.amount";
export const patternStyleTarget = "pattern.style";
export const patternScaleTarget = "pattern.scale";
export const patternColorTarget = "pattern.color";
export const patternBlendTarget = "pattern.blend";
export const focalTarget = "light.focal";
export const glowTarget = "light.glow";
export const glowColorTarget = "light.glowColor";
export const temperatureTarget = "grade.temperature";
export const vibranceTarget = "grade.vibrance";
export const contrastTarget = "grade.contrast";
export const imageFormatTarget = "export.image.format";
export const imageResolutionTarget = "export.image.resolution";
export const exportPngActionValue = "export-png";
export const randomizeActionValue = "randomize";
export const copyCssActionValue = "copy-css";
export const presetActionPrefix = "preset-";
export const gradientPresetPrefix = "gradient-";
export const meshShuffleActionValue = "mesh-shuffle";
export const harmonizeActionValue = "harmonize";
export const recolorHueTarget = "recolor.hue";
export const recolorChromaTarget = "recolor.chroma";
export const recolorLightnessTarget = "recolor.lightness";
export const motionModeTarget = "motion.mode";
export const motionSpeedTarget = "motion.speed";
export const exportVideoActionValue = "export-video";
export const exportGifActionValue = "export-gif";
export const sizePresetPrefix = "size-";
export const meshTarget = "mesh.amount";
export const meshPointsTarget = "mesh.points";
export const meshSeedTarget = "mesh.seed";
export const meshSizeTarget = "mesh.size";
export const meshSpreadTarget = "mesh.spread";
export const meshSoftnessTarget = "mesh.softness";
export const meshBlendTarget = "mesh.blend";

export const appSchema = defineToolcraft({
  canvas: {
    enabled: true,
    sizing: { mode: "editable-output" },
    upload: false,
  },
  export: {
    png: {
      // No background layer in this app: translucent gradient stops export as
      // real PNG transparency.
      background: "transparent",
    },
  },
  panels: {
    controls: {
      sections: [
        {
          title: "Gradient",
          controls: {
            gradient: {
              defaultValue: defaultGradientValue,
              label: false,
              orderRole: "primary",
              performanceReason:
                "Editing the gradient repaints the full-canvas preview on every change.",
              performanceRole: "responsiveness",
              target: gradientTarget,
              type: "gradient",
            },
          },
        },
        {
          title: "Library",
          controls: {
            gradientLibrary: {
              actions: [
                { icon: "wand-sparkles", label: "Harmonize", value: harmonizeActionValue, variant: "secondary" },
                { label: "Sunset", value: `${gradientPresetPrefix}sunset`, variant: "outline" },
                { label: "Ocean", value: `${gradientPresetPrefix}ocean`, variant: "outline" },
                { label: "Aurora", value: `${gradientPresetPrefix}aurora`, variant: "outline" },
                { label: "Ember", value: `${gradientPresetPrefix}ember`, variant: "outline" },
                { label: "Berry", value: `${gradientPresetPrefix}berry`, variant: "outline" },
                { label: "Mint", value: `${gradientPresetPrefix}mint`, variant: "outline" },
                { label: "Cosmic", value: `${gradientPresetPrefix}cosmic`, variant: "outline" },
                { label: "Dusk", value: `${gradientPresetPrefix}dusk`, variant: "outline" },
              ],
              label: false,
              target: "gradient.library",
              type: "actions",
            },
            paletteImage: {
              label: false,
              target: "gradient.paletteImage",
              type: "paletteImage",
            },
          },
        },
        {
          title: "Recolor",
          controls: {
            recolorHue: {
              defaultValue: 0,
              label: "Hue",
              max: 180,
              min: -180,
              performanceReason:
                "Hue shift recolors every gradient stop in OKLCH on each change.",
              performanceRole: "responsiveness",
              step: 1,
              target: recolorHueTarget,
              type: "slider",
              unit: "°",
            },
            recolorChroma: {
              defaultValue: 0,
              label: "Chroma",
              max: 100,
              min: -100,
              performanceReason:
                "Chroma scales every gradient stop's saturation in OKLCH on each change.",
              performanceRole: "responsiveness",
              step: 1,
              target: recolorChromaTarget,
              type: "slider",
            },
            recolorLightness: {
              defaultValue: 0,
              label: "Lightness",
              max: 100,
              min: -100,
              performanceReason:
                "Lightness offsets every gradient stop in OKLCH on each change.",
              performanceRole: "responsiveness",
              step: 1,
              target: recolorLightnessTarget,
              type: "slider",
            },
          },
        },
        {
          title: "Mesh",
          controls: {
            mesh: {
              defaultValue: 0,
              label: "Mesh",
              max: 100,
              min: 0,
              performanceReason:
                "Mesh repaints a multi-blob color field over the gradient on every change.",
              performanceRole: "responsiveness",
              step: 1,
              target: meshTarget,
              type: "slider",
              unit: "%",
            },
            meshPoints: {
              defaultValue: 5,
              label: "Points",
              max: 8,
              min: 3,
              performanceReason:
                "Changing the blob count re-generates and repaints the mesh field.",
              performanceRole: "responsiveness",
              step: 1,
              target: meshPointsTarget,
              type: "slider",
              variant: "discrete",
              visibleWhen: { greaterThan: 0, target: meshTarget },
            },
            meshSize: {
              defaultValue: 100,
              label: "Blob size",
              max: 200,
              min: 20,
              performanceReason:
                "Resizing the blobs repaints the mesh field on every change.",
              performanceRole: "responsiveness",
              step: 1,
              target: meshSizeTarget,
              type: "slider",
              unit: "%",
              visibleWhen: { greaterThan: 0, target: meshTarget },
            },
            meshSpread: {
              defaultValue: 100,
              label: "Spread",
              max: 100,
              min: 0,
              performanceReason:
                "Adjusting spread repositions and repaints the mesh field on every change.",
              performanceRole: "responsiveness",
              step: 1,
              target: meshSpreadTarget,
              type: "slider",
              unit: "%",
              visibleWhen: { greaterThan: 0, target: meshTarget },
            },
            meshSoftness: {
              defaultValue: 100,
              label: "Softness",
              max: 100,
              min: 0,
              performanceReason:
                "Adjusting softness repaints the mesh blob falloff on every change.",
              performanceRole: "responsiveness",
              step: 1,
              target: meshSoftnessTarget,
              type: "slider",
              unit: "%",
              visibleWhen: { greaterThan: 0, target: meshTarget },
            },
            meshBlend: {
              defaultValue: "normal",
              label: "Blend",
              options: [
                { label: "Normal", value: "normal" },
                { label: "Screen", value: "screen" },
                { label: "Overlay", value: "overlay" },
              ],
              target: meshBlendTarget,
              type: "segmented",
              visibleWhen: { greaterThan: 0, target: meshTarget },
            },
            meshShuffle: {
              actions: [
                { icon: "shuffle", label: "Shuffle layout", value: meshShuffleActionValue, variant: "outline" },
              ],
              label: false,
              target: "mesh.shuffleAction",
              type: "actions",
              visibleWhen: { greaterThan: 0, target: meshTarget },
            },
          },
        },
        {
          title: "Light",
          controls: {
            focal: {
              coordinateMode: "screen",
              defaultValue: { x: "0.00", y: "0.00" },
              label: "Focal point",
              performanceReason:
                "Dragging the focal point repositions the gradient center and glow live.",
              performanceRole: "responsiveness",
              target: focalTarget,
              type: "vector",
              xLabel: "X",
              yLabel: "Y",
            },
            glow: {
              defaultValue: 0,
              label: "Glow",
              max: 100,
              min: 0,
              performanceReason:
                "Glow repaints a radial bloom overlay on every change.",
              performanceRole: "responsiveness",
              step: 1,
              target: glowTarget,
              type: "slider",
              unit: "%",
            },
            glowColor: {
              defaultValue: { hex: "#FFF4E0" },
              label: "Glow color",
              target: glowColorTarget,
              type: "color",
              visibleWhen: { greaterThan: 0, target: glowTarget },
            },
          },
        },
        {
          title: "Motion",
          controls: {
            motionMode: {
              defaultValue: "off",
              label: "Animate",
              options: [
                { label: "Off", value: "off" },
                { label: "Hue", value: "hue" },
                { label: "Spin", value: "spin" },
                { label: "Drift", value: "drift" },
              ],
              target: motionModeTarget,
              type: "segmented",
            },
            motionSpeed: {
              defaultValue: 50,
              label: "Speed",
              max: 100,
              min: 0,
              performanceReason:
                "Changing speed restarts the CSS animation on the gradient layer.",
              performanceRole: "responsiveness",
              step: 1,
              target: motionSpeedTarget,
              type: "slider",
              unit: "%",
              visibleWhen: { notEquals: "off", target: motionModeTarget },
            },
          },
        },
        {
          title: "Effects",
          controls: {
            effectPresets: {
              actions: [
                { label: "Clean", value: `${presetActionPrefix}clean`, variant: "outline" },
                { label: "Film", value: `${presetActionPrefix}film`, variant: "outline" },
                { label: "Soft", value: `${presetActionPrefix}soft`, variant: "outline" },
                { label: "Poster", value: `${presetActionPrefix}poster`, variant: "outline" },
              ],
              label: false,
              target: "effects.preset",
              type: "actions",
            },
            grain: {
              defaultValue: 0,
              label: "Grain",
              max: 100,
              min: 0,
              performanceReason:
                "Grain overlays a tiling noise texture that repaints on every change.",
              performanceRole: "responsiveness",
              step: 1,
              target: grainTarget,
              type: "slider",
              unit: "%",
            },
            grainSize: {
              defaultValue: 50,
              label: "Grain size",
              max: 100,
              min: 1,
              performanceReason:
                "Resizing the grain re-tiles the noise overlay on every change.",
              performanceRole: "responsiveness",
              step: 1,
              target: grainSizeTarget,
              type: "slider",
              visibleWhen: { greaterThan: 0, target: grainTarget },
            },
            grainBlend: {
              defaultValue: "overlay",
              label: "Blend",
              options: [
                { label: "Overlay", value: "overlay" },
                { label: "Soft", value: "soft-light" },
                { label: "Screen", value: "screen" },
                { label: "Normal", value: "normal" },
              ],
              target: grainBlendTarget,
              type: "segmented",
              visibleWhen: { greaterThan: 0, target: grainTarget },
            },
            vignette: {
              defaultValue: 0,
              label: "Vignette",
              max: 100,
              min: 0,
              performanceReason:
                "Vignette repaints a radial edge-darkening overlay on every change.",
              performanceRole: "responsiveness",
              step: 1,
              target: vignetteTarget,
              type: "slider",
              unit: "%",
            },
            vignetteSoftness: {
              defaultValue: 50,
              label: "Softness",
              max: 100,
              min: 0,
              performanceReason:
                "Adjusting softness repaints the radial vignette falloff on every change.",
              performanceRole: "responsiveness",
              step: 1,
              target: vignetteSoftnessTarget,
              type: "slider",
              unit: "%",
              visibleWhen: { greaterThan: 0, target: vignetteTarget },
            },
          },
        },
        {
          title: "Grade",
          controls: {
            temperature: {
              defaultValue: 0,
              label: "Temperature",
              max: 100,
              min: -100,
              performanceReason:
                "Temperature repaints a warm/cool color wash on every change.",
              performanceRole: "responsiveness",
              step: 1,
              target: temperatureTarget,
              type: "slider",
            },
            vibrance: {
              defaultValue: 0,
              label: "Vibrance",
              max: 100,
              min: -100,
              performanceReason:
                "Vibrance re-saturates the full-canvas preview on every change.",
              performanceRole: "responsiveness",
              step: 1,
              target: vibranceTarget,
              type: "slider",
            },
            contrast: {
              defaultValue: 0,
              label: "Contrast",
              max: 100,
              min: -100,
              performanceReason:
                "Contrast re-grades the full-canvas preview on every change.",
              performanceRole: "responsiveness",
              step: 1,
              target: contrastTarget,
              type: "slider",
            },
          },
        },
        {
          title: "Canvas Size",
          controls: {
            sizePresets: {
              actions: [
                { label: "Desktop 16:9", value: `${sizePresetPrefix}desktop`, variant: "outline" },
                { label: "Phone 9:19.5", value: `${sizePresetPrefix}phone`, variant: "outline" },
                { label: "Square 1:1", value: `${sizePresetPrefix}square`, variant: "outline" },
                { label: "Post 4:5", value: `${sizePresetPrefix}post`, variant: "outline" },
                { label: "Story 9:16", value: `${sizePresetPrefix}story`, variant: "outline" },
                { label: "OG 1.91:1", value: `${sizePresetPrefix}og`, variant: "outline" },
                { label: "Banner 3:1", value: `${sizePresetPrefix}banner`, variant: "outline" },
              ],
              label: false,
              target: "canvas.sizePreset",
              type: "actions",
            },
          },
        },
        {
          title: "Image Export",
          controls: {
            imageFormat: {
              defaultValue: "png",
              label: "Format",
              options: [
                { label: "PNG", value: "png" },
                { label: "JPG", value: "jpg" },
              ],
              orderRole: "advanced",
              target: imageFormatTarget,
              type: "select",
            },
            imageResolution: {
              defaultValue: "4k",
              label: "Resolution",
              options: [
                { label: "2K", value: "2k" },
                { label: "4K", value: "4k" },
                { label: "8K", value: "8k" },
              ],
              orderRole: "advanced",
              target: imageResolutionTarget,
              type: "select",
            },
            motionDownload: {
              actions: [
                {
                  icon: "download",
                  label: "Download video",
                  value: exportVideoActionValue,
                  variant: "secondary",
                },
                {
                  icon: "download",
                  label: "Download GIF",
                  value: exportGifActionValue,
                  variant: "secondary",
                },
              ],
              label: false,
              target: "export.motionDownload",
              type: "actions",
              // Video/GIF record the Motion animation; without one there is
              // nothing to capture, so these only show when it's active.
              visibleWhen: { notEquals: "off", target: motionModeTarget },
            },
          },
          layoutGroups: [
            {
              columns: 2,
              controls: ["imageFormat", "imageResolution"],
              layout: "inline",
            },
          ],
        },
        {
          title: "Export",
          controls: {
            exportActions: {
              actions: [
                {
                  icon: "copy",
                  label: "Copy CSS",
                  value: copyCssActionValue,
                  variant: "secondary",
                },
                {
                  icon: "shuffle",
                  label: "Randomize",
                  value: randomizeActionValue,
                  variant: "secondary",
                },
                {
                  icon: "upload-simple",
                  label: "Export PNG",
                  value: exportPngActionValue,
                },
              ],
              target: "panelActions.export",
              type: "panelActions",
            },
          },
        },
      ],
      title: "Gradient",
    },
  },
  persistence: {
    include: ["values", "canvas", "panels"],
    key: "toolcraft:gradient-generator:state:v1",
    storage: "localStorage",
    version: 1,
  },
  toolbar: {
    history: true,
    radar: true,
    theme: true,
    zoom: true,
  },
});
