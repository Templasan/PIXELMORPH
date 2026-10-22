import { memo, useCallback } from 'react';
import { Slider } from '@core/ui';

interface Props {
  label: string;
  field: string;
  value: number;
  min: number;
  max: number;
  gradientColors?: readonly [string, string];
  setField: (field: string, value: number) => void;
  onCommit: (field: string, value: number, previousValue: number) => void;
}

/** One slider row: re-renders only when its own `value` changes (setField/onCommit are stable). */
export const AdjustSlider = memo(function AdjustSlider({
  label,
  field,
  value,
  min,
  max,
  gradientColors,
  setField,
  onCommit,
}: Props) {
  // Stable callbacks: a new function per render made the Slider rebuild its gesture and send it
  // to the UI thread again on every tick of the slider being dragged.
  const onChange = useCallback((v: number) => setField(field, v), [setField, field]);
  const onSlidingComplete = useCallback(
    (v: number, from: number) => onCommit(field, v, from),
    [onCommit, field]
  );
  return (
    <Slider
      label={label}
      value={value}
      min={min}
      max={max}
      bipolar={min < 0}
      showSign={min < 0}
      gradientColors={gradientColors}
      onChange={onChange}
      onSlidingComplete={onSlidingComplete}
    />
  );
});
