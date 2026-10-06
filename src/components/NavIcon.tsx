import type { MobileNavIcon } from "@/lib/nav";

export const NavIcon = ({
  name,
  day,
}: {
  name: MobileNavIcon;
  /** Hoy: today's day number inside the calendar glyph (client-only). */
  day?: number | null;
}) => {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    className: "h-5 w-5",
    "aria-hidden": true,
  } as const;

  if (name === "today") {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path strokeLinecap="round" d="M4 9.5h16M8.5 3.5v3M15.5 3.5v3" />
        {day != null ? (
          <text
            x="12"
            y="17.6"
            textAnchor="middle"
            fontSize="7.5"
            fontWeight="700"
            fill="currentColor"
            stroke="none"
            fontFamily="var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
          >
            {day}
          </text>
        ) : null}
      </svg>
    );
  }

  if (name === "queue") {
    return (
      <svg {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 4.5h10.5a1 1 0 0 1 1 1V20L12.25 16.5 6 20V5.5a1 1 0 0 1 1-1Z"
        />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="5.5" />
        <path strokeLinecap="round" d="m15.5 15.5 4 4" />
      </svg>
    );
  }

  if (name === "tag") {
    return (
      <svg {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.75 12.6V5.75a1 1 0 0 1 1-1h6.85a1 1 0 0 1 .7.3l6.2 6.2a1 1 0 0 1 0 1.4l-6.85 6.85a1 1 0 0 1-1.4 0l-6.2-6.2a1 1 0 0 1-.3-.7Z"
        />
        <circle cx="8.75" cy="8.75" r="1.25" />
      </svg>
    );
  }

  if (name === "profile") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8.25" r="3.15" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5.6 18.75c.85-3.05 2.95-4.75 6.4-4.75s5.55 1.7 6.4 4.75"
        />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 7h12M6 12h12M6 17h8"
      />
    </svg>
  );
};
