// Virtualized animation card grid — only renders rows currently in view, so
// 49-anim corpus stress files (props_07_the corpse) stay smooth.
// Items can come from multiple anm2s (player + costume-exclusive) so each
// card carries its own baseScene.

import { useEffect, useRef, useState } from "react";
import { AnimCard } from "./AnimCard";
import type { ThumbScene } from "../home/renderThumb";

const CARD_W = 132;
const CARD_H = 172;
const OVERSCAN_ROWS = 2;

export interface AnimItem {
  /** Scene tied to the anm2 owning this animation */
  baseScene: ThumbScene;
  animName: string;
  frameNum: number;
  loops: boolean;
  isDefault: boolean;
}

interface Props {
  items: AnimItem[];
  selectedName: string;
  onSelect: (item: AnimItem) => void;
}

export function AnimGrid({ items, selectedName, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: 800, h: 600, scrollTop: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setVp({
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

  const cols = Math.max(1, Math.floor((vp.w - 16) / CARD_W));
  const rows = Math.ceil(items.length / cols);
  const firstRow = Math.max(
    0,
    Math.floor(vp.scrollTop / CARD_H) - OVERSCAN_ROWS,
  );
  const lastRow = Math.min(
    rows,
    Math.ceil((vp.scrollTop + vp.h) / CARD_H) + OVERSCAN_ROWS,
  );

  const visible: { item: AnimItem; idx: number; row: number; col: number }[] = [];
  for (let row = firstRow; row < lastRow; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      if (i >= items.length) break;
      visible.push({ item: items[i], idx: i, row, col });
    }
  }

  return (
    <div ref={ref} className="anim-grid">
      <div style={{ position: "relative", height: rows * CARD_H }}>
        {visible.map(({ item, idx, row, col }) => (
          <div
            key={`${item.animName}-${idx}`}
            style={{
              position: "absolute",
              top: row * CARD_H,
              left: col * CARD_W + 8,
              width: CARD_W - 12,
              height: CARD_H - 12,
            }}
          >
            <AnimCard
              baseScene={item.baseScene}
              animName={item.animName}
              frameNum={item.frameNum}
              loops={item.loops}
              isDefault={item.isDefault}
              selected={item.animName === selectedName}
              onSelect={() => onSelect(item)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
