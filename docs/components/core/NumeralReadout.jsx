import React from 'react';

export function NumeralReadout({ value, of, caption, size = 'lg' }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div style={{ font: size === 'lg' ? 'var(--type-numeral)' : 'var(--type-numeral-sm)', letterSpacing: 'var(--tracking-numeral)' }}>{value}</div>
        {of && <div style={{ font: '500 24px/1 var(--font-sans)', color: 'var(--ink-4)', paddingBottom: 8 }}>/ {of}</div>}
      </div>
      {caption && <div style={{ font: 'var(--type-data-sm)', color: 'var(--ink-2)', marginTop: 11 }}>{caption}</div>}
    </div>
  );
}
