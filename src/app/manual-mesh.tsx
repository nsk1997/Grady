import * as React from "react";

import { useToolcraft } from "@/toolcraft/runtime/react";

import { meshManualPointsTarget } from "./app-schema";
import { getMeshCss, readMeshManualPoints, type MeshBlob } from "./gradient";

const DEFAULT_RADIUS = 0.4;

type ManualMeshLayerProps = {
  meshBlendCss: string;
  meshSoftness: number;
  opacity: number;
  // Gradient stop colors, used to pick a sensible default for each new blob.
  paletteColors: readonly string[];
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// A drag/resize gesture in progress. `draft` holds the live-edited points so the
// mesh updates smoothly without dispatching (and spamming history) on every
// pointer move; we commit to Toolcraft state once on release.
type Draft = { index: number; points: MeshBlob[] } | null;

// Manual mesh: renders the user-placed blobs AND an interactive editor overlay.
// Click empty canvas to add a blob, drag a handle to move it, and use the little
// toolbar on the selected handle to recolor, resize, or delete it.
export function ManualMeshLayer({
  meshBlendCss,
  meshSoftness,
  opacity,
  paletteColors,
}: ManualMeshLayerProps): React.JSX.Element {
  const { dispatch, state } = useToolcraft();
  const stored = readMeshManualPoints(state.values[meshManualPointsTarget]);
  const [draft, setDraft] = React.useState<Draft>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);

  const points = draft ? draft.points : stored;

  const commit = React.useCallback(
    (next: MeshBlob[], label: string): void => {
      dispatch({ label, target: meshManualPointsTarget, type: "controls.setValue", value: next });
      setDraft(null);
    },
    [dispatch],
  );

  const pointerFraction = (event: React.PointerEvent): { x: number; y: number } => {
    const rect = overlayRef.current?.getBoundingClientRect();

    if (!rect || rect.width === 0 || rect.height === 0) {
      return { x: 0.5, y: 0.5 };
    }

    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  };

  // Pointer-down on empty canvas → add a new blob there and start dragging it.
  const handleOverlayPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) {
      return;
    }

    // Keep the click from reaching Toolcraft's canvas (which would pan/deselect).
    event.stopPropagation();

    const { x, y } = pointerFraction(event);
    const color = paletteColors[stored.length % Math.max(1, paletteColors.length)] ?? "#FFFFFF";
    const next: MeshBlob[] = [...points, { color, radius: DEFAULT_RADIUS, x, y }];

    setSelected(next.length - 1);
    setDraft({ index: next.length - 1, points: next });
    overlayRef.current?.setPointerCapture(event.pointerId);
  };

  // Pointer-down on an existing handle → select it and start dragging.
  const handleHandlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    setSelected(index);
    setDraft({ index, points });
    overlayRef.current?.setPointerCapture(event.pointerId);
  };

  const handleOverlayPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!draft) {
      return;
    }

    const { x, y } = pointerFraction(event);
    const next = draft.points.map((point, index) =>
      index === draft.index ? { ...point, x, y } : point,
    );

    setDraft({ index: draft.index, points: next });
  };

  const handleOverlayPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!draft) {
      return;
    }

    overlayRef.current?.releasePointerCapture(event.pointerId);
    commit(draft.points, "Move mesh point");
  };

  const updateSelected = (patch: Partial<MeshBlob>, label: string, live: boolean): void => {
    if (selected === null || selected >= points.length) {
      return;
    }

    const next = points.map((point, index) =>
      index === selected ? { ...point, ...patch } : point,
    );

    if (live) {
      setDraft({ index: selected, points: next });
    } else {
      commit(next, label);
    }
  };

  const deleteSelected = (): void => {
    if (selected === null) {
      return;
    }

    commit(
      points.filter((_, index) => index !== selected),
      "Delete mesh point",
    );
    setSelected(null);
  };

  const selectedPoint = selected !== null ? points[selected] : undefined;

  return (
    <>
      {/* The mesh itself — same look as the auto mesh (blend + opacity). */}
      {points.length > 0 ? (
        <div
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            backgroundImage: getMeshCss(points, meshSoftness),
            mixBlendMode: meshBlendCss as React.CSSProperties["mixBlendMode"],
            opacity: opacity / 100,
          }}
        />
      ) : null}

      {/* Editor overlay: captures clicks/drags to place and move blobs. */}
      <div
        className="absolute inset-0 cursor-crosshair"
        onPointerDown={handleOverlayPointerDown}
        onPointerMove={handleOverlayPointerMove}
        onPointerUp={handleOverlayPointerUp}
        ref={overlayRef}
        style={{ touchAction: "none" }}
      >
        {points.map((point, index) => {
          const isSelected = index === selected;

          return (
            <React.Fragment key={index}>
              <button
                aria-label={`Mesh point ${index + 1}`}
                className="absolute block size-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
                onPointerDown={(event) => handleHandlePointerDown(event, index)}
                style={{
                  backgroundColor: point.color,
                  boxShadow: isSelected
                    ? "0 0 0 2px #fff, 0 0 0 4px rgba(0,0,0,0.55), 0 0 10px 2px rgba(255,255,255,0.4)"
                    : "0 0 0 1.5px rgba(255,255,255,0.9), 0 0 0 3px rgba(0,0,0,0.45)",
                  cursor: "grab",
                  left: `${point.x * 100}%`,
                  top: `${point.y * 100}%`,
                }}
                type="button"
              />
              {isSelected && selectedPoint ? (
                <div
                  className="absolute z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-white/15 bg-black/70 px-1.5 py-1 backdrop-blur-md"
                  onPointerDown={(event) => event.stopPropagation()}
                  style={{
                    left: `${point.x * 100}%`,
                    top: `calc(${point.y * 100}% - 30px)`,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <input
                    aria-label="Point color"
                    className="size-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                    onChange={(event) =>
                      updateSelected({ color: event.target.value }, "Recolor mesh point", false)
                    }
                    type="color"
                    value={selectedPoint.color}
                  />
                  <input
                    aria-label="Point size"
                    className="h-1 w-16 cursor-pointer"
                    max={1}
                    min={0.08}
                    onChange={(event) =>
                      updateSelected({ radius: Number(event.target.value) }, "Resize mesh point", true)
                    }
                    onPointerUp={() =>
                      selectedPoint && commit(points, "Resize mesh point")
                    }
                    step={0.01}
                    type="range"
                    value={selectedPoint.radius}
                  />
                  <button
                    aria-label="Delete point"
                    className="flex size-6 shrink-0 items-center justify-center rounded bg-white/10 text-xs text-white hover:bg-rose-500/70"
                    onClick={deleteSelected}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
}
