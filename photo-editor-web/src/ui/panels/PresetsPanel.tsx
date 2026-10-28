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
    </>
  );
}
