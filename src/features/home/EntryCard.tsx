import { useEffect, useRef, useState } from "react";
import { tabFromEntry, useAppStore, type WorkTab } from "../../app/store";
import type { CatalogEntry } from "../../lib/catalog/types";
import { subscribeSheet } from "../../lib/sheets/store";
import { drawThumb, thumbScene, type ThumbScene } from "./renderThumb";
import { thumbUrl } from "./thumbs";

export function EntryCard({ entry }: { entry: CatalogEntry }) {
  const paths = useAppStore((s) => s.paths);
  const openTab = useAppStore((s) => s.openTab);
  if (!paths) return null;
  const tab = tabFromEntry(entry, paths.gfxRoot);

  return (
    <button
      className="entry-card"
      title={entry.anm2Path ?? entry.sheetPath ?? entry.name}
      onClick={() => openTab(tab)}
    >
      <span className="entry-thumb checkerboard">
        {tab.anm2Path ? <AnimThumb tab={tab} /> : <PngThumb tab={tab} />}
      </span>
      <span className="entry-name">{entry.name}</span>
    </button>
  );
}

/** Rendered first frame of the default animation; plays while hovered. */
function AnimThumb({ tab }: { tab: WorkTab }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ThumbScene | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const unsubs: (() => void)[] = [];

    const observer = new IntersectionObserver(([hit]) => {
      if (!hit.isIntersecting) return;
      observer.disconnect();
      thumbScene(tab).then((scene) => {
        if (cancelled || !scene) return;
        sceneRef.current = scene;
        drawThumb(canvas, scene, 0);
        // Live link: editing a sheet redraws the static frame.
        for (const p of scene.sheetPaths) {
          unsubs.push(
            subscribeSheet(p, () => {
              if (!rafRef.current) drawThumb(canvas, scene, 0);
            }),
          );
        }
      });
    });
    observer.observe(canvas);
    return () => {
      cancelled = true;
      observer.disconnect();
      unsubs.forEach((u) => u());
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [tab.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function startPlayback() {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene || rafRef.current) return;
    const start = performance.now();
    const step = (now: number) => {
      const t =
        (((now - start) / 1000) * scene.fps) % Math.max(1, scene.anim.frameNum);
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
    <canvas
      ref={canvasRef}
      width={112}
      height={88}
      className="entry-thumb-canvas"
      onMouseEnter={startPlayback}
      onMouseLeave={stopPlayback}
    />
  );
}

/** Plain image fallback for png-only entries (items, backdrops, UI art). */
function PngThumb({ tab }: { tab: WorkTab }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const observer = new IntersectionObserver(([hit]) => {
      if (hit.isIntersecting) {
        observer.disconnect();
        thumbUrl(tab).then((u) => !cancelled && setUrl(u));
      }
    });
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [tab.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span ref={ref} className="entry-thumb-img">
      {url ? <img src={url} alt="" loading="lazy" /> : <span className="entry-thumb-blank" />}
    </span>
  );
}
