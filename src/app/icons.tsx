// Icon palette. Two families coexist:
//
//   * Lucide (MIT, lucide.dev) for everything tool-shaped: editor tool
//     rail, options-strip actions, transport, layer/history panels. They
//     read viewBox="0 0 24 24" with stroke-2, matching the source set.
//
//   * Hand-rolled 16×16 stroke icons for the Home category sidebar
//     (Characters, Tears, Familiars, etc.) and a few app-shell glyphs.
//     Those are intentionally chunky and project-specific.
//
// Steam logo is Simple Icons (CC0). Mixing libraries inside one app is
// fine when each is being used for what it's good at.

interface IconProps {
  size?: number;
}

/* ---------------- Lucide (24×24 stroke-2) ---------------- */

function lc(path: React.ReactNode, { size = 19 }: IconProps = {}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

/* ---------------- Hand-rolled (16×16 stroke-1.4) ---------------- */

function svg(path: React.ReactNode, { size = 19 }: IconProps = {}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

/* ============ editor — tool rail ============ */

/** Photoshop's Move tool: arrow cursor with a small crosshair badge. */
export const MoveToolIcon = () =>
  lc(<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" />);

export const BrushIcon = () =>
  lc(
    <>
      <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
    </>,
  );

/** Pencil glyph for "edit sheet" affordances in the player Sheets panel. */
export const PencilIcon = () =>
  lc(
    <>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </>,
  );

export const EraserIcon = () =>
  lc(
    <>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </>,
  );

export const DropperIcon = () =>
  lc(
    <>
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.121 2.121 0 1 1 3 3L18 9l.4.4a2.121 2.121 0 1 1-3 3l-3.8-3.8a2.121 2.121 0 1 1 3-3l.4.4z" />
    </>,
  );

export const FillIcon = () =>
  lc(
    <>
      <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
      <path d="m5 2 5 5" />
      <path d="M2 13h15" />
      <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
    </>,
  );

/** Lucide "square-dashed" — dashed-corner rectangle. */
export const MarqueeIcon = () =>
  lc(
    <>
      <path d="M5 3a2 2 0 0 0-2 2" />
      <path d="M19 3a2 2 0 0 1 2 2" />
      <path d="M21 19a2 2 0 0 1-2 2" />
      <path d="M5 21a2 2 0 0 1-2-2" />
      <path d="M9 3h1" />
      <path d="M9 21h1" />
      <path d="M14 3h1" />
      <path d="M14 21h1" />
      <path d="M3 9v1" />
      <path d="M21 9v1" />
      <path d="M3 14v1" />
      <path d="M21 14v1" />
    </>,
  );

export const LassoIcon = () =>
  lc(
    <>
      <path d="M7 22a5 5 0 0 1-2-4" />
      <path d="M3.3 14A6.8 6.8 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1" />
      <circle cx="5" cy="20" r="2" />
    </>,
  );

/** Magic wand — Lucide "wand-sparkles" with the sparkles trimmed to keep
 *  the tool rail clean. */
export const WandIcon = () =>
  lc(
    <>
      <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z" />
      <path d="m14 7 3 3" />
      <path d="M10 2v2" />
      <path d="M7 8H3" />
    </>,
  );

/** Pan / Hand tool. */
export const MoveIcon = () =>
  lc(
    <>
      <path d="M18 11V6a2 2 0 0 0-4 0v5" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </>,
  );

/** Free Transform — Lucide "scaling". */
export const TransformIcon = () =>
  lc(
    <>
      <path d="M21 3 9 15" />
      <path d="M12 3H3v18h18v-9" />
      <path d="M16 3h5v5" />
      <path d="M14 15H9v-5" />
    </>,
  );

/* ============ editor — actions ============ */

export const UndoIcon = () =>
  lc(
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
    </>,
  );

export const RedoIcon = () =>
  lc(
    <>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
    </>,
  );

export const GridIcon = () =>
  lc(
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </>,
  );

export const CloseIcon = () =>
  lc(
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>,
  );

export const PaletteIcon = () =>
  lc(
    <>
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" stroke="none" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </>,
  );

/** Mirror brush toggle — Lucide "flip-horizontal". */
export const MirrorIcon = () =>
  lc(
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M12 20v2" />
      <path d="M12 14v2" />
      <path d="M12 8v2" />
      <path d="M12 2v2" />
    </>,
  );

/** Swap (Photoshop's FG/BG toggle). Lucide "arrow-left-right" turned diagonal. */
export const SwapArrowsIcon = ({ size = 12 }: IconProps = {}) =>
  lc(
    <>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </>,
    { size },
  );

/* ============ player transport ============ */

export const PlayIcon = () =>
  lc(<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" />);

export const PauseIcon = () =>
  lc(
    <>
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
    </>,
  );

export const LoopIcon = () =>
  lc(
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>,
  );

/** Onion skin — Lucide "layers-2". */
export const OnionIcon = () =>
  lc(
    <>
      <path d="m16.02 12 5.48 3.13a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74L7.98 12" />
      <path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74Z" />
    </>,
  );

/** Frame strip — Lucide "film". */
export const FilmStripIcon = () =>
  lc(
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M3 7.5h4" />
      <path d="M3 12h18" />
      <path d="M3 16.5h4" />
      <path d="M17 3v18" />
      <path d="M17 7.5h4" />
      <path d="M17 16.5h4" />
    </>,
  );

/** Zoom — Lucide "search". */
export const MagnifierIcon = () =>
  lc(
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>,
  );

/* ============ panels / common ============ */

export const PlusIcon = () =>
  lc(
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>,
  );

export const EyeIcon = () =>
  lc(
    <>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </>,
  );

export const EyeOffIcon = () =>
  lc(
    <>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </>,
  );

export const ChevronUpIcon = () => lc(<path d="m18 15-6-6-6 6" />);
export const ChevronDownIcon = () => lc(<path d="m6 9 6 6 6-6" />);

export const LockIcon = () =>
  lc(
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>,
  );

export const UnlockIcon = () =>
  lc(
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </>,
  );

export const CopyIcon = () =>
  lc(
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>,
  );

export const TrashIcon = () =>
  lc(
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>,
  );

/* ============ app shell ============ */

export const HomeIcon = () =>
  lc(
    <>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>,
  );

export const SearchIcon = () =>
  lc(
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>,
  );

export const GearIcon = () =>
  lc(
    <>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  );

export const FolderIcon = () =>
  lc(<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />);

/** Folder with a gear — the Mods tab. */
export const FolderGearIcon = () =>
  lc(
    <>
      <path d="M19 6.5a2 2 0 0 0-2-2h-5l-2-2H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6" />
      <circle cx="18" cy="18" r="3" />
      <path d="M18 14v1" />
      <path d="M18 21v1" />
      <path d="m22 18-1 0" />
      <path d="m15 18-1 0" />
      <path d="m21 15-.7.7" />
      <path d="m15.7 20.3-.7.7" />
      <path d="m21 21-.7-.7" />
      <path d="m15.7 15.7-.7-.7" />
    </>,
  );

/* ============ Home category rail (kept as-is — hand-rolled) ============ */

export const PersonIcon = () =>
  svg(
    <>
      <circle cx="8" cy="5" r="2.8" />
      <path d="M2.8 14 C3.4 10.8 5.4 9.4 8 9.4 C10.6 9.4 12.6 10.8 13.2 14" />
    </>,
  );

export const DropIcon = () =>
  svg(<path d="M8 1.8 C10.8 5.4 12.5 7.8 12.5 10 A4.5 4.5 0 0 1 3.5 10 C3.5 7.8 5.2 5.4 8 1.8 Z" />);

export const PawIcon = () =>
  svg(
    <>
      <ellipse cx="4" cy="6" rx="1.3" ry="1.7" />
      <ellipse cx="12" cy="6" rx="1.3" ry="1.7" />
      <ellipse cx="6.5" cy="3.8" rx="1.3" ry="1.7" />
      <ellipse cx="9.5" cy="3.8" rx="1.3" ry="1.7" />
      <path d="M8 8 C10.5 8 12 10 11.5 11.8 C11 13.5 9.5 13.8 8 13.8 C6.5 13.8 5 13.5 4.5 11.8 C4 10 5.5 8 8 8 Z" />
    </>,
  );

export const HeartIcon = () =>
  svg(<path d="M8 13.5 C3 10 2 7.5 2 5.6 C2 3.9 3.4 2.5 5 2.5 C6.3 2.5 7.4 3.3 8 4.4 C8.6 3.3 9.7 2.5 11 2.5 C12.6 2.5 14 3.9 14 5.6 C14 7.5 13 10 8 13.5 Z" />);

export const BoxIcon = () =>
  svg(
    <>
      <path d="M2.5 5 L8 2 L13.5 5 V11 L8 14 L2.5 11 Z" />
      <path d="M2.5 5 L8 8 L13.5 5 M8 8 V14" />
    </>,
  );

export const SkullIcon = () =>
  svg(
    <>
      <path d="M8 1.8 C11.3 1.8 13.5 4.2 13.5 7.2 C13.5 9 12.7 10.2 11.5 11 V13 H4.5 V11 C3.3 10.2 2.5 9 2.5 7.2 C2.5 4.2 4.7 1.8 8 1.8 Z" />
      <circle cx="5.8" cy="7.2" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="10.2" cy="7.2" r="1.2" fill="currentColor" stroke="none" />
      <path d="M6.5 13 V14.2 M9.5 13 V14.2" />
    </>,
  );

export const SparkIcon = () =>
  svg(<path d="M8 1.5 L9.4 6.6 L14.5 8 L9.4 9.4 L8 14.5 L6.6 9.4 L1.5 8 L6.6 6.6 Z" />);

export const ImageIcon = () =>
  svg(
    <>
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M2 11 L6 7.5 L9 10 L11 8.5 L14 11" />
      <circle cx="10.5" cy="6" r="1" />
    </>,
  );

export const WindowIcon = () =>
  svg(
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="1" />
      <path d="M2 5.5 H14" />
      <circle cx="4" cy="4" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="6" cy="4" r="0.6" fill="currentColor" stroke="none" />
    </>,
  );

export const FilmIcon = () =>
  svg(
    <>
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M4.8 3 V13 M11.2 3 V13 M2 6.3 H4.8 M2 9.7 H4.8 M11.2 6.3 H14 M11.2 9.7 H14" />
    </>,
  );

/* ============ brand ============ */

/**
 * Steam logo — Simple Icons SVG path (CC0). For tagging Workshop mods.
 * Source: github.com/simple-icons/simple-icons/blob/develop/icons/steam.svg
 */
export const SteamIcon = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
  </svg>
);
