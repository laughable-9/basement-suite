import { useEffect, useRef } from "react";
import {
  activeLayer,
  composite,
  type SheetDoc,
} from "../../lib/sheets/store";
import { beginStroke, type StrokeRecorder } from "./history";
import type { CropRect } from "./cropGrid";
import type { Floating } from "./floating";
import {
  buildSelectionCache,
  fillFlood,
  inSelection,
  inSelectionCache,
  lassoSelection,
  magicWand,
  rectSelection,
  translateSelection,
  type Selection,
  type SelectionCache,
} from "./selection";
import type { Rgba } from "../../lib/anm2/types";

export type Tool =
  | "move"
  | "brush"
  | "eraser"
  | "eyedropper"
  | "fill"
  | "marquee"
  | "lasso"
  | "wand"
  | "pan";

const ZOOM_LEVELS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32];
const HANDLE_HIT_PX = 9;
type Edge = "n" | "s" | "e" | "w";

export interface EditorCanvasProps {
  doc: SheetDoc;
  tool: Tool;
  brushSize: number;
  color: Rgba;
  onPick: (color: Rgba) => void;
  rects: CropRect[];
  showGrid: boolean;
  /** Frame-strip → editor: pan to and highlight this rect when it changes */
  highlightRect: CropRect | null;
  onJump: (rect: CropRect) => void;
  onStrokeEnd: () => void;
  zoom: number;
  onZoom: (z: number) => void;
  floating: Floating | null;
  onFloatingChange: (f: Floating) => void;
  /** Click outside the floating rect = commit (Photoshop behavior) */
  onFloatingCommit: () => void;
  /** Marquee/wand selection — clips paint and is what Ctrl+X/T act on. */
  selection: Selection | null;
  /** Mid-drag selection update — sets doc.selection but doesn't record. */
  onSelectionPreview: (sel: Selection | null) => void;
  /** Final selection state — records as a single history entry. */
  onSelectionCommit: (sel: Selection | null, label: string) => void;
  /** Magic-wand tolerance, 0–255. */
  wandTolerance: number;
  /** Paint-bucket tolerance, 0–255. */
  fillTolerance: number;
  /** Mirror brush — symmetric paint along the doc's horizontal/vertical axes. */
  mirrorX: boolean;
  mirrorY: boolean;
  /** Alt+drag on the canvas with a selection → duplicate via Floating. */
  onAltDragSelection: () => void;
  /** Move tool gesture — host turns the active layer / selection into a
   *  floating piece synchronously and returns the click offset so this
   *  component can immediately start tracking the drag. */
  onMoveStart: (docX: number, docY: number) => void;
}

type Corner = 0 | 1 | 2 | 3; // TL TR BL BR

interface ScaleDrag {
  corner: Corner;
  anchorX: number;
  anchorY: number;
  origW: number;
  origH: number;
}

interface EdgeDrag {
  edge: Edge;
  /** Coordinate of the opposite edge in doc space (stays fixed during drag). */
  anchor: number;
}

interface Pointer {
  panning: boolean;
  stroke: StrokeRecorder | null;
  lastDoc: { x: number; y: number } | null;
  lastScreen: { x: number; y: number };
  floatMove: { dx: number; dy: number } | null;
  floatScale: ScaleDrag | null;
  floatEdge: EdgeDrag | null;
  /** Marquee anchor (doc-space) while the user drags out a NEW rect. */
  marqueeAnchor: { x: number; y: number } | null;
  /** Inside-drag of an existing marquee — translates the outline only. */
  marqueeMove: {
    startSel: Selection;
    startX: number;
    startY: number;
    /** Reusable mask canvas — allocated once per inside-drag. */
    scratch: HTMLCanvasElement | null;
  } | null;
  /** Lasso path being drawn (doc-space points). */
  lasso: { x: number; y: number }[] | null;
  /** Pre-read selection alpha for fast per-paint checks during the stroke. */
  strokeMask: SelectionCache | null;
}

