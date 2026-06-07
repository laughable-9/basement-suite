// Photoshop-style Layers panel docked to the right of the editor canvas.
// Every layer op goes through history.ts's record* helpers so the History
// panel sees them (Add / Delete / Show / Hide / Lock / Unlock / Rename /
// Move up / Move down). Opacity slider is the one exception: it changes
// while the user drags, and we record the final value on slider release.

import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  PlusIcon,
  TrashIcon,
  UnlockIcon,
} from "../../app/icons";
import {
  bumpSheet,
  composite,
  setActiveLayer,
  subscribeSheet,
  type SheetDoc,
  type SheetLayer,
} from "../../lib/sheets/store";
import {
  recordAddLayer,
  recordLayerProp,
  recordMoveLayer,
  recordRemoveLayer,
} from "./history";

interface Props {
  doc: SheetDoc;
}

export function LayersPanel({ doc }: Props) {
  const [, setRev] = useState(0);

  useEffect(() => {
    return subscribeSheet(doc.path, () => setRev((r) => r + 1));
  }, [doc.path]);

  const layers = [...doc.layers].reverse();

  return (
    <aside className="layers-panel">
      <header className="panel-header">
        Layers <span className="panel-count">{doc.layers.length}</span>
        <button
          className="rail-btn layers-add-btn"
          title="New layer"
          onClick={() => recordAddLayer(doc)}
        >
          <PlusIcon />
        </button>
      </header>
      <div className="panel-body">
        {layers.map((layer) => (
          <LayerRow
            key={layer.id}
            doc={doc}
            layer={layer}
            active={layer.id === doc.activeLayerId}
          />
        ))}
      </div>
      <footer className="layers-footer">
        <button
          className="rail-btn"
          disabled={!canMove(doc, doc.activeLayerId, +1)}
          onClick={() => recordMoveLayer(doc, doc.activeLayerId, +1)}
          title="Bring forward"
        >
          <ChevronUpIcon />
        </button>
        <button
          className="rail-btn"
          disabled={!canMove(doc, doc.activeLayerId, -1)}
          onClick={() => recordMoveLayer(doc, doc.activeLayerId, -1)}
          title="Send backward"
        >
          <ChevronDownIcon />
        </button>
        <span className="toolbar-spacer" />
        <button
          className="rail-btn layers-delete-btn"
          disabled={doc.layers.length <= 1 || activeIsLocked(doc)}
          onClick={() => recordRemoveLayer(doc, doc.activeLayerId)}
          title={
            doc.layers.length <= 1
              ? "Can't delete the last layer"
              : activeIsLocked(doc)
                ? "Unlock the layer first"
                : "Delete the active layer"
          }
        >
          <TrashIcon />
        </button>
      </footer>
    </aside>
  );
}

function canMove(doc: SheetDoc, id: number, delta: number): boolean {
  const idx = doc.layers.findIndex((l) => l.id === id);
  if (idx === -1) return false;
  return idx + delta >= 0 && idx + delta < doc.layers.length;
}

function activeIsLocked(doc: SheetDoc): boolean {
  return !!doc.layers.find((l) => l.id === doc.activeLayerId)?.locked;
}

function LayerRow({
  doc,
  layer,
  active,
}: {
  doc: SheetDoc;
  layer: SheetLayer;
  active: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(layer.name);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  // Opacity drag mutates layer.opacity live for visual feedback; the start
  // value is captured in a ref so we can push ONE history entry on release.
  const opacityStartRef = useRef<number | null>(null);

  useEffect(() => setDraft(layer.name), [layer.name]);

  useEffect(() => {
    const dst = thumbRef.current;
    if (!dst) return;
    const SIZE = 32;
    const dpr = window.devicePixelRatio || 1;
    dst.width = SIZE * dpr;
    dst.height = SIZE * dpr;
    const ctx = dst.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const scale = Math.min(
      SIZE / layer.canvas.width,
      SIZE / layer.canvas.height,
    );
    const w = layer.canvas.width * scale;
    const h = layer.canvas.height * scale;
    ctx.drawImage(layer.canvas, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  }, [layer.canvas, doc.version]);

  function commitName() {
    setEditing(false);
    const v = draft.trim();
    if (v.length > 0 && v !== layer.name) {
      recordLayerProp(doc, layer.id, `Rename to "${v}"`, { name: v });
    } else {
      setDraft(layer.name);
    }
  }

  return (
    <div
      className={`layer-row${active ? " active" : ""}${
        layer.locked ? " locked" : ""
      }`}
      onClick={() => setActiveLayer(doc, layer.id)}
    >
      <button
        className="layer-eye"
        title={layer.visible ? "Hide layer" : "Show layer"}
        onClick={(e) => {
          e.stopPropagation();
          recordLayerProp(
            doc,
            layer.id,
            layer.visible ? `Hide "${layer.name}"` : `Show "${layer.name}"`,
            { visible: !layer.visible },
          );
        }}
      >
        {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
      </button>
      <span className="layer-thumb checkerboard">
        <canvas ref={thumbRef} />
      </span>
      <div className="layer-meta" onDoubleClick={() => setEditing(true)}>
        {editing ? (
          <input
            className="layer-name-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") {
                setDraft(layer.name);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="layer-name" title={layer.name}>
            {layer.name}
          </span>
        )}
        <input
          className="layer-opacity"
          type="range"
          min={0}
          max={100}
          value={Math.round(layer.opacity * 100)}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={() => {
            opacityStartRef.current = layer.opacity;
          }}
          onChange={(e) => {
            // Live mutation for instant feedback; no history yet.
            layer.opacity = Number(e.target.value) / 100;
            composite(doc);
            bumpSheet(doc);
          }}
          onPointerUp={() => {
            const start = opacityStartRef.current;
            opacityStartRef.current = null;
            if (start === null || start === layer.opacity) return;
            // Roll the mutation back through recordLayerProp so before/after
            // are correct in history; visually unchanged.
            const final = layer.opacity;
            layer.opacity = start;
            recordLayerProp(
              doc,
              layer.id,
              `Set "${layer.name}" opacity to ${Math.round(final * 100)}%`,
              { opacity: final },
            );
          }}
          title={`Opacity ${Math.round(layer.opacity * 100)}%`}
        />
      </div>
      <button
        className="layer-lock"
        title={layer.locked ? "Unlock layer" : "Lock layer"}
        onClick={(e) => {
          e.stopPropagation();
          recordLayerProp(
            doc,
            layer.id,
            layer.locked ? `Unlock "${layer.name}"` : `Lock "${layer.name}"`,
            { locked: !layer.locked },
          );
        }}
      >
        {layer.locked ? <LockIcon /> : <UnlockIcon />}
      </button>
    </div>
  );
}
