export default function Logo({ variant = "dark", compact = false }) {
  return (
    <span className={`logo logo--${variant}`}>
      <svg className="logo__mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="var(--forest)" />
        <g
          stroke="var(--gold)"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        >
          <path d="M16 14v36M14 16h36" />
          <path d="M26 14v36M14 26h36" />
          <path d="M50 26v24M26 50h24" />
          <path d="M40 50V38M38 40h12" />
        </g>
        <circle cx="45" cy="19" r="5.5" fill="var(--gold)" />
        <circle cx="45" cy="19" r="2" fill="var(--forest)" />
      </svg>
      {!compact && (
        <span className="logo__word">
          <span className="logo__name">Bhumi</span>
          <span className="logo__sub">LANDMARKS</span>
        </span>
      )}
    </span>
  );
}
