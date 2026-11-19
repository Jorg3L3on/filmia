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

  if (name === "lists") {
    // Bulleted list: the drawing Perfil's «Listas ›» row used before it became a tab (FIL-34).
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h12M8 12h12M8 18h8M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    );
  }

  if (name === "para-ti") {
    // A spark with a smaller one beside it: something you did not know was there (FIL-I60-1).
    return (
      <svg {...common}>
        <path
          strokeLinejoin="round"
          d="M10.5 4c.55 3.6 2.1 5.15 5.7 5.7-3.6.55-5.15 2.1-5.7 5.7-.55-3.6-2.1-5.15-5.7-5.7 3.6-.55 5.15-2.1 5.7-5.7Z"
        />
        <path strokeLinejoin="round" d="M17.25 14.5c.25 1.6.95 2.3 2.5 2.5-1.55.25-2.25.95-2.5 2.5-.25-1.55-.95-2.25-2.5-2.5 1.55-.2 2.25-.9 2.5-2.5Z" />
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

  if (name === "ticket") {
    // Admit-one stub: notched sides, perforation down the tear line.
    return (
      <svg {...common}>
        <path
          strokeLinejoin="round"
          d="M4.5 7.5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v2a2.5 2.5 0 0 0 0 5v2a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-2a2.5 2.5 0 0 0 0-5v-2Z"
        />
        <path strokeLinecap="round" strokeDasharray="1.4 2.1" d="M14.5 8v8" />
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
