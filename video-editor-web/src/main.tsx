import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createEditorSession } from './application/session';
import { createDevHost } from './adapters/dev/devHost';
import { App } from './ui/App';
import './ui/styles.css';

const session = createEditorSession(createDevHost());
void session.load().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App session={session} />
    </StrictMode>
  );
});
// Dev only: lets tests and the console drive the editor.
(window as unknown as { pm: typeof session }).pm = session;
