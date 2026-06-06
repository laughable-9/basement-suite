import { useCallback, useEffect, useMemo, useState } from "react";
import { parseAnm2 } from "../../lib/anm2/parse";
import type { Rgba } from "../../lib/anm2/types";
import { readText } from "../../lib/fsx/fs";
import { dirname, resolveRelative } from "../../lib/fsx/resolve";
import {
  getSheetDoc,
  subscribeSheet,
  type SheetDoc,
} from "../../lib/sheets/store";
import { useAppStore, type EditingTarget } from "../../app/store";
import { cropGrid, type CropRect } from "./cropGrid";
import { canRedo, canUndo, redo, undo } from "./history";
import { EditorCanvas, type Tool } from "./EditorCanvas";

const MAX_RECENT = 16;

function rgbaKey(c: Rgba): string {
  return `${c.r},${c.g},${c.b},${c.a}`;
}

function toHex(c: Rgba): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function fromHex(hex: string, a: number): Rgba {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
    a,
  };
}

export function Editor({ target }: { target: EditingTarget }) {
  const closeEditor = useAppStore((s) => s.closeEditor);
  const requestPlayerJump = useAppStore((s) => s.requestPlayerJump);

  const [doc, setDoc] = useState<SheetDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rects, setRects] = useState<CropRect[]>([]);
  const [tool, setTool] = useState<Tool>("pencil");
  const [brushSize, setBrushSize] = useState(1);
  const [color, setColor] = useState<Rgba>({ r: 255, g: 255, b: 255, a: 255 });
  const [recent, setRecent] = useState<Rgba[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(8);
  // Bumped on sheet mutations so undo/redo button state stays fresh.
  const [, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    setRects([]);

    getSheetDoc(target.sheetPath).then(async (d) => {
      if (cancelled) return;
      setDoc(d);
      if (!target.anm2Path) return;
      try {
        const anm2 = parseAnm2(await readText(target.anm2Path));
        const dir = dirname(target.anm2Path);
        const sheet = anm2.content.spritesheets.find(
          (s) =>
            resolveRelative(dir, s.rawPath).toLowerCase() ===
            target.sheetPath.replace(/\\/g, "/").toLowerCase(),
        );
        if (sheet && !cancelled) setRects(cropGrid(anm2, sheet.id));
      } catch {
        // Grid is optional decoration — a broken anm2 shouldn't kill the editor.
      }
    }, (e) => !cancelled && setError(String(e)));

    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    if (!doc) return;
    return subscribeSheet(doc.path, () => setRev((r) => r + 1));
  }, [doc]);

  const pushRecent = useCallback((c: Rgba) => {
    setRecent((rs) => {
      const next = [c, ...rs.filter((r) => rgbaKey(r) !== rgbaKey(c))];
      return next.slice(0, MAX_RECENT);
    });
  }, []);

  const onStrokeEnd = useCallback(() => {
    pushRecent(color);
  }, [color, pushRecent]);

  const onPick = useCallback(
    (c: Rgba) => {
      setColor(c);
      setTool("pencil");
    },
    [],
  );

  const onJump = useCallback(
    (r: CropRect) => requestPlayerJump(r.animName, r.atTick),
    [requestPlayerJump],
  );

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!doc) return;
      if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(doc);
        else undo(doc);
      } else if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo(doc);
      } else if (!e.ctrlKey) {
        if (e.key === "b" || e.key === "p") setTool("pencil");
        else if (e.key === "e") setTool("eraser");
        else if (e.key === "i") setTool("eyedropper");
        else if (e.key === "v") setTool("inspect");
        else if (e.key === "g") setShowGrid((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc]);

  const fileName = useMemo(
    () => target.sheetPath.split(/[\\/]/).pop() ?? target.sheetPath,
    [target.sheetPath],
  );

  if (error) return <div className="detail-error">{error}</div>;
  if (!doc) return <div className="detail-empty">Loading sheet…</div>;

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <strong className="editor-title" title={target.sheetPath}>
          {fileName}
        </strong>
        {doc.dirty && <span className="dirty-badge">unsaved · in-memory</span>}
        <span className="toolbar-spacer" />
        <button className="player-btn" onClick={closeEditor} title="Close editor">
          ✕
        </button>
      </div>

      <div className="editor-toolbar">
        {(
          [
            ["pencil", "✏ Pencil (B)"],
            ["eraser", "▱ Eraser (E)"],
            ["eyedropper", "💉 Pick (I)"],
            ["inspect", "➤ Inspect (V)"],
          ] as [Tool, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            className={`player-btn tool-btn${tool === t ? " active" : ""}`}
            onClick={() => setTool(t)}
          >
            {label}
          </button>
        ))}
        <label className="player-zoom">
          size
          <select
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          >
            {[1, 2, 4].map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>
        </label>
        <button
          className="player-btn"
          disabled={!canUndo(doc)}
          onClick={() => undo(doc)}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          className="player-btn"
          disabled={!canRedo(doc)}
          onClick={() => redo(doc)}
          title="Redo (Ctrl+Y)"
        >
          ↷
        </button>
        <label className="player-zoom">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          grid ({rects.length})
        </label>
        <span className="detail-meta">
          {doc.canvas.width}×{doc.canvas.height} · {zoom}×
        </span>
      </div>

      <div className="editor-toolbar">
        <span
          className="color-swatch checkerboard"
          title={`rgba(${rgbaKey(color)})`}
        >
          <span
            style={{
              background: `rgba(${color.r},${color.g},${color.b},${color.a / 255})`,
            }}
          />
        </span>
        <input
          type="color"
          value={toHex(color)}
          onChange={(e) => setColor(fromHex(e.target.value, color.a))}
        />
        <label className="player-zoom alpha-label">
          α
          <input
            type="range"
            min={0}
            max={255}
            value={color.a}
            onChange={(e) => setColor({ ...color, a: Number(e.target.value) })}
          />
          {color.a}
        </label>
        <span className="recent-colors">
          {recent.map((c) => (
            <button
              key={rgbaKey(c)}
              className="recent-color checkerboard"
              title={`rgba(${rgbaKey(c)})`}
              onClick={() => setColor(c)}
            >
              <span
                style={{
                  background: `rgba(${c.r},${c.g},${c.b},${c.a / 255})`,
                }}
              />
            </button>
          ))}
        </span>
      </div>

      <EditorCanvas
        doc={doc}
        tool={tool}
        brushSize={brushSize}
        color={color}
        onPick={onPick}
        rects={rects}
        showGrid={showGrid}
        onJump={onJump}
        onStrokeEnd={onStrokeEnd}
        zoom={zoom}
        onZoom={setZoom}
      />
      <div className="editor-hint">
        wheel: zoom · space/middle-drag: pan · Alt+click or Inspect tool on a
        grid rect: jump player to that frame
      </div>
    </div>
  );
}
