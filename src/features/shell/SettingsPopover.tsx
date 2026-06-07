import { useEffect, useRef } from "react";
import { useAppStore } from "../../app/store";

export function SettingsPopover({ onClose }: { onClose: () => void }) {
  const paths = useAppStore((s) => s.paths);
  const catalog = useAppStore((s) => s.catalog);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="settings-popover">
      <h3>Paths</h3>
      <dl className="settings-paths">
        <dt>Game gfx</dt>
        <dd title={paths?.gfxRoot}>{paths?.gfxRoot ?? "—"}</dd>
        <dt>Mods folder</dt>
        <dd title={paths?.modsPath}>{paths?.modsPath ?? "—"}</dd>
      </dl>
      <p className="settings-note">
        Paths come from <code>bs.config.json</code> in the project root — edit
        it there and restart the app.
      </p>
      <h3>Catalog</h3>
      <p className="settings-note">
        {catalog
          ? `${catalog.entries.length} entries · ${catalog.warnings.length} skipped rows`
          : "still building…"}
      </p>
      <p className="settings-about">
        Basement Suite · pixel editor + anm2 previewer for Isaac modding
      </p>
    </div>
  );
}
