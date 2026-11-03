import { useMemo, useState } from 'react';
import { t } from '../../i18n';
import type { PhotoSession } from '../../application/session';
import { harmonies, type Crop } from '../../domain/suggestions';
import { useStore } from '../../state/useStore';

/** Sugestões (US-26): the picture's colours, what goes with them, and crops by composition. */
export function SuggestionsPanel({ session }: { session: PhotoSession }) {
  const { editor } = session;
  const adjustments = useStore(editor.store, (s) => s.adjustments);
  // Read once when the panel opens: the suggestions should not move while they are being tried.
  const found = useMemo(() => session.analyzePicture(), [session]);
  const [base, setBase] = useState<string | null>(null);
  const color = base ?? found?.palette[0] ?? null;
  const applyCrop = (c: Crop) => editor.applyPreset({ cropX: c.x, cropY: c.y, cropW: c.w, cropH: c.h });
  const cropped = adjustments.cropW < 1 || adjustments.cropH < 1;
  if (!found) return <div className="muted">{t('Abrindo a foto…')}</div>;
  const swatch = (hex: string) => (
    <button
      key={hex}
      className={`chip${hex === color ? ' on' : ''}`}
      onClick={() => {
        setBase(hex);
        editor.setBrush({ color: hex });
        editor.setTextDraft({ color: hex });
      }}
      aria-label={hex}
    >
      <span style={{ display: 'inline-block', width: 20, height: 20, background: hex, verticalAlign: 'middle' }} />
    </button>
  );
  return (
    <>
      <div className="sub">{t('Paleta da foto')}</div>
      <div className="chips">{found.palette.map(swatch)}</div>
      {color &&
        harmonies(color).map((h) => (
          <div key={h.name}>
            <div className="sub">{t(h.name)}</div>
            <div className="chips">{h.colors.map(swatch)}</div>
          </div>
        ))}
      <div className="muted">{t('A cor tocada vira a cor do pincel e do texto.')}</div>
      <div className="sub">{t('Sugestões de corte')}</div>
      {found.crops.length === 0 && <div className="muted">{t('Nenhuma sugestão para esta foto.')}</div>}
      <div className="chips">
        {found.crops.map((c) => (
          <button
            key={c.aspect}
            className={`chip${Math.abs(adjustments.cropX - c.x) < 0.001 && Math.abs(adjustments.cropW - c.w) < 0.001 && Math.abs(adjustments.cropY - c.y) < 0.001 && Math.abs(adjustments.cropH - c.h) < 0.001 ? ' on' : ''}`}
            onClick={() => applyCrop(c)}
          >
            {c.aspect} · {t(c.rule)}
          </button>
        ))}
        <button className="chip" disabled={!cropped} onClick={() => applyCrop({ x: 0, y: 0, w: 1, h: 1 })}>
          {t('Sem corte')}
        </button>
      </div>
    </>
  );
}
