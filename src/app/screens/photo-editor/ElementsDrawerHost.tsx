import { memo, type ComponentProps } from 'react';
import { useStore } from '@core/state';
import type { PhotoEditorStore } from '@modules/photo-editor';
import { ElementsDrawer } from './ElementsDrawer';

/**
 * The Elementos drawer wired to the editor store: the text/shape forms and their actions live in
 * the store, so typing in a form re-renders this drawer only — not the editor screen.
 */
export const ElementsDrawerHost = memo(function ElementsDrawerHost({
  editor,
  onSubmitCollage,
}: {
  editor: PhotoEditorStore;
  onSubmitCollage: ComponentProps<typeof ElementsDrawer>['onSubmitCollage'];
}) {
  const textDraft = useStore(editor.store, (st) => st.textDraft);
  const shapeDraft = useStore(editor.store, (st) => st.shapeDraft);
  const selectedKind = useStore(
    editor.store,
    (st) => st.layers.find((l) => l.id === st.selectedLayerId)?.kind
  );
  return (
    <ElementsDrawer
      textDraft={textDraft}
      onChangeTextDraft={editor.setTextDraft}
      onSubmitText={editor.submitText}
      isEditingText={selectedKind === 'text'}
      shapeDraft={shapeDraft}
      onChangeShapeDraft={editor.setShapeDraft}
      onSubmitShape={editor.submitShape}
      isEditingShape={selectedKind === 'shape'}
      onSubmitMeme={editor.submitMeme}
      onAddSticker={editor.addSticker}
      onSubmitCollage={onSubmitCollage}
    />
  );
});
