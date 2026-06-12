import React from 'react';
import { useMedication } from '../context/MedicationContext';
import { useSettings } from '../context/SettingsContext';
import { jsPDF } from 'jspdf';
import { Flame, AlertCircle, FileText, CheckCircle2, XCircle } from 'lucide-react';

export const AdherenceReport: React.FC = () => {
  const { medications, logs, streak, adherenceRate } = useMedication();
  const { language, t } = useSettings();

  // 1. Calculate 7-day logs details for the SVG bar chart
  const today = new Date();
  const past7DaysData = Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - idx));
    const dateStr = date.toISOString().split('T')[0];
    const dayLog = logs[dateStr] || {};

    let total = 0;
    let taken = 0;

    // Filter meds active on this day
    const activeMeds = medications.filter(m => m.startDate <= dateStr);
    activeMeds.forEach(m => {
      m.timing.forEach(slot => {
        total++;
        if (dayLog[`${m.id}_${slot}`]?.taken) {
          taken++;
        }
      });
    });

    const percent = total > 0 ? Math.round((taken / total) * 100) : 0;
    const label = date.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-US', { weekday: 'short' });
    
    return {
      dateStr,
      percent,
      label,
      taken,
      total
    };
  });

  // 2. Identify Missed Doses in the past 7 days
  const missedDosesList: { name: string; date: string; slot: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayLog = logs[dateStr] || {};

    const activeMeds = medications.filter(m => m.startDate <= dateStr);
    activeMeds.forEach(m => {
      m.timing.forEach(slot => {
        const logKey = `${m.id}_${slot}`;
        if (!dayLog[logKey]?.taken) {
          missedDosesList.push({
            name: m.name,
            date: dateStr,
            slot
          });
        }
      });
    });
  }

  // 3. Export PDF using jsPDF
  const exportPDFReport = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Elegant medical header
    doc.setFillColor(11, 19, 43); // deep navy
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(24);
    doc.text("PULSE MEDICATION REPORT", 15, 18);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()} | Patient: Self Profile`, 15, 28);

    // Adherence summaries
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 50, 180, 25, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, 50, 180, 25);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.text("ADHERENCE SUMMARY", 20, 58);
    doc.setFont('Helvetica', 'normal');
    doc.text(`7-Day Adherence Score: ${adherenceRate}%`, 20, 68);
    doc.text(`Current Streak: ${streak} Days`, 120, 68);

    // Active Medications lists
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text("CURRENT PRESCRIBED MEDICATIONS", 15, 90);
    
    let y = 100;
    doc.setFontSize(10);
    
    medications.forEach((med, idx) => {
      doc.setFont('Helvetica', 'bold');
      doc.text(`${idx + 1}. ${med.name} -- ${med.dosage}`, 15, y);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Frequency: ${med.frequency} | Timing: [${med.timing.join(', ')}] | Directions: ${med.instructions}`, 20, y + 5);
      y += 14;
    });

    // Missed doses section
    if (missedDosesList.length > 0) {
      y += 10;
      doc.setFontSize(14);
      doc.setFont('Helvetica', 'bold');
      doc.text("MISSED DOSES RECORD (PAST 7 DAYS)", 15, y);
      
      y += 10;
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(225, 29, 72); // rose red

      missedDosesList.slice(0, 10).forEach((miss) => {
        doc.text(`• ${miss.name} - Missed during ${miss.slot} slot on ${miss.date}`, 15, y);
        y += 7;
      });
    }

    // Save report
    doc.save(`pulse_adherence_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header and quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">{t.reportTitle}</h2>
          <p className="text-sm text-navy-700 mt-0.5">
            {language === 'hi'
              ? 'पिछले 7 दिनों का दवाई एडहेरेंस सारांश'
              : 'A 7-day summary of your medication adherence'}
          </p>
        </div>
        <button
          onClick={exportPDFReport}
          className="self-start sm:self-auto flex items-center gap-2 bg-accent hover:bg-accent-dark text-white font-bold py-2.5 px-4 rounded-card shadow-lg shadow-accent/20 border border-accent text-sm tactile-btn"
        >
          <FileText size={16} />
          <span>{t.exportPdf}</span>
        </button>
      </div>

      {/* 2. Key stats metrics grids */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-navy flex flex-col items-center justify-center p-5 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-accent/5 rounded-full blur-xl"></div>
          <span className="text-3xl font-extrabold text-accent font-sans">{adherenceRate}%</span>
          <span className="text-xs text-navy-750 font-bold uppercase tracking-wider mt-1">{t.adherenceRate}</span>
        </div>

        <div className="card-navy flex flex-col items-center justify-center p-5 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 rounded-full blur-xl"></div>
          <span className="text-3xl font-extrabold text-orange-500 font-sans flex items-center justify-center space-x-1">
            <Flame size={24} fill="#F97316" stroke="none" />
            <span>{streak}</span>
          </span>
          <span className="text-xs text-navy-750 font-bold uppercase tracking-wider mt-1">{t.streakText}</span>
        </div>

        <div className="card-navy flex flex-col items-center justify-center p-5 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-success/5 rounded-full blur-xl"></div>
          <span className="text-3xl font-extrabold text-success font-sans">{medications.length}</span>
          <span className="text-xs text-navy-750 font-bold uppercase tracking-wider mt-1">
            {language === 'hi' ? 'सक्रिय दवाइयाँ' : 'Active Medicines'}
          </span>
        </div>
      </div>

      {/* 3. SVG 7-Day adherence bar chart (custom & zero dependencies!) */}
      <div className="card-navy text-left space-y-4">
        <h3 className="text-sm font-bold text-navy-700 uppercase tracking-widest pl-1">7-Day History Chart</h3>

        <div className="flex items-end justify-between h-44 pt-4 border-b border-navy-800 pb-1 px-2 relative">
          
          {/* Background grid lines */}
          <div className="absolute top-4 left-0 right-0 border-t border-navy-850 border-dashed text-[9px] text-navy-800 font-bold pr-1 text-right">100%</div>
          <div className="absolute top-24 left-0 right-0 border-t border-navy-850 border-dashed text-[9px] text-navy-800 font-bold pr-1 text-right">50%</div>

          {past7DaysData.map((day, dIdx) => {
            const barHeight = Math.max((day.percent / 100) * 120, 6); // min height for zero percent visual feedback
            return (
              <div key={dIdx} className="flex flex-col items-center flex-1 space-y-2 group z-10">
                <div className="relative w-7 flex justify-center items-end h-32">
                  
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 bg-navy-950 text-[10px] text-white px-2 py-0.5 rounded border border-navy-850 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {day.percent}% ({day.taken}/{day.total})
                  </div>

                  <div 
                    style={{ height: `${barHeight}px` }}
                    className={`w-5 rounded-t-lg transition-all duration-500 cursor-pointer ${
                      day.percent >= 80 
                        ? 'bg-success shadow-lg shadow-success/10' 
                        : day.percent >= 50 
                        ? 'bg-accent shadow-lg shadow-accent/10'
                        : 'bg-navy-750'
                    }`}
                  ></div>
                </div>
                
                <span className="text-xs font-bold text-navy-100 uppercase">{day.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Missed doses logs list */}
      <div className="card-navy text-left space-y-4">
        <div className="flex items-center space-x-2 text-rose-500">
          <AlertCircle size={20} />
          <h3 className="text-sm font-bold uppercase tracking-widest">{t.missedDoses}</h3>
        </div>

        <div className="space-y-3">
          {missedDosesList.length === 0 ? (
            <div className="text-center py-4 flex flex-col items-center justify-center space-y-1">
              <CheckCircle2 className="text-success mb-1" size={24} />
              <p className="text-xs text-navy-100 font-bold">Perfect compliance!</p>
              <p className="text-[10px] text-navy-850">No missed doses identified in the past week.</p>
            </div>
          ) : (
            missedDosesList.slice(0, 5).map((miss, idx) => (
              <div 
                key={idx}
                className="bg-navy-950 border border-navy-800/60 rounded-card py-3 px-4 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3 text-left">
                  <XCircle size={18} className="text-rose-500" />
                  <div>
                    <span className="font-extrabold text-white text-elder-sm">{miss.name}</span>
                    <p className="text-[10px] text-navy-700 font-bold uppercase mt-0.5">{miss.slot} slot</p>
                  </div>
                </div>

                <span className="text-xs font-semibold text-navy-100">{miss.date}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
