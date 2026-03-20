import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './AuthPage';
import StatLabApp from './App';
import { Spin } from 'antd';

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = React.useState(false);
  React.useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error("[App Global Error]", error);
      setHasError(true);
    };
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (hasError) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f5f5f7', padding: 20, textAlign: 'center' }}>
        <h2 style={{ marginBottom: 12 }}>应用启动失败</h2>
        <p style={{ color: '#86868b', marginBottom: 24 }}>检测到某些组件资源未能正确加载。请尝试刷新页面或清除缓存。</p>
        <button 
          onClick={() => window.location.reload()}
          style={{ padding: '10px 24px', borderRadius: 12, background: '#111827', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          立即刷新
        </button>
      </div>
    );
  }
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  
  console.log("[AppWrapper] auth status:", { user: !!user, loading });

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
