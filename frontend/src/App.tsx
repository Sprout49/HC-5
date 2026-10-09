import { useState, useEffect } from 'react';
import { SimulationProvider } from './context/SimulationContext';
import { AdminDashboard } from './pages/AdminDashboard';
import { AmbulanceDashboard } from './pages/AmbulanceDashboard';

export function App() {
  const [activeTab, setActiveTab] = useState<'admin' | 'ambulance'>('admin');

  // Sync with browser URL path if /ambulance or /admin
  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('ambulance')) {
      setActiveTab('ambulance');
    } else {
      setActiveTab('admin');
    }
  }, []);

  const switchTab = (tab: 'admin' | 'ambulance') => {
    setActiveTab(tab);
    window.history.pushState({}, '', tab === 'ambulance' ? '/ambulance' : '/admin');
  };

  return (
    <SimulationProvider>
      <div className="relative w-screen h-screen overflow-hidden font-sans">
        {/* Active Dashboard View with integrated switcher */}
        {activeTab === 'admin' ? (
          <AdminDashboard activeTab={activeTab} onSwitchTab={switchTab} />
        ) : (
          <AmbulanceDashboard activeTab={activeTab} onSwitchTab={switchTab} />
        )}
      </div>
    </SimulationProvider>
  );
}

export default App;
