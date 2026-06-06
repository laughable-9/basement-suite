import { useEffect, useState } from "react";
import { pngUrl, readText } from "../../lib/fsx/fs";
import { peekAnm2, type Anm2Peek } from "../../lib/anm2/peek";
import { useAppStore } from "../../app/store";

export function DetailPane() {
  const selected = useAppStore((s) => s.selected);

  if (!selected) {
    return (
      <div className="detail-empty">
        Select a spritesheet or .anm2 file on the left
      </div>
    );
  }
  return selected.kind === "png" ? (
    <PngDetail key={selected.path} path={selected.path} name={selected.name} />
  ) : (
    <Anm2Detail key={selected.path} path={selected.path} name={selected.name} />
  );
}

function PngDetail({ path, name }: { path: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pngUrl(path).then(setUrl, (e) => setError(String(e)));
  }, [path]);

  if (error) return <div className="detail-error">{error}</div>;
  return (
    <div className="detail">
      <h2>{name}</h2>
      <div className="detail-meta">{dims}</div>
      <div className="checkerboard">
        {url && (
          <img
            className="pixelated"
            src={url}
            alt={name}
            onLoad={(e) =>
              setDims(
                `${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`,
              )
            }
          />
        )}
      </div>
    </div>
  );
}

function Anm2Detail({ path, name }: { path: string; name: string }) {
  const [peek, setPeek] = useState<Anm2Peek | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readText(path).then(
      (xml) => setPeek(peekAnm2(xml)),
      (e) => setError(String(e)),
    );
  }, [path]);

  if (error) return <div className="detail-error">{error}</div>;
  if (!peek) return <div className="detail-empty">Loading…</div>;

  return (
    <div className="detail">
      <h2>{name}</h2>
      <div className="detail-meta">
        {peek.fps} fps · {peek.animations.length} animation
        {peek.animations.length === 1 ? "" : "s"}
      </div>
      <table className="anim-table">
        <thead>
          <tr>
            <th>Animation</th>
            <th>Frames</th>
            <th>Loop</th>
          </tr>
        </thead>
        <tbody>
          {peek.animations.map((a, i) => (
            <tr key={`${a.name}-${i}`}>
              <td>
                {a.name}
                {a.name === peek.defaultAnimation && (
                  <span className="default-badge">default</span>
                )}
              </td>
              <td>{a.frameNum}</td>
              <td>{a.loop ? "↻" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Spritesheets</h3>
      <ul className="sheet-list">
        {peek.spritesheets.map((s, i) => (
          <li key={`${s}-${i}`}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
