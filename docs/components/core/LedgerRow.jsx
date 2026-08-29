import React from 'react';

export function LedgerRow({ time, note, value, marker = 'ink', ghost = false }) {
  const dot = marker === 'now' ? 'var(--marker-now)' : 'var(--ink-1)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: 'var(--row-pad-y) 0',
      borderTop: '1px solid ' + (ghost ? 'var(--line-3)' : 'var(--line-2)'),
    }}>
      <span style={{ font: 'var(--type-data)', width: 52, color: ghost ? 'var(--ink-5)' : 'var(--ink-1)' }}>{time}</span>
      <span style={{ width: 9, height: 9, background: ghost ? 'transparent' : dot, border: ghost ? '1px solid var(--ink-5)' : 0, boxSizing: 'border-box' }} />
      <span style={{ flex: 1, font: 'var(--type-body)', color: ghost ? 'var(--ink-5)' : 'var(--ink-2)' }}>{note}</span>
      <span style={{ font: 'var(--type-data-sm)', color: ghost ? 'var(--ink-5)' : 'var(--ink-1)' }}>{value}</span>
    </div>
  );
}
