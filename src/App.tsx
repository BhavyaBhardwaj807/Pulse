import React, { useState } from 'react';
import { SettingsProvider } from './context/SettingsContext';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
import { MedicationProvider } from './context/MedicationContext';
import { RoleProvider } from './context/RoleContext';

import { Layout } from './components/Layout';
import { RoleGuard } from './components/RoleGuard';
import { Home } from './pages/Home';
import { Medicines } from './pages/Medicines';
import { Documents } from './pages/Documents';
import { AdherenceReport } from './pages/AdherenceReport';
import { Assistant } from './pages/Assistant';
import { CaregiverLink } from './pages/CaregiverLink';
import { NearbyCare } from './pages/NearbyCare';
import { Appointments } from './pages/Appointments';
import Login from './pages/Login';

import './App.css';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');

  const { user, loading } = useFirebase();

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'home':
        return (
          <Home
            onOpenReport={() => setActiveTab('reports')}
            onOpenNearby={() => setActiveTab('nearby')}
          />
        );
      case 'medicines':
        return <Medicines />;
      case 'documents':
        return <Documents />;
      case 'reports':
        return <AdherenceReport />;
      case 'assistant':
      case 'caregiver':
        return <Assistant />;
      case 'caregiver-link':
        return <CaregiverLink />;
      case 'appointments':
        return <Appointments />;
      case 'nearby':
        return <NearbyCare />;
      default:
        return (
          <Home
            onOpenReport={() => setActiveTab('reports')}
            onOpenNearby={() => setActiveTab('nearby')}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950 text-navy-100">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold">Loading PULSE…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <RoleProvider>
      {/* MedicationProvider lives inside RoleProvider so useActivePatient
          (defined in RoleContext) is available to it. */}
      <MedicationProvider>
        <RoleGuard activeTab={activeTab} setActiveTab={setActiveTab}>
          <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
            {renderActiveTab()}
          </Layout>
        </RoleGuard>
      </MedicationProvider>
    </RoleProvider>
  );
};

function App() {
  return (
    <SettingsProvider>
      <FirebaseProvider>
        <AppContent />
      </FirebaseProvider>
    </SettingsProvider>
  );
}

export default App;
