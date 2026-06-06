import { useEffect } from "react";
import { useAppStore, type RailCategory } from "../../app/store";
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
import { Editor } from "../editor/Editor";
import { Home } from "../home/Home";
import { WorkTabView } from "../work/WorkTabView";

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
  const closeTab = useAppStore((s) => s.closeTab);
  const home = useAppStore((s) => s.home);
  const setHome = useAppStore((s) => s.setHome);
  const query = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const editing = useAppStore((s) => s.editing);
  const catalog = useAppStore((s) => s.catalog);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

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
        closeTab(activeTab.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs, activeTabId, activeTab, setActiveTab, closeTab]);

  return (
    <div className="workbench">
      <header className="appbar">
        <span className="app-logo" title="Basement Suite">
          BS
        </span>
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
                if (e.button === 1) closeTab(t.id);
              }}
            >
              <button className="doc-tab-label" onClick={() => setActiveTab(t.id)}>
                {t.title}
              </button>
              <button
                className="doc-tab-close"
                title="Close (Ctrl+W)"
                onClick={() => closeTab(t.id)}
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

        {editing && (
          <section className="pane pane-editor">
            <Editor
              key={`${editing.sheetPath}|${editing.anm2Path}`}
              target={editing}
            />
          </section>
        )}

        <main className="shell-content">
          {activeTab ? <WorkTabView key={activeTab.id} tab={activeTab} /> : <Home />}
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
        <span title="Last used mod folder">
          mod: {localStorage.getItem("bs:lastModName") ?? "—"}
        </span>
      </footer>
    </div>
  );
}
