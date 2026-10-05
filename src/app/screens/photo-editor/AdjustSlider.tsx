import { memo } from 'react';
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
  return (
    <Slider
      label={label}
      value={value}
      min={min}
      max={max}
      bipolar={min < 0}
      showSign={min < 0}
      gradientColors={gradientColors}
      onChange={(v) => setField(field, v)}
      onSlidingComplete={(v, from) => onCommit(field, v, from)}
    />
  );
});
