import type { EditorSession } from '../application/session';
import type { QualitySetting, Tier } from '../domain/previewQuality';
import { t } from '../i18n';

const TIER_LABEL: Record<Tier, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

/** The chip on the preview: "Prévia: Média (auto)" when the person left it on Automática. */
export function qualityChipText(quality: { setting: QualitySetting; tier: Tier }): string {
  const text = t('Prévia: {tier}', { tier: t(TIER_LABEL[quality.tier]) });
  return quality.setting === 'auto' ? `${text} ${t('(auto)')}` : text;
}

/** Choosing a quality reopens the editor (the page is replaced), so the sheet only closes here. */
export function QualitySheet({ session, onClose }: { session: EditorSession; onClose: () => void }) {
  const { setting, auto } = session.quality;
  const options: { setting: QualitySetting; label: string }[] = [
    { setting: 'auto', label: `${t('Automática')} (${t(TIER_LABEL[auto])})` },
    { setting: 'alta', label: t('Alta') },
    { setting: 'media', label: t('Média') },
    { setting: 'baixa', label: t('Baixa') },
  ];
  const choose = (next: QualitySetting) => {
    onClose();
    if (next !== setting) void session.setPreviewQuality(next);
  };
  return (
    <div className="sheet-veil" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <span>{t('Qualidade da prévia')}</span>
          <button className="icon-btn" onClick={onClose} aria-label={t('Fechar')}>
            ✕
          </button>
        </div>
        <div className="chips quality-list">
          {options.map((o) => (
            <button key={o.setting} className={`chip${setting === o.setting ? ' on' : ''}`} onClick={() => choose(o.setting)}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="muted">{t('O vídeo final usa sempre os arquivos originais.')}</p>
      </div>
    </div>
  );
}
