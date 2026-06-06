// Windowed card grid: renders only visible rows (+overscan). Hand-rolled —
// fixed card size makes the math trivial, no dependency needed.

import { useEffect, useRef, useState } from "react";
import type { CatalogEntry } from "../../lib/catalog/types";
import { EntryCard } from "./EntryCard";

const CARD_W = 168; // incl. gap
const CARD_H = 200;
const OVERSCAN_ROWS = 2;

export function VirtualGrid({ entries }: { entries: CatalogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 800, h: 600, scrollTop: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setViewport({
        w: el.clientWidth,
        h: el.clientHeight,
        scrollTop: el.scrollTop,
      });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);

  const cols = Math.max(1, Math.floor((viewport.w - 16) / CARD_W));
  const rows = Math.ceil(entries.length / cols);
  const firstRow = Math.max(
    0,
    Math.floor(viewport.scrollTop / CARD_H) - OVERSCAN_ROWS,
  );
  const lastRow = Math.min(
    rows,
    Math.ceil((viewport.scrollTop + viewport.h) / CARD_H) + OVERSCAN_ROWS,
  );

  const visible: { entry: CatalogEntry; row: number; col: number }[] = [];
  for (let row = firstRow; row < lastRow; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      if (i >= entries.length) break;
      visible.push({ entry: entries[i], row, col });
    }
  }

  return (
    <div ref={ref} className="virtual-grid">
      <div style={{ position: "relative", height: rows * CARD_H }}>
        {visible.map(({ entry, row, col }) => (
          <div
            key={entry.key}
            style={{
              position: "absolute",
              top: row * CARD_H,
              left: col * CARD_W + 8,
              width: CARD_W - 12,
              height: CARD_H - 12,
            }}
          >
            <EntryCard entry={entry} />
          </div>
        ))}
      </div>
    </div>
  );
}
