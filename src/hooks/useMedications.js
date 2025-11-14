import { useState, useEffect } from 'react';

export const useMedications = () => {
  const [medications, setMedications] = useState([]);
  const [streak, setStreak] = useState(12);

  useEffect(() => {
    const saved = localStorage.getItem('pulse-medications');
    if (saved) {
      setMedications(JSON.parse(saved));
    } else {
      const toyData = [
        { id: 1, name: 'Vitamin D3', dosage: '1000 IU', frequency: 'Once daily', time: '08:00', color: '#f59e0b', taken: true, addedDate: new Date().toISOString() },
        { id: 2, name: 'Metformin', dosage: '500mg', frequency: 'Twice daily', time: '12:00', color: '#10b981', taken: false, addedDate: new Date().toISOString() },
        { id: 3, name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', time: '20:00', color: '#8b5cf6', taken: true, addedDate: new Date().toISOString() },
        { id: 4, name: 'Omega-3', dosage: '1200mg', frequency: 'Once daily', time: '09:00', color: '#06b6d4', taken: true, addedDate: new Date().toISOString() },
        { id: 5, name: 'Aspirin', dosage: '81mg', frequency: 'Once daily', time: '21:00', color: '#ef4444', taken: false, addedDate: new Date().toISOString() }
      ];
      setMedications(toyData);
    }
    const savedStreak = localStorage.getItem('pulse-streak');
    if (savedStreak) setStreak(parseInt(savedStreak));
  }, []);

  useEffect(() => {
    localStorage.setItem('pulse-medications', JSON.stringify(medications));
  }, [medications]);

  const addMedication = (medication, userProfile, addToGoogleCalendar) => {
    const newMedication = {
      id: Date.now(),
      ...medication,
      taken: false,
      addedDate: new Date().toISOString(),
      nextDose: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMedications(prev => [...prev, newMedication]);
    
    if (userProfile.email && userProfile.remindersEnabled && newMedication.time) {
      addToGoogleCalendar(newMedication);
    }
    
    return newMedication;
  };

  const toggleTaken = (id) => {
    setMedications(medications.map(med => {
      if (med.id === id) {
        const newTaken = !med.taken;
        if (newTaken) {
          const newStreak = streak + 1;
          setStreak(newStreak);
          localStorage.setItem('pulse-streak', newStreak.toString());
        }
        return { ...med, taken: newTaken, takenAt: newTaken ? new Date().toISOString() : null };
      }
      return med;
    }));
  };

  const deleteMedication = (id) => {
    setMedications(medications.filter(med => med.id !== id));
  };

  return {
    medications,
    streak,
    addMedication,
    toggleTaken,
    deleteMedication
  };
};