// Cardstock brand mark: an amber tile with an ink "dog-eared card" glyph — a
// nod to premium card stock (paper) and to the card/carousel the product makes.
// Pure SVG so it stays crisp at any size and works on light or dark surfaces.

export function CardstockMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flex: 'none' }}
    >
      <rect width="32" height="32" rx="8" fill="#F2B705" />
      {/* card body — the cut top-right corner lets the amber tile read as a fold */}
      <path
        d="M11 6H18l6 6v12a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        fill="#1B160E"
      />
      {/* folded-corner crease */}
      <path d="M18 6v6h6" fill="none" stroke="#F2B705" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Mark + "Cardstock" wordmark lockup. `collapsed` animates the wordmark away
// (Anthropic-style) so only the mark remains — used by the landing navbar on
// scroll. `whiteSpace: nowrap` + `overflow: hidden` make the max-width collapse
// clean.
export function CardstockLogo({
  size = 30,
  wordSize = 18,
  color = 'var(--ink)',
  collapsed = false,
}: {
  size?: number;
  wordSize?: number;
  color?: string;
  collapsed?: boolean;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}>
      <CardstockMark size={size} />
      <span
        style={{
          display: 'inline-flex',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          maxWidth: collapsed ? 0 : 200,
          opacity: collapsed ? 0 : 1,
          transform: collapsed ? 'translateX(-8px)' : 'translateX(0)',
          transition: 'max-width .5s cubic-bezier(.4,0,.2,1), opacity .3s ease, transform .5s cubic-bezier(.4,0,.2,1)',
        }}
      >
        <span style={{ font: `800 ${wordSize}px/1 Archivo`, letterSpacing: '-0.02em', color }}>Cardstock</span>
      </span>
    </span>
  );
}
