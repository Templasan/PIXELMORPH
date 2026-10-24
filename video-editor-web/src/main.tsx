import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createEditorSession } from './application/session';
import { createDevHost } from './adapters/dev/devHost';
import { createAndroidHost } from './adapters/android/androidHost';
import { inApp } from './adapters/android/bridge';
import { createTestKit } from './adapters/dev/testKit';
import { App } from './ui/App';
import './ui/styles.css';

// Inside the Android app the host is the app (bridge); in a desktop browser, the dev host.
const session = createEditorSession(inApp() ? createAndroidHost() : createDevHost());
void session.load().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App session={session} />
    </StrictMode>
  );
});
// Dev only: lets tests and the console drive the editor.
(window as unknown as { pm: typeof session }).pm = session;
if (import.meta.env.DEV) {
  (window as unknown as { T: ReturnType<typeof createTestKit> }).T = createTestKit(session);
}
