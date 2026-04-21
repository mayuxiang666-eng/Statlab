import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './AuthPage';
import StatLabApp from './App';
import { Spin } from 'antd';

type RuntimeErrorState = {
  hasError: boolean;
  message: string;
};

const RELOAD_GUARD_KEY = 'statlab_runtime_reload_once';

const isLikelyResourceLoadError = (msg: string) => {
  const text = msg.toLowerCase();
  return (
    text.includes('chunkloaderror') ||
    text.includes('loading chunk') ||
    text.includes('failed to fetch dynamically imported module') ||
    text.includes('loading css chunk') ||
    text.includes('script error')
  );
};

const clearBrowserCaches = async () => {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore cache API failures
  }
};

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = React.useState<RuntimeErrorState>({ hasError: false, message: '' });

  React.useEffect(() => {
    const handleRuntimeFailure = (message: string) => {
      // Resource/chunk loading failures are often recoverable via one-time reload.
      if (isLikelyResourceLoadError(message) && !sessionStorage.getItem(RELOAD_GUARD_KEY)) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
        window.location.reload();
        return;
      }

      setState({ hasError: true, message });
    };

    const handleError = (event: ErrorEvent) => {
      const msg = event?.error?.message || event?.message || 'Unknown runtime error';
      console.error('[App Global Error]', event);
      handleRuntimeFailure(msg);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = typeof reason === 'string' ? reason : reason?.message || 'Unhandled promise rejection';
      console.error('[App Unhandled Rejection]', event);
      handleRuntimeFailure(msg);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (state.hasError) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#f5f5f7',
          padding: 20,
          textAlign: 'center',
          gap: 12,
        }}
      >
        <h2 style={{ marginBottom: 4 }}>应用启动失败</h2>
        <p style={{ color: '#86868b', marginBottom: 4 }}>
          检测到某些组件资源未能正确加载。请尝试刷新页面或清除缓存。
        </p>
        <p style={{ color: '#9ca3af', fontSize: 12, maxWidth: 680, wordBreak: 'break-word' }}>
          Error: {state.message}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => {
              sessionStorage.removeItem(RELOAD_GUARD_KEY);
              window.location.reload();
            }}
            style={{
              padding: '10px 24px',
              borderRadius: 12,
              background: '#111827',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            立即刷新
          </button>
          <button
            onClick={async () => {
              await clearBrowserCaches();
              sessionStorage.removeItem(RELOAD_GUARD_KEY);
              window.location.reload();
            }}
            style={{
              padding: '10px 24px',
              borderRadius: 12,
              background: '#fff',
              color: '#111827',
              border: '1px solid #d1d5db',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            清缓存并刷新
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f5f5f7' }}>
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#86868b', fontWeight: 500 }}>初始化加密环境...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <StatLabApp />;
};

const AppWrapper: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default AppWrapper;
