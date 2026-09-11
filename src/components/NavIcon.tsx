import type { MobileNavIcon } from "@/lib/nav";

export const NavIcon = ({ name }: { name: MobileNavIcon }) => {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    className: "h-5 w-5",
    "aria-hidden": true,
  } as const;

  if (name === "diary") {
    return (
      <svg {...common}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 5.25h5.25A1.75 1.75 0 0 1 13 7v12.25H7.75A1.75 1.75 0 0 1 6 17.5V5.25Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 7h4.25A1.75 1.75 0 0 1 19 8.75V19.25H13"
        />
        <path strokeLinecap="round" d="M8.25 8.75h2.5M8.25 11.5h2.5" />
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
      <svg {...common} className="h-6 w-6">
        <circle cx="11" cy="11" r="5.5" />
        <path strokeLinecap="round" d="m15.5 15.5 4 4" />
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
