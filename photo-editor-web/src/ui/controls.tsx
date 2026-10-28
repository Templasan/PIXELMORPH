import { useRef, type ReactNode } from 'react';
import type { PhotoSession } from '../application/session';
import { DEFAULT_ADJUSTMENTS } from '../domain/adjustments';
import { useStore } from '../state/useStore';

/**
 * A slider bound to one adjustment field: moving it edits live, releasing records one undo
 * entry (field, value before the drag, value after).
 */
export function FieldSlider({
  session,
  field,
  label,
  min,
  max,
  step = 1,
  format = (v) => String(Math.round(v)),
}: {
  session: PhotoSession;
  field: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const { editor } = session;
  const value = useStore(editor.store, (s) => s.adjustments[field]);
  const from = useRef<number | null>(null);
  const end = () => {
    if (from.current === null) return;
    editor.commitField(field, editor.store.get().adjustments[field], from.current);
    from.current = null;
  };
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        <span>{format(value)}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={() => (from.current ??= value)}
        onKeyDown={() => (from.current ??= value)}
        onChange={(e) => {
          from.current ??= value;
          editor.setField(field, Number(e.target.value));
        }}
        onPointerUp={end}
        onKeyUp={end}
        onBlur={end}
        onDoubleClick={() => editor.commitField(field, DEFAULT_ADJUSTMENTS[field], value)}
      />
    </div>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  label = (v) => String(v),
  onPick,
}: {
  options: readonly T[];
  value: T | null;
  label?: (v: T) => ReactNode;
  onPick: (v: T) => void;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={String(o)} className={`chip${o === value ? ' on' : ''}`} onClick={() => onPick(o)}>
          {label(o)}
        </button>
      ))}
    </div>
  );
}

/** A slider for a value that is not an adjustment (layer opacity, brush): live, no undo entry. */
export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  format = (v) => String(Math.round(v)),
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        <span>{format(value)}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/** Fixed colours plus an "Outra cor" input; a colour outside the fixed ones shows in that input. */
export function Swatches({
  options,
  value,
  onPick,
}: {
  options: readonly string[];
  value: string;
  onPick: (hex: string) => void;
}) {
  const custom = !options.some((c) => c.toLowerCase() === value.toLowerCase());
  return (
    <div className="chips">
      {options.map((c) => (
        <button
          key={c}
          className={`color-dot${c.toLowerCase() === value.toLowerCase() ? ' on' : ''}`}
          style={{ background: c }}
          aria-label={c}
          onClick={() => onPick(c)}
        />
      ))}
      <label className={`color-dot custom${custom ? ' on' : ''}`} style={custom ? { background: value } : undefined} title="Outra cor">
        {!custom && '+'}
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} />
      </label>
    </div>
  );
}

/** Commits a discrete change of one field (a chip, a toggle) as one undo entry. */
export function commit(session: PhotoSession, field: string, value: number) {
  const before = session.editor.store.get().adjustments[field];
  session.editor.commitField(field, value, before);
}
