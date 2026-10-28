/**
 * Request/response over the React Native WebView bridge. The page posts
 * {id, method, args}; the app answers by calling window.__pmReply({id, result | error}).
 */
interface RNWindow extends Window {
  ReactNativeWebView?: { postMessage(message: string): void };
  __pmReply?: (reply: { id: number; result?: unknown; error?: string }) => void;
  __pmEvent?: (event: { type: string; [key: string]: unknown }) => void;
}

const w = window as RNWindow;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let nextId = 1;

w.__pmReply = (reply) => {
  const p = pending.get(reply.id);
  if (!p) return;
  pending.delete(reply.id);
  if (reply.error !== undefined) p.reject(new Error(reply.error));
  else p.resolve(reply.result);
};

export const inApp = () => !!w.ReactNativeWebView;

const listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();
/** Events the app pushes without being asked (window.__pmEvent({type, ...})). */
w.__pmEvent = (event) => listeners.get(event.type)?.forEach((l) => l(event));

export function onEvent(type: string, listener: (event: Record<string, unknown>) => void) {
  let set = listeners.get(type);
  if (!set) listeners.set(type, (set = new Set()));
  set.add(listener);
}

export function call<T>(method: string, ...args: unknown[]): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.ReactNativeWebView!.postMessage(JSON.stringify({ id, method, args }));
  });
}
