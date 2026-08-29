import React from 'react';

export function SegmentBar({ count = 0, goal = 8, height = 24 }) {
  const cells = [];
  for (let i = 0; i < Math.max(goal, count); i++) {
    const filled = i < count, bonus = i >= goal;
    cells.push(
      <div key={i} style={{
        flex: 1, height,
        background: filled ? (bonus ? 'var(--bar-bonus)' : 'var(--bar-filled)') : 'transparent',
        border: '1px solid ' + (filled ? (bonus ? 'var(--bar-bonus)' : 'var(--bar-filled)') : 'var(--bar-empty-edge)'),
        boxSizing: 'border-box',
      }} />
    );
  }
  return <div style={{ display: 'flex', gap: 'var(--gap-segment)' }}>{cells}</div>;
}
