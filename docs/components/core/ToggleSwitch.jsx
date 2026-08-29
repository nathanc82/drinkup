import React from 'react';

export function ToggleSwitch({ on = false, onChange }) {
  return (
    <button onClick={onChange} style={{
      width: 44, height: 26, border: 0, borderRadius: 13, padding: 3, cursor: 'pointer',
      background: on ? 'var(--control-track-on)' : 'var(--control-track-off)',
      display: 'flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start',
    }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--control-knob)' }} />
    </button>
  );
}
