import { t } from '../../i18n';
import { useEffect, useState } from 'react';
import type { PhotoSession } from '../../application/session';
import type { ShapeKind, TextAlign } from '../../domain/layers';
import { useStore } from '../../state/useStore';
import { Chips, Range, Swatches } from '../controls';
import { Icon } from '../Icon';
import { CollageSection } from './MontagePanels';

const TABS = ['Texto', 'Formas', 'Adesivos', 'Meme', 'QR code', "Marca d'água", 'Colagem'] as const;
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
const TEXT_ALIGNS: { label: string; align: TextAlign }[] = [
  { label: 'Esquerda', align: 'left' },
  { label: 'Centro', align: 'center' },
  { label: 'Direita', align: 'right' },
];
const STICKERS = ['👍', '😂', '🔥', '❤️', '😮', '🎉'];

/** RF-066: a QR code from a link or text. The export reads it back before saving. */
function QrSection({ session }: { session: PhotoSession }) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    setError(null);
    try {
      session.addQrLayer(content);
      setContent('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <>
      <div className="field">
        <input type="text" value={content} placeholder={t('Link ou texto')} onChange={(e) => setContent(e.target.value)} />
      </div>
      <button className="primary-btn wide" disabled={!content.trim()} onClick={add}>
        {t('ADICIONAR AO CANVAS')}
      </button>
      {error && <div className="muted">{error}</div>}
      <div className="muted">{t('Mova e redimensione na foto. Antes de salvar, o export confere se o código pode ser lido.')}</div>
    </>
  );
}

/** RF-020: a text or logo layer kept for other photos, with its place, size, turn and opacity. */
function WatermarkSection({ session }: { session: PhotoSession }) {
  const { editor } = session;
  const kept = useStore(session.watermarks);
  const selected = useStore(editor.store, (s) => s.layers.find((l) => l.id === s.selectedLayerId));
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void session.loadWatermarks();
  }, [session]);
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  const keepable = !!selected && (selected.kind === 'text' || selected.kind === 'image');
  return (
    <>
      <button className="chip" onClick={() => session.addImageLayer().catch(fail)}>
        {t('Logo da galeria')}
      </button>
      {keepable ? (
        <>
          <div onPointerUp={() => editor.endLayers()}>
            <Range
              label={t('Transparência')}
              value={100 - selected.opacity}
              min={0}
              max={100}
              format={(v) => `${v}%`}
              onChange={(v) =>
                editor.liveLayers((ls) => ls.map((l) => (l.id === selected.id ? { ...l, opacity: 100 - v } : l)))
              }
            />
          </div>
          <div className="field">
            <input type="text" value={name} placeholder={t('Nome da marca')} onChange={(e) => setName(e.target.value)} />
          </div>
          <button
            className="primary-btn wide"
            disabled={!name.trim()}
            onClick={() => {
              setError(null);
              session
                .saveWatermark(name, selected)
                .then(() => setName(''))
                .catch(fail);
            }}
          >
            {t('SALVAR COMO MARCA')}
          </button>
        </>
      ) : (
        <div className="muted">{t('Selecione ou crie um texto ou logo para salvar como marca.')}</div>
      )}
      {error && <div className="muted">{error}</div>}
      <div className="chips">
        {(kept ?? []).map((w) => (
          <span key={w.id} className="chips">
            <button className="chip" onClick={() => session.applyWatermark(w)}>
              {w.name}
            </button>
            <button className="icon-btn" onClick={() => void session.deleteWatermark(w.id).catch(fail)} aria-label={t('Excluir marca {name}', { name: w.name })}>
              <Icon name="trash" size={16} />
            </button>
          </span>
        ))}
      </div>
    </>
  );
}

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
      {tab === 'QR code' && <QrSection session={session} />}
      {tab === "Marca d'água" && <WatermarkSection session={session} />}
      {tab === 'Texto' && (
        <>
          <div className="field">
            <textarea
              rows={3}
              value={draft.content}
              placeholder={t('Digite o texto')}
              onChange={(e) => editor.setTextDraft({ content: e.target.value })}
              onBlur={() => editor.endLayers()}
            />
          </div>
          <Chips
            options={TEXT_FONTS.map((f) => f.family)}
            value={draft.fontFamily}
            label={(family) => t(TEXT_FONTS.find((f) => f.family === family)?.label ?? '')}
            onPick={(fontFamily) => editor.setTextDraft({ fontFamily })}
          />
          <Chips
            options={TEXT_ALIGNS.map((a) => a.align)}
            value={draft.align}
            label={(align) => t(TEXT_ALIGNS.find((a) => a.align === align)?.label ?? '')}
            onPick={(align) => editor.setTextDraft({ align })}
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
          {editingText && (
            <button className="chip" onClick={() => editor.selectLayer('fundo')}>
              {t('Novo texto')}
            </button>
          )}
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
          <div onPointerUp={() => editor.endLayers()}>
            <Range label={t('Espessura')} value={shape.strokeWidth} min={1} max={20} onChange={(strokeWidth) => editor.setShapeDraft({ strokeWidth })} />
          </div>
          <button className="primary-btn wide" onClick={() => editor.submitShape()}>
            {editingShape ? t('APLICAR') : t('ADICIONAR AO CANVAS')}
          </button>
          {editingShape && (
            <button className="chip" onClick={() => editor.selectLayer('fundo')}>
              {t('Nova forma')}
            </button>
          )}
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
