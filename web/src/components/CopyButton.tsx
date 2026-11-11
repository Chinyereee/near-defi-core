import { useState } from 'react';

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      window.setTimeout(() => setDone(false), 1400);
    } catch {
      /* clipboard blocked: the value is still selectable on screen */
    }
  }
  return (
    <button className="copy-btn" type="button" onClick={copy} aria-label={`${label} ${value}`}>
      {done ? 'Copied' : label}
    </button>
  );
}
