import { useState, useEffect } from 'react';
import { SimulationProvider } from './context/SimulationContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminDashboard } from './pages/AdminDashboard';
import { AmbulanceDashboard } from './pages/AmbulanceDashboard';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AmbulanceLoginPage } from './pages/AmbulanceLoginPage';

function MainRouter() {
  const { isAdminLoggedIn, isAmbulanceLoggedIn } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname.toLowerCase());

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname.toLowerCase());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path.toLowerCase());
  };

  // 1. Ambulance Login Route
  if (currentPath.includes('/ambulance/login')) {
    return (
      <AmbulanceLoginPage
        onLoginSuccess={() => navigateTo('/ambulance')}
        onNavigateToAdminLogin={() => navigateTo('/admin/login')}
      />
    );
  }

  // 2. Admin Login Route
  if (currentPath.includes('/admin/login') || currentPath === '/login') {
    return (
      <AdminLoginPage
        onLoginSuccess={() => navigateTo('/admin')}
        onNavigateToAmbulanceLogin={() => navigateTo('/ambulance/login')}
      />
    );
  }

  // 3. Ambulance Dashboard Route (Guarded)
  if (currentPath.includes('/ambulance')) {
    if (!isAmbulanceLoggedIn) {
      return (
        <AmbulanceLoginPage
          onLoginSuccess={() => navigateTo('/ambulance')}
          onNavigateToAdminLogin={() => navigateTo('/admin/login')}
        />
      );
    }
    return (
      <AmbulanceDashboard
        activeTab="ambulance"
        onSwitchTab={(tab) => navigateTo(tab === 'admin' ? '/admin' : '/ambulance')}
      />
    );
  }

  // 4. Admin Dashboard Route (Guarded - Default)
  if (!isAdminLoggedIn) {
    return (
      <AdminLoginPage
        onLoginSuccess={() => navigateTo('/admin')}
        onNavigateToAmbulanceLogin={() => navigateTo('/ambulance/login')}
      />
    );
  }

  return (
    <AdminDashboard
      activeTab="admin"
      onSwitchTab={(tab) => navigateTo(tab === 'admin' ? '/admin' : '/ambulance')}
    />
  );
}

export function App() {
  return (
    <AuthProvider>
      <SimulationProvider>
        <div className="relative w-screen h-screen overflow-hidden font-sans">
          <MainRouter />
        </div>
      </SimulationProvider>
    </AuthProvider>
  );
}

export default App;
