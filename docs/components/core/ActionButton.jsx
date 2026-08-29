import React from 'react';

export function ActionButton({ label = '+ ONE CUP', variant = 'primary', hint, onClick, onHoldStart, onHoldEnd }) {
  const base = {
    width: '100%', height: 'var(--control-height)', border: 0,
    borderRadius: 'var(--radius-2)', cursor: 'pointer',
    font: '600 15px/1 var(--font-sans)', letterSpacing: '0.06em',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  };
  const skin = variant === 'primary'
    ? { background: 'var(--action-bg)', color: 'var(--action-fg)' }
    : { background: 'var(--ink-1)', color: 'var(--paper-1)' };
  return (
    <div>
      <button style={{ ...base, ...skin }} onClick={onClick}
        onMouseDown={onHoldStart} onMouseUp={onHoldEnd} onMouseLeave={onHoldEnd}
        onTouchStart={onHoldStart} onTouchEnd={onHoldEnd}>{label}</button>
      {hint && <div style={{ textAlign: 'center', font: 'var(--type-label-xs)', letterSpacing: 'var(--tracking-label)', color: 'var(--ink-4)', marginTop: 10 }}>{hint}</div>}
    </div>
  );
}
