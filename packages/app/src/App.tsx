import React, { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import { queryClient } from './queryClient';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { LOCAL_MODE } from './api';
import { Spinner } from './components/ui/primitives';
import { QueryError } from './components/ui/QueryError';

dayjs.locale('zh-cn');

const CalendarView = lazy(() => import('./views/CalendarView').then(module => ({ default: module.CalendarView })));
const LoginView = lazy(() => import('./views/LoginView').then(module => ({ default: module.LoginView })));
const InvitationView = lazy(() => import('./views/InvitationView').then(module => ({ default: module.InvitationView })));

function AppLoading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white dark:bg-zinc-950">
      <Spinner label="正在加载工作台…" />
    </div>
  );
}

function readInvitation() {
  return LOCAL_MODE ? null : new URLSearchParams(window.location.hash.slice(1)).get('invite');
}

const AppContent: React.FC = () => {
  const { user, isInitialized, authError, initAuth, setSession } = useAuthStore();
  const [invitation, setInvitation] = useState(readInvitation);

  useEffect(() => {
    if (!invitation && !isInitialized) void initAuth();
  }, [initAuth, invitation, isInitialized]);

  useEffect(() => {
    if (LOCAL_MODE) return;
    const onHashChange = () => setInvitation(readInvitation());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (invitation) {
    const closeInvitation = () => {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      setInvitation(null);
    };
    return <InvitationView key={invitation} token={invitation} onClose={closeInvitation} onAccepted={session => {
      setSession(session);
      closeInvitation();
    }} />;
  }

  if (!isInitialized) return <AppLoading />;

  if (authError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <QueryError message={authError} retry={initAuth} />
      </div>
    );
  }

  if (!user) return LOCAL_MODE ? <AppLoading /> : <LoginView />;

  return <CalendarView key={user.id} />;
};

export const App: React.FC = () => {
  const { resolvedTheme } = useThemeStore();
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster theme={resolvedTheme} richColors position="top-center" />
      <Suspense fallback={<AppLoading />}><AppContent /></Suspense>
    </QueryClientProvider>
  );
};
