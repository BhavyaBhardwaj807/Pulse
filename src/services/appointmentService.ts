import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

export type AppointmentStatus = 'upcoming' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  doctorName: string;
  specialty: string;
  hospitalName: string;
  /** Stored in Firestore as Timestamp; surfaced as JS Date to the UI. */
  appointmentDate: Date;
  notes: string;
  linkedDocumentIds: string[];
  reminderSet: boolean;
  status: AppointmentStatus;
  /** uid of whoever created the record (patient or caregiver). */
  createdBy: string;
  createdAt?: Date;
}

export interface AppointmentInput {
  doctorName: string;
  specialty: string;
  hospitalName: string;
  appointmentDate: Date;
  notes: string;
  reminderSet: boolean;
}

export const appointmentsPath = (patientId: string): string =>
  `users/${patientId}/appointments`;

const appointmentDocRef = (patientId: string, id: string) =>
  doc(db, `${appointmentsPath(patientId)}/${id}`);

const tsToDate = (v: any): Date | undefined => {
  if (!v) return undefined;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v?.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
};

/**
 * Converts a Firestore snapshot into the UI-facing Appointment shape.
 * Tolerates missing fields so a partially-populated doc never crashes
 * the list.
 */
export const parseAppointmentDoc = (
  snap: DocumentSnapshot | QueryDocumentSnapshot
): Appointment | null => {
  const data = snap.data() as any;
  if (!data) return null;
  const apptDate = tsToDate(data.appointmentDate);
  if (!apptDate) return null;

  return {
    id: snap.id,
    doctorName: data.doctorName || '',
    specialty: data.specialty || '',
    hospitalName: data.hospitalName || '',
    appointmentDate: apptDate,
    notes: data.notes || '',
    linkedDocumentIds: Array.isArray(data.linkedDocumentIds)
      ? data.linkedDocumentIds
      : [],
    reminderSet: !!data.reminderSet,
    status:
      data.status === 'completed' || data.status === 'cancelled'
        ? data.status
        : 'upcoming',
    createdBy: data.createdBy || '',
    createdAt: tsToDate(data.createdAt),
  };
};

/**
 * Creates an appointment under the patient's subcollection. Caregivers
 * pass the active patient's id; `createdBy` records the actual writer.
 */
export const createAppointment = async (
  patientId: string,
  createdBy: string,
  input: AppointmentInput
): Promise<string> => {
  const ref = await addDoc(collection(db, appointmentsPath(patientId)), {
    doctorName: input.doctorName,
    specialty: input.specialty,
    hospitalName: input.hospitalName,
    appointmentDate: Timestamp.fromDate(input.appointmentDate),
    notes: input.notes,
    reminderSet: input.reminderSet,
    linkedDocumentIds: [] as string[],
    status: 'upcoming' as AppointmentStatus,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export interface AppointmentPatch {
  doctorName?: string;
  specialty?: string;
  hospitalName?: string;
  appointmentDate?: Date;
  notes?: string;
  reminderSet?: boolean;
  status?: AppointmentStatus;
}

export const updateAppointment = async (
  patientId: string,
  id: string,
  patch: AppointmentPatch
): Promise<void> => {
  const payload: Record<string, any> = { ...patch };
  if (patch.appointmentDate) {
    payload.appointmentDate = Timestamp.fromDate(patch.appointmentDate);
  }
  await updateDoc(appointmentDocRef(patientId, id), payload);
};

export const markAppointmentComplete = async (
  patientId: string,
  id: string
): Promise<void> => {
  await updateDoc(appointmentDocRef(patientId, id), {
    status: 'completed' as AppointmentStatus,
    completedAt: serverTimestamp(),
  });
};

export const cancelAppointment = async (
  patientId: string,
  id: string
): Promise<void> => {
  await updateDoc(appointmentDocRef(patientId, id), {
    status: 'cancelled' as AppointmentStatus,
    cancelledAt: serverTimestamp(),
  });
};

export const deleteAppointment = async (
  patientId: string,
  id: string
): Promise<void> => {
  await deleteDoc(appointmentDocRef(patientId, id));
};

export const setLinkedDocuments = async (
  patientId: string,
  id: string,
  documentIds: string[]
): Promise<void> => {
  await updateDoc(appointmentDocRef(patientId, id), {
    linkedDocumentIds: documentIds,
  });
};
