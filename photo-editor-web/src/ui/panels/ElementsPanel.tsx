import { t } from '../../i18n';
import { useState } from 'react';
import type { PhotoSession } from '../../application/session';
import type { ShapeKind } from '../../domain/layers';
import { useStore } from '../../state/useStore';
import { Chips, Range, Swatches } from '../controls';
import { CollageSection } from './MontagePanels';

const TABS = ['Texto', 'Formas', 'Adesivos', 'Meme', 'Colagem'] as const;
type Tab = (typeof TABS)[number];

// Android system family names (the same list the app's Elementos drawer offers).
const TEXT_FONTS = [
  { label: 'Padrão', family: 'sans-serif' },
  { label: 'Condensada', family: 'sans-serif-condensed' },
  { label: 'Serifada', family: 'serif' },
  { label: 'Monoespaçada', family: 'monospace' },
  { label: 'Negrito extra', family: 'sans-serif-black' },
];
const TEXT_COLORS = ['#E4E4E4', '#3A8FDE', '#D25252', '#5FB98F', '#D2A05E'];
// Outline needs a dark option; the light text colour is too light to outline white text.
const OUTLINE_COLORS = ['#000000', '#FFFFFF', '#3A8FDE', '#D25252'];
const SHAPES: { label: string; kind: ShapeKind }[] = [
  { label: 'Círculo', kind: 'circle' },
  { label: 'Retângulo', kind: 'rect' },
  { label: 'Linha', kind: 'line' },
  { label: 'Seta', kind: 'arrow' },
];
const STICKERS = ['👍', '😂', '🔥', '❤️', '😮', '🎉'];

/** Elementos (RF-008/044/046): text, shapes, stickers and memes, placed on the picture as layers. */
export function ElementsPanel({ session }: { session: PhotoSession }) {
  const { editor } = session;
  const [tab, setTab] = useState<Tab>('Texto');
  const [memeTop, setMemeTop] = useState('');
  const [memeBottom, setMemeBottom] = useState('');
  const draft = useStore(editor.store, (s) => s.textDraft);
  const shape = useStore(editor.store, (s) => s.shapeDraft);
  const selectedKind = useStore(editor.store, (s) => s.layers.find((l) => l.id === s.selectedLayerId)?.kind);
  // Editing a selected layer changes its button label; a new one is added to the picture.
  const editingText = selectedKind === 'text';
  const editingShape = selectedKind === 'shape';

  return (
    <>
      <Chips options={TABS} value={tab} onPick={setTab} />

      {tab === 'Colagem' && <CollageSection session={session} />}
      {tab === 'Texto' && (
        <>
          <div className="field">
            <input
              type="text"
              value={draft.content}
              placeholder={t('Digite o texto')}
              onChange={(e) => editor.setTextDraft({ content: e.target.value })}
            />
          </div>
          <Chips
            options={TEXT_FONTS.map((f) => f.family)}
            value={draft.fontFamily}
            label={(family) => t(TEXT_FONTS.find((f) => f.family === family)?.label ?? '')}
            onPick={(fontFamily) => editor.setTextDraft({ fontFamily })}
          />
          <Swatches options={TEXT_COLORS} value={draft.color} onPick={(color) => editor.setTextDraft({ color })} />
          <div className="chips">
            <button className={`chip${draft.shadow ? ' on' : ''}`} onClick={() => editor.setTextDraft({ shadow: !draft.shadow })}>
              {t('Sombra')}
            </button>
            <button
              className={`chip${draft.strokeWidth > 0 ? ' on' : ''}`}
              onClick={() => editor.setTextDraft({ strokeWidth: draft.strokeWidth > 0 ? 0 : 2 })}
            >
              {t('Contorno')}
            </button>
          </div>
          {draft.strokeWidth > 0 && (
            <Swatches options={OUTLINE_COLORS} value={draft.strokeColor} onPick={(strokeColor) => editor.setTextDraft({ strokeColor })} />
          )}
          <button className="primary-btn wide" disabled={!draft.content.trim()} onClick={() => editor.submitText()}>
            {editingText ? t('APLICAR') : t('ADICIONAR AO CANVAS')}
          </button>
        </>
      )}

      {tab === 'Formas' && (
        <>
          <Chips
            options={SHAPES.map((s) => s.kind)}
            value={shape.kind}
            label={(kind) => t(SHAPES.find((s) => s.kind === kind)?.label ?? '')}
            onPick={(kind) => editor.setShapeDraft({ kind })}
          />
          <Swatches options={TEXT_COLORS} value={shape.color} onPick={(color) => editor.setShapeDraft({ color })} />
          <Range label={t('Espessura')} value={shape.strokeWidth} min={1} max={20} onChange={(strokeWidth) => editor.setShapeDraft({ strokeWidth })} />
          <button className="primary-btn wide" onClick={() => editor.submitShape()}>
            {editingShape ? t('APLICAR') : t('ADICIONAR AO CANVAS')}
          </button>
        </>
      )}

      {tab === 'Adesivos' && (
        <div className="stickers">
          {STICKERS.map((emoji) => (
            <button key={emoji} onClick={() => editor.addSticker(emoji)} aria-label={t('Adesivo {emoji}', { emoji })}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {tab === 'Meme' && (
        <>
          <div className="field">
            <input type="text" value={memeTop} placeholder={t('Texto de cima')} onChange={(e) => setMemeTop(e.target.value)} />
          </div>
          <div className="field">
            <input type="text" value={memeBottom} placeholder={t('Texto de baixo')} onChange={(e) => setMemeBottom(e.target.value)} />
          </div>
          <button
            className="primary-btn wide"
            disabled={!memeTop.trim() && !memeBottom.trim()}
            onClick={() => {
              editor.submitMeme(memeTop, memeBottom);
              setMemeTop('');
              setMemeBottom('');
            }}
          >
            {t('CRIAR MEME')}
          </button>
        </>
      )}
    </>
  );
}
