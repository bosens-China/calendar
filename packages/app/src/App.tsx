import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import { queryClient } from './queryClient';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { LoginView } from './views/LoginView';
import { CalendarView } from './views/CalendarView';
import { Spinner } from './components/ui/primitives';

dayjs.locale('zh-cn');

const AppContent: React.FC = () => {
  const { token, user, isInitialized, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white dark:bg-zinc-950">
        <Spinner label="正在加载排期画布..." />
      </div>
    );
  }

  if (!token || !user) {
    return <LoginView />;
  }

  return <CalendarView key={user.id} />;
};

export const App: React.FC = () => {
  const { resolvedTheme } = useThemeStore();
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster theme={resolvedTheme} richColors position="top-center" />
      <AppContent />
    </QueryClientProvider>
  );
};
