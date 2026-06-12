import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from './FirebaseContext';

export type UserRole = 'patient' | 'caregiver';

export interface LinkedPatientRow {
  userId: string;
  name: string;
  email?: string;
  adherencePercent: number;
  medicineCount: number;
}

export interface UserProfile {
  role?: UserRole;
  phoneNumber?: string;
  linkedPatientIds?: string[];
  linkedCaregiverIds?: string[];
  activePatientId?: string | null;
  displayName?: string;
}

interface RoleContextType {
  role: UserRole | null;
  profile: UserProfile | null;
  profileLoading: boolean;
  phoneNumber: string | null;
  linkedPatientIds: string[];
  linkedCaregiverIds: string[];
  linkedPatients: LinkedPatientRow[];
  linkedPatientsLoading: boolean;
  activePatientId: string | null;
  activePatientName: string | null;
  setActivePatientId: (id: string | null) => void;
  saveRole: (role: UserRole) => Promise<void>;
  savePhoneNumber: (phoneNumber: string) => Promise<void>;
  saveDisplayName: (name: string) => Promise<void>;
  refreshLinkedPatients: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

const userDocRef = (uid: string) => doc(db, `users/${uid}`);

/**
 * Computes 7-day adherence + active medicine count for a given user, by
 * reading their `medications` and `logs` subcollections directly. Falls
 * back gracefully to 0/100 when nothing is logged yet.
 */
async function fetchAdherenceFor(userId: string): Promise<{
  adherencePercent: number;
  medicineCount: number;
}> {
  try {
    const medsSnap = await getDocs(collection(db, `users/${userId}/medications`));
    const meds: any[] = [];
    medsSnap.forEach((d) => meds.push({ id: d.id, ...d.data() }));

    const logsSnap = await getDocs(collection(db, `users/${userId}/logs`));
    const logs: Record<string, any> = {};
    logsSnap.forEach((d) => (logs[d.id] = d.data()));

    if (meds.length === 0) return { adherencePercent: 100, medicineCount: 0 };

    let total = 0;
    let taken = 0;
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLog = logs[dateStr] || {};
      const active = meds.filter((m) => (m.startDate ?? '0000-00-00') <= dateStr);
      active.forEach((m: any) => {
        (m.timing || []).forEach((slot: string) => {
          total++;
          if (dayLog[`${m.id}_${slot}`]?.taken) taken++;
        });
      });
    }

    const percent = total > 0 ? Math.round((taken / total) * 100) : 100;
    return { adherencePercent: percent, medicineCount: meds.length };
  } catch (err) {
    console.warn('fetchAdherenceFor failed for', userId, err);
    return { adherencePercent: 0, medicineCount: 0 };
  }
}

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useFirebase();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [linkedPatients, setLinkedPatients] = useState<LinkedPatientRow[]>([]);
  const [linkedPatientsLoading, setLinkedPatientsLoading] = useState(false);

  // activePatientId is per-session for caregivers and isn't persisted to
  // Firestore, so a caregiver always starts the session viewing their own
  // dashboard until they explicitly switch.
  const [activePatientId, setActivePatientIdState] = useState<string | null>(null);

  // Subscribe to the current user's profile doc.
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const unsub = onSnapshot(
      userDocRef(user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          setProfile({} as UserProfile);
        }
        setProfileLoading(false);
      },
      (err) => {
        console.error('profile snapshot error', err);
        setProfile({} as UserProfile);
        setProfileLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const linkedPatientIds = useMemo(() => profile?.linkedPatientIds ?? [], [profile]);
  const linkedCaregiverIds = useMemo(() => profile?.linkedCaregiverIds ?? [], [profile]);

  // For caregivers, hydrate the linkedPatients summary list from Firestore.
  const refreshLinkedPatients = useCallback(async () => {
    if (!user || profile?.role !== 'caregiver' || linkedPatientIds.length === 0) {
      setLinkedPatients([]);
      return;
    }

    setLinkedPatientsLoading(true);
    try {
      const rows: LinkedPatientRow[] = await Promise.all(
        linkedPatientIds.map(async (pid) => {
          const profSnap = await getDoc(userDocRef(pid));
          const p = profSnap.exists() ? (profSnap.data() as UserProfile) : {};
          const { adherencePercent, medicineCount } = await fetchAdherenceFor(pid);
          return {
            userId: pid,
            name: p.displayName || (p.phoneNumber ? p.phoneNumber : 'Linked Patient'),
            email: undefined,
            adherencePercent,
            medicineCount,
          };
        })
      );
      setLinkedPatients(rows);
    } catch (err) {
      console.error('refreshLinkedPatients failed', err);
    } finally {
      setLinkedPatientsLoading(false);
    }
  }, [user, profile, linkedPatientIds]);

  // Refresh whenever the linkedPatientIds list changes.
  useEffect(() => {
    refreshLinkedPatients();
  }, [refreshLinkedPatients]);

  const setActivePatientId = useCallback((id: string | null) => {
    setActivePatientIdState(id);
  }, []);

  const saveRole = useCallback(
    async (role: UserRole) => {
      if (!user) return;
      await setDoc(
        userDocRef(user.uid),
        {
          role,
          email: user.email || null,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );
    },
    [user]
  );

  const savePhoneNumber = useCallback(
    async (phoneNumber: string) => {
      if (!user) return;
      await setDoc(userDocRef(user.uid), { phoneNumber }, { merge: true });
    },
    [user]
  );

  const saveDisplayName = useCallback(
    async (name: string) => {
      if (!user) return;
      await setDoc(userDocRef(user.uid), { displayName: name }, { merge: true });
    },
    [user]
  );

  const role = (profile?.role as UserRole | undefined) ?? null;
  const phoneNumber = profile?.phoneNumber ?? null;

  const activePatientName =
    linkedPatients.find((p) => p.userId === activePatientId)?.name ?? null;

  // Reset active selection if it disappears from the linked list (e.g. revoked)
  useEffect(() => {
    if (activePatientId && !linkedPatientIds.includes(activePatientId)) {
      setActivePatientIdState(null);
    }
  }, [activePatientId, linkedPatientIds]);

  const value: RoleContextType = {
    role,
    profile,
    profileLoading,
    phoneNumber,
    linkedPatientIds,
    linkedCaregiverIds,
    linkedPatients,
    linkedPatientsLoading,
    activePatientId,
    activePatientName,
    setActivePatientId,
    saveRole,
    savePhoneNumber,
    saveDisplayName,
    refreshLinkedPatients,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
};

/* ===================================================================
 * useActivePatient
 *
 * Returns the user id whose data subtree should be read. For patients
 * this is always their own uid; for caregivers it's whichever patient
 * they have switched to (or their own uid when no patient is selected).
 * ================================================================= */
export interface ActivePatientResolution {
  patientId: string | null;
  isOwnData: boolean;
  isCaregiverViewing: boolean;
  basePath: string | null; // e.g. "users/<uid>"
  medicationsPath: string | null;
  documentsPath: string | null;
  logsPath: string | null;
}

export const useActivePatient = (): ActivePatientResolution => {
  const { user } = useFirebase();
  const { role, activePatientId } = useRole();

  if (!user) {
    return {
      patientId: null,
      isOwnData: false,
      isCaregiverViewing: false,
      basePath: null,
      medicationsPath: null,
      documentsPath: null,
      logsPath: null,
    };
  }

  const isCaregiverViewing = role === 'caregiver' && !!activePatientId;
  const patientId = isCaregiverViewing ? (activePatientId as string) : user.uid;
  const basePath = `users/${patientId}`;

  return {
    patientId,
    isOwnData: patientId === user.uid,
    isCaregiverViewing,
    basePath,
    medicationsPath: `${basePath}/medications`,
    documentsPath: `${basePath}/documents`,
    logsPath: `${basePath}/logs`,
  };
};
