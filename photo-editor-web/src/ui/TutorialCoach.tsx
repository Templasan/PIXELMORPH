import { useEffect, useState } from 'react';
import type { PhotoSession } from '../application/session';
import { nextStep, type TutorialStep } from '../application/tutorials';
import { t } from '../i18n';

/** RF-056: says what to do next, and moves on when it is done. It can be left at any time. */
export function TutorialCoach({ session, steps }: { session: PhotoSession; steps: TutorialStep[] }) {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const check = () => setStep((at) => nextStep(steps, at, session.editor.store.get()));
    check();
    return session.editor.store.subscribe(check);
  }, [session, steps]);
  if (!open) return null;
  const finished = step >= steps.length;
  return (
    <div className="coach" role="status">
      <span>
        {finished ? t('Pronto! A foto é sua para continuar editando.') : `${step + 1}/${steps.length} · ${t(steps[step].text)}`}
      </span>
      <button className="chip" onClick={() => setOpen(false)}>
        {finished ? t('Fechar') : t('Sair do tutorial')}
      </button>
    </div>
  );
}
