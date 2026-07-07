import { CURATED_FONTS, CURATED_PALETTES, type RegionStyle, type SizeToken } from '@/lib/canvas-theme';

interface StyleControlsProps {
  label: string;
  value: RegionStyle;
  onChange: (next: RegionStyle) => void;
  showSize?: boolean;
}

// Curated font/size/color controls for a single region -- deliberately NOT
// a free-form Google-Fonts search or open color picker (decision 15). Kept
// as three small dropdowns so the UI stays simple (decision 13).
export function StyleControls({ label, value, onChange, showSize = true }: StyleControlsProps) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', width: 70, flexShrink: 0 }}>{label}</span>
      <select
        className="input"
        style={{ width: 'auto', height: 36, fontSize: 13, flex: '1 1 120px' }}
        value={value.font}
        onChange={(e) => onChange({ ...value, font: e.target.value as RegionStyle['font'] })}
      >
        {CURATED_FONTS.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      {showSize && (
        <select
          className="input"
          style={{ width: 64, height: 36, fontSize: 13, flexShrink: 0 }}
          value={value.size}
          onChange={(e) => onChange({ ...value, size: e.target.value as SizeToken })}
        >
          <option value="S">S</option>
          <option value="M">M</option>
          <option value="L">L</option>
        </select>
      )}
    </div>
  );
}

interface PalettePickerProps {
  value: string;
  onChange: (id: string) => void;
}

export function PalettePicker({ value, onChange }: PalettePickerProps) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      {CURATED_PALETTES.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          title={p.label}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: p.bg,
            border: value === p.id ? `2px solid ${p.accentStrong}` : '1px solid var(--line)',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <span style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: p.accent }} />
        </button>
      ))}
    </div>
  );
}
