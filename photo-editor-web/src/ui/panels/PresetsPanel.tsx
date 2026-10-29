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
      .catch((e) => setError(`Não foi possível salvar: ${e?.message ?? e}`));
  return (
    <>
      {presets === null ? (
        <div className="muted">Carregando…</div>
      ) : presets.length === 0 ? (
        <div className="muted">Nenhum preset salvo ainda.</div>
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
        <input type="text" placeholder="Nome do preset" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="chip" disabled={!name.trim()} onClick={save}>
          Salvar ajustes atuais
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
  const start = () => {
    setOpen(true);
    session.listPhotoProjects().then(setProjects, (e) => setMessage(String(e?.message ?? e)));
  };
  const apply = () =>
    session
      .applyLookTo(chosen, presets.find((p) => p.id === source) ?? null)
      .then((n) => {
        setMessage(`Aplicado em ${n} ${n === 1 ? 'foto' : 'fotos'}.`);
        setChosen([]);
      })
      .catch((e) => setMessage(`Não foi possível aplicar: ${e?.message ?? e}`));
  if (!open)
    return (
      <button className="chip" onClick={start}>
        Edição em lote…
      </button>
    );
  return (
    <div className="field">
      <div className="sub">Aplicar</div>
      <div className="chips">
        <button className={`chip${source === '' ? ' on' : ''}`} onClick={() => setSource('')}>
          Ajustes desta foto
        </button>
        {presets.map((p) => (
          <button key={p.id} className={`chip${source === p.id ? ' on' : ''}`} onClick={() => setSource(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      <div className="sub">Em</div>
      {projects === null ? (
        <div className="muted">Carregando…</div>
      ) : projects.length === 0 ? (
        <div className="muted">Não há outras fotos.</div>
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
      <button className="primary-btn wide" disabled={chosen.length === 0} onClick={apply}>
        Aplicar em {chosen.length} {chosen.length === 1 ? 'foto' : 'fotos'}
      </button>
      {message && <div className="muted">{message}</div>}
    </div>
  );
}
