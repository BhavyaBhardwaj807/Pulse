import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  type DocumentReference,
  type FieldValue,
} from 'firebase/firestore';
import { db } from '../firebase';

export type SOSAlertStatus = 'triggered' | 'acknowledged';

/**
 * Shape of a document in the `sosAlerts` Firestore collection. The
 * `timestamp` field is written as a server timestamp at create time and
 * comes back from snapshots as a Firestore Timestamp (read as `any` on
 * the client to avoid leaking the Firestore type into UI components).
 */
export interface SOSAlert {
  patientId: string;
  patientName: string;
  lat: number | null;
  lng: number | null;
  timestamp: any;
  status: SOSAlertStatus;
  notifiedCaregiverIds: string[];
}

export interface SOSAlertCreateInput {
  patientId: string;
  patientName: string;
  lat: number | null;
  lng: number | null;
  notifiedCaregiverIds: string[];
}

const SOS_COLLECTION = 'sosAlerts';

/**
 * Writes a new SOS alert document. The caller passes coords (or nulls
 * when geolocation was denied/unavailable) and we attach the server
 * timestamp + initial `triggered` status here.
 */
export const createSOSAlert = async (
  payload: SOSAlertCreateInput
): Promise<DocumentReference> => {
  const docPayload: Omit<SOSAlert, 'timestamp'> & { timestamp: FieldValue } = {
    patientId: payload.patientId,
    patientName: payload.patientName,
    lat: payload.lat,
    lng: payload.lng,
    status: 'triggered',
    notifiedCaregiverIds: payload.notifiedCaregiverIds,
    timestamp: serverTimestamp(),
  };
  return addDoc(collection(db, SOS_COLLECTION), docPayload);
};

/**
 * Marks a triggered alert as acknowledged. Called by the caregiver UI.
 */
export const acknowledgeSOSAlert = async (alertId: string): Promise<void> => {
  await updateDoc(doc(db, `${SOS_COLLECTION}/${alertId}`), {
    status: 'acknowledged',
    acknowledgedAt: serverTimestamp(),
  });
};

/**
 * STUB. Real Twilio / WhatsApp delivery will be wired here later. We
 * intentionally do not call any external API yet — the spec is to write
 * the Firestore doc only and leave this side-effect as a console log
 * so the surrounding code path can be exercised end-to-end.
 */
export const sendSOSNotification = async (
  alert: SOSAlert & { id?: string }
): Promise<void> => {
  // TODO(integration): replace with Twilio / WhatsApp Cloud API call.
  console.log('[sosService] sendSOSNotification (stub) →', alert);
  return Promise.resolve();
};

/**
 * Wraps `navigator.geolocation.getCurrentPosition` in a Promise that
 * never rejects — denied / unavailable / timed-out all collapse to
 * `null` so the caller can write the alert without coordinates. We
 * keep `enableHighAccuracy: false` so the request finishes quickly on
 * desktops where high-accuracy can hang.
 */
export const getCurrentPositionSafe = (
  timeoutMs: number = 8000
): Promise<{ lat: number; lng: number } | null> =>
  new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    const guard = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, timeoutMs + 500);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          console.warn('[sosService] geolocation failed', err?.message || err);
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          maximumAge: 60_000,
          timeout: timeoutMs,
        }
      );
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      console.warn('[sosService] geolocation threw', err);
      resolve(null);
    }
  });

/**
 * Builds the human-readable message that would be sent over SMS /
 * WhatsApp. Matches the exact format from the feature spec; when
 * coordinates are unavailable we substitute a fallback string.
 */
export const buildSOSMessage = (
  patientName: string,
  lat: number | null,
  lng: number | null,
  when: Date
): string => {
  const timeStr = when.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (lat == null || lng == null) {
    return `PULSE SOS: ${patientName} needs help. Location unavailable — sent at ${timeStr}`;
  }
  const url = `https://maps.google.com/maps?q=${lat},${lng}`;
  return `PULSE SOS: ${patientName} needs help. Location: ${url} — sent at ${timeStr}`;
};
