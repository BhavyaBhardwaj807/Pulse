import React, { useState, useEffect } from 'react';
import { useMedication } from '../context/MedicationContext';
import type { Medication } from '../context/MedicationContext';
import { useSettings } from '../context/SettingsContext';
import { useRole, useActivePatient } from '../context/RoleContext';
import { CaregiverEnterCodeCard } from '../components/CaregiverEnterCodeCard';
import { SOSButton } from '../components/SOSButton';
import { NearbyCareCard } from '../components/NearbyCareCard';
import {
  Check,
  Flame,
  Clock,
  Calendar,
  ArrowRight,
  Sun,
  Sunrise,
  Sunset,
  Moon,
} from 'lucide-react';

interface HomeProps {
  onOpenReport?: () => void;
  onOpenNearby?: () => void;
}

type Slot = 'morning' | 'afternoon' | 'evening' | 'night';
const SLOTS: Slot[] = ['morning', 'afternoon', 'evening', 'night'];

export const Home: React.FC<HomeProps> = ({ onOpenReport, onOpenNearby }) => {
  const { medications, logs, toggleDose, streak } = useMedication();
  const { language, t } = useSettings();
  const { role } = useRole();
  const { isCaregiverViewing } = useActivePatient();
  const [currentTime, setCurrentTime] = useState(new Date());

  const [nextDoseText, setNextDoseText] = useState('');
  const [countdown, setCountdown] = useState('');

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Next dose countdown
  useEffect(() => {
    if (medications.length === 0) {
      setNextDoseText(language === 'hi' ? 'कोई दवाई शेड्यूल नहीं' : 'No medicines scheduled');
      setCountdown('--:--:--');
      return;
    }

    const computeNextDose = () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const slotHours: Record<Slot, number> = { morning: 8, afternoon: 13, evening: 18, night: 21 };

      let nearestDiff = Infinity;
      let nearestMed: Medication | null = null;
      let nearestSlot: Slot | '' = '';

      medications.forEach(med => {
        const timings = Array.isArray(med.timing) ? med.timing : [];
        timings.forEach(slot => {
          const target = new Date();
          target.setHours(slotHours[slot], 0, 0, 0);

          const logKey = `${med.id}_${slot}`;
          const isTakenToday = !!logs[todayStr]?.[logKey]?.taken;

          let diff = target.getTime() - now.getTime();
          if (diff <= 0 || isTakenToday) {
            target.setDate(target.getDate() + 1);
            diff = target.getTime() - now.getTime();
          }

          if (diff < nearestDiff) {
            nearestDiff = diff;
            nearestMed = med;
            nearestSlot = slot;
          }
        });
      });

      if (nearestMed) {
        const medName = (nearestMed as Medication).name;
        const slotText: Record<string, string> = {
          morning:   language === 'hi' ? 'सुबह' : language === 'ta' ? 'காலை' : 'Morning',
          afternoon: language === 'hi' ? 'दोपहर' : language === 'ta' ? 'மதியம்' : 'Afternoon',
          evening:   language === 'hi' ? 'शाम' : language === 'ta' ? 'மாலை' : 'Evening',
          night:     language === 'hi' ? 'रात' : language === 'ta' ? 'இரவு' : 'Night',
        };
        setNextDoseText(`${medName} (${slotText[nearestSlot] || nearestSlot})`);

        const totalSecs = Math.floor(nearestDiff / 1000);
        const hrs  = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        setCountdown(
          `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        );
      }
    };

    computeNextDose();
    const interval = setInterval(computeNextDose, 1000);
    return () => clearInterval(interval);
  }, [medications, logs, language]);

  // Today's progress
  const todayStr = currentTime.toISOString().split('T')[0];
  const todayLog = logs[todayStr] || {};

  let totalDosesToday = 0;
  let takenDosesToday = 0;
  medications.forEach(m => {
    (Array.isArray(m.timing) ? m.timing : []).forEach(slot => {
      totalDosesToday++;
      if (todayLog[`${m.id}_${slot}`]?.taken) takenDosesToday++;
    });
  });

  const progressPercent =
    totalDosesToday > 0 ? Math.round((takenDosesToday / totalDosesToday) * 100) : 100;

  // Ring math — 200px diameter
  const RING_SIZE = 200;
  const RING_STROKE = 16;
  const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  const ringDashOffset = RING_CIRCUMFERENCE - (progressPercent / 100) * RING_CIRCUMFERENCE;

  // Past 7 days adherence (right panel chart)
  const past7Days = Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date(currentTime);
    date.setDate(currentTime.getDate() - (6 - idx));
    const dateStr = date.toISOString().split('T')[0];
    const dayLog = logs[dateStr] || {};

    let total = 0;
    let taken = 0;
    const activeMeds = medications.filter(m => m.startDate <= dateStr);
    activeMeds.forEach(m => {
      m.timing.forEach(slot => {
        total++;
        if (dayLog[`${m.id}_${slot}`]?.taken) taken++;
      });
    });

    return {
      dateStr,
      label: date.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short' }),
      percent: total > 0 ? Math.round((taken / total) * 100) : 0,
      taken,
      total,
    };
  });

  const slotLabel = (slot: Slot): string => {
    const map: Record<Slot, Record<string, string>> = {
      morning:   { hi: 'सुबह',  ta: 'காலை',  en: 'Morning'   },
      afternoon: { hi: 'दोपहर', ta: 'மதியம்', en: 'Afternoon' },
      evening:   { hi: 'शाम',   ta: 'மாலை',  en: 'Evening'   },
      night:     { hi: 'रात',   ta: 'இரவு',  en: 'Night'     },
    };
    return map[slot][language as 'hi' | 'ta' | 'en'] || map[slot].en;
  };

  const slotIcon = (slot: Slot) => {
    const props = { size: 14, className: 'text-accent' };
    if (slot === 'morning')   return <Sunrise {...props} />;
    if (slot === 'afternoon') return <Sun {...props} />;
    if (slot === 'evening')   return <Sunset {...props} />;
    return <Moon {...props} />;
  };

  const slotTimeBadge: Record<Slot, string> = {
    morning: '08:00',
    afternoon: '13:00',
    evening: '18:00',
    night: '21:00',
  };

  return (
    <div className="space-y-6">
      {/* ===== Header — title + View Full Report ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {language === 'hi' ? 'डैशबोर्ड' : 'Dashboard'}
          </h2>
          <p className="text-sm text-navy-700 mt-0.5">
            {language === 'hi'
              ? 'आज का अवलोकन और दवाइयों की प्रगति'
              : "Today's overview and medication progress"}
          </p>
        </div>

        <button
          onClick={onOpenReport}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-2.5 px-5 rounded-card shadow-lg shadow-accent/20 border border-accent tactile-btn text-sm self-start sm:self-auto"
        >
          <span>{language === 'hi' ? 'पूरी रिपोर्ट देखें' : 'View Full Report'}</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Caregiver — enter invite code card on their own dashboard */}
      {role === 'caregiver' && !isCaregiverViewing && <CaregiverEnterCodeCard />}

      {/* ===== Stat bar — date + streak side by side ===== */}
      <div className="card-navy flex flex-col sm:flex-row sm:items-center divide-y sm:divide-y-0 sm:divide-x divide-navy-800">
        <div className="flex items-center gap-3 py-3 sm:py-2 sm:pr-6 flex-1">
          <div className="w-10 h-10 rounded-card bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Calendar className="text-accent" size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-navy-700">
              {language === 'hi' ? 'आज की तारीख' : 'Today'}
            </div>
            <div className="text-base font-bold text-white">
              {currentTime.toLocaleDateString(
                language === 'hi' ? 'hi-IN' : language === 'ta' ? 'ta-IN' : 'en-US',
                { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 py-3 sm:py-2 sm:px-6 flex-1">
          <div className="w-10 h-10 rounded-card bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Flame className="text-orange-500" size={18} fill="#F97316" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-navy-700">
              {t.streakText}
            </div>
            <div className="text-base font-bold text-white">
              {streak} {language === 'hi' ? 'दिन' : 'Days'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 py-3 sm:py-2 sm:pl-6 flex-1">
          <div className="w-10 h-10 rounded-card bg-success/10 border border-success/20 flex items-center justify-center">
            <Clock className="text-success" size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-navy-700">
              {t.nextDose}
            </div>
            <div className="text-base font-bold text-white truncate">
              {nextDoseText}{' '}
              <span className="text-accent font-mono text-sm tracking-tight">{countdown}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Nearby Care launcher — visible to both roles ===== */}
      <NearbyCareCard onOpen={onOpenNearby} />

      {/* ===== Main grid: ring + schedule (left, 2 cols) | weekly chart (right) ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left panel — spans 2 cols on xl */}
        <div className="xl:col-span-2 space-y-5">
          {/* Ring chart */}
          <div className="card-navy">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div
                className="relative flex items-center justify-center shrink-0"
                style={{ width: RING_SIZE, height: RING_SIZE }}
              >
                <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    className="stroke-navy-800"
                    strokeWidth={RING_STROKE}
                    fill="transparent"
                  />
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    className="stroke-accent transition-all duration-700"
                    strokeWidth={RING_STROKE}
                    fill="transparent"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={ringDashOffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold text-white">{progressPercent}%</span>
                  <span className="text-[10px] text-navy-700 font-bold uppercase tracking-widest mt-1">
                    {t.todayProgress}
                  </span>
                  <span className="text-xs text-navy-100 font-bold mt-1">
                    {takenDosesToday}/{totalDosesToday}
                  </span>
                </div>
              </div>

              <div className="flex-1 min-w-0 w-full md:w-auto">
                <h3 className="text-sm font-bold text-navy-100 uppercase tracking-widest mb-3">
                  {language === 'hi' ? 'आज की प्रगति' : "Today's Progress"}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-navy-950 border border-navy-800 rounded-card p-3">
                    <div className="text-2xl font-extrabold text-success">{takenDosesToday}</div>
                    <div className="text-[10px] uppercase font-bold text-navy-700 tracking-widest mt-1">
                      {language === 'hi' ? 'ली गई' : 'Taken'}
                    </div>
                  </div>
                  <div className="bg-navy-950 border border-navy-800 rounded-card p-3">
                    <div className="text-2xl font-extrabold text-rose-400">
                      {Math.max(totalDosesToday - takenDosesToday, 0)}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-navy-700 tracking-widest mt-1">
                      {language === 'hi' ? 'बाकी' : 'Pending'}
                    </div>
                  </div>
                  <div className="bg-navy-950 border border-navy-800 rounded-card p-3">
                    <div className="text-2xl font-extrabold text-accent">{medications.length}</div>
                    <div className="text-[10px] uppercase font-bold text-navy-700 tracking-widest mt-1">
                      {language === 'hi' ? 'दवाइयाँ' : 'Active Meds'}
                    </div>
                  </div>
                  <div className="bg-navy-950 border border-navy-800 rounded-card p-3">
                    <div className="text-2xl font-extrabold text-orange-500">{streak}</div>
                    <div className="text-[10px] uppercase font-bold text-navy-700 tracking-widest mt-1">
                      {language === 'hi' ? 'स्ट्रीक' : 'Day Streak'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Today's Schedule table — Morning / Afternoon / Evening / Night columns */}
          <div className="card-navy">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-navy-100 uppercase tracking-widest">
                {language === 'hi' ? 'आज का शेड्यूल' : "Today's Schedule"}
              </h3>
              <span className="text-[10px] font-semibold text-navy-700">
                {language === 'hi' ? 'टैप करके चिह्नित करें' : 'Tap a dose to mark taken'}
              </span>
            </div>

            {medications.length === 0 ? (
              <div className="text-center py-8 text-navy-700">
                <p className="text-sm font-semibold">
                  {language === 'hi' ? 'कोई दवाई नहीं जोड़ी गई' : 'No medicines added yet'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {SLOTS.map(slot => {
                  const slotMeds = medications.filter(m =>
                    (Array.isArray(m.timing) ? m.timing : []).includes(slot)
                  );
                  return (
                    <div
                      key={slot}
                      className="bg-navy-950 border border-navy-800 rounded-card p-3 flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-navy-800">
                        <div className="flex items-center gap-2">
                          {slotIcon(slot)}
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            {slotLabel(slot)}
                          </span>
                        </div>
                        <span className="text-[10px] text-navy-700 font-mono font-bold">
                          {slotTimeBadge[slot]}
                        </span>
                      </div>

                      <div className="space-y-2 flex-1">
                        {slotMeds.length === 0 ? (
                          <div className="text-[11px] text-navy-700 italic py-2 text-center">
                            —
                          </div>
                        ) : (
                          slotMeds.map(med => {
                            const key = `${med.id}_${slot}`;
                            const isTaken = !!todayLog[key]?.taken;
                            return (
                              <button
                                key={key}
                                onClick={() => toggleDose(todayStr, med.id, slot)}
                                className={`w-full flex items-center gap-2 p-2 rounded-card border text-left transition-all tactile-btn ${
                                  isTaken
                                    ? 'bg-success/10 border-success/30'
                                    : 'bg-navy-900 border-navy-800 hover:border-navy-750'
                                }`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                    isTaken
                                      ? 'bg-success border-success'
                                      : 'border-navy-750'
                                  }`}
                                >
                                  {isTaken && (
                                    <Check size={12} strokeWidth={3} className="text-navy-950" />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div
                                    className={`text-xs font-bold leading-tight truncate ${
                                      isTaken ? 'text-navy-100 line-through' : 'text-white'
                                    }`}
                                  >
                                    {med.name}
                                  </div>
                                  <div className="text-[10px] text-navy-700 font-semibold truncate">
                                    {med.dosage}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel — weekly adherence bar chart */}
        <div className="card-navy flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-navy-100 uppercase tracking-widest">
              {language === 'hi' ? '7-दिन एडहेरेंस' : '7-Day Adherence'}
            </h3>
            <button
              onClick={onOpenReport}
              className="text-[10px] font-bold text-accent hover:text-accent-light uppercase tracking-wider tactile-btn"
            >
              {language === 'hi' ? 'विवरण →' : 'Details →'}
            </button>
          </div>

          <div className="flex items-end justify-between gap-1.5 h-56 pt-4 border-b border-navy-800 px-1 relative">
            {/* Grid lines */}
            <div className="absolute left-0 right-0 top-4 border-t border-dashed border-navy-800/60 pointer-events-none">
              <span className="absolute -top-2 -right-1 text-[9px] text-navy-700 font-bold">100%</span>
            </div>
            <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-navy-800/60 pointer-events-none">
              <span className="absolute -top-2 -right-1 text-[9px] text-navy-700 font-bold">50%</span>
            </div>

            {past7Days.map((day, i) => {
              const barH = Math.max((day.percent / 100) * 175, 6);
              const colour =
                day.percent >= 80
                  ? 'bg-success shadow-success/20'
                  : day.percent >= 50
                  ? 'bg-accent shadow-accent/20'
                  : 'bg-navy-750';
              return (
                <div key={i} className="flex flex-col items-center flex-1 group z-10">
                  <div className="relative w-full flex justify-center items-end h-44">
                    <div className="absolute -top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-navy-950 text-white text-[10px] px-2 py-0.5 rounded border border-navy-800 whitespace-nowrap pointer-events-none">
                      {day.percent}%
                    </div>
                    <div
                      style={{ height: `${barH}px` }}
                      className={`w-6 sm:w-7 rounded-t-md transition-all duration-500 shadow-lg ${colour}`}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-navy-100 uppercase mt-2">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-navy-950 border border-navy-800 rounded-card p-2.5 text-center">
              <div className="text-xs font-bold text-success">≥80%</div>
              <div className="text-[9px] text-navy-700 uppercase font-bold mt-0.5">
                {language === 'hi' ? 'अच्छा' : 'Strong'}
              </div>
            </div>
            <div className="bg-navy-950 border border-navy-800 rounded-card p-2.5 text-center">
              <div className="text-xs font-bold text-accent">50-79%</div>
              <div className="text-[9px] text-navy-700 uppercase font-bold mt-0.5">
                {language === 'hi' ? 'सामान्य' : 'Steady'}
              </div>
            </div>
            <div className="bg-navy-950 border border-navy-800 rounded-card p-2.5 text-center">
              <div className="text-xs font-bold text-navy-700">&lt;50%</div>
              <div className="text-[9px] text-navy-700 uppercase font-bold mt-0.5">
                {language === 'hi' ? 'कम' : 'Low'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SOSButton />
    </div>
  );
};
