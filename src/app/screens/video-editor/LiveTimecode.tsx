import { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { formatTimecode } from '@modules/video-editor';

interface LiveTimecodeProps {
  timeMs: number;
  totalMs: number;
  playing: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * The editor only learns the playhead ~10x/s, which made the frame digits jump by 3. While
 * playing this extrapolates between those updates on every screen frame, re-rendering just
 * this Text (not the whole editor), and only when the displayed timecode changes.
 */
export function LiveTimecode({ timeMs, totalMs, playing, style }: LiveTimecodeProps) {
  const [shown, setShown] = useState(timeMs);
  const base = useRef({ timeMs, stamp: Date.now() });
  const last = useRef(timeMs);

  useEffect(() => {
    base.current = { timeMs, stamp: Date.now() };
    // Never run backwards because of a small timing jitter, only on real seeks.
    if (!playing || Math.abs(timeMs - last.current) > 300 || timeMs > last.current) {
      last.current = timeMs;
      setShown(timeMs);
    }
  }, [timeMs, playing]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const next = Math.min(totalMs, base.current.timeMs + (Date.now() - base.current.stamp));
      if (next > last.current && formatTimecode(next) !== formatTimecode(last.current)) {
        last.current = next;
        setShown(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, totalMs]);

  return <Text style={style}>{formatTimecode(shown)}</Text>;
}
