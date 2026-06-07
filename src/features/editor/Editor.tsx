import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseAnm2 } from "../../lib/anm2/parse";
import type { Anm2, Rgba } from "../../lib/anm2/types";
import { readText } from "../../lib/fsx/fs";
import { dirname, resolveRelative } from "../../lib/fsx/resolve";
import {
  getSheetDoc,
  subscribeSheet,
  type SheetDoc,
} from "../../lib/sheets/store";
import { useAppStore, type EditingTarget } from "../../app/store";
import { cropGrid, type CropRect } from "./cropGrid";
import { beginStroke, canRedo, canUndo, redo, undo } from "./history";
import {
  cancelFloating as cancelFloatingObj,
  closeSource,
  commitFloating,
  makeFloating,
  type Floating,
} from "./floating";
import { extractPalette } from "./palette";
import { SaveToModDialog } from "../export/SaveToModDialog";
import { EditorCanvas, type Tool } from "./EditorCanvas";
import { findSharedSheetInfo } from "./sharedSheet";
import { rectAtFrame } from "./rectAtFrame";
import { LayersPanel } from "./LayersPanel";
import { HistoryPanel } from "./HistoryPanel";
import {
  BrushIcon,
  CloseIcon,
  DropperIcon,
  EraserIcon,
  FillIcon,
  GridIcon,
  LassoIcon,
  MarqueeIcon,
  MirrorIcon,
  MoveIcon,
  MoveToolIcon,
  PaletteIcon,
  RedoIcon,
  SwapArrowsIcon,
  TransformIcon,
  UndoIcon,
  WandIcon,
} from "../../app/icons";
import { ColorPicker } from "./ColorPicker";
import {
  clearSelection,
  extractSelection,
  layerContentBounds,
  type Selection,
} from "./selection";
import { composite, bumpSheet } from "../../lib/sheets/store";
import { activeLayer, previewSelection } from "../../lib/sheets/store";
import { recordRemoveLayer, recordSelection } from "./history";

const BRUSH_MIN = 1;
const BRUSH_MAX = 64;

const MAX_RECENT = 16;

function rgbaKey(c: Rgba): string {
  return `${c.r},${c.g},${c.b},${c.a}`;
}

function toHex(c: Rgba): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

const TOOLS: {
  id: Tool;
  icon: () => React.ReactNode;
  tip: string;
  label: string;
}[] = [
  { id: "move",       icon: MoveToolIcon, tip: "Move (V) — drag layer contents; Alt+click jumps the player to a frame rect", label: "Move" },
  { id: "brush",      icon: BrushIcon,    tip: "Brush (B)",      label: "Brush" },
  { id: "eraser",     icon: EraserIcon,   tip: "Eraser (E)",     label: "Eraser" },
  { id: "eyedropper", icon: DropperIcon,  tip: "Eyedropper (I)", label: "Eyedropper" },
  { id: "fill",       icon: FillIcon,     tip: "Fill bucket (G) — flood-fill connected pixels with the current color", label: "Fill bucket" },
  { id: "marquee",    icon: MarqueeIcon,  tip: "Rectangle marquee (M) — drag to select, inside-drag moves the outline, Ctrl+T transform, Alt+drag duplicate, Ctrl+X clear, Ctrl+D deselect", label: "Marquee" },
  { id: "lasso",      icon: LassoIcon,    tip: "Lasso (L) — drag a freeform shape; release to close", label: "Lasso" },
  { id: "wand",       icon: WandIcon,     tip: "Magic wand (W) — tolerance in the options strip", label: "Magic wand" },
  { id: "pan",        icon: MoveIcon,     tip: "Pan view (H, or hold Space / middle-drag)", label: "Pan" },
];

const TOOL_LABEL: Record<Tool, string> = Object.fromEntries(
  TOOLS.map((t) => [t.id, t.label]),
) as Record<Tool, string>;

interface EditorProps {
  target: EditingTarget;
  /** Owning tab — player jumps stay inside it */
  tabId: string;
  /** Keyboard shortcuts only respond in the visible tab */
  active: boolean;
  onClose: () => void;
}

