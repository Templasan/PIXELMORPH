import { memo, useMemo, type ComponentProps, type ReactNode } from 'react';
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
  const live = useMemo(() => histogram.compute(uniforms), [histogram, uniforms]);
  return <AdjustDrawer {...rest} adjustments={adjustments} histogram={live} uniforms={uniforms} />;
});
