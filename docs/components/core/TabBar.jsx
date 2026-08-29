import React from 'react';

export function TabBar({ tabs = [], active, onSelect }) {
  return (
    <div style={{ display: 'flex', borderTop: '1px solid var(--line-1)', background: 'var(--surface-app)', padding: '14px 0 34px' }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onSelect && onSelect(t)} style={{
          flex: 1, background: 'transparent', border: 0, cursor: 'pointer', padding: '6px 0',
          font: 'var(--type-label)', letterSpacing: '0.12em',
          color: t === active ? 'var(--ink-1)' : 'var(--ink-4)',
        }}>{t}</button>
      ))}
    </div>
  );
}
