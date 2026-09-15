import { useCallback, useEffect, useRef, useState } from 'react';
import { HistoryStore } from './HistoryStore';
import { LocalHistoryRepository } from './LocalHistoryRepository';
import { Operation, createOperation } from './Operation';

/**
 * React glue for HistoryStore + LocalHistoryRepository: unlimited, persisted undo/redo
 * (RF-027) that also acts as the autosave mechanism (RNF-005) — every push/undo/redo
 * writes straight through to AsyncStorage.
 */
export function usePersistedHistory(sessionId: string) {
  const storeRef = useRef(new HistoryStore());
  const repoRef = useRef(new LocalHistoryRepository());
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0); // bump to force re-render after store mutations

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    repoRef.current.load(sessionId).then((snapshot) => {
      if (cancelled) return;
      storeRef.current = new HistoryStore(snapshot ?? undefined);
      setReady(true);
      setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const persist = useCallback(() => {
    repoRef.current.save(sessionId, storeRef.current.toSnapshot());
  }, [sessionId]);

  const push = useCallback(
    <TValue>(type: string, from: TValue, to: TValue, extraParams?: Record<string, unknown>) => {
      storeRef.current.push(createOperation(type, from, to, extraParams));
      persist();
      setVersion((v) => v + 1);
    },
    [persist]
  );

  const undo = useCallback((): Operation | undefined => {
    const op = storeRef.current.undo();
    if (op) {
      persist();
      setVersion((v) => v + 1);
    }
    return op;
  }, [persist]);

  const redo = useCallback((): Operation | undefined => {
    const op = storeRef.current.redo();
    if (op) {
      persist();
      setVersion((v) => v + 1);
    }
    return op;
  }, [persist]);

  return {
    ready,
    push,
    undo,
    redo,
    canUndo: storeRef.current.canUndo,
    canRedo: storeRef.current.canRedo,
    log: storeRef.current.log,
    reconstructState: storeRef.current.reconstructState.bind(storeRef.current),
    // Exposed so a screen can key its own re-render effects off history changes.
    version,
  };
}
