import React from 'react';

export function MonoLabel({ children, wide = false, color = 'var(--ink-3)' }) {
  return <span style={{
    font: 'var(--type-label)',
    letterSpacing: wide ? 'var(--tracking-label-wide)' : 'var(--tracking-label)',
    color, textTransform: 'uppercase',
  }}>{children}</span>;
}
