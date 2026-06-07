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
  recordReorderLayer,
} from "./history";

interface Props {
  doc: SheetDoc;
  /** Host-supplied Merge Down (Ctrl+E) action — needs to coordinate with
   *  history.ts, so the Editor owns it. */
  onMergeDown: () => void;
}

export function LayersPanel({ doc, onMergeDown }: Props) {
  const [, setRev] = useState(0);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  useEffect(() => {
    return subscribeSheet(doc.path, () => setRev((r) => r + 1));
  }, [doc.path]);

  // Reversed = top of the visual stack first.
  const layers = [...doc.layers].reverse();

  /** Translate a drop position in the REVERSED visual list to the index
   *  in doc.layers (which is bottom-up). */
  function applyDrop(targetVisual: number) {
    if (dragId === null) return;
    const docTarget = doc.layers.length - 1 - targetVisual;
    recordReorderLayer(doc, dragId, docTarget);
    setDragId(null);
    setDropAt(null);
  }

  const activeIdx = doc.layers.findIndex((l) => l.id === doc.activeLayerId);
  const canMergeDown =
    activeIdx > 0 && !doc.layers[activeIdx - 1].locked;

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
        {layers.map((layer, visualIdx) => (
          <div
            key={layer.id}
            draggable
            onDragStart={(e) => {
              setDragId(layer.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (dragId === null || dragId === layer.id) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              const above = e.clientY < r.top + r.height / 2;
              setDropAt(above ? visualIdx : visualIdx + 1);
            }}
            onDragEnd={() => {
              setDragId(null);
              setDropAt(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dropAt !== null) applyDrop(dropAt);
            }}
            className={`layer-row-wrap${
              dropAt === visualIdx ? " drop-above" : ""
            }${dropAt === visualIdx + 1 ? " drop-below" : ""}`}
          >
            <LayerRow
              doc={doc}
              layer={layer}
              active={layer.id === doc.activeLayerId}
            />
          </div>
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
        <button
          className="rail-btn"
          disabled={!canMergeDown}
          onClick={onMergeDown}
          title={
            !canMergeDown
              ? "Need a non-locked layer below to merge into"
              : "Merge down (Ctrl+E)"
          }
        >
          <MergeDownIcon />
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

/** Tiny inline glyph: stacked-square + down arrow, no need to add to icons.tsx. */
function MergeDownIcon() {
  return (
    <svg width={19} height={19} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="6" height="5" />
      <rect x="6.5" y="6.5" width="7" height="6" />
      <path d="M8 9.5 V13 M6 11 L8 13 L10 11" />
    </svg>
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
