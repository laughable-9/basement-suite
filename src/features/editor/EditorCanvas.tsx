import { useEffect, useRef } from "react";
import type { SheetDoc } from "../../lib/sheets/store";
import { beginStroke, type StrokeRecorder } from "./history";
import type { CropRect } from "./cropGrid";
import type { Rgba } from "../../lib/anm2/types";

export type Tool = "pencil" | "eraser" | "eyedropper" | "inspect";

const ZOOM_LEVELS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32];

export interface EditorCanvasProps {
  doc: SheetDoc;
  tool: Tool;
  brushSize: number;
  color: Rgba;
  onPick: (color: Rgba) => void;
  rects: CropRect[];
  showGrid: boolean;
  onJump: (rect: CropRect) => void;
  onStrokeEnd: () => void;
  zoom: number;
  onZoom: (z: number) => void;
}

interface Pointer {
  panning: boolean;
  stroke: StrokeRecorder | null;
  lastDoc: { x: number; y: number } | null;
  lastScreen: { x: number; y: number };
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
  });
  const spaceRef = useRef(false);

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

      const { doc, rects, showGrid, zoom, tool, brushSize } = propsRef.current;
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

      // Brush footprint preview
      const hover = hoverRef.current;
      if (hover && (tool === "pencil" || tool === "eraser")) {
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

  function toDoc(e: React.PointerEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { zoom } = propsRef.current;
    return {
      x: Math.floor((e.clientX - rect.left - panRef.current.x) / zoom),
      y: Math.floor((e.clientY - rect.top - panRef.current.y) / zoom),
    };
  }

  function inBounds(p: { x: number; y: number }): boolean {
    const { doc } = propsRef.current;
    return (
      p.x >= 0 && p.y >= 0 && p.x < doc.canvas.width && p.y < doc.canvas.height
    );
  }

  function paint(p: { x: number; y: number }): void {
    const { doc, tool, brushSize, color } = propsRef.current;
    const o = Math.floor((brushSize - 1) / 2);
    const x = p.x - o;
    const y = p.y - o;
    // Replace semantics (no blending): clear then fill — predictable pixels.
    doc.ctx.clearRect(x, y, brushSize, brushSize);
    if (tool === "pencil" && color.a > 0) {
      doc.ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
      doc.ctx.fillRect(x, y, brushSize, brushSize);
    }
    pointerRef.current.stroke?.touch(x, y, brushSize, brushSize);
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

  function onPointerDown(e: React.PointerEvent) {
    canvasRef.current!.setPointerCapture(e.pointerId);
    const ptr = pointerRef.current;
    ptr.lastScreen = { x: e.clientX, y: e.clientY };

    if (e.button === 1 || spaceRef.current) {
      ptr.panning = true;
      return;
    }
    if (e.button !== 0) return;

    const p = toDoc(e);
    const { tool, doc } = propsRef.current;
    if (tool === "inspect" || e.altKey) {
      if (inBounds(p)) jumpAt(p);
      return;
    }
    if (tool === "eyedropper") {
      if (inBounds(p)) pickColor(p);
      return;
    }
    ptr.stroke = beginStroke(doc);
    ptr.lastDoc = p;
    if (inBounds(p)) paint(p);
  }

  function onPointerMove(e: React.PointerEvent) {
    const ptr = pointerRef.current;
    const p = toDoc(e);
    hoverRef.current = inBounds(p) ? p : null;

    if (ptr.panning) {
      panRef.current.x += e.clientX - ptr.lastScreen.x;
      panRef.current.y += e.clientY - ptr.lastScreen.y;
      ptr.lastScreen = { x: e.clientX, y: e.clientY };
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
    if (ptr.stroke) {
      ptr.stroke.commit();
      ptr.stroke = null;
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
    props.tool === "inspect"
      ? "default"
      : props.tool === "eyedropper"
        ? "crosshair"
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
