import { useState, useCallback } from 'react';
import LoginScreen from './screens/Login';
import ProjectsScreen from './screens/Projects';
import CameraScreen from './screens/Camera';
import PhotoEditorScreen from './screens/PhotoEditor';
import VideoEditorScreen from './screens/VideoEditor';
import CommunityScreen from './screens/Community';
import TutorialsScreen from './screens/Tutorials';
import PresetsScreen from './screens/Presets';
import StorageScreen from './screens/Storage';
import AccountScreen from './screens/Account';
import SignUpScreen from './screens/SignUp';
import HelpScreen from './screens/Help';
import ExportModal from './screens/Export';
import SideDrawer from './components/SideDrawer';

export type Screen =
  | 'login'
  | 'projects'
  | 'camera'
  | 'photoEditor'
  | 'videoEditor'
  | 'community'
  | 'tutorials'
  | 'presets'
  | 'storage'
  | 'account'
  | 'help'
  | 'signup';

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const navigate = useCallback((s: Screen) => {
    setScreen(s);
    setDrawerOpen(false);
  }, []);

  const showsDrawer = screen !== 'login' && screen !== 'camera';

  return (
    <div
      style={{
        background: '#0D0D0D',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 390,
          height: 844,
          position: 'relative',
          overflow: 'hidden',
          background: '#1A1A1A',
          flexShrink: 0,
        }}
      >
        {screen === 'login' && <LoginScreen navigate={navigate} />}
        {screen === 'projects' && (
          <ProjectsScreen navigate={navigate} onOpenDrawer={() => setDrawerOpen(true)} />
        )}
        {screen === 'camera' && <CameraScreen navigate={navigate} />}
        {screen === 'photoEditor' && (
          <PhotoEditorScreen
            navigate={navigate}
            onOpenDrawer={() => setDrawerOpen(true)}
            onExport={() => setExportOpen(true)}
          />
        )}
        {screen === 'videoEditor' && (
          <VideoEditorScreen
            navigate={navigate}
            onOpenDrawer={() => setDrawerOpen(true)}
            onExport={() => setExportOpen(true)}
          />
        )}
        {screen === 'community' && (
          <CommunityScreen navigate={navigate} onOpenDrawer={() => setDrawerOpen(true)} />
        )}
        {screen === 'tutorials' && (
          <TutorialsScreen navigate={navigate} onOpenDrawer={() => setDrawerOpen(true)} />
        )}
        {screen === 'presets' && (
          <PresetsScreen navigate={navigate} onOpenDrawer={() => setDrawerOpen(true)} />
        )}
        {screen === 'storage' && (
          <StorageScreen navigate={navigate} onOpenDrawer={() => setDrawerOpen(true)} />
        )}
        {screen === 'signup' && <SignUpScreen navigate={navigate} />}
        {screen === 'account' && <AccountScreen navigate={navigate} />}
        {screen === 'help' && (
          <HelpScreen navigate={navigate} onOpenDrawer={() => setDrawerOpen(true)} />
        )}

        {showsDrawer && (
          <SideDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            navigate={navigate}
            currentScreen={screen}
          />
        )}

        {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
      </div>
    </div>
  );
}
