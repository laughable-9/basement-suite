import { useCallback, useEffect, useState } from "react";
import {
  useAppStore,
  type RailCategory,
  type WorkTab,
} from "../../app/store";
import { peekSheetDoc, subscribeSheet } from "../../lib/sheets/store";
import { applyIsaacBranding } from "./isaacBranding";
import {
  BoxIcon,
  CloseIcon,
  DropIcon,
  FilmIcon,
  FolderIcon,
  GridIcon,
  HeartIcon,
  HomeIcon,
  ImageIcon,
  PawIcon,
  PersonIcon,
  SearchIcon,
  SkullIcon,
  SparkIcon,
  WindowIcon,
} from "../../app/icons";
import { CATEGORY_LABELS } from "../../lib/catalog/types";
import { Home } from "../home/Home";
import { WorkTabView } from "../work/WorkTabView";

/** Amber dot on tabs whose editing sheet has unsaved changes. */
function TabDirtyDot({ tab }: { tab: WorkTab }) {
  const [, setRev] = useState(0);
  const sheetPath = tab.editing?.sheetPath;

  useEffect(() => {
    if (!sheetPath) return;
    return subscribeSheet(sheetPath, () => setRev((r) => r + 1));
  }, [sheetPath]);

  if (!sheetPath || !peekSheetDoc(sheetPath)?.dirty) return null;
  return <span className="dirty-dot" title="Unsaved edits" />;
}

const RAIL: { id: RailCategory; icon: () => React.ReactNode; label: string }[] =
  [
    { id: "characters", icon: PersonIcon, label: CATEGORY_LABELS.characters },
    { id: "tears", icon: DropIcon, label: CATEGORY_LABELS.tears },
    { id: "familiars", icon: PawIcon, label: CATEGORY_LABELS.familiars },
    { id: "pickups", icon: HeartIcon, label: CATEGORY_LABELS.pickups },
    { id: "items", icon: BoxIcon, label: CATEGORY_LABELS.items },
    { id: "enemies", icon: SkullIcon, label: CATEGORY_LABELS.enemies },
    { id: "effects", icon: SparkIcon, label: CATEGORY_LABELS.effects },
    { id: "grid", icon: GridIcon, label: CATEGORY_LABELS.grid },
    { id: "backdrops", icon: ImageIcon, label: CATEGORY_LABELS.backdrops },
    { id: "ui", icon: WindowIcon, label: CATEGORY_LABELS.ui },
    { id: "cutscenes", icon: FilmIcon, label: CATEGORY_LABELS.cutscenes },
    { id: "files", icon: FolderIcon, label: "Files (raw tree)" },
  ];

export function AppShell() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTabRaw = useAppStore((s) => s.closeTab);

  // Closing a tab with unsaved sheet edits asks first.
  const closeTab = useCallback(
    (tab: WorkTab) => {
      const doc = tab.editing && peekSheetDoc(tab.editing.sheetPath);
      if (doc?.dirty && !confirm(`"${tab.title}" has unsaved edits. Close anyway?`)) {
        return;
      }
      closeTabRaw(tab.id);
    },
    [closeTabRaw],
  );
  const home = useAppStore((s) => s.home);
  const setHome = useAppStore((s) => s.setHome);
  const query = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const catalog = useAppStore((s) => s.catalog);
  const playbackSpeed = useAppStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useAppStore((s) => s.setPlaybackSpeed);
  const [logo, setLogo] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  // Isaac thumbs-up (public/icon.png) as window icon + app-bar logo.
  useEffect(() => {
    applyIsaacBranding().then(setLogo);
  }, []);

  // Ctrl+Tab cycles tabs (incl. Home), Ctrl+W closes the active one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        const ids = ["home", ...tabs.map((t) => t.id)];
        const i = ids.indexOf(activeTabId);
        const next = e.shiftKey
          ? ids[(i - 1 + ids.length) % ids.length]
          : ids[(i + 1) % ids.length];
        setActiveTab(next);
      } else if (e.ctrlKey && e.key.toLowerCase() === "w" && activeTab) {
        e.preventDefault();
        closeTab(activeTab);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs, activeTabId, activeTab, setActiveTab, closeTab]);

  return (
    <div className="workbench">
      <header className="appbar">
        {logo ? (
          <img className="app-logo-img" src={logo} alt="" title="Basement Suite" />
        ) : (
          <span className="app-logo" title="Basement Suite">
            BS
          </span>
        )}
        <nav className="tabstrip">
          <button
            className={`doc-tab${activeTabId === "home" ? " active" : ""}`}
            onClick={() => setActiveTab("home")}
            title="Home — browse everything"
          >
            <HomeIcon />
          </button>
          {tabs.map((t) => (
            <span
              key={t.id}
              className={`doc-tab doc-tab-entity${t.id === activeTabId ? " active" : ""}`}
              onAuxClick={(e) => {
                if (e.button === 1) closeTab(t);
              }}
            >
              <button className="doc-tab-label" onClick={() => setActiveTab(t.id)}>
                {t.title}
              </button>
              <TabDirtyDot tab={t} />
              <button
                className="doc-tab-close"
                title="Close (Ctrl+W)"
                onClick={() => closeTab(t)}
              >
                <CloseIcon />
              </button>
            </span>
          ))}
        </nav>
        <label className="global-search">
          <SearchIcon />
          <input
            placeholder="Search everything…"
            value={query}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchQuery("");
            }}
          />
        </label>
      </header>

      <div className="shell-body">
        <aside className="category-rail">
          {RAIL.map((c) => (
            <button
              key={c.id}
              className={`rail-btn${
                activeTabId === "home" && home.category === c.id ? " active" : ""
              }`}
              title={c.label}
              onClick={() => setHome({ category: c.id, subcategory: null })}
            >
              <c.icon />
            </button>
          ))}
        </aside>

        <main className="shell-content">
          {/* All tabs stay mounted so editor/player state survives switches */}
          <div className="tab-host" hidden={activeTabId !== "home"}>
            <Home />
          </div>
          {tabs.map((t) => (
            <div key={t.id} className="tab-host" hidden={t.id !== activeTabId}>
              <WorkTabView tab={t} active={t.id === activeTabId} />
            </div>
          ))}
        </main>
      </div>

      <footer className="statusbar">
        <span>
          {catalog
            ? `${catalog.entries.length} catalog entries`
            : "building catalog…"}
        </span>
        <span>{tabs.length} open</span>
        <span className="toolbar-spacer" />
        <label className="speed-control" title="Animation playback speed (player + thumbnails)">
          speed
          <input
            type="range"
            min={0.1}
            max={2}
            step={0.1}
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          />
          <span className="speed-value">{playbackSpeed.toFixed(1)}×</span>
        </label>
        <span title="Last used mod folder">
          mod: {localStorage.getItem("bs:lastModName") ?? "—"}
        </span>
      </footer>
    </div>
  );
}
