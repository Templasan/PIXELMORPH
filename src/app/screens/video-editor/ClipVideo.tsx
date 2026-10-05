import { useEffect, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';

/** Seconds of drift between the timeline clock and the player before we re-seek while playing (a seek blanks the surface, so only for real jumps). */
const MAX_DRIFT_S = 1.2;

interface ClipVideoProps {
  uri: string;
  /** Where the playhead is inside the source file, in ms (already accounts for trim and speed). */
  sourceTimeMs: number;
  playing: boolean;
  rate: number; // 0.25..4
  volume: number; // 0..1
  style?: StyleProp<ViewStyle>;
  /** Hide without unmounting (transition overlay on top), so the surface does not recreate. */
  hidden?: boolean;
}

/**
 * US-14/15/16: the real video for the clip under the playhead. The timeline clock stays the
 * master (it already handles trim, speed and multi-clip order); this player follows it —
 * paused → seek to the exact frame, playing → run and re-seek only if it drifts.
 * Renders nothing until the source is actually playable, so image/placeholder clips keep
 * showing the thumbnail the editor draws underneath.
 */
export function ClipVideo({
  uri,
  sourceTimeMs,
  playing,
  rate,
  volume,
  style,
  hidden,
}: ClipVideoProps) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const ready = status === 'readyToPlay';
  // Once the first frame is playable keep the surface mounted: the status drops to 'loading'
  // on every seek, and unmounting the VideoView there made the picture blink.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (ready) setShown(true);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    player.playbackRate = rate;
    player.volume = volume;
  }, [player, ready, rate, volume]);

  useEffect(() => {
    if (!ready) return;
    const target = Math.max(0, sourceTimeMs / 1000);
    if (!playing || Math.abs(player.currentTime - target) > MAX_DRIFT_S) {
      player.currentTime = target;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, playing, Math.round(sourceTimeMs / 100)]);

  useEffect(() => {
    if (!ready) return;
    if (playing) player.play();
    else player.pause();
  }, [player, ready, playing]);

  if (!shown) return null;
  return (
    <VideoView
      player={player}
      style={[styles.video, style, hidden && styles.hidden]}
      contentFit="contain"
      surfaceType="textureView"
      nativeControls={false}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hidden: { opacity: 0 },
});
