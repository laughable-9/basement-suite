// Virtualized animation card grid — only renders rows currently in view, so
// 49-anim corpus stress files (props_07_the corpse) stay smooth.

import { useEffect, useRef, useState } from "react";
import type { Anm2Animation } from "../../lib/anm2/types";
import { AnimCard } from "./AnimCard";
import type { ThumbScene } from "../home/renderThumb";

const CARD_W = 132;
// Tall enough that thumb aspect-ratio:1 + name + meta fit without stretching.
const CARD_H = 172;
const OVERSCAN_ROWS = 2;

interface Props {
  baseScene: ThumbScene;
  animations: Anm2Animation[];
  selectedName: string;
  defaultName: string;
  onSelect: (name: string) => void;
}

export function AnimGrid({
  baseScene,
  animations,
  selectedName,
  defaultName,
  onSelect,
}: Props) {
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
  const rows = Math.ceil(animations.length / cols);
  const firstRow = Math.max(
    0,
    Math.floor(vp.scrollTop / CARD_H) - OVERSCAN_ROWS,
  );
  const lastRow = Math.min(
    rows,
    Math.ceil((vp.scrollTop + vp.h) / CARD_H) + OVERSCAN_ROWS,
  );

  const visible: { anim: Anm2Animation; row: number; col: number }[] = [];
  for (let row = firstRow; row < lastRow; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      if (i >= animations.length) break;
      visible.push({ anim: animations[i], row, col });
    }
  }

  return (
    <div ref={ref} className="anim-grid">
      <div style={{ position: "relative", height: rows * CARD_H }}>
        {visible.map(({ anim, row, col }) => (
          <div
            key={`${anim.name}-${row * cols + col}`}
            style={{
              position: "absolute",
              top: row * CARD_H,
              left: col * CARD_W + 8,
              width: CARD_W - 12,
              height: CARD_H - 12,
            }}
          >
            <AnimCard
              baseScene={baseScene}
              animName={anim.name}
              frameNum={anim.frameNum}
              loops={anim.loop}
              isDefault={anim.name === defaultName}
              selected={anim.name === selectedName}
              onSelect={() => onSelect(anim.name)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
