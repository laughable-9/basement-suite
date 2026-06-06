// Minimal 16px stroke icons for the tool rail (Photoshop-style, our palette).

interface IconProps {
  size?: number;
}

function svg(path: React.ReactNode, { size = 16 }: IconProps = {}) {
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

export const PencilIcon = () =>
  svg(
    <>
      <path d="M3 13 L3.8 10.2 L11 3 L13 5 L5.8 12.2 Z" />
      <path d="M10 4 L12 6" />
    </>,
  );

export const EraserIcon = () =>
  svg(
    <>
      <path d="M5.5 12.5 L2.5 9.5 L8.5 3.5 L12.5 7.5 L7.5 12.5 Z" />
      <path d="M5 13 H13" />
    </>,
  );

export const DropperIcon = () =>
  svg(
    <>
      <path d="M9.5 4.5 L11.5 6.5 L5.5 12.5 L3 13 L3.5 10.5 Z" />
      <path d="M9 3 L10.5 1.5 C11.3 0.7 12.8 0.7 13.5 1.5 C14.3 2.2 14.3 3.7 13.5 4.5 L12 6" />
    </>,
  );

export const CursorIcon = () =>
  svg(<path d="M4 2 L12 9 L8.5 9.5 L10.5 13.5 L8.7 14.3 L6.8 10.3 L4 12.5 Z" />);

export const UndoIcon = () =>
  svg(
    <>
      <path d="M3 6 H10 C12 6 13.5 7.5 13.5 9.5 C13.5 11.5 12 13 10 13 H6" />
      <path d="M6 3 L3 6 L6 9" />
    </>,
  );

export const RedoIcon = () =>
  svg(
    <>
      <path d="M13 6 H6 C4 6 2.5 7.5 2.5 9.5 C2.5 11.5 4 13 6 13 H10" />
      <path d="M10 3 L13 6 L10 9" />
    </>,
  );

export const GridIcon = () =>
  svg(
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="0.5" />
      <path d="M2.5 8 H13.5 M8 2.5 V13.5" />
    </>,
  );

export const CloseIcon = () => svg(<path d="M4 4 L12 12 M12 4 L4 12" />);

export const MoveIcon = () =>
  svg(
    <>
      <path d="M8 1.5 V14.5 M1.5 8 H14.5" />
      <path d="M6.3 3.2 L8 1.5 L9.7 3.2" />
      <path d="M6.3 12.8 L8 14.5 L9.7 12.8" />
      <path d="M3.2 6.3 L1.5 8 L3.2 9.7" />
      <path d="M12.8 6.3 L14.5 8 L12.8 9.7" />
    </>,
  );

export const PlayIcon = () =>
  svg(<path d="M5 3 L12.5 8 L5 13 Z" fill="currentColor" />);

export const PauseIcon = () =>
  svg(
    <>
      <path d="M5.5 3.5 V12.5" strokeWidth="2.4" />
      <path d="M10.5 3.5 V12.5" strokeWidth="2.4" />
    </>,
  );