export function EditorCanvas(props: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // High-frequency interaction state lives in refs; React state would
  // re-render per pointermove.
  const propsRef = useRef(props);
  propsRef.current = props;
  const panRef = useRef({ x: 40, y: 40 });
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const pointerRef = useRef<Pointer>({
    panning: false,
    stroke: null,
    lastDoc: null,
    lastScreen: { x: 0, y: 0 },
    floatMove: null,
    floatScale: null,
    floatEdge: null,
    marqueeAnchor: null,
    marqueeMove: null,
    lasso: null,
    strokeMask: null,
  });
  const spaceRef = useRef(false);
  // Preview buffer for the floating image, downsampled to its doc rect so the
  // user sees the final pixelization while positioning.
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const prevSourceRef = useRef<ImageBitmap | HTMLCanvasElement | null>(null);

  // Center the sheet on first mount.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    panRef.current = {
      x: (wrap.clientWidth - props.doc.canvas.width * props.zoom) / 2,
      y: (wrap.clientHeight - props.doc.canvas.height * props.zoom) / 2,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.doc]);

  // Frame-strip → editor: pan so the highlighted rect sits in the viewport
  // center. Zoom stays where the user set it; if the rect would clip we
  // still center on its midpoint and let the user zoom out.
  useEffect(() => {
    const wrap = wrapRef.current;
    const rect = props.highlightRect;
    if (!wrap || !rect) return;
    const cx = (rect.x + rect.w / 2) * props.zoom;
    const cy = (rect.y + rect.h / 2) * props.zoom;
    panRef.current = {
      x: wrap.clientWidth / 2 - cx,
      y: wrap.clientHeight / 2 - cy,
    };
  }, [props.highlightRect, props.zoom]);

  // Continuous redraw: cheap (one drawImage + rect strokes) and immune to
  // missed invalidations from strokes/zoom/sheet mutations.
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      if (canvas.width !== wrap.clientWidth) canvas.width = wrap.clientWidth;
      if (canvas.height !== wrap.clientHeight) canvas.height = wrap.clientHeight;

      const {
        doc,
        rects,
        showGrid,
        highlightRect,
        zoom,
        tool,
        brushSize,
        floating,
        selection,
      } = propsRef.current;
      const pan = panRef.current;
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);
      ctx.drawImage(doc.canvas, 0, 0);
      ctx.restore();

      // Sheet border
      ctx.strokeStyle = "#5a4a66";
      ctx.strokeRect(
        pan.x - 0.5,
        pan.y - 0.5,
        doc.canvas.width * zoom + 1,
        doc.canvas.height * zoom + 1,
      );

      if (showGrid) {
        ctx.font = "10px 'Segoe UI', sans-serif";
        for (const r of rects) {
          const sx = pan.x + r.x * zoom;
          const sy = pan.y + r.y * zoom;
          const sw = r.w * zoom;
          const sh = r.h * zoom;
          ctx.strokeStyle = "rgba(120,220,160,0.85)";
          ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
          if (sw >= 40) {
            const text = r.label;
            const tw = ctx.measureText(text).width + 6;
            ctx.fillStyle = "rgba(20,40,28,0.85)";
            ctx.fillRect(sx, sy, tw, 13);
            ctx.fillStyle = "rgb(150,235,180)";
            ctx.fillText(text, sx + 3, sy + 10);
          }
        }
      }

      // Strip-driven highlight: thick accent outline over the active rect.
      // Drawn unconditionally (even with grid off) so a strip seek still
      // shows the user where the edit lands.
      if (highlightRect) {
        const r = highlightRect;
        const sx = pan.x + r.x * zoom;
        const sy = pan.y + r.y * zoom;
        const sw = r.w * zoom;
        const sh = r.h * zoom;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(196,80,56,0.95)";
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.lineWidth = 1;
      }

      if (floating) {
        drawFloating(ctx, floating, pan, zoom);
      }

      // Selection outline (marching ants). For masked selections we still
      // show the bbox rect — the mask itself is enforced on paint ops.
      if (selection) {
        const b = selection.bounds;
        const sx = pan.x + b.x * zoom;
        const sy = pan.y + b.y * zoom;
        const sw = b.w * zoom;
        const sh = b.h * zoom;
        const phase = (performance.now() / 80) % 8;
        // Black underlay
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#000";
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -phase;
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
        // White ants on top, offset half a dash so the eye sees alternation
        ctx.strokeStyle = "#fff";
        ctx.lineDashOffset = -phase + 4;
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
        ctx.setLineDash([]);
        // If wand mask, tint the selected region so the user knows the
        // ants outline a bbox, not the actual shape.
        if (selection.mask) {
          ctx.save();
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = "#7ab8ff";
          ctx.translate(pan.x, pan.y);
          ctx.scale(zoom, zoom);
          ctx.drawImage(selection.mask, 0, 0);
          ctx.restore();
        }
      }

      // Lasso path preview while drawing.
      const lasso = pointerRef.current.lasso;
      if (lasso && lasso.length > 1) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -(performance.now() / 80) % 8;
        ctx.beginPath();
        ctx.moveTo(pan.x + lasso[0].x * zoom + 0.5, pan.y + lasso[0].y * zoom + 0.5);
        for (let i = 1; i < lasso.length; i++) {
          ctx.lineTo(pan.x + lasso[i].x * zoom + 0.5, pan.y + lasso[i].y * zoom + 0.5);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Brush footprint preview
      const hover = hoverRef.current;
      if (hover && !floating && (tool === "brush" || tool === "eraser")) {
        const o = Math.floor((brushSize - 1) / 2);
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.strokeRect(
          pan.x + (hover.x - o) * zoom + 0.5,
          pan.y + (hover.y - o) * zoom + 0.5,
          brushSize * zoom - 1,
          brushSize * zoom - 1,
        );
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  function drawFloating(
    ctx: CanvasRenderingContext2D,
    f: Floating,
    pan: { x: number; y: number },
    zoom: number,
  ) {
    const w = Math.max(1, Math.round(f.w));
    const h = Math.max(1, Math.round(f.h));
    // Downsample source → doc-res preview (area average), then nearest-
    // neighbor up to screen so the final pixel grid is visible pre-commit.
    // Recomputed only when the source or target size changes — not per frame.
    let prev = previewRef.current;
    if (!prev) prev = previewRef.current = document.createElement("canvas");
    const stale =
      prev.width !== w || prev.height !== h || prevSourceRef.current !== f.source;
    if (stale) {
      prev.width = w;
      prev.height = h;
      prevSourceRef.current = f.source;
      const pctx = prev.getContext("2d")!;
      pctx.imageSmoothingEnabled = true;
      pctx.imageSmoothingQuality = "high";
      pctx.clearRect(0, 0, w, h);
      pctx.drawImage(f.source, 0, 0, w, h);
    }

    const sx = pan.x + f.x * zoom;
    const sy = pan.y + f.y * zoom;
    const sw = f.w * zoom;
    const sh = f.h * zoom;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(prev, 0, 0, w, h, sx, sy, sw, sh);

    // Dashed outline + handles (4 corners for uniform scale + 4 edge
    // midpoints for axis-locked scaling).
    ctx.strokeStyle = "#7ab8ff";
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
    ctx.setLineDash([]);
    ctx.fillStyle = "#7ab8ff";
    for (const [cx, cy] of cornerPoints(f, pan, zoom)) {
      ctx.fillRect(cx - 3, cy - 3, 6, 6);
    }
    for (const [cx, cy] of edgePoints(f, pan, zoom)) {
      ctx.fillRect(cx - 3, cy - 3, 6, 6);
    }
  }

  function cornerPoints(
    f: Floating,
    pan: { x: number; y: number },
    zoom: number,
  ): [number, number][] {
    const x0 = pan.x + f.x * zoom;
    const y0 = pan.y + f.y * zoom;
    const x1 = pan.x + (f.x + f.w) * zoom;
    const y1 = pan.y + (f.y + f.h) * zoom;
    return [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
    ];
  }

  /** [N, S, W, E] in screen coords — midpoints of each edge. */
  function edgePoints(
    f: Floating,
    pan: { x: number; y: number },
    zoom: number,
  ): [number, number][] {
    const cx = pan.x + (f.x + f.w / 2) * zoom;
    const cy = pan.y + (f.y + f.h / 2) * zoom;
    const x0 = pan.x + f.x * zoom;
    const y0 = pan.y + f.y * zoom;
    const x1 = pan.x + (f.x + f.w) * zoom;
    const y1 = pan.y + (f.y + f.h) * zoom;
    return [
      [cx, y0], // N
      [cx, y1], // S
      [x0, cy], // W
      [x1, cy], // E
    ];
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  function toScreen(e: React.PointerEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function toDocF(e: React.PointerEvent): { x: number; y: number } {
    const s = toScreen(e);
    const { zoom } = propsRef.current;
    return {
      x: (s.x - panRef.current.x) / zoom,
      y: (s.y - panRef.current.y) / zoom,
    };
  }

  function toDoc(e: React.PointerEvent): { x: number; y: number } {
    const p = toDocF(e);
    return { x: Math.floor(p.x), y: Math.floor(p.y) };
  }

  function inBounds(p: { x: number; y: number }): boolean {
    const { doc } = propsRef.current;
    return (
      p.x >= 0 && p.y >= 0 && p.x < doc.canvas.width && p.y < doc.canvas.height
    );
  }

  function paintDot(p: { x: number; y: number }): void {
    const { doc, tool, brushSize, color } = propsRef.current;
    const layer = activeLayer(doc);
    // Pre-built mask cache from stroke begin — no per-paint getImageData.
    if (!inSelectionCache(pointerRef.current.strokeMask, p.x, p.y)) return;
    const o = Math.floor((brushSize - 1) / 2);
    const x = p.x - o;
    const y = p.y - o;
    const ctx = layer.ctx;
    ctx.clearRect(x, y, brushSize, brushSize);
    if (tool === "brush" && color.a > 0) {
      ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
      ctx.fillRect(x, y, brushSize, brushSize);
    }
    pointerRef.current.stroke?.touch(x, y, brushSize, brushSize);
  }

  function paint(p: { x: number; y: number }): void {
    const { doc, mirrorX, mirrorY } = propsRef.current;
    if (activeLayer(doc).locked) return;
    paintDot(p);
    // Mirror across the doc center axes — symmetric sprite painting.
    if (mirrorX || mirrorY) {
      const w = doc.canvas.width;
      const h = doc.canvas.height;
      if (mirrorX) paintDot({ x: w - 1 - p.x, y: p.y });
      if (mirrorY) paintDot({ x: p.x, y: h - 1 - p.y });
      if (mirrorX && mirrorY)
        paintDot({ x: w - 1 - p.x, y: h - 1 - p.y });
    }
    composite(doc);
  }

  /** Bresenham between consecutive pointer samples so fast strokes stay solid. */
  function paintLine(a: { x: number; y: number }, b: { x: number; y: number }) {
    let { x: x0, y: y0 } = a;
    const { x: x1, y: y1 } = b;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      paint({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function pickColor(p: { x: number; y: number }): void {
    const { doc, onPick } = propsRef.current;
    const d = doc.ctx.getImageData(p.x, p.y, 1, 1).data;
    onPick({ r: d[0], g: d[1], b: d[2], a: d[3] });
  }

  function jumpAt(p: { x: number; y: number }): void {
    const { rects, onJump, showGrid } = propsRef.current;
    if (!showGrid) return;
    const hit = rects.find(
      (r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h,
    );
    if (hit) onJump(hit);
  }

  function floatingHit(
    e: React.PointerEvent,
    f: Floating,
  ):
    | { kind: "corner"; corner: Corner }
    | { kind: "edge"; edge: Edge }
    | { kind: "inside" }
    | null {
    const s = toScreen(e);
    const { zoom } = propsRef.current;
    // Corners first — they sit at edge-handle locations too, so corners
    // win when both could hit the same screen point.
    const corners = cornerPoints(f, panRef.current, zoom);
    for (let i = 0; i < 4; i++) {
      if (
        Math.abs(s.x - corners[i][0]) <= HANDLE_HIT_PX &&
        Math.abs(s.y - corners[i][1]) <= HANDLE_HIT_PX
      ) {
        return { kind: "corner", corner: i as Corner };
      }
    }
    const edges = edgePoints(f, panRef.current, zoom);
    const edgeNames: Edge[] = ["n", "s", "w", "e"];
    for (let i = 0; i < 4; i++) {
      if (
        Math.abs(s.x - edges[i][0]) <= HANDLE_HIT_PX &&
        Math.abs(s.y - edges[i][1]) <= HANDLE_HIT_PX
      ) {
        return { kind: "edge", edge: edgeNames[i] };
      }
    }
    const p = toDocF(e);
    if (p.x >= f.x && p.x < f.x + f.w && p.y >= f.y && p.y < f.y + f.h) {
      return { kind: "inside" };
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
    canvasRef.current!.setPointerCapture(e.pointerId);
    const ptr = pointerRef.current;
    const { tool, doc, floating, onFloatingCommit } = propsRef.current;
    ptr.lastScreen = { x: e.clientX, y: e.clientY };

    if (e.button === 1 || spaceRef.current || tool === "pan") {
      ptr.panning = true;
      return;
    }
    if (e.button !== 0) return;

    // Floating paste intercepts all left clicks until resolved.
    if (floating) {
      const hit = floatingHit(e, floating);
      if (hit === null) {
        onFloatingCommit();
        return;
      }
      if (hit.kind === "corner") {
        const opposite: Corner = (3 - hit.corner) as Corner;
        const pts = [
          [floating.x, floating.y],
          [floating.x + floating.w, floating.y],
          [floating.x, floating.y + floating.h],
          [floating.x + floating.w, floating.y + floating.h],
        ];
        ptr.floatScale = {
          corner: hit.corner,
          anchorX: pts[opposite][0],
          anchorY: pts[opposite][1],
          origW: floating.w,
          origH: floating.h,
        };
      } else if (hit.kind === "edge") {
        // The opposite edge stays put — drag the active edge along one axis.
        const anchors: Record<Edge, number> = {
          n: floating.y + floating.h,
          s: floating.y,
          w: floating.x + floating.w,
          e: floating.x,
        };
        ptr.floatEdge = { edge: hit.edge, anchor: anchors[hit.edge] };
      } else {
        const p = toDocF(e);
        ptr.floatMove = { dx: p.x - floating.x, dy: p.y - floating.y };
      }
      return;
    }

    const p = toDoc(e);

    // Alt+drag with an active selection → duplicate it as a floating piece.
    // Delegated to the host (Editor) which knows how to set the floating
    // state without rummaging in our refs.
    const {
      selection,
      wandTolerance,
      onSelectionPreview,
      onSelectionCommit,
      onAltDragSelection,
      onMoveStart,
    } = propsRef.current;
    if (e.altKey && selection && inBounds(p) && inSelection(selection, p.x, p.y)) {
      onAltDragSelection();
      return;
    }

    // Move tool — pick up the active layer / selection and float-drag it.
    if (tool === "move") {
      if (inBounds(p) && !e.altKey) {
        onMoveStart(p.x, p.y);
        // After onMoveStart, the host has set floating; arm floatMove so
        // pointermove drags it immediately on the same gesture.
        // We use a 1-tick deferral via the next propsRef snapshot.
        const f = propsRef.current.floating;
        if (f) ptr.floatMove = { dx: p.x - f.x, dy: p.y - f.y };
        return;
      }
      if (inBounds(p)) jumpAt(p); // Alt-click still jumps the player
      return;
    }
    if (e.altKey) {
      if (inBounds(p)) jumpAt(p);
      return;
    }
    if (tool === "eyedropper") {
      if (inBounds(p)) pickColor(p);
      return;
    }

    // Marquee: inside an existing selection → translate the outline only
    // (Photoshop's "move marquee" gesture). Outside → start a new rect.
    if (tool === "marquee") {
      if (!inBounds(p)) {
        onSelectionCommit(null, "Deselect");
        return;
      }
      if (selection && inSelectionCache(buildSelectionCache(selection), p.x, p.y)) {
        ptr.marqueeMove = {
          startSel: selection,
          startX: p.x,
          startY: p.y,
          scratch: null,
        };
      } else {
        ptr.marqueeAnchor = p;
        onSelectionPreview(rectSelection({ x: p.x, y: p.y, w: 1, h: 1 }));
      }
      return;
    }

    // Lasso: collect points; close + rasterize on pointerup.
    if (tool === "lasso") {
      if (!inBounds(p)) {
        onSelectionCommit(null, "Deselect");
        return;
      }
      ptr.lasso = [{ x: p.x, y: p.y }];
      return;
    }

    // Magic wand: flood-fill on the active layer.
    if (tool === "wand") {
      if (!inBounds(p)) {
        onSelectionCommit(null, "Deselect");
        return;
      }
      const sel = magicWand(activeLayer(doc), p.x, p.y, wandTolerance);
      onSelectionCommit(sel, "Magic wand");
      return;
    }

    // Fill bucket: flood-fill recolor on the active layer.
    if (tool === "fill") {
      if (!inBounds(p) || activeLayer(doc).locked) return;
      const rec = beginStroke(doc, "Fill");
      const { color, fillTolerance } = propsRef.current;
      const bbox = fillFlood(
        activeLayer(doc),
        p.x,
        p.y,
        color,
        fillTolerance,
        selection,
      );
      if (bbox) rec.touch(bbox.x, bbox.y, bbox.w, bbox.h);
      rec.commit();
      composite(doc);
      return;
    }

    if (activeLayer(doc).locked) return;
    ptr.stroke = beginStroke(
      doc,
      tool === "eraser" ? "Eraser" : "Brush",
    );
    ptr.strokeMask = buildSelectionCache(selection);
    ptr.lastDoc = p;
    if (inBounds(p)) paint(p);
  }

  function onPointerMove(e: React.PointerEvent) {
    const ptr = pointerRef.current;
    const { floating, onFloatingChange } = propsRef.current;
    const p = toDoc(e);
    hoverRef.current = inBounds(p) ? p : null;

    if (ptr.panning) {
      panRef.current.x += e.clientX - ptr.lastScreen.x;
      panRef.current.y += e.clientY - ptr.lastScreen.y;
      ptr.lastScreen = { x: e.clientX, y: e.clientY };
      return;
    }
    if (floating && ptr.floatMove) {
      const pf = toDocF(e);
      onFloatingChange({
        ...floating,
        x: pf.x - ptr.floatMove.dx,
        y: pf.y - ptr.floatMove.dy,
      });
      return;
    }
    if (floating && ptr.floatScale) {
      const pf = toDocF(e);
      const d = ptr.floatScale;
      // Uniform scale anchored at the opposite corner, aspect preserved.
      const sx = Math.abs(pf.x - d.anchorX) / d.origW;
      const sy = Math.abs(pf.y - d.anchorY) / d.origH;
      const s = Math.max(0.02, Math.max(sx, sy));
      const w = d.origW * s;
      const h = d.origH * s;
      onFloatingChange({
        ...floating,
        w,
        h,
        x: pf.x < d.anchorX ? d.anchorX - w : d.anchorX,
        y: pf.y < d.anchorY ? d.anchorY - h : d.anchorY,
      });
      return;
    }
    if (floating && ptr.floatEdge) {
      const pf = toDocF(e);
      const d = ptr.floatEdge;
      // Axis-only scale anchored on the opposite edge; doesn't preserve
      // aspect. Stretch / squash along one direction.
      if (d.edge === "n" || d.edge === "s") {
        const h = Math.max(0.5, Math.abs(pf.y - d.anchor));
        const y = pf.y < d.anchor ? d.anchor - h : d.anchor;
        onFloatingChange({ ...floating, y, h });
      } else {
        const w = Math.max(0.5, Math.abs(pf.x - d.anchor));
        const x = pf.x < d.anchor ? d.anchor - w : d.anchor;
        onFloatingChange({ ...floating, x, w });
      }
      return;
    }
    if (ptr.marqueeAnchor) {
      const a = ptr.marqueeAnchor;
      const x = Math.min(a.x, p.x);
      const y = Math.min(a.y, p.y);
      const w = Math.abs(p.x - a.x) + 1;
      const h = Math.abs(p.y - a.y) + 1;
      propsRef.current.onSelectionPreview(rectSelection({ x, y, w, h }));
      return;
    }
    if (ptr.marqueeMove) {
      const move = ptr.marqueeMove;
      // Reuse one canvas across the whole drag so we don't allocate
      // a new doc-sized mask per pointermove.
      if (!move.scratch && move.startSel.mask) {
        move.scratch = document.createElement("canvas");
      }
      propsRef.current.onSelectionPreview(
        translateSelection(
          move.startSel,
          p.x - move.startX,
          p.y - move.startY,
          move.scratch ?? undefined,
        ),
      );
      return;
    }
    if (ptr.lasso) {
      // Sample sparingly — pointermove fires per-pixel at high zoom.
      const last = ptr.lasso[ptr.lasso.length - 1];
      if (last.x !== p.x || last.y !== p.y) ptr.lasso.push({ x: p.x, y: p.y });
      return;
    }
    if (ptr.stroke && ptr.lastDoc) {
      paintLine(ptr.lastDoc, p);
      ptr.lastDoc = p;
    }
  }

  function onPointerUp() {
    const ptr = pointerRef.current;
    ptr.panning = false;
    // Move tool: on release, commit the floating to the active layer.
    if (
      propsRef.current.tool === "move" &&
      propsRef.current.floating &&
      ptr.floatMove
    ) {
      propsRef.current.onFloatingCommit();
    }
    ptr.floatMove = null;
    ptr.floatScale = null;
    ptr.floatEdge = null;
    if (ptr.marqueeAnchor) {
      const sel = propsRef.current.selection;
      if (sel && sel.bounds.w <= 1 && sel.bounds.h <= 1) {
        // Zero-area drag = deselect.
        propsRef.current.onSelectionCommit(null, "Deselect");
      } else if (sel) {
        propsRef.current.onSelectionCommit(sel, "Rectangle marquee");
      }
      ptr.marqueeAnchor = null;
    }
    if (ptr.marqueeMove) {
      // Commit through onSelectionCommit; the recordSelection helper clones
      // the mask, so leaking the scratch ref to history can't happen.
      propsRef.current.onSelectionCommit(
        propsRef.current.selection,
        "Move marquee",
      );
      ptr.marqueeMove = null;
    }
    if (ptr.lasso) {
      const pts = ptr.lasso;
      ptr.lasso = null;
      const { doc } = propsRef.current;
      const sel = lassoSelection(doc.canvas.width, doc.canvas.height, pts);
      propsRef.current.onSelectionCommit(sel, sel ? "Lasso" : "Deselect");
    }
    if (ptr.stroke) {
      ptr.stroke.commit();
      ptr.stroke = null;
      ptr.strokeMask = null;
      ptr.lastDoc = null;
      propsRef.current.onStrokeEnd();
    }
  }

  function onWheel(e: React.WheelEvent) {
    const { zoom, onZoom } = propsRef.current;
    const idx = ZOOM_LEVELS.indexOf(zoom);
    const next =
      ZOOM_LEVELS[
        Math.max(0, Math.min(ZOOM_LEVELS.length - 1, idx + (e.deltaY < 0 ? 1 : -1)))
      ];
    if (next === zoom) return;
    // Anchor the zoom at the cursor position.
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const pan = panRef.current;
    pan.x = cx - ((cx - pan.x) / zoom) * next;
    pan.y = cy - ((cy - pan.y) / zoom) * next;
    onZoom(next);
  }

  const cursor =
    props.tool === "pan"
      ? "grab"
      : props.floating
        ? "move"
        : props.tool === "move"
          ? "move"
          : props.tool === "wand" || props.tool === "fill"
            ? "default"
            : "crosshair";

  return (
    <div ref={wrapRef} className="editor-canvas-wrap checkerboard">
      <canvas
        ref={canvasRef}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => (hoverRef.current = null)}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
