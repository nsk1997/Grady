// Minimal ambient types for gifenc (which ships no declarations). Covers only
// the encoder surface this app uses: quantize + applyPalette + GIFEncoder.
declare module "gifenc" {
  export type GifPalette = number[][];

  export type QuantizeOptions = {
    format?: "rgb565" | "rgb444" | "rgba4444";
    oneBitAlpha?: boolean | number;
    clearAlpha?: boolean;
    clearAlphaThreshold?: number;
    clearAlphaColor?: number;
  };

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ): GifPalette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: "rgb565" | "rgb444" | "rgba4444",
  ): Uint8Array;

  export type WriteFrameOptions = {
    palette?: GifPalette | null;
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    colorDepth?: number;
    dispose?: number;
    first?: boolean;
  };

  export type GifEncoderInstance = {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: WriteFrameOptions,
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
    readonly buffer: ArrayBuffer;
  };

  export function GIFEncoder(options?: {
    auto?: boolean;
    initialCapacity?: number;
  }): GifEncoderInstance;

  export default GIFEncoder;
}
