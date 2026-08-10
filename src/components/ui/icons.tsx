/**
 * Jeu d'icônes maison : traits fins, grille 24, cohérent avec la typographie.
 * Aucune dépendance externe, poids négligeable.
 */

type IconProps = {
  className?: string;
  size?: number;
};

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
}

export const IconToday = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconStudio = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 5v14M10 8v8M16 4v16M22 9v6" />
  </svg>
);

export const IconSession = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="13" r="7" />
    <path d="M12 10v3.5M9 3h6" />
  </svg>
);

export const IconRelease = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

export const IconLabel = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z" />
    <path d="m4 8 8 5 8-5" />
  </svg>
);

export const IconCalendar = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const IconChart = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const IconSettings = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.64 8.6a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
  </svg>
);

export const IconMore = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPlus = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconSearch = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconClose = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconCheck = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

export const IconPlay = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPause = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 4.5h3v15H8zM13 4.5h3v15h-3z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconVolume = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z" />
    <path d="M16 9a4 4 0 0 1 0 6" />
  </svg>
);

export const IconChevronRight = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const IconChevronDown = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="m5 9 7 7 7-7" />
  </svg>
);

export const IconChevronLeft = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);

export const IconTrash = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </svg>
);

export const IconEdit = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 20h4L20 8a2.5 2.5 0 0 0-3.5-3.5L4 16z" />
  </svg>
);

export const IconCopy = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);

export const IconLink = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M10 13a4 4 0 0 0 5.7.3l3-3a4 4 0 0 0-5.7-5.7L11.3 6" />
    <path d="M14 11a4 4 0 0 0-5.7-.3l-3 3a4 4 0 0 0 5.7 5.7L12.7 18" />
  </svg>
);

export const IconWarning = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 4 2.5 20h19z" />
    <path d="M12 10v4M12 17.2v.1" />
  </svg>
);

export const IconFlag = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M5 21V4M5 5h11l-2 3.5L16 12H5" />
  </svg>
);

export const IconClock = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
);

export const IconNote = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M14 4v5h5M8 13h8M8 17h5" />
  </svg>
);

export const IconUpload = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 16V4M8 8l4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
);

export const IconFolder = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const IconMail = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 8 8 5 8-5" />
  </svg>
);

export const IconTarget = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconGrid = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </svg>
);

export const IconList = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);

export const IconFilter = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 5h18l-7 8v6l-4 2v-8z" />
  </svg>
);

export const IconArrowRight = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

export const IconRefresh = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M20 11a8 8 0 1 0-.6 4" />
    <path d="M20 4v7h-7" />
  </svg>
);

export const IconLogout = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h11" />
  </svg>
);

export const IconMusic = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="7" cy="18" r="2.5" />
    <circle cx="18" cy="16" r="2.5" />
    <path d="M9.5 18V7l11-2v11" />
  </svg>
);

export const IconSparks = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 3.5 13.7 9l5.3 1.7-5.3 1.7L12 18l-1.7-5.6L5 10.7 10.3 9z" />
    <path d="M19 4v3M17.5 5.5h3" />
  </svg>
);
