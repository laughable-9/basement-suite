// One animation in the AnimGrid — rendered static thumbnail (first frame).
// The card's name label is enough to identify it; no hover-play (the user
// found the moving thumbs distracting and the title is already shown).
// Live link still wired: editing a sheet redraws the resting thumb.

import { useEffect, useRef } from "react";
import { subscribeSheet } from "../../lib/sheets/store";
import { buildAnimScene, drawThumb, type ThumbScene } from "../home/renderThumb";

interface Props {
  baseScene: ThumbScene;
  animName: string;
  frameNum: number;
  loops: boolean;
  isDefault: boolean;
  selected: boolean;
  onSelect: () => void;
}

export function AnimCard({
  baseScene,
  animName,
  frameNum,
  loops,
  isDefault,
  selected,
  onSelect,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(buildAnimScene(baseScene, animName));

  useEffect(() => {
    sceneRef.current = buildAnimScene(baseScene, animName);
    const canvas = canvasRef.current;
    if (!canvas || !sceneRef.current) return;

    let disposed = false;
    const unsubs: (() => void)[] = [];

    const observer = new IntersectionObserver(([hit]) => {
      if (!hit.isIntersecting) return;
      observer.disconnect();
      // Match buffer to layout; otherwise canvas stretches the bitmap.
      const box = canvas.parentElement!;
      canvas.width = Math.max(32, box.clientWidth);
      canvas.height = Math.max(32, box.clientHeight);
      drawThumb(canvas, sceneRef.current!, 0);
      for (const p of sceneRef.current!.sheetPaths) {
        unsubs.push(
          subscribeSheet(p, () => {
            if (disposed) return;
            drawThumb(canvas, sceneRef.current!, 0);
          }),
        );
      }
    });
    observer.observe(canvas);

    return () => {
      disposed = true;
      observer.disconnect();
      unsubs.forEach((u) => u());
    };
  }, [baseScene, animName]);

  return (
    <button
      className={`anim-card${selected ? " selected" : ""}`}
      onClick={onSelect}
      title={animName}
    >
      <span className="anim-card-thumb checkerboard">
        <canvas ref={canvasRef} className="anim-card-canvas" />
      </span>
      <span className="anim-card-name">
        {animName}
        {isDefault && <span className="default-badge">default</span>}
      </span>
      <span className="anim-card-meta">
        {frameNum} Frame{frameNum === 1 ? "" : "s"}
        {loops ? " · loops" : ""}
      </span>
    </button>
  );
}
