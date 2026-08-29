import React from 'react';

export function DayColumn({ letter, day, count, goal = 8, max = 12, today = false, onClick }) {
  const future = count === null || count === undefined;
  const h = future ? 2 : Math.max(Math.round(Math.min(count / max, 1) * 118), 3);
  return (
    <button onClick={onClick} disabled={future} style={{
      flex: 1, background: 'transparent', border: 0, padding: 0,
      cursor: future ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ height: 'var(--chart-height)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <span style={{ font: '500 11px/1 var(--font-mono)', color: future ? 'var(--ink-5)' : (count >= goal ? 'var(--ink-1)' : 'var(--ink-4)') }}>{future ? '\u2013' : count}</span>
        <div style={{ width: '100%', height: h, background: future ? 'var(--line-2)' : (count >= goal ? 'var(--ink-1)' : 'var(--ink-5)') }} />
      </div>
      <div style={{ borderTop: '1px solid var(--line-1)', paddingTop: 9, textAlign: 'center' }}>
        <div style={{ font: 'var(--type-label)', letterSpacing: '0.1em', color: 'var(--ink-3)' }}>{letter}</div>
        <div style={{ font: '500 13px/1 var(--font-mono)', color: today ? 'var(--marker-now)' : 'var(--ink-3)', marginTop: 5 }}>{day}</div>
      </div>
    </button>
  );
}
