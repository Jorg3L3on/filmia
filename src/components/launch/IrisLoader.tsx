type MarkProps = {
  title: string;
};

/** White F from the Iris canvas (`#fmarkw`): the mark silhouette, not the gradient tile. */
const Mark = ({ title }: MarkProps) => {
  const maskId = `${title}-mask`;

  return (
    <svg className="iris-mark" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <g fill="none" stroke="#fff" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 18V84" />
            <path d="M22 18H80" />
            <path d="M22 50H64" />
          </g>
          <g fill="#000">
            <rect x="18" y="30" width="8" height="6" rx="1.5" />
            <rect x="18" y="39" width="8" height="6" rx="1.5" />
            <rect x="18" y="62" width="8" height="6" rx="1.5" />
            <rect x="18" y="71" width="8" height="6" rx="1.5" />
            <rect x="40" y="14" width="6" height="8" rx="1.5" />
            <rect x="52" y="14" width="6" height="8" rx="1.5" />
            <rect x="64" y="14" width="6" height="8" rx="1.5" />
          </g>
        </mask>
      </defs>
      <rect width="100" height="100" fill="#fff4e6" mask={`url(#${maskId})`} />
    </svg>
  );
};

/**
 * Launch loader. The iOS startup image is the same pose, linked only from
 * the Apple startup meta — this tree does not download it.
 */
export const IrisLoader = () => (
  <div className="iris-loader" role="status" aria-label="Preparando la función">
    <div className="iris-lin">
      <div className="iris-weave">
        <div className="iris-bloom" />
        <div className="iris-leak" />
        <div className="iris-scene">
          <div className="iris-grade" />
          <div className="iris-poster" />
          <div className="iris-streak" />
        </div>
        <div className="iris-blades" />
        <div className="iris-logo">
          <div className="iris-ghost">
            <Mark title="iris-ghost" />
          </div>
          <Mark title="iris-logo" />
        </div>
        <div className="iris-rim" />
        <p className="iris-word">Filmia</p>
        <p className="iris-cap">Preparando la función</p>
      </div>
    </div>
    <div className="iris-vig" aria-hidden="true" />
    <div className="iris-grain" aria-hidden="true" />
  </div>
);
