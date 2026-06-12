import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  doc,
  setDoc,
  query,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { useFirebase } from './FirebaseContext';
import { useActivePatient } from './RoleContext';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timing: ('morning' | 'afternoon' | 'evening' | 'night')[];
  startDate: string;
  instructions: string;
}

export interface DoseLog {
  medId: string;
  medName: string;
  dosage: string;
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'night';
  taken: boolean;
  takenAt?: string;
}

export interface MedDocument {
  id: string;
  name: string;
  type: 'prescription' | 'report' | 'summary';
  date: string;
  doctor: string;
  hospital: string;
  medicines: string[];
  fileUrl: string;
  googleDriveId?: string;
  isSynced?: boolean;
  extractedText?: string;
  uploadedAt?: any;
  processedAt?: any;
}

interface MedicationContextType {
  medications: Medication[];
  logs: Record<string, Record<string, DoseLog>>;
  documents: MedDocument[];
  addMedication: (med: Omit<Medication, 'id'>) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  updateMedication: (med: Medication) => Promise<void>;
  toggleDose: (
    date: string,
    medId: string,
    slot: 'morning' | 'afternoon' | 'evening' | 'night'
  ) => Promise<void>;
  addDocument: (docData: Omit<MedDocument, 'id'>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  streak: number;
  adherenceRate: number;
}

const MedicationContext = createContext<MedicationContextType | undefined>(undefined);

export const MedicationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { db, isFirebaseActive } = useFirebase();
  const {
    patientId,
    isOwnData,
    medicationsPath,
    documentsPath,
    logsPath,
  } = useActivePatient();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<Record<string, Record<string, DoseLog>>>({});
  const [documents, setDocuments] = useState<MedDocument[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [adherenceRate, setAdherenceRate] = useState<number>(100);

  // Load — when Firestore is active, subscribe live to the *active* patient's
  // subtree. When viewing your own data, mirror to localStorage so the UI is
  // resilient if the user reloads offline. When viewing another patient's data
  // (caregiver mode), never write to localStorage.
  useEffect(() => {
    if (isFirebaseActive && db && medicationsPath && documentsPath && logsPath) {
      const unsubMeds = onSnapshot(
        query(collection(db, medicationsPath)),
        (snapshot) => {
          const meds: Medication[] = [];
          snapshot.forEach((d) => meds.push({ id: d.id, ...d.data() } as Medication));
          setMedications(meds);
          if (isOwnData) {
            try {
              localStorage.setItem('pulse_medications', JSON.stringify(meds));
            } catch {}
          }
        },
        (err) => console.warn('meds snapshot error', err)
      );

      const unsubDocs = onSnapshot(
        query(collection(db, documentsPath)),
        (snapshot) => {
          const docsList: MedDocument[] = [];
          snapshot.forEach((d) => docsList.push({ id: d.id, ...d.data() } as MedDocument));
          setDocuments(docsList);
          if (isOwnData) {
            try {
              localStorage.setItem('pulse_documents', JSON.stringify(docsList));
            } catch {}
          }
        },
        (err) => console.warn('docs snapshot error', err)
      );

      const unsubLogs = onSnapshot(
        query(collection(db, logsPath)),
        (snapshot) => {
          const fetchedLogs: Record<string, Record<string, DoseLog>> = {};
          snapshot.forEach((d) => {
            fetchedLogs[d.id] = d.data() as Record<string, DoseLog>;
          });
          setLogs(fetchedLogs);
          if (isOwnData) {
            try {
              localStorage.setItem('pulse_logs', JSON.stringify(fetchedLogs));
            } catch {}
          }
        },
        (err) => console.warn('logs snapshot error', err)
      );

      return () => {
        unsubMeds();
        unsubDocs();
        unsubLogs();
      };
    } else {
      // No Firebase yet (logged out, or transient state). Use last-known
      // local snapshot to keep the UI populated.
      try {
        const localMeds = localStorage.getItem('pulse_medications');
        setMedications(localMeds ? JSON.parse(localMeds) : []);
      } catch {
        setMedications([]);
      }
      try {
        const localDocs = localStorage.getItem('pulse_documents');
        setDocuments(localDocs ? JSON.parse(localDocs) : []);
      } catch {
        setDocuments([]);
      }
      try {
        const localLogs = localStorage.getItem('pulse_logs');
        setLogs(localLogs ? JSON.parse(localLogs) : {});
      } catch {
        setLogs({});
      }
    }
  }, [isFirebaseActive, db, medicationsPath, documentsPath, logsPath, isOwnData, patientId]);

  // Adherence + streak recompute on data change
  useEffect(() => {
    if (medications.length === 0) {
      setAdherenceRate(100);
      setStreak(0);
      return;
    }

    const today = new Date();
    let computedStreak = 0;

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayLog = logs[dateStr] || {};
      const activeMeds = medications.filter((m) => m.startDate <= dateStr);
      if (activeMeds.length === 0) continue;

      let totalDosesForDay = 0;
      let takenDosesForDay = 0;
      activeMeds.forEach((m) => {
        m.timing.forEach((slot) => {
          totalDosesForDay++;
          if (dayLog[`${m.id}_${slot}`]?.taken) takenDosesForDay++;
        });
      });

      if (totalDosesForDay > 0) {
        if (takenDosesForDay === totalDosesForDay) {
          computedStreak++;
        } else if (i > 0) {
          break;
        }
      }
    }
    setStreak(computedStreak);

    let total7 = 0;
    let taken7 = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayLog = logs[dateStr] || {};
      const activeMeds = medications.filter((m) => m.startDate <= dateStr);
      activeMeds.forEach((m) => {
        m.timing.forEach((slot) => {
          total7++;
          if (dayLog[`${m.id}_${slot}`]?.taken) taken7++;
        });
      });
    }
    setAdherenceRate(total7 > 0 ? Math.round((taken7 / total7) * 100) : 100);
  }, [medications, logs]);

  // ========== Mutations ==========
  // Caregivers viewing another patient cannot write — guard at the call site.
  const canWrite = isFirebaseActive && !!db && !!medicationsPath && isOwnData;

  const addMedication = async (med: Omit<Medication, 'id'>) => {
    if (canWrite) {
      await addDoc(collection(db, medicationsPath as string), med);
    } else if (!isFirebaseActive) {
      const newMed: Medication = {
        id: 'med_' + Math.random().toString(36).substr(2, 9),
        ...med,
      };
      const updated = [...medications, newMed];
      setMedications(updated);
      try {
        localStorage.setItem('pulse_medications', JSON.stringify(updated));
      } catch {}
    } else {
      console.warn('addMedication blocked — caregiver cannot add for another patient');
    }
  };

  const deleteMedication = async (id: string) => {
    if (canWrite) {
      try {
        await deleteDoc(doc(db, `${medicationsPath}/${id}`));
      } catch (err) {
        console.error('deleteMedication failed', err);
      }
    } else if (!isFirebaseActive) {
      const updated = medications.filter((m) => m.id !== id);
      setMedications(updated);
      try {
        localStorage.setItem('pulse_medications', JSON.stringify(updated));
      } catch {}
    } else {
      console.warn('deleteMedication blocked — caregiver cannot modify another patient');
    }
  };

  const updateMedication = async (med: Medication) => {
    if (canWrite) {
      try {
        const { id, ...rest } = med;
        await updateDoc(doc(db, `${medicationsPath}/${id}`), rest as any);
      } catch (err) {
        console.error('updateMedication failed', err);
      }
    } else if (!isFirebaseActive) {
      const updated = medications.map((m) => (m.id === med.id ? med : m));
      setMedications(updated);
      try {
        localStorage.setItem('pulse_medications', JSON.stringify(updated));
      } catch {}
    }
  };

  const toggleDose = async (
    date: string,
    medId: string,
    slot: 'morning' | 'afternoon' | 'evening' | 'night'
  ) => {
    const today = new Date();
    const timeStr = today.toTimeString().split(' ')[0].substr(0, 5);
    const med = medications.find((m) => m.id === medId);
    const medName = med ? med.name : 'Unknown Medicine';
    const dosage = med ? med.dosage : '1 dose';

    const dayLog = logs[date] || {};
    const key = `${medId}_${slot}`;
    const isCurrentlyTaken = !!dayLog[key]?.taken;
    const newLogVal: DoseLog = {
      medId,
      medName,
      dosage,
      timeSlot: slot,
      taken: !isCurrentlyTaken,
      takenAt: !isCurrentlyTaken ? timeStr : undefined,
    };
    const updatedDayLog = { ...dayLog, [key]: newLogVal };

    if (canWrite) {
      try {
        await setDoc(doc(db, `${logsPath}/${date}`), updatedDayLog);
      } catch (err) {
        console.error('toggleDose Firestore write failed', err);
      }
    } else if (!isFirebaseActive) {
      const updatedLogs = { ...logs, [date]: updatedDayLog };
      setLogs(updatedLogs);
      try {
        localStorage.setItem('pulse_logs', JSON.stringify(updatedLogs));
      } catch {}
    } else {
      console.warn('toggleDose blocked — caregiver cannot modify another patient');
    }
  };

  const addDocument = async (docData: Omit<MedDocument, 'id'>) => {
    if (canWrite) {
      try {
        const ref = await addDoc(collection(db, documentsPath as string), {
          ...docData,
          uploadedAt: serverTimestamp(),
        });
        await setDoc(
          doc(db, `${documentsPath}/${ref.id}`),
          {
            extractedText: docData.extractedText || '',
            documentType: docData.type,
            processedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        console.error('addDocument failed', err);
      }
    } else if (!isFirebaseActive) {
      const newDoc: MedDocument = {
        id: 'doc_' + Math.random().toString(36).substr(2, 9),
        ...docData,
        extractedText: docData.extractedText || '',
        uploadedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      };
      const updated = [newDoc, ...documents];
      setDocuments(updated);
      try {
        localStorage.setItem('pulse_documents', JSON.stringify(updated));
      } catch {}
    } else {
      console.warn('addDocument blocked — caregiver cannot upload for another patient');
    }
  };

  const deleteDocument = async (id: string) => {
    if (canWrite) {
      try {
        await deleteDoc(doc(db, `${documentsPath}/${id}`));
      } catch (err) {
        console.error('deleteDocument failed', err);
      }
    } else if (!isFirebaseActive) {
      const updated = documents.filter((d) => d.id !== id);
      setDocuments(updated);
      try {
        localStorage.setItem('pulse_documents', JSON.stringify(updated));
      } catch {}
    }
  };

  return (
    <MedicationContext.Provider
      value={{
        medications,
        logs,
        documents,
        addMedication,
        deleteMedication,
        updateMedication,
        toggleDose,
        addDocument,
        deleteDocument,
        streak,
        adherenceRate,
      }}
    >
      {children}
    </MedicationContext.Provider>
  );
};

export const useMedication = () => {
  const context = useContext(MedicationContext);
  if (!context) throw new Error('useMedication must be used within MedicationProvider');
  return context;
};
