// Lightweight inline SVG icon set (Lucide-style, 24px grid).
const ICONS = {
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  "chevron-left": <path d="M15 6l-6 6 6 6" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  "arrow-right": (
    <>
      <path d="M4 12h16" />
      <path d="M13 5l7 7-7 7" />
    </>
  ),
  "arrow-up-right": (
    <>
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </>
  ),
  "arrow-up": (
    <>
      <path d="M12 20V4" />
      <path d="M5 11l7-7 7 7" />
    </>
  ),
  check: <path d="M4 12.5l5 5L20 6.5" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.8 2.8L16.5 9" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  phone: (
    <path d="M5 4h4l1.5 4.5L8 10a12.5 12.5 0 0 0 6 6l1.5-2.5L20 15v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7.5l9 6 9-6" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" />
      <path d="M9.2 8.7c.3 3 3 5.7 6.1 6.1l1.2-1.3-2-1.4-.9.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.9-1.4-2z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  star: (
    <path d="M12 3.2l2.65 5.4 5.95.85-4.3 4.2 1 5.95L12 16.8l-5.3 2.8 1-5.95-4.3-4.2 5.95-.85L12 3.2z" />
  ),
  quote: (
    <path
      fill="currentColor"
      stroke="none"
      d="M4.5 12.2c0-3.9 2-6.6 5.6-8.2l.9 1.7c-1.8 1-2.8 2.2-3 3.8.3-.1.7-.2 1.1-.2 1.6 0 2.8 1.2 2.8 2.9 0 1.8-1.3 3-3.1 3-2.6 0-4.3-1.2-4.3-3zm8.6 0c0-3.9 2-6.6 5.6-8.2l.9 1.7c-1.8 1-2.8 2.2-3 3.8.3-.1.7-.2 1.1-.2 1.6 0 2.8 1.2 2.8 2.9 0 1.8-1.3 3-3.1 3-2.6 0-4.3-1.2-4.3-3z"
    />
  ),
  ruler: (
    <>
      <path d="M3 17L17 3l4 4L7 21l-4-4z" />
      <path d="M8 12l2 2" />
      <path d="M11 9l2 2" />
      <path d="M14 6l2 2" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13.5l9 5 9-5" />
      <path d="M3 17.5l9 5 9-5" opacity="0" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12l9-9h9v9l-9 9-9-9z" />
      <circle cx="16.5" cy="7.5" r="1.4" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  building: (
    <>
      <path d="M6 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
      <path d="M16 9.5h3a1 1 0 0 1 1 1V21" />
      <path d="M3.5 21h17" />
      <path d="M9 7.5h1.5M12.5 7.5H14M9 11h1.5M12.5 11H14M9 14.5h1.5M12.5 14.5H14" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 4 4 7.5-8.5" />
      <path d="M15.5 6.5h5v5" />
    </>
  ),
  road: (
    <>
      <path d="M8.5 3L5 21" />
      <path d="M15.5 3L19 21" />
      <path d="M12 4v2.5" />
      <path d="M12 10.5V13" />
      <path d="M12 17.5V20" />
    </>
  ),
  tree: (
    <>
      <path d="M12 21v-5" />
      <path d="M12 3l4.5 6.5h-2.6l4 6H6.1l4-6H7.5L12 3z" />
    </>
  ),
  waves: (
    <>
      <path d="M2.5 9.5c2.4 0 2.4 2 4.75 2s2.35-2 4.75-2 2.4 2 4.75 2 2.35-2 4.75-2" />
      <path d="M2.5 15c2.4 0 2.4 2 4.75 2s2.35-2 4.75-2 2.4 2 4.75 2 2.35-2 4.75-2" />
    </>
  ),
  mosque: (
    <>
      <path d="M4.5 21V10" />
      <path d="M19.5 21V10" />
      <path d="M3.5 10h2" />
      <path d="M18.5 10h2" />
      <path d="M12 3.5v1.8" />
      <path d="M8 21v-6a4 4 0 0 1 8 0v6" />
      <path d="M10.5 21v-3.5a1.5 1.5 0 0 1 3 0V21" />
      <path d="M3 21h18" />
    </>
  ),
  school: (
    <>
      <path d="M2.5 9.5L12 5l9.5 4.5L12 14 2.5 9.5z" />
      <path d="M6.5 11.8V16c0 1.5 2.5 2.8 5.5 2.8s5.5-1.3 5.5-2.8v-4.2" />
      <path d="M21.5 9.5v4.5" />
    </>
  ),
  hospital: (
    <>
      <path d="M6.5 21V8a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v13" />
      <path d="M4 21h16" />
      <path d="M12 10.5v6" />
      <path d="M9 13.5h6" />
      <path d="M10 3.5h4V7h-4z" />
    </>
  ),
  play: (
    <>
      <path d="M9 17.5V6.5l9 5.5-9 5.5z" />
      <path d="M4 20.5h16" />
    </>
  ),
  shopping: (
    <>
      <path d="M6 8h12l-1.1 12.2a1 1 0 0 1-1 .8H8.1a1 1 0 0 1-1-.8L6 8z" />
      <path d="M9 10.5V6a3 3 0 0 1 6 0v4.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 2.4v5.4c0 4.6-3 7.6-7 9.2-4-1.6-7-4.6-7-9.2V5.4L12 3z" />
      <path d="M9 11.6l2 2 4-4.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.2" r="3.4" />
      <path d="M3.5 19.5c.6-3.2 2.6-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="17" cy="9.2" r="2.5" />
      <path d="M17.5 14.6c2.3.3 3.6 1.9 4 4.4" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4" />
      <path d="M9 12.5h6" />
      <path d="M9 16h6" />
    </>
  ),
  plan: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.2" />
      <path d="M3 12h18" />
      <path d="M12 5v14" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16" />
      <path d="M6.5 20h11" />
      <path d="M12 5.5L5.5 8" />
      <path d="M12 5.5l6.5 2.5" />
      <path d="M2.5 14a3.2 3.2 0 0 0 6.4 0L5.7 8l-3.2 6z" />
      <path d="M15.1 14a3.2 3.2 0 0 0 6.4 0L18.3 8l-3.2 6z" />
    </>
  ),
  heart: (
    <path d="M12 20.2S4.6 15.6 2.9 11.2A5.1 5.1 0 0 1 12 6.6a5.1 5.1 0 0 1 9.1 4.6c-1.7 4.4-9.1 9-9.1 9z" />
  ),
  plane: (
    <>
      <path d="M21 3L3 10.3l7 3.1 3.1 7L21 3z" />
      <path d="M10 13.4L21 3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L21 21" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v11" />
      <path d="M7 9.5l5 5 5-5" />
      <path d="M4 20.5h16" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4.2" />
      <path d="M10.5 12.5L20.5 2.5" />
      <path d="M16.5 4l3 3" />
      <path d="M13.5 7l2.5 2.5" />
    </>
  ),
  send: (
    <>
      <path d="M21 3L3 10.3l7 3.1 3.1 7L21 3z" />
      <path d="M10 13.4L21 3" />
    </>
  ),
  facebook: (
    <path
      fill="currentColor"
      stroke="none"
      d="M13.4 21v-7h2.4l.5-3.1h-2.9V8.9c0-.9.4-1.5 1.5-1.5h1.5V4.6c-.5-.1-1.3-.1-2.1-.1-2.2 0-3.8 1.3-3.8 4v2.4H8v3.1h2.5v7h2.9z"
    />
  ),
  youtube: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="3.5" />
      <path fill="currentColor" stroke="none" d="M10.5 9.5l5 2.5-5 2.5z" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M7.5 10.5v6" />
      <path d="M7.5 7.4v.1" />
      <path d="M11.2 16.5v-6" />
      <path d="M11.2 13c0-1.4 1-2.5 2.4-2.5s2.4 1.1 2.4 2.5v3.5" />
    </>
  ),
};

export default function Icon({ name, size = 20, className = "", strokeWidth = 1.7 }) {
  const glyph = ICONS[name];
  if (!glyph) return null;
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}
