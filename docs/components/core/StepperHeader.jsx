import React from 'react';

export function StepperHeader({ label, sub, onPrev, onNext, prevEnabled = true, nextEnabled = true }) {
  const btn = (enabled, glyph, fn) => (
    <button onClick={fn} style={{
      width: 'var(--control-square)', height: 'var(--control-square)', flex: 'none',
      border: '1px solid var(--line-2)', background: 'transparent', cursor: 'pointer',
      borderRadius: 'var(--radius-1)', font: '400 15px/1 var(--font-mono)',
      color: enabled ? 'var(--ink-1)' : 'var(--line-4)',
    }}>{glyph}</button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {btn(prevEnabled, '\u2039', onPrev)}
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ font: '600 15px/1 var(--font-mono)', letterSpacing: '0.06em' }}>{label}</div>
        {sub && <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--tracking-label)', color: 'var(--ink-3)', marginTop: 6 }}>{sub}</div>}
      </div>
      {btn(nextEnabled, '\u203a', onNext)}
    </div>
  );
}
