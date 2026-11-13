/** Juegos' mark: a die face (three pips on the diagonal). Decorative. */
export const JuegosIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <circle cx="8.6" cy="8.6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15.4" cy="15.4" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);
