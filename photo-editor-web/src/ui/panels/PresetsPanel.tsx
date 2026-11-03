import { t } from '../../i18n';
import { useEffect, useState } from 'react';
import type { PhotoSession } from '../../application/session';
import { useStore } from '../../state/useStore';

/** Presets (US-02): the saved looks, applied in one undo step; save the current one. */
export function PresetsPanel({ session }: { session: PhotoSession }) {
  const presets = useStore(session.presets);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    session.loadPresets().catch((e) => setError(String(e?.message ?? e)));
  }, [session]);
  const save = () =>
    session
      .savePreset(name)
      .then(() => setName(''))
      .catch((e) => setError(t('Não foi possível salvar: {msg}', { msg: e?.message ?? e })));
  return (
    <>
      {presets === null ? (
        <div className="muted">{t('Carregando…')}</div>
      ) : presets.length === 0 ? (
        <div className="muted">{t('Nenhum preset salvo ainda.')}</div>
      ) : (
        <div className="chips">
          {presets.map((p) => (
            <button key={p.id} className="chip" onClick={() => session.applyPreset(p)}>
              {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="field row">
        <input type="text" placeholder={t('Nome do preset')} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="chip" disabled={!name.trim()} onClick={save}>
          {t('Salvar ajustes atuais')}
        </button>
      </div>
      {error && <div className="muted">{error}</div>}
      <BatchSection session={session} />
    </>
  );
}

/** Edição em lote (US-02): this photo's look, or a preset, applied to other photo projects. */
function BatchSection({ session }: { session: PhotoSession }) {
  const presets = useStore(session.presets) ?? [];
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const start = () => {
    setOpen(true);
    session.listPhotoProjects().then(setProjects, (e) => setMessage(String(e?.message ?? e)));
  };
  const apply = () => {
    const total = chosen.length;
    setApplying(true);
    setMessage(t('Aplicando {done} de {total}…', { done: 0, total }));
    return session
      .applyLookTo(chosen, presets.find((p) => p.id === source) ?? null, (done) =>
        setMessage(t('Aplicando {done} de {total}…', { done, total }))
      )
      .then((n) => {
        setMessage(t(n === 1 ? 'Aplicado em 1 foto.' : 'Aplicado em {n} fotos.', { n }));
        setChosen([]);
      })
      .catch((e) => setMessage(t('Não foi possível aplicar: {msg}', { msg: e?.message ?? e })))
      .finally(() => setApplying(false));
  };
  if (!open)
    return (
      <button className="chip" onClick={start}>
        {t('Edição em lote…')}
      </button>
    );
  return (
    <div className="field">
      <div className="sub">{t('Aplicar')}</div>
      <div className="chips">
        <button className={`chip${source === '' ? ' on' : ''}`} onClick={() => setSource('')}>
          {t('Ajustes desta foto')}
        </button>
        {presets.map((p) => (
          <button key={p.id} className={`chip${source === p.id ? ' on' : ''}`} onClick={() => setSource(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="sub">{t('Em')}</div>
      {projects === null ? (
        <div className="muted">{t('Carregando…')}</div>
      ) : projects.length === 0 ? (
        <div className="muted">{t('Não há outras fotos.')}</div>
      ) : (
        <div className="chips">
          {projects.map((p) => (
            <button
              key={p.id}
              className={`chip${chosen.includes(p.id) ? ' on' : ''}`}
              onClick={() => setChosen((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id]))}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <button className="primary-btn wide" disabled={chosen.length === 0 || applying} onClick={apply}>
        {t(chosen.length === 1 ? 'Aplicar em 1 foto' : 'Aplicar em {n} fotos', { n: chosen.length })}
      </button>
      {message && <div className="muted">{message}</div>}
    </div>
  );
}
