import { useEffect, useRef, useState } from "react";
import type { Rgba } from "../../lib/anm2/types";
import { CloseIcon } from "../../app/icons";

interface HSV { h: number; s: number; v: number }
interface RGB { r: number; g: number; b: number }

function rgbToHsv(r: number, g: number, b: number): HSV {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): RGB {
  const c = v * s;
  const hh = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let R = 0, G = 0, B = 0;
  if (hh < 1) { R = c; G = x; }
  else if (hh < 2) { R = x; G = c; }
  else if (hh < 3) { G = c; B = x; }
  else if (hh < 4) { G = x; B = c; }
  else if (hh < 5) { R = x; B = c; }
  else { R = c; B = x; }
  const m = v - c;
  return {
    r: Math.round((R + m) * 255),
    g: Math.round((G + m) * 255),
    b: Math.round((B + m) * 255),
  };
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `${h(r)}${h(g)}${h(b)}`;
}

function fromHex(s: string): RGB | null {
  const m = s.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

const SWATCH_PRESETS: RGB[] = [
  { r: 0, g: 0, b: 0 },
  { r: 255, g: 255, b: 255 },
  { r: 127, g: 127, b: 127 },
  { r: 220, g: 50, b: 50 },
  { r: 240, g: 140, b: 40 },
  { r: 240, g: 210, b: 60 },
  { r: 70, g: 180, b: 70 },
  { r: 50, g: 150, b: 220 },
  { r: 90, g: 70, b: 180 },
  { r: 200, g: 80, b: 180 },
  { r: 120, g: 75, b: 40 },
  { r: 255, g: 200, b: 170 },
];

interface Props {
  initial: Rgba;
  title?: string;
  onCommit: (c: Rgba) => void;
  onCancel: () => void;
}

export function ColorPicker({ initial, title = "Color Picker", onCommit, onCancel }: Props) {
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(initial.r, initial.g, initial.b));
  const [alpha, setAlpha] = useState<number>(initial.a);
  const [hexInput, setHexInput] = useState<string>(() => toHex(initial));

  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);

  const svRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);

  // SV square: pure hue base + white→transparent horizontal + transparent→black vertical
  useEffect(() => {
    const canvas = svRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const pure = hsvToRgb(hsv.h, 1, 1);
    ctx.fillStyle = `rgb(${pure.r},${pure.g},${pure.b})`;
    ctx.fillRect(0, 0, w, h);
    const wg = ctx.createLinearGradient(0, 0, w, 0);
    wg.addColorStop(0, "rgba(255,255,255,1)");
    wg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "rgba(0,0,0,0)");
    bg.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }, [hsv.h]);

  // Hue strip
  useEffect(() => {
    const canvas = hueRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (let i = 0; i <= 6; i++) {
      const hue = (i * 60) % 360;
      const c = hsvToRgb(hue, 1, 1);
      g.addColorStop(i / 6, `rgb(${c.r},${c.g},${c.b})`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, []);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onCommit({ ...rgb, a: alpha });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onCommit, rgb, alpha]);

  const onSvPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.type !== "pointerdown" && e.buttons === 0) return;
    const canvas = svRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const s = rect.width === 0 ? 0 : x / rect.width;
    const v = rect.height === 0 ? 0 : 1 - y / rect.height;
    setHsv((p) => ({ h: p.h, s, v }));
    setHexInput(toHex(hsvToRgb(hsv.h, s, v)));
    if (e.type === "pointerdown") {
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }
  };

  const onHuePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.type !== "pointerdown" && e.buttons === 0) return;
    const canvas = hueRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const h = rect.height === 0 ? 0 : (y / rect.height) * 360;
    setHsv((p) => ({ h, s: p.s, v: p.v }));
    setHexInput(toHex(hsvToRgb(h, hsv.s, hsv.v)));
    if (e.type === "pointerdown") {
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }
  };

  const setR = (n: number) => {
    const r = Math.max(0, Math.min(255, n | 0));
    setHsv(rgbToHsv(r, rgb.g, rgb.b));
    setHexInput(toHex({ r, g: rgb.g, b: rgb.b }));
  };
  const setG = (n: number) => {
    const g = Math.max(0, Math.min(255, n | 0));
    setHsv(rgbToHsv(rgb.r, g, rgb.b));
    setHexInput(toHex({ r: rgb.r, g, b: rgb.b }));
  };
  const setB = (n: number) => {
    const b = Math.max(0, Math.min(255, n | 0));
    setHsv(rgbToHsv(rgb.r, rgb.g, b));
    setHexInput(toHex({ r: rgb.r, g: rgb.g, b }));
  };

  const previewNew = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
  const previewOld = `rgb(${initial.r},${initial.g},${initial.b})`;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal color-picker-modal">
        <div className="color-picker-head">
          <h2>{title}</h2>
          <button className="rail-btn" title="Close (Esc)" onClick={onCancel}>
            <CloseIcon />
          </button>
        </div>
        <div className="color-picker-body">
          <div className="color-picker-sv">
            <canvas
              ref={svRef}
              width={236}
              height={236}
              onPointerDown={onSvPointer}
              onPointerMove={onSvPointer}
            />
            <div
              className="color-picker-sv-dot"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
              }}
            />
          </div>
          <div className="color-picker-hue">
            <canvas
              ref={hueRef}
              width={18}
              height={236}
              onPointerDown={onHuePointer}
              onPointerMove={onHuePointer}
            />
            <div
              className="color-picker-hue-mark"
              style={{ top: `${(hsv.h / 360) * 100}%` }}
            />
          </div>
          <div className="color-picker-side">
            <div className="color-picker-preview">
              <div
                className="color-picker-preview-new"
                style={{ background: previewNew }}
                title="New"
              />
              <div
                className="color-picker-preview-old"
                style={{ background: previewOld }}
                title="Previous"
              />
            </div>
            <label className="cp-field">
              <span>H</span>
              <input
                type="number"
                min={0}
                max={360}
                value={Math.round(hsv.h)}
                onChange={(e) => {
                  const h = Math.max(0, Math.min(360, Number(e.target.value) || 0));
                  setHsv({ h, s: hsv.s, v: hsv.v });
                  setHexInput(toHex(hsvToRgb(h, hsv.s, hsv.v)));
                }}
              />
              <span className="cp-unit">°</span>
            </label>
            <label className="cp-field">
              <span>S</span>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(hsv.s * 100)}
                onChange={(e) => {
                  const s = Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100;
                  setHsv({ h: hsv.h, s, v: hsv.v });
                  setHexInput(toHex(hsvToRgb(hsv.h, s, hsv.v)));
                }}
              />
              <span className="cp-unit">%</span>
            </label>
            <label className="cp-field">
              <span>V</span>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(hsv.v * 100)}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100;
                  setHsv({ h: hsv.h, s: hsv.s, v });
                  setHexInput(toHex(hsvToRgb(hsv.h, hsv.s, v)));
                }}
              />
              <span className="cp-unit">%</span>
            </label>
            <div className="cp-divider" />
            <label className="cp-field">
              <span>R</span>
              <input
                type="number"
                min={0}
                max={255}
                value={rgb.r}
                onChange={(e) => setR(Number(e.target.value) || 0)}
              />
            </label>
            <label className="cp-field">
              <span>G</span>
              <input
                type="number"
                min={0}
                max={255}
                value={rgb.g}
                onChange={(e) => setG(Number(e.target.value) || 0)}
              />
            </label>
            <label className="cp-field">
              <span>B</span>
              <input
                type="number"
                min={0}
                max={255}
                value={rgb.b}
                onChange={(e) => setB(Number(e.target.value) || 0)}
              />
            </label>
            <label className="cp-field cp-field-hex">
              <span>#</span>
              <input
                type="text"
                spellCheck={false}
                value={hexInput}
                onChange={(e) => {
                  setHexInput(e.target.value);
                  const c = fromHex(e.target.value);
                  if (c) setHsv(rgbToHsv(c.r, c.g, c.b));
                }}
              />
            </label>
            <label className="cp-field">
              <span>A</span>
              <input
                type="number"
                min={0}
                max={255}
                value={alpha}
                onChange={(e) =>
                  setAlpha(Math.max(0, Math.min(255, Number(e.target.value) || 0)))
                }
              />
            </label>
          </div>
        </div>
        <div className="color-picker-swatches">
          {SWATCH_PRESETS.map((c) => (
            <button
              key={`${c.r}-${c.g}-${c.b}`}
              className="color-picker-preset"
              style={{ background: `rgb(${c.r},${c.g},${c.b})` }}
              title={`#${toHex(c)}`}
              onClick={() => {
                setHsv(rgbToHsv(c.r, c.g, c.b));
                setHexInput(toHex(c));
              }}
            />
          ))}
        </div>
        <div className="modal-actions">
          <button className="modal-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="modal-btn primary"
            onClick={() => onCommit({ ...rgb, a: alpha })}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
