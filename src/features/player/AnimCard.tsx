// One animation in the AnimGrid — rendered thumbnail that plays on hover.
// Reuses the Home thumb scene + drawThumb pipeline; the base scene is loaded
// once per tab and shared across all cards, so 39 cards = 1 anm2 parse + 1
// sheet decode pass, not 39.

import { useEffect, useRef } from "react";
import { useAppStore } from "../../app/store";
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
  const rafRef = useRef(0);
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
      // Live link: any sheet edit redraws the resting frame.
      for (const p of sceneRef.current!.sheetPaths) {
        unsubs.push(
          subscribeSheet(p, () => {
            if (disposed) return;
            if (!rafRef.current) drawThumb(canvas, sceneRef.current!, 0);
          }),
        );
      }
    });
    observer.observe(canvas);

    return () => {
      disposed = true;
      observer.disconnect();
      unsubs.forEach((u) => u());
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [baseScene, animName]);

  function startPlayback() {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene || rafRef.current) return;
    const start = performance.now();
    const step = (now: number) => {
      const speed = useAppStore.getState().playbackSpeed;
      const t =
        (((now - start) / 1000) * scene.fps * speed) %
        Math.max(1, scene.anim.frameNum);
      drawThumb(canvas, scene, t);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }

  function stopPlayback() {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (canvas && scene) drawThumb(canvas, scene, 0);
  }

  return (
    <button
      className={`anim-card${selected ? " selected" : ""}`}
      onClick={onSelect}
      onMouseEnter={startPlayback}
      onMouseLeave={stopPlayback}
      title={`${animName} — ${frameNum} frames${loops ? " (loops)" : ""}`}
    >
      <span className="anim-card-thumb checkerboard">
        <canvas ref={canvasRef} className="anim-card-canvas" />
      </span>
      <span className="anim-card-name">
        {animName}
        {isDefault && <span className="default-badge">default</span>}
      </span>
      <span className="anim-card-meta">
        {frameNum}f{loops ? " ↻" : ""}
      </span>
    </button>
  );
}