export function Editor({ target, tabId, active, onClose }: EditorProps) {
  const requestPlayerJump = useAppStore((s) => s.requestPlayerJump);
  const addToast = useAppStore((s) => s.addToast);
  const catalog = useAppStore((s) => s.catalog);
  const currentTitle = useAppStore(
    (s) => s.tabs.find((t) => t.id === tabId)?.title,
  );
  const sharedInfo = useMemo(
    () =>
      findSharedSheetInfo(
        catalog,
        currentTitle,
        target.anm2Path,
        target.sheetId,
      ),
    [catalog, currentTitle, target.anm2Path, target.sheetId],
  );
  // Dismissal is per-sheet: closing the warning on Azazel's head sheet won't
  // suppress it when the user later opens ghost.png.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const editorJump = useAppStore((s) => s.editorJump);

  const [doc, setDoc] = useState<SheetDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rects, setRects] = useState<CropRect[]>([]);
  // Frame-strip → editor jump needs the parsed anm2 to resolve
  // (animation, tick) → crop rect via rectAtFrame.
  const [parsed, setParsed] = useState<{
    anm2: Anm2;
    sheetId: number;
  } | null>(null);
  // Highlighted rect (from a frame-strip click); auto-clears after ~1.4s.
  const [highlightRect, setHighlightRect] = useState<CropRect | null>(null);
  const [tool, setTool] = useState<Tool>("move");
  const [brushSize, setBrushSize] = useState(1);
  // Photoshop foreground/background. `color` is the brush/fill color. `bgColor`
  // is the secondary swatch — X swaps them, D resets to defaults.
  const [color, setColor] = useState<Rgba>({ r: 0, g: 0, b: 0, a: 255 });
  const [bgColor, setBgColor] = useState<Rgba>({ r: 255, g: 255, b: 255, a: 255 });
  const [picker, setPicker] = useState<"fg" | "bg" | null>(null);
  const [recent, setRecent] = useState<Rgba[]>([]);
  const [palette, setPalette] = useState<Rgba[] | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  // Selection lives on the doc (so history can undo/redo it); subscribe to
  // sheet bumps to mirror the latest value.
  const [, setSelRev] = useState(0);
  useEffect(() => {
    if (!doc) return;
    return subscribeSheet(doc.path, () => setSelRev((r) => r + 1));
  }, [doc]);
  const selection: Selection | null = doc?.selection ?? null;
  const [wandTolerance, setWandTolerance] = useState(32);
  const [fillTolerance, setFillTolerance] = useState(0);
  const [mirrorX, setMirrorX] = useState(false);
  const [mirrorY, setMirrorY] = useState(false);
  // Initial zoom seeded from the last value the user set, so reopening the
  // editor (or switching to the Mods diff viewer) keeps the same scale.
  const initialZoom = useAppStore.getState().lastEditorZoom;
  const setLastEditorZoom = useAppStore((s) => s.setLastEditorZoom);
  const [zoom, setZoomState] = useState(initialZoom);
  const setZoom = useCallback(
    (z: number) => {
      setZoomState(z);
      setLastEditorZoom(z);
    },
    [setLastEditorZoom],
  );
  const [floating, setFloating] = useState<Floating | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  // Bumped on sheet mutations so undo/redo button state stays fresh.
  const [, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    setRects([]);
    setParsed(null);

    getSheetDoc(target.sheetPath).then(async (d) => {
      if (cancelled) return;
      setDoc(d);
      if (!target.anm2Path) return;
      try {
        const anm2 = parseAnm2(await readText(target.anm2Path));
        // Prefer the explicit sheet id (skin overrides never path-match);
        // fall back to resolving the anm2's own sheet paths.
        let sheetId = target.sheetId;
        if (sheetId === undefined) {
          const dir = dirname(target.anm2Path);
          sheetId = anm2.content.spritesheets.find(
            (s) =>
              resolveRelative(dir, s.rawPath).toLowerCase() ===
              target.sheetPath.replace(/\\/g, "/").toLowerCase(),
          )?.id;
        }
        if (sheetId !== undefined && !cancelled) {
          setRects(cropGrid(anm2, sheetId));
          setParsed({ anm2, sheetId });
        }
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

  // Frame strip → editor: resolve the rect for the clicked frame on this
  // sheet, hand it to the canvas for pan + highlight. Each jump seq is
  // consumed once so a stale request can't re-fire after target swap.
  const consumedEditorJumpRef = useRef(0);
  useEffect(() => {
    if (!editorJump || !parsed) return;
    if (editorJump.tabId !== tabId) return;
    if (editorJump.seq === consumedEditorJumpRef.current) return;
    consumedEditorJumpRef.current = editorJump.seq;
    const rect = rectAtFrame(
      parsed.anm2,
      editorJump.animName,
      parsed.sheetId,
      Math.floor(editorJump.tick),
      rects,
    );
    if (rect) {
      setHighlightRect(rect);
      // Auto-clear so the bright outline doesn't stick forever.
      const id = window.setTimeout(() => setHighlightRect(null), 1400);
      return () => window.clearTimeout(id);
    }
  }, [editorJump, parsed, rects, tabId]);

  const pushRecent = useCallback((c: Rgba) => {
    setRecent((rs) => {
      const next = [c, ...rs.filter((r) => rgbaKey(r) !== rgbaKey(c))];
      return next.slice(0, MAX_RECENT);
    });
  }, []);

  const onStrokeEnd = useCallback(() => {
    pushRecent(color);
  }, [color, pushRecent]);

  const onPick = useCallback((c: Rgba) => {
    setColor(c);
    setTool("brush");
  }, []);

  const onJump = useCallback(
    (r: CropRect) => requestPlayerJump(tabId, r.animName, r.atTick),
    [requestPlayerJump, tabId],
  );

  const stampFloating = useCallback(() => {
    if (!doc || !floating) return;
    commitFloating(doc, floating);
    setFloating(null);
  }, [doc, floating]);

  const cancelFloating = useCallback(() => {
    if (!doc || !floating) return;
    cancelFloatingObj(doc, floating);
    setFloating(null);
  }, [doc, floating]);

  /** Lift the selection's pixels off the active layer into a Floating. */
  const beginTransform = useCallback(
    async (sel: Selection, cut: boolean, label = "Transform") => {
      if (!doc) return;
      if (activeLayer(doc).locked) return;
      let canvas: HTMLCanvasElement;
      if (cut) {
        const rec = beginStroke(doc, label);
        rec.touch(sel.bounds.x, sel.bounds.y, sel.bounds.w, sel.bounds.h);
        canvas = extractSelection(doc, sel, true);
        rec.commit();
      } else {
        canvas = extractSelection(doc, sel, false);
      }
      const bitmap = await createImageBitmap(canvas);
      if (floating?.source) closeSource(floating.source);
      setFloating({
        source: bitmap,
        x: sel.bounds.x,
        y: sel.bounds.y,
        w: sel.bounds.w,
        h: sel.bounds.h,
      });
      // Drop the marquee outline; user re-selects after committing.
      recordSelection(doc, "Deselect", null);
      setTool("move");
    },
    [doc, floating],
  );

  /** Ctrl+T — uses the active selection, or falls back to the active
   *  layer's tight content bbox when none is selected. */
  const triggerTransform = useCallback(() => {
    if (!doc) return;
    if (activeLayer(doc).locked) return;
    if (selection) {
      void beginTransform(selection, true);
      return;
    }
    const bounds = layerContentBounds(activeLayer(doc));
    if (!bounds) return;
    void beginTransform({ bounds, mask: null }, true);
  }, [doc, selection, beginTransform]);

  /** Ctrl+X / Delete — clears the selection if present, else the layer. */
  const triggerClear = useCallback(() => {
    if (!doc) return;
    if (activeLayer(doc).locked) return;
    if (selection) {
      const rec = beginStroke(doc, "Clear selection");
      rec.touch(
        selection.bounds.x,
        selection.bounds.y,
        selection.bounds.w,
        selection.bounds.h,
      );
      clearSelection(doc, selection);
      rec.commit();
      recordSelection(doc, "Deselect", null);
      return;
    }
    const layer = activeLayer(doc);
    const rec = beginStroke(doc, "Clear layer");
    rec.touch(0, 0, layer.canvas.width, layer.canvas.height);
    layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    rec.commit();
  }, [doc, selection]);

  const onAltDragSelection = useCallback(() => {
    if (!doc || !selection) return;
    void beginTransform(selection, false, "Duplicate");
  }, [doc, selection, beginTransform]);

  /**
   * Move tool click — lifts pixels off the active layer and floats them
   * synchronously. Holds an open stroke recorder through the drag so cut
   * and stamp collapse to one "Move" entry in history. Esc aborts the
   * recorder (pixels restored) and restores the selection that was active
   * at lift time, so cancelling a Move feels like nothing happened.
   *
   * Returns the new floating object so the caller can arm any pointer
   * state that depends on it without waiting for the React state flush.
   */
  const onMoveStart = useCallback((): Floating | null => {
    if (!doc) return null;
    if (activeLayer(doc).locked) return null;
    const bounds = selection?.bounds ?? layerContentBounds(activeLayer(doc));
    if (!bounds || bounds.w <= 0 || bounds.h <= 0) return null;
    const sel: Selection = selection ?? { bounds, mask: null };
    if (floating) cancelFloatingObj(doc, floating);
    const rec = beginStroke(doc, "Move");
    rec.touch(bounds.x, bounds.y, bounds.w, bounds.h);
    const canvas = extractSelection(doc, sel, true);
    const priorSelection = selection;
    // Clear the marquee outline silently — Esc will put it back, commit
    // drops it (Photoshop also folds the selection-clear into the Move).
    previewSelection(doc, null);
    const next: Floating = {
      source: canvas,
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h,
      recorder: rec,
      commitLabel: "Move",
      priorSelection,
    };
    setFloating(next);
    return next;
  }, [doc, selection, floating]);

  /**
   * Merge the active layer down onto the layer immediately beneath it,
   * then remove the active one. Photoshop's Ctrl+E. Two history entries
   * land: the pixel diff on the underlying layer, then the layer removal.
   */
  const triggerMergeDown = useCallback(() => {
    if (!doc) return;
    const idx = doc.layers.findIndex((l) => l.id === doc.activeLayerId);
    if (idx <= 0) return; // bottom layer or invalid
    const active = doc.layers[idx];
    const below = doc.layers[idx - 1];
    if (below.locked) return;
    // Step 1: composite active onto below as one pixel patch.
    const prevActive = doc.activeLayerId;
    doc.activeLayerId = below.id;
    const rec = beginStroke(doc, `Merge "${active.name}" down`);
    rec.touch(0, 0, below.canvas.width, below.canvas.height);
    below.ctx.save();
    below.ctx.globalAlpha = active.opacity;
    below.ctx.drawImage(active.canvas, 0, 0);
    below.ctx.restore();
    rec.commit();
    doc.activeLayerId = prevActive;
    composite(doc);
    bumpSheet(doc);
    // Step 2: remove the now-merged active layer through history.
    recordRemoveLayer(doc, active.id);
  }, [doc]);

  const onSelectionPreview = useCallback(
    (sel: Selection | null) => {
      if (!doc) return;
      previewSelection(doc, sel);
    },
    [doc],
  );

  const onSelectionCommit = useCallback(
    (sel: Selection | null, label: string) => {
      if (!doc) return;
      recordSelection(doc, label, sel);
    },
    [doc],
  );

  // Ctrl+V: paste an image as a floating object (committed on Enter).
  // Active-gated so a paste lands only in the visible tab's editor.
  useEffect(() => {
    if (!active) return;
    const onPaste = async (e: ClipboardEvent) => {
      if (!doc) return;
      const item = [...(e.clipboardData?.items ?? [])].find((i) =>
        i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      const bitmap = await createImageBitmap(file);
      if (floating?.source) closeSource(floating.source);
      setFloating(makeFloating(bitmap, doc));
      setTool("move");
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [doc, floating, active]);

  // Keyboard shortcuts (only while this tab is visible).
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!doc) return;
      if (floating && e.key === "Enter") {
        e.preventDefault();
        stampFloating();
        return;
      }
      if (floating && e.key === "Escape") {
        cancelFloating();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setSaveOpen(true);
      } else if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(doc);
        else undo(doc);
      } else if (e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo(doc);
      } else if (e.ctrlKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        triggerTransform();
      } else if (e.ctrlKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        triggerClear();
      } else if (e.ctrlKey && e.key.toLowerCase() === "d") {
        // Photoshop deselect.
        e.preventDefault();
        if (selection) recordSelection(doc, "Deselect", null);
      } else if (e.ctrlKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        triggerMergeDown();
      } else if (
        !e.ctrlKey &&
        (e.key === "Delete" || e.key === "Backspace")
      ) {
        e.preventDefault();
        triggerClear();
      } else if (!e.ctrlKey) {
        if (e.key === "v") setTool("move");
        else if (e.key === "b") setTool("brush");
        else if (e.key === "e") setTool("eraser");
        else if (e.key === "i") setTool("eyedropper");
        else if (e.key === "g") setTool("fill");
        else if (e.key === "m") setTool("marquee");
        else if (e.key === "l") setTool("lasso");
        else if (e.key === "w") setTool("wand");
        else if (e.key === "h") setTool("pan");
        else if (e.key === "x") {
          // Photoshop FG/BG swap.
          const fg = color;
          setColor(bgColor);
          setBgColor(fg);
        } else if (e.key === "d") {
          // Photoshop default colors — black FG, white BG.
          setColor({ r: 0, g: 0, b: 0, a: 255 });
          setBgColor({ r: 255, g: 255, b: 255, a: 255 });
        } else if (e.key === "/") setShowGrid((s) => !s);
        else if (e.key === "Escape") {
          if (floating) cancelFloating();
          else if (selection) recordSelection(doc, "Deselect", null);
        } else if (e.key === "[")
          setBrushSize((s) => Math.max(BRUSH_MIN, s - 1));
        else if (e.key === "]")
          setBrushSize((s) => Math.min(BRUSH_MAX, s + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    doc,
    floating,
    stampFloating,
    cancelFloating,
    active,
    selection,
    triggerTransform,
    triggerClear,
    triggerMergeDown,
    color,
    bgColor,
  ]);

  const fileName = useMemo(
    () => target.sheetPath.split(/[\\/]/).pop() ?? target.sheetPath,
    [target.sheetPath],
  );

  if (error) return <div className="detail-error">{error}</div>;
  if (!doc) return <div className="detail-empty">Loading sheet…</div>;

  const showBrushOptions = tool === "brush" || tool === "eraser";

  return (
    <div className="editor">
      <div className="editor-topbar">
        <span className="editor-title" title={target.sheetPath}>
          {fileName}
        </span>
        {doc.dirty && (
          <span className="dirty-dot" title="Unsaved — edits are in-memory only" />
        )}
        {savedPath && !doc.dirty && (
          <span className="saved-note" title={savedPath}>
            saved
          </span>
        )}
        <span className="toolbar-spacer" />
        <span className="editor-meta">
          {doc.canvas.width}×{doc.canvas.height}px · {zoom}×
        </span>
        <button
          className="save-btn"
          onClick={() => setSaveOpen(true)}
          title="Write this sheet into a mod folder (Ctrl+S)"
        >
          Save to mod
        </button>
        <button
          className="rail-btn"
          onClick={onClose}
          title="Close editor"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="editor-options">
        <span className="opt-tool" title={`Active tool: ${TOOL_LABEL[tool]}`}>
          {TOOL_LABEL[tool]}
        </span>
        <span className="opt-sep" />
        {floating && (
          <span className="opt-hint floating-hint">
            Floating paste — drag to move, corner handles to scale ·{" "}
            <b>Enter</b> commits (pixelized to sheet) · <b>Esc</b> cancels
          </span>
        )}
        {!floating && showBrushOptions && (
          <>
            <label className="opt">
              Size
              <input
                type="number"
                min={BRUSH_MIN}
                max={BRUSH_MAX}
                value={brushSize}
                onChange={(e) =>
                  setBrushSize(
                    Math.max(
                      BRUSH_MIN,
                      Math.min(BRUSH_MAX, Number(e.target.value) || BRUSH_MIN),
                    ),
                  )
                }
              />
              px <span className="opt-kbd">[ ]</span>
            </label>
            {tool === "brush" && (
              <>
                <span className="opt-sep" />
                <button
                  className="opt-swatch checkerboard"
                  title={`Foreground color rgba(${rgbaKey(color)}) — click to open picker`}
                  onClick={() => setPicker("fg")}
                >
                  <span
                    style={{
                      background: `rgba(${color.r},${color.g},${color.b},${color.a / 255})`,
                    }}
                  />
                </button>
                <span className="opt-hex">#{toHex(color).slice(1).toUpperCase()}</span>
                <label className="opt">
                  Opacity
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={color.a}
                    onChange={(e) =>
                      setColor({ ...color, a: Number(e.target.value) })
                    }
                  />
                  <span className="opt-num">
                    {Math.round((color.a / 255) * 100)}%
                  </span>
                </label>
                {recent.length > 0 && <span className="opt-sep" />}
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
                <span className="opt-sep" />
                <button
                  className="rail-btn opt-icon-btn"
                  title="Extract sheet palette (most-used colors in this sheet)"
                  onClick={() => setPalette(extractPalette(doc))}
                >
                  <PaletteIcon />
                </button>
                {palette && (
                  <span className="recent-colors">
                    {palette.map((c) => (
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
                )}
              </>
            )}
          </>
        )}
        {!floating && tool === "eyedropper" && (
          <span className="opt-hint">Click a pixel to sample its color (alpha included)</span>
        )}
        {!floating && tool === "pan" && (
          <span className="opt-hint">Drag to pan the view</span>
        )}
        {!floating && tool === "move" && (
          <span className="opt-hint">
            Drag layer content to reposition · Alt+click a frame rect jumps
            the player · Ctrl+V pastes an image
          </span>
        )}
        {!floating && tool === "marquee" && (
          <span className="opt-hint">
            Drag a rectangle to select · Ctrl+T transform · Ctrl+X / Delete
            clear · Alt+drag inside duplicates · Esc deselects
          </span>
        )}
        {!floating && tool === "lasso" && (
          <span className="opt-hint">
            Drag a freeform shape to select · release to close · Esc deselects
          </span>
        )}
        {!floating && tool === "fill" && (
          <>
            <label className="opt">
              Tolerance
              <input
                type="range"
                min={0}
                max={120}
                value={fillTolerance}
                onChange={(e) => setFillTolerance(Number(e.target.value))}
              />
              <span className="opt-num">{fillTolerance}</span>
            </label>
            <span className="opt-sep" />
            <span className="opt-hint">
              Click to flood-fill matching pixels
            </span>
          </>
        )}
        {!floating && (tool === "brush" || tool === "eraser") && (
          <>
            <span className="opt-sep" />
            <button
              className={`rail-btn opt-icon-btn${mirrorX ? " active" : ""}`}
              title="Mirror horizontally across the doc's vertical center"
              onClick={() => setMirrorX((m) => !m)}
            >
              <MirrorIcon />
            </button>
            <button
              className={`rail-btn opt-icon-btn${mirrorY ? " active" : ""}`}
              title="Mirror vertically across the doc's horizontal center"
              onClick={() => setMirrorY((m) => !m)}
              style={{ transform: "rotate(90deg)" }}
            >
              <MirrorIcon />
            </button>
          </>
        )}
        {!floating && tool === "wand" && (
          <>
            <label className="opt">
              Tolerance
              <input
                type="range"
                min={0}
                max={120}
                value={wandTolerance}
                onChange={(e) => setWandTolerance(Number(e.target.value))}
              />
              <span className="opt-num">{wandTolerance}</span>
            </label>
            <span className="opt-sep" />
            <span className="opt-hint">
              Click to select connected pixels of similar colour
            </span>
          </>
        )}
        {!floating && (
          <>
            <span className="opt-sep" />
            <button
              className="rail-btn opt-icon-btn"
              title={
                selection
                  ? "Free Transform selection (Ctrl+T)"
                  : "Free Transform — uses the active layer's content"
              }
              onClick={triggerTransform}
            >
              <TransformIcon />
            </button>
          </>
        )}
      </div>

      {sharedInfo && dismissedFor !== target.sheetPath && (
        <div className="editor-shared-warning" role="alert">
          <span className="editor-shared-text">
            <strong>Shared sheet:</strong> edits also affect{" "}
            {sharedInfo.others.length === 1
              ? sharedInfo.others[0]
              : sharedInfo.others.length <= 4
                ? sharedInfo.others.join(", ")
                : `${sharedInfo.others.slice(0, 3).join(", ")} +${sharedInfo.others.length - 3} more`}
            {sharedInfo.reason === "player"
              ? " — this sheet is pulled in by every character through the shared player anm2."
              : " — this costume is reused by the characters above."}
          </span>
          <button
            className="editor-shared-close"
            title="Dismiss for this sheet"
            onClick={() => setDismissedFor(target.sheetPath)}
          >
            <CloseIcon />
          </button>
        </div>
      )}
      <div className="editor-body">
        <div className="tool-rail">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`rail-btn${tool === t.id ? " active" : ""}`}
              onClick={() => setTool(t.id)}
              title={t.tip}
            >
              <t.icon />
            </button>
          ))}
          <span className="rail-sep" />
          <button
            className="rail-btn"
            disabled={!canUndo(doc)}
            onClick={() => undo(doc)}
            title="Undo (Ctrl+Z)"
          >
            <UndoIcon />
          </button>
          <button
            className="rail-btn"
            disabled={!canRedo(doc)}
            onClick={() => redo(doc)}
            title="Redo (Ctrl+Y)"
          >
            <RedoIcon />
          </button>
          <span className="rail-sep" />
          <button
            className={`rail-btn${showGrid ? " active" : ""}`}
            onClick={() => setShowGrid((s) => !s)}
            title={`Frame grid — ${rects.length} rects (G)`}
          >
            <GridIcon />
          </button>
          <span className="rail-sep" />
          <div
            className="fg-bg-widget"
            title="Foreground / Background — click to open picker · X to swap · D to reset"
          >
            <button
              className="fg-bg-swatch fg-bg-bg checkerboard"
              title={`Background color rgba(${rgbaKey(bgColor)}) — click to open picker`}
              onClick={() => setPicker("bg")}
            >
              <span
                style={{
                  background: `rgba(${bgColor.r},${bgColor.g},${bgColor.b},${bgColor.a / 255})`,
                }}
              />
            </button>
            <button
              className="fg-bg-swatch fg-bg-fg checkerboard"
              title={`Foreground color rgba(${rgbaKey(color)}) — click to open picker`}
              onClick={() => setPicker("fg")}
            >
              <span
                style={{
                  background: `rgba(${color.r},${color.g},${color.b},${color.a / 255})`,
                }}
              />
            </button>
            <button
              className="fg-bg-swap"
              title="Swap foreground and background (X)"
              onClick={() => {
                const fg = color;
                setColor(bgColor);
                setBgColor(fg);
              }}
            >
              <SwapArrowsIcon size={11} />
            </button>
            <button
              className="fg-bg-reset"
              title="Reset to default black / white (D)"
              onClick={() => {
                setColor({ r: 0, g: 0, b: 0, a: 255 });
                setBgColor({ r: 255, g: 255, b: 255, a: 255 });
              }}
            >
              <span className="fg-bg-reset-fg" />
              <span className="fg-bg-reset-bg" />
            </button>
          </div>
        </div>
        <div className="editor-main">
          <EditorCanvas
            doc={doc}
            tool={tool}
            brushSize={brushSize}
            color={color}
            onPick={onPick}
            rects={rects}
            showGrid={showGrid}
            highlightRect={highlightRect}
            onJump={onJump}
            onStrokeEnd={onStrokeEnd}
            zoom={zoom}
            onZoom={setZoom}
            floating={floating}
            onFloatingChange={setFloating}
            onFloatingCommit={stampFloating}
            selection={selection}
            onSelectionPreview={onSelectionPreview}
            onSelectionCommit={onSelectionCommit}
            wandTolerance={wandTolerance}
            fillTolerance={fillTolerance}
            mirrorX={mirrorX}
            mirrorY={mirrorY}
            onAltDragSelection={onAltDragSelection}
            onMoveStart={onMoveStart}
          />
          <div className="editor-hint">
            wheel zoom · space / middle-drag pan · [ ] brush size · Ctrl+V
            paste image · Ctrl+S save to mod · Alt+click rect jumps player
          </div>
        </div>
        <div className="editor-panels">
          <LayersPanel doc={doc} onMergeDown={triggerMergeDown} />
          <HistoryPanel doc={doc} />
        </div>
      </div>
      {picker && (
        <ColorPicker
          initial={picker === "fg" ? color : bgColor}
          title={picker === "fg" ? "Foreground Color" : "Background Color"}
          onCancel={() => setPicker(null)}
          onCommit={(c) => {
            if (picker === "fg") {
              setColor(c);
              pushRecent(c);
            } else {
              setBgColor(c);
            }
            setPicker(null);
          }}
        />
      )}
      {saveOpen && (
        <SaveToModDialog
          doc={doc}
          onClose={() => setSaveOpen(false)}
          onSaved={(p) => {
            setSaveOpen(false);
            setSavedPath(p);
            addToast(`Saved → ${p}`, "success");
          }}
        />
      )}
    </div>
  );
}
