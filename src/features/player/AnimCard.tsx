// One animation in the AnimGrid — rendered static thumbnail (first frame).
// The card's name label is enough to identify it; no hover-play (would distract).
// Live link still wired: editing a sheet redraws the resting thumb.

import { useEffect, useRef } from "react";
import { subscribeSheet } from "../../lib/sheets/store";
import { buildAnimScene, drawThumb, type ThumbScene } from "../home/renderThumb";

interface Props {
  /** Scene tied to this card's animation source (player anm2 OR costume anm2) */
  baseScene: ThumbScene;
  animName: string;
  frameNum: number;
  loops: boolean;
  isDefault: boolean;
  sheets: string[];
  selected: boolean;
  onSelect: () => void;
}

export function AnimCard({
  baseScene,
  animName,
  frameNum,
  loops,
  isDefault,
  sheets,
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

  const sheetsLabel = sheets.join(", ");
  return (
    <button
      className={`anim-card${selected ? " selected" : ""}`}
      onClick={onSelect}
      title={
        sheets.length > 0 ? `${animName}\nSheets: ${sheetsLabel}` : animName
      }
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
      {sheets.length > 0 && (
        <span className="anim-card-sheets" title={sheetsLabel}>
          {sheetsLabel}
        </span>
      )}
    </button>
  );
}
