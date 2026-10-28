import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createPhotoSession } from './application/session';
import { createDevHost } from './adapters/dev/devHost';
import { createAndroidHost } from './adapters/android/androidHost';
import { inApp } from './adapters/android/bridge';
import { App } from './ui/App';
import './ui/styles.css';

performance.mark('pm:script');
// Inside the Android app the host is the app (bridge); in a desktop browser, the dev host.
const session = createPhotoSession(inApp() ? createAndroidHost() : createDevHost());
void session.load().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App session={session} />
    </StrictMode>
  );
});
// Lets tests and the console drive the editor.
(window as unknown as { pm: typeof session }).pm = session;
