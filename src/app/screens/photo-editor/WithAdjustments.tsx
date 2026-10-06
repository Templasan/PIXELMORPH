import { memo, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { InteractionManager } from 'react-native';
import { useStore } from '@core/state';
import type { PhotoEditorStore, RGBHistogram } from '@modules/photo-editor';
import { adjustmentUniforms, type Adjustments } from '@modules/photo-editor/domain/adjustments';
import { AdjustDrawer } from './AdjustDrawer';

/**
 * Subscribes to the editor's adjustments and renders `children` with them, so only this part of
 * the tree re-renders on a slider tick — the screen around it does not subscribe at all.
 */
export function WithAdjustments({
  editor,
  children,
}: {
  editor: PhotoEditorStore;
  children: (adjustments: Adjustments) => ReactNode;
}) {
  const adjustments = useStore(editor.store, (st) => st.adjustments);
  return <>{children(adjustments)}</>;
}

type AdjustDrawerProps = ComponentProps<typeof AdjustDrawer>;

const EMPTY_HISTOGRAM: RGBHistogram = { r: [], g: [], b: [] };

/**
 * The Ajustes drawer with its live histogram (RF-047). Shader uniforms and the histogram are
 * computed here, from the store, only while the drawer is mounted.
 */
export const AdjustDrawerHost = memo(function AdjustDrawerHost({
  editor,
  histogram,
  ...rest
}: Omit<AdjustDrawerProps, 'adjustments' | 'histogram' | 'uniforms'> & {
  editor: PhotoEditorStore;
  histogram: { compute: (uniforms: ReturnType<typeof adjustmentUniforms>) => RGBHistogram };
}) {
  const adjustments = useStore(editor.store, (st) => st.adjustments);
  const uniforms = useMemo(() => adjustmentUniforms(adjustments), [adjustments]);
  // The drawer mounts ~7 sliders in the same frame as its opening animation; the histogram pass
  // (photo sample through the full adjustment math, on the JS thread) waits until that is done.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setSettled(true));
    return () => task.cancel();
  }, []);
  const live = useMemo(
    () => (settled ? histogram.compute(uniforms) : EMPTY_HISTOGRAM),
    [settled, histogram, uniforms]
  );
  return <AdjustDrawer {...rest} adjustments={adjustments} histogram={live} uniforms={uniforms} />;
});
