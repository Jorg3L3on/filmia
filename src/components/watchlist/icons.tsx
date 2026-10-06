import type { SVGProps } from "react";

const base = (size: number): SVGProps<SVGSVGElement> => ({
  viewBox: "0 0 24 24",
  width: size,
  height: size,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export const EyeIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...base(size)}>
    <path d="M2.8 12s3.4-6.4 9.2-6.4S21.2 12 21.2 12s-3.4 6.4-9.2 6.4S2.8 12 2.8 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

export const MoonIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...base(size)}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>
);

export const DotsIcon = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <circle cx="6" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="18" cy="12" r="1.8" />
  </svg>
);

export const SparkIcon = ({ size = 11 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
  </svg>
);

export const ClockIcon = ({ size = 12 }: { size?: number }) => (
  <svg {...base(size)} strokeWidth={2}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l2.5 1.5" />
  </svg>
);

export const LaurelIcon = ({ size = 12 }: { size?: number }) => (
  <svg {...base(size)} strokeWidth={2}>
    <path d="M12 20c-4-1-7-5-7-10 2 0 4 1 5 3M12 20c4-1 7-5 7-10-2 0-4 1-5 3M12 20V9" />
  </svg>
);

export const TvIcon = ({ size = 15 }: { size?: number }) => (
  <svg {...base(size)}>
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M8 21h8" />
  </svg>
);

export const ChevronIcon = ({ size = 14 }: { size?: number }) => (
  <svg {...base(size)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const ReorderIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...base(size)} strokeWidth={2}>
    <path d="M7 4v16M3.5 7.5 7 4l3.5 3.5M17 20V4M13.5 16.5 17 20l3.5-3.5" />
  </svg>
);

export const CheckIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...base(size)} strokeWidth={2.25}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const UpIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...base(size)}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export const PenIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...base(size)}>
    <path d="M4 20h4l10-10-4-4L4 16z" />
    <path d="M13 7l4 4" />
  </svg>
);

export const ListIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...base(size)}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </svg>
);

export const FichaIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...base(size)}>
    <rect x="7" y="3.5" width="10" height="17" rx="2" />
    <path d="M10 7.5h4M10 11h4M10 14.5h2.5" />
  </svg>
);

export const TrashIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...base(size)}>
    <path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7M10 11v5M14 11v5" />
  </svg>
);

export const SortIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...base(size)}>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </svg>
);
