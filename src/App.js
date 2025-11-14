import React, { useState, useEffect } from 'react';
import medicalHistoryData from './medicalHistory.json';
import Header from './components/Header';
import StatsGrid from './components/StatsGrid';
import AddMedicationForm from './components/AddMedicationForm';
import AdherenceReport from './components/AdherenceReport';
import SmartScanner from './components/SmartScanner';
import ProfileForm from './components/ProfileForm';
import AgoraVoice from './components/AgoraVoice';
import MedicationGrid from './components/MedicationGrid';
import { useMedications } from './hooks/useMedications';
import { useScanner } from './hooks/useScanner';
import { useVoiceInput } from './hooks/useVoiceInput';
import './App.css';

function App() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAgoraVoice, setShowAgoraVoice] = useState(false);
  const [agoraConnected, setAgoraConnected] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: '', time: '', color: '#3b82f6' });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [adherenceHistory, setAdherenceHistory] = useState([]);
  const [medicationStats, setMedicationStats] = useState({});
  const [userProfile, setUserProfile] = useState({ email: '', name: '', remindersEnabled: false });
  const [medicalHistory, setMedicalHistory] = useState(medicalHistoryData);
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);

  const { medications, streak, addMedication, toggleTaken, deleteMedication } = useMedications();
  const { stream, isScanning, startCamera, stopCamera, scanMedicine } = useScanner();
  const { isListening, recognition, startVoiceInput, parseSpeechToMedicine } = useVoiceInput();

  useEffect(() => {
    const savedProfile = localStorage.getItem('pulse-profile');
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));
    
    const savedDetails = localStorage.getItem('pulse-additional-details');
    if (savedDetails) setAdditionalDetails(savedDetails);
    
    const history = Array.from({length: 7}, (_, i) => {
      const taken = Math.floor(Math.random() * 4) + 2;
      const total = 5;
      return {
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        taken,
        total,
        percentage: Math.round((taken / total) * 100)
      };
    }).reverse();
    setAdherenceHistory(history);
    
    const savedStats = localStorage.getItem('pulse-med-stats');
    if (!savedStats) {
      const stats = {};
      [1, 2, 3, 4, 5].forEach(id => {
        const expectedDaily = id === 2 ? 2 : id === 3 ? 1 : 1;
        const expectedWeekly = expectedDaily * 7;
        const actualTaken = Math.floor(expectedWeekly * (0.7 + Math.random() * 0.25));
        stats[id] = {
          expectedWeekly,
          actualTaken,
          adherenceRate: Math.round((actualTaken / expectedWeekly) * 100)
        };
      });
      setMedicationStats(stats);
      localStorage.setItem('pulse-med-stats', JSON.stringify(stats));
    } else {
      setMedicationStats(JSON.parse(savedStats));
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showCamera) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [showCamera, startCamera, stopCamera]);

  const handleAddMedication = (e) => {
    e.preventDefault();
    if (!newMed.name || !newMed.dosage) return;
    
    addMedication(newMed, userProfile, addToGoogleCalendar);
    setNewMed({ name: '', dosage: '', frequency: '', time: '', color: '#3b82f6' });
    setShowAddForm(false);
  };

  const handleScanSuccess = (result) => {
    setNewMed({...newMed, name: result.name, dosage: result.dosage || 'Not specified'});
    stopCamera();
    setShowCamera(false);
    setShowAddForm(true);
  };

  const handleScanError = (error) => {
    const suggestions = 'Common medicines: Paracetamol, Ibuprofen, Aspirin, Vitamin D, Metformin, Lisinopril';
    const name = prompt(`${error}\n\n${suggestions}\n\nEnter medicine name manually:`);
    
    if (name && name.trim()) {
      const cleanName = name.trim().split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      
      const dosage = prompt('Enter dosage (e.g., 500mg, 10ml, 2 tablets):') || 'Not specified';
      
      setNewMed({...newMed, name: cleanName, dosage});
      stopCamera();
      setShowCamera(false);
      setShowAddForm(true);
      
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(`Added ${cleanName} manually. Please review the details.`);
        speechSynthesis.speak(utterance);
      }
    }
  };

  const handleVoiceInput = async () => {
    if (agoraConnected) {
      setShowAgoraVoice(true);
      return;
    }
    
    if (!recognition) {
      setShowAgoraVoice(true);
      return;
    }
    
    startVoiceInput(
      (result) => {
        setNewMed(result);
        setShowCamera(false);
        setShowAddForm(true);
      },
      (error) => {
        alert(error);
      }
    );
  };

  const saveProfile = (e) => {
    e.preventDefault();
    localStorage.setItem('pulse-profile', JSON.stringify(userProfile));
    setShowProfile(false);
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Profile saved. Reminders will be synced to Google Calendar.');
      speechSynthesis.speak(utterance);
    }
  };

  const addToGoogleCalendar = (medication) => {
    const startDate = new Date();
    const [hours, minutes] = medication.time.split(':');
    startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const endDate = new Date(startDate.getTime() + 15 * 60000);
    
    const event = {
      summary: `Take ${medication.name}`,
      description: `Medication: ${medication.name}\\nDosage: ${medication.dosage}\\nFrequency: ${medication.frequency}`,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      recurrence: getRecurrenceRule(medication.frequency)
    };
    
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.summary)}&dates=${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(event.description)}&recur=${encodeURIComponent(event.recurrence)}`;
    
    window.open(calendarUrl, '_blank');
  };

  const getRecurrenceRule = (frequency) => {
    switch (frequency) {
      case 'Once daily': return 'RRULE:FREQ=DAILY';
      case 'Twice daily': return 'RRULE:FREQ=DAILY;INTERVAL=1';
      case 'Three times daily': return 'RRULE:FREQ=DAILY;INTERVAL=1';
      default: return 'RRULE:FREQ=DAILY';
    }
  };

  const agoraRtcProps = {
    appId: 'e7f6e9aeecf14b2ba10e3f40be9f56e7',
    channel: 'pulse-voice-' + Date.now(),
    token: null
  };

  const agoraCallbacks = {
    EndCall: () => {
      setShowAgoraVoice(false);
      setAgoraConnected(false);
      setTimeout(() => {
        const sampleInput = 'Paracetamol 500mg once daily';
        const result = parseSpeechToMedicine(sampleInput);
        setNewMed(result);
        setShowCamera(false);
        setShowAddForm(true);
      }, 1000);
    }
  };

  const todaysTaken = medications.filter(med => med.taken).length;
  const totalToday = medications.length;
  const completionRate = totalToday > 0 ? Math.round((todaysTaken / totalToday) * 100) : 0;
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <div className="app">
      <div className="animated-bg">
        <div className="pulse-wave"></div>
        <div className="pulse-wave"></div>
        <div className="pulse-wave"></div>
      </div>
      
      <Header 
        currentTime={currentTime}
        onProfileClick={() => setShowProfile(true)}
      />

      <main className="main">
        <div className="container">
          <StatsGrid 
            completionRate={completionRate}
            todaysTaken={todaysTaken}
            totalToday={totalToday}
            streak={streak}
            medications={medications}
          />

          <div className="dashboard">
            <div className="dashboard-header">
              <h2>Today's Medications</h2>
              <div className="header-actions">
                <button 
                  className="scan-btn"
                  onClick={() => setShowCamera(true)}
                >
                  📷🎤 Smart Add
                </button>
                <button 
                  className="report-btn"
                  onClick={() => setShowReport(true)}
                >
                  📊 Report
                </button>
                <button 
                  className="add-btn floating-btn"
                  onClick={() => setShowAddForm(true)}
                >
                  <span className="btn-icon">+</span>
                  Manual Add
                </button>
              </div>
            </div>

            <AddMedicationForm 
              showAddForm={showAddForm}
              setShowAddForm={setShowAddForm}
              newMed={newMed}
              setNewMed={setNewMed}
              addMedication={handleAddMedication}
              colors={colors}
            />

            <AdherenceReport 
              showReport={showReport}
              setShowReport={setShowReport}
              adherenceHistory={adherenceHistory}
              medications={medications}
              medicationStats={medicationStats}
              medicalHistory={medicalHistory}
              additionalDetails={additionalDetails}
              setAdditionalDetails={setAdditionalDetails}
              showAdditionalDetails={showAdditionalDetails}
              setShowAdditionalDetails={setShowAdditionalDetails}
            />

            <SmartScanner 
              showCamera={showCamera}
              setShowCamera={setShowCamera}
              isScanning={isScanning}
              isListening={isListening}
              setIsListening={() => {}}
              stream={stream}
              scanMedicine={() => scanMedicine(handleScanSuccess, handleScanError)}
              startVoiceInput={handleVoiceInput}
              recognition={recognition}
            />

            <ProfileForm 
              showProfile={showProfile}
              setShowProfile={setShowProfile}
              userProfile={userProfile}
              setUserProfile={setUserProfile}
              saveProfile={saveProfile}
            />

            <AgoraVoice 
              showAgoraVoice={showAgoraVoice}
              setShowAgoraVoice={setShowAgoraVoice}
              agoraRtcProps={agoraRtcProps}
              agoraCallbacks={agoraCallbacks}
            />

            <MedicationGrid 
              medications={medications}
              setShowAddForm={setShowAddForm}
              toggleTaken={toggleTaken}
              deleteMedication={deleteMedication}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;