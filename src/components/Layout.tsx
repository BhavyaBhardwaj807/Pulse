import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Pill,
  FileText,
  Sparkles,
  Mic,
  Settings,
  X,
  Volume2,
  ShieldAlert,
  Menu,
  LogOut,
  User as UserIcon,
  Users,
  Link as LinkIcon,
  ChevronLeft,
  MapPin,
  CalendarCheck,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import type { LanguageCode } from '../context/SettingsContext';
import { useMedication } from '../context/MedicationContext';
import { useFirebase } from '../context/FirebaseContext';
import { useRole } from '../context/RoleContext';
import { SarvamService } from '../services/sarvamService';
import { auth } from '../firebase';
import { PatientSwitcher } from './PatientSwitcher';
import { CaregiverSOSBanner } from './CaregiverSOSBanner';

interface LayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  nativeLabel?: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, setActiveTab, children }) => {
  const {
    language,
    setLanguage,
    sarvamKey,
    setSarvamKey,
    firebaseConfig,
    setFirebaseConfig,
    t,
    isDemo,
    setIsDemo,
  } = useSettings();
  const { addMedication } = useMedication();
  const { user } = useFirebase();
  const { role, activePatientId, activePatientName, setActivePatientId } = useRole();

  // Drawer / dialog states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMicOpen, setIsMicOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [tempSarvam, setTempSarvam] = useState(sarvamKey);
  const [tempFirebase, setTempFirebase] = useState(firebaseConfig);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // mobile only
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isPatientSwitcherOpen, setIsPatientSwitcherOpen] = useState(false);

  // Web Speech recognition variables
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (Speech) {
      const rec = new Speech();
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => {
        setIsListening(true);
        setSpeechText('');
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSpeechText(transcript);
        handleSpeechCompletion(transcript);
        console.log('VOICE RECEIVED:', transcript);
      };

      rec.onerror = (e: any) => {
        console.error('Speech Recognition Error:', e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, [language]);

  const toggleMic = () => {
    if (isMicOpen) {
      if (recognition) recognition.stop();
      setIsMicOpen(false);
    } else {
      setIsMicOpen(true);
      setSpeechText(t.micListening);
      setTimeout(() => {
        startSpeechListening();
      }, 500);
    }
  };

  const startSpeechListening = () => {
    if (recognition) {
      const langMap: Record<LanguageCode, string> = {
        hi: 'hi-IN', ta: 'ta-IN', gu: 'gu-IN', mr: 'mr-IN',
        te: 'te-IN', bn: 'bn-IN', kn: 'kn-IN', ml: 'ml-IN', en: 'en-IN'
      };
      recognition.lang = langMap[language] || 'hi-IN';
      try {
        recognition.start();
      } catch (err) {
        console.warn('Recognition already active', err);
      }
    } else {
      setIsListening(true);
      setTimeout(() => {
        setIsListening(false);
        const sim =
          language === 'hi'
            ? 'सुबह खाने के बाद एक गोली एस्पिरिन देना'
            : 'Take one tablet of Aspirin in the morning after breakfast';
        setSpeechText(sim);
        handleSpeechCompletion(sim);
      }, 2000);
    }
  };

  const handleSpeechCompletion = async (text: string) => {
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Voice queries on the assistant page route directly into the chat input.
    if (activeTab === 'assistant') {
      window.dispatchEvent(new CustomEvent('pulse_voice_chat', { detail: text }));
      setIsMicOpen(false);
      return;
    }

    console.log('CALLING SARVAM AI...');
    const parsedMed = await SarvamService.extractMedicationFromText(text);
    if (!parsedMed?.name) {
      alert('Could not identify medication name');
      return;
    }
    console.log('SARVAM RAW:', parsedMed);
    parsedMed.timing = Array.isArray(parsedMed.timing) ? parsedMed.timing : ['morning'];
    parsedMed.instructions = parsedMed.instructions || 'After meals';
    parsedMed.frequency = parsedMed.frequency || 'Once Daily';
    parsedMed.dosage = parsedMed.dosage || '1 Tablet';

    await addMedication(parsedMed);
    console.log('AI Medication:', parsedMed);

    const successSpeech: Record<LanguageCode, string> = {
      hi: `${parsedMed.name} दवाई सुरक्षित कर ली गई है।`,
      ta: `${parsedMed.name} மருந்து வெற்றிகரமாக சேர்க்கப்பட்டது.`,
      gu: `${parsedMed.name} દવા ઉમેરી દેવામાં આવી છે.`,
      mr: `${parsedMed.name} औषध जतन केले आहे.`,
      te: `${parsedMed.name} మందును జోడించడం జరిగింది.`,
      bn: `${parsedMed.name} ওষুধ সংরক্ষণ করা হয়েছে।`,
      kn: `${parsedMed.name} ಔಷಧಿ ಸೇರಿಸಲಾಗಿದೆ.`,
      ml: `${parsedMed.name} മരുന്ന് വിജയകരമായി ചേർത്തു.`,
      en: `${parsedMed.name} medication added successfully.`,
    };

    await SarvamService.textToSpeech(successSpeech[language] || successSpeech['hi'], language);

    setActiveTab('medicines');
    setIsMicOpen(false);
  };

  const handleSaveSettings = () => {
    setSarvamKey(tempSarvam);
    setFirebaseConfig(tempFirebase);
    setIsSettingsOpen(false);

    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.error('LOGOUT FAILED:', err);
    } finally {
      setProfileMenuOpen(false);
    }
  };

  // Localised sidebar labels (kept short for the 240px column)
  const navLabels: Record<string, { en: string; native?: string }> = {
    home:           { en: 'Dashboard', native: language === 'hi' ? 'डैशबोर्ड' : undefined },
    medicines:      { en: 'Medicines', native: language === 'hi' ? 'दवाइयाँ' : t.medicinesTab },
    documents:      { en: 'Prescriptions', native: language === 'hi' ? 'पर्चे और रिपोर्ट्स' : t.documentsTab },
    appointments:   { en: 'Appointments', native: language === 'hi' ? 'अपॉइंटमेंट' : language === 'ta' ? 'சந்திப்புகள்' : undefined },
    nearby:         { en: 'Nearby Care', native: language === 'hi' ? 'पास की देखभाल' : language === 'ta' ? 'அருகிலுள்ள கவனிப்பு' : undefined },
    assistant:      { en: 'AI Assistant', native: language === 'hi' ? 'सहायक' : undefined },
    'caregiver-link': { en: 'Link Caregiver', native: language === 'hi' ? 'केयरगिवर लिंक' : undefined },
  };

  const baseNavItems: NavItem[] = [
    { id: 'home',      label: navLabels.home.en,      nativeLabel: navLabels.home.native,      icon: LayoutDashboard },
    { id: 'medicines', label: navLabels.medicines.en, nativeLabel: navLabels.medicines.native, icon: Pill },
    { id: 'documents', label: navLabels.documents.en, nativeLabel: navLabels.documents.native, icon: FileText },
    { id: 'appointments', label: navLabels.appointments.en, nativeLabel: navLabels.appointments.native, icon: CalendarCheck },
    { id: 'nearby',    label: navLabels.nearby.en,    nativeLabel: navLabels.nearby.native,    icon: MapPin },
    { id: 'assistant', label: navLabels.assistant.en, nativeLabel: navLabels.assistant.native, icon: Sparkles },
  ];

  // Patients get an extra "Link Caregiver" tab. Caregivers don't see it
  // (RoleGuard would also redirect them away if they tried to navigate to it).
  const navItems: NavItem[] =
    role === 'patient'
      ? [
          ...baseNavItems,
          {
            id: 'caregiver-link',
            label: navLabels['caregiver-link'].en,
            nativeLabel: navLabels['caregiver-link'].native,
            icon: LinkIcon,
          },
        ]
      : baseNavItems;

  const userInitial = (user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen w-full bg-navy-950 text-navy-50 flex flex-col">
      {/* ===== TOP NAVBAR ===== */}
      <header className="sticky top-0 z-40 h-16 bg-navy-900/95 backdrop-blur border-b border-navy-800 flex items-center px-4 lg:px-6">
        {/* Caregiver hamburger — opens linked patients drawer */}
        {role === 'caregiver' && (
          <button
            onClick={() => setIsPatientSwitcherOpen(true)}
            className="mr-3 p-2 text-navy-100 hover:text-white bg-navy-850 rounded-card border border-navy-800 tactile-btn relative"
            aria-label="Open linked patients"
            style={{ minHeight: 40, minWidth: 40 }}
          >
            <Users size={18} />
            {activePatientId && (
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-success border-2 border-navy-900"
                aria-hidden="true"
              />
            )}
          </button>
        )}

        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden mr-3 p-2 text-navy-100 hover:text-white bg-navy-850 rounded-card border border-navy-800 tactile-btn"
          aria-label="Open menu"
          style={{ minHeight: 40, minWidth: 40 }}
        >
          <Menu size={18} />
        </button>

        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-card bg-accent flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-accent/20">
            ⚡
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-bold text-white tracking-wide">{t.appName}</h1>
            <span className="hidden sm:block text-[10px] font-semibold text-navy-700 uppercase tracking-widest">
              Medication Tracker
            </span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Right cluster: language, settings, profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            className="bg-navy-850 text-navy-50 font-medium text-sm px-2.5 py-1.5 rounded-card border border-navy-800 outline-none cursor-pointer hover:border-navy-750 focus:border-accent transition-colors"
          >
            <option value="hi">हिंदी</option>
            <option value="ta">தமிழ்</option>
            <option value="gu">ગુજરાતી</option>
            <option value="mr">मराठी</option>
            <option value="te">తెలుగు</option>
            <option value="bn">বাংলা</option>
            <option value="kn">ಕನ್ನಡ</option>
            <option value="ml">മലയാളം</option>
            <option value="en">EN</option>
          </select>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-navy-100 hover:text-white bg-navy-850 rounded-card border border-navy-800 hover:border-navy-750 tactile-btn"
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>

          {/* Profile avatar */}
          <div className="relative">
            <button
              onClick={() => setProfileMenuOpen(p => !p)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent-dark text-white font-bold text-sm flex items-center justify-center shadow-md hover:scale-105 transition-transform tactile-btn"
              aria-label="Profile"
            >
              {userInitial}
            </button>

            {profileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setProfileMenuOpen(false)}
                />
                <div className="absolute right-0 top-12 w-60 bg-navy-900 border border-navy-800 rounded-card shadow-2xl z-40 p-2 animate-slide-up">
                  <div className="px-3 py-2 border-b border-navy-800 mb-1.5">
                    <div className="text-[10px] font-bold text-navy-700 uppercase tracking-widest">
                      Signed in as
                    </div>
                    <div className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                      <UserIcon size={13} />
                      {user?.email || 'Guest'}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-card text-left tactile-btn"
                  >
                    <LogOut size={14} />
                    <span>Sign out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ===== Caregiver "Viewing patient X" banner ===== */}
      {role === 'caregiver' && activePatientId && (
        <div className="sticky top-16 z-30 bg-success/10 border-b border-success/30 px-4 lg:px-6 py-2.5 flex items-center gap-3 backdrop-blur">
          <button
            onClick={() => setIsPatientSwitcherOpen(true)}
            className="inline-flex items-center gap-2 text-success hover:text-white tactile-btn"
            style={{ minHeight: 36 }}
          >
            <ChevronLeft size={14} />
            <Users size={14} />
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-success">
              {language === 'hi' ? 'देख रहे हैं' : 'Viewing'}
            </span>
            <span className="ml-2 text-sm font-bold text-white truncate">
              {activePatientName || 'Linked patient'}
            </span>
          </div>
          <button
            onClick={() => setActivePatientId(null)}
            className="inline-flex items-center gap-1 text-xs font-bold text-success hover:text-white bg-success/10 hover:bg-success/20 border border-success/30 rounded-card px-3 tactile-btn"
            style={{ minHeight: 36 }}
            aria-label="Exit patient view"
          >
            <X size={12} />
            <span className="hidden sm:inline">{language === 'hi' ? 'बाहर निकलें' : 'Exit'}</span>
          </button>
        </div>
      )}

      {/* ===== Caregiver SOS banner (self-gates by role + active alerts) ===== */}
      <CaregiverSOSBanner />

      {/* ===== Caregiver patient switcher drawer ===== */}
      <PatientSwitcher
        open={isPatientSwitcherOpen}
        onClose={() => setIsPatientSwitcherOpen(false)}
      />

      {/* ===== BODY: SIDEBAR + MAIN ===== */}
      <div className="flex-1 flex">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-navy-800 bg-navy-900/40 sticky top-16 h-[calc(100vh-4rem)]">
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto thin-scroll">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-card text-left transition-all border ${
                    active
                      ? 'bg-accent/10 border-accent/30 text-accent shadow-md'
                      : 'border-transparent text-navy-100 hover:bg-navy-850 hover:text-white'
                  }`}
                >
                  <Icon size={18} className={active ? 'text-accent' : 'text-navy-700'} />
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm font-semibold">{item.label}</span>
                    {item.nativeLabel && item.nativeLabel !== item.label && (
                      <span className="text-[10px] text-navy-700 font-medium">{item.nativeLabel}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Voice mic CTA in the sidebar footer */}
          <div className="p-3 border-t border-navy-800">
            <button
              onClick={toggleMic}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-2.5 rounded-card border border-accent shadow-lg shadow-accent/20 tactile-btn mic-active-pulse"
            >
              <Mic size={16} />
              <span className="text-sm">Voice Add</span>
            </button>
            <p className="text-[10px] text-navy-700 text-center mt-2 leading-tight">
              Speak in your language to log a medicine
            </p>
          </div>
        </aside>

        {/* Sidebar — mobile drawer */}
        {isSidebarOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 bg-black/60 z-40 animate-fade-in"
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-navy-900 border-r border-navy-800 z-50 flex flex-col animate-slide-left">
              <div className="h-16 px-4 flex items-center justify-between border-b border-navy-800">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-card bg-accent flex items-center justify-center font-bold text-white">⚡</div>
                  <span className="font-bold text-white">{t.appName}</span>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 text-navy-100 bg-navy-850 rounded-card border border-navy-800 tactile-btn"
                >
                  <X size={16} />
                </button>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto thin-scroll">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-card text-left transition-all border ${
                        active
                          ? 'bg-accent/10 border-accent/30 text-accent'
                          : 'border-transparent text-navy-100 hover:bg-navy-850'
                      }`}
                    >
                      <Icon size={18} className={active ? 'text-accent' : 'text-navy-700'} />
                      <span className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold">{item.label}</span>
                        {item.nativeLabel && item.nativeLabel !== item.label && (
                          <span className="text-[10px] text-navy-700 font-medium">{item.nativeLabel}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </nav>
              <div className="p-3 border-t border-navy-800">
                <button
                  onClick={() => {
                    setIsSidebarOpen(false);
                    toggleMic();
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-3 rounded-card border border-accent tactile-btn mic-active-pulse"
                >
                  <Mic size={16} />
                  <span className="text-sm">Voice Add</span>
                </button>
              </div>
            </aside>
          </>
        )}

        {/* Main content area */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Floating mic — only visible on mobile / tablet (sidebar hides on small screens) */}
      <button
        onClick={toggleMic}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-accent hover:bg-accent-dark flex items-center justify-center shadow-2xl border-4 border-navy-950 text-white tactile-btn mic-active-pulse z-30"
        aria-label="Voice input"
      >
        <Mic size={22} />
      </button>

      {/* ===== Voice modal ===== */}
      {isMicOpen && (
        <div className="fixed inset-0 bg-navy-950/95 z-50 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          <button
            onClick={() => setIsMicOpen(false)}
            className="absolute top-6 right-6 p-2 text-navy-100 bg-navy-850 rounded-full border border-navy-800 tactile-btn"
          >
            <X size={20} />
          </button>

          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2 text-white">{t.appName} Voice Input</h2>
            <p className="text-navy-700 text-base">
              {activeTab === 'assistant' ? 'Talk to the Pulse Assistant' : t.micPrompt}
            </p>
          </div>

          <div className="relative w-36 h-36 flex items-center justify-center mb-12">
            <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping"></div>
            <div className="absolute inset-4 rounded-full bg-accent/40 animate-pulse"></div>
            <button
              onClick={startSpeechListening}
              className="w-24 h-24 rounded-full bg-accent hover:bg-accent-dark flex items-center justify-center border-4 border-navy-900 text-white z-10 shadow-2xl tactile-btn"
            >
              {isListening ? <Volume2 size={36} className="animate-bounce" /> : <Mic size={36} />}
            </button>
          </div>

          <div className="bg-navy-900 border border-navy-800 rounded-card p-6 w-full max-w-md shadow-xl min-h-24 flex items-center justify-center">
            <p className="text-white text-base font-medium leading-relaxed">{speechText}</p>
          </div>
        </div>
      )}

      {/* ===== Settings drawer ===== */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end animate-fade-in">
          <div className="w-full sm:w-[420px] h-full bg-navy-950 border-l border-navy-800 flex flex-col shadow-2xl animate-slide-left p-6 overflow-y-auto thin-scroll">
            <div className="flex items-center justify-between mb-7">
              <h2 className="text-lg font-bold text-white">{t.apiKeySettings}</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 text-navy-100 bg-navy-850 rounded-card border border-navy-800 tactile-btn"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/30 rounded-card p-4 mb-6">
              <div className="flex items-center space-x-2 text-accent font-semibold mb-1">
                <ShieldAlert size={18} />
                <span>{t.demoMode}</span>
              </div>
              <p className="text-xs text-navy-700 leading-normal">
                PULSE uses browser Speech APIs and local clinical response fallbacks to ensure 100% immediate demo compatibility.
              </p>
              <button
                onClick={() => setIsDemo(!isDemo)}
                className={`mt-3 py-1.5 px-3 rounded-card font-semibold text-xs border ${
                  isDemo ? 'bg-accent border-accent text-white' : 'border-navy-800 text-navy-100 hover:bg-navy-850'
                } tactile-btn`}
              >
                {language === 'hi'
                  ? isDemo
                    ? 'रियल API मोड में जाएँ'
                    : 'ऑफलाइन डेमो मोड में जाएँ'
                  : isDemo
                  ? 'Switch to Real API Mode'
                  : 'Switch to Offline Demo Mode'}
              </button>
            </div>

            <div className="space-y-5 mb-8 flex-1">
              <div>
                <label className="block text-sm font-semibold text-navy-100 mb-2">Sarvam AI API Key</label>
                <input
                  type="password"
                  value={tempSarvam}
                  onChange={(e) => setTempSarvam(e.target.value)}
                  placeholder="Enter sarvam.ai API Key"
                  className="w-full bg-navy-900 border border-navy-800 rounded-card py-2.5 px-3 text-sm text-white outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-100 mb-2">Firebase Project Config</label>
                <textarea
                  value={tempFirebase}
                  onChange={(e) => setTempFirebase(e.target.value)}
                  placeholder='{ "apiKey": "...", "projectId": "..." }'
                  rows={6}
                  className="w-full bg-navy-900 border border-navy-800 rounded-card py-2.5 px-3 text-xs text-white outline-none focus:border-accent font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              className="w-full bg-accent hover:bg-accent-dark text-white font-bold py-3 rounded-card shadow-xl border border-accent tactile-btn"
            >
              {t.saveKeys}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
