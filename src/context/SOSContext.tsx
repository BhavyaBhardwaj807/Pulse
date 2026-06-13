// PULSE — modified
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from './FirebaseContext';

export type SosStatus = 'pending' | 'acknowledged' | 'resolved';
export type UrgencyScore = 'HIGH' | 'MED' | 'LOW';

/**
 * Shape of a document in the new `sosEvents` collection. Timestamps are
 * Firestore server-side and surface as Date on the client. This is the
 * single source of truth — the SOS pipeline writes it, the banner /
 * history feed read it, the navigation dot derives its count from it.
 */
export interface SosEvent {
  id: string;
  patientId: string;
  patientName: string;
  caregiverId: string;
  timestamp: Date;
  status: SosStatus;
  urgencyScore: UrgencyScore;
  transcription: string;
  translatedText: string;
  aiSummary: string;
  language: string;
  // PULSE — modified: audioBase64 was added when we dropped Firebase
  // Storage. With the default `base64` strategy this carries the full
  // `data:audio/...;base64,...` URI; with the `cloudinary` strategy it
  // is `''` and the playable URL lives in `audioURL` instead.
  audioBase64: string;
  audioStoragePath: string;
  audioURL: string;
  ttsAudioURL: string | null;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
}

export interface SosContextValue {
  pendingSosEvents: SosEvent[];
  allSosEvents: SosEvent[];
  unacknowledgedCount: number;
  acknowledgeEvent: (eventId: string) => Promise<void>;
  isLoading: boolean;
}

const SOSContext = createContext<SosContextValue | undefined>(undefined);

const SOS_COLLECTION = 'sosEvents';

// One subscription returns up to this many events; it's wide enough for
// the history feed (spec: last 20 + Load more) and for the banner +
// navigation dot to derive their state without a second listener.
const SOS_SUBSCRIPTION_LIMIT = 50;

const tsToDate = (raw: unknown): Date => {
  if (!raw) return new Date(0);
  if (raw instanceof Date) return raw;
  const anyTs = raw as { toDate?: () => Date; toMillis?: () => number };
  if (typeof anyTs.toDate === 'function') return anyTs.toDate();
  if (typeof anyTs.toMillis === 'function') return new Date(anyTs.toMillis());
  if (typeof raw === 'number') return new Date(raw);
  return new Date(0);
};

const tsToDateOrNull = (raw: unknown): Date | null => {
  if (!raw) return null;
  return tsToDate(raw);
};

const coerceUrgency = (raw: unknown): UrgencyScore => {
  return raw === 'HIGH' || raw === 'LOW' || raw === 'MED' ? raw : 'MED';
};

const coerceStatus = (raw: unknown): SosStatus => {
  return raw === 'acknowledged' || raw === 'resolved' ? raw : 'pending';
};

export const SOSProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useFirebase();

  const [allSosEvents, setAllSosEvents] = useState<SosEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Single onSnapshot for the whole session. Both the SOS banner and the
  // navigation ping read derived state from `allSosEvents` so we don't
  // open two parallel queries against Firestore.
  useEffect(() => {
    if (!user) {
      setAllSosEvents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const q = query(
      collection(db, SOS_COLLECTION),
      where('caregiverId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(SOS_SUBSCRIPTION_LIMIT)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: SosEvent[] = [];
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          rows.push({
            id: d.id,
            patientId: String(data.patientId ?? ''),
            patientName: String(data.patientName ?? 'Linked patient'),
            caregiverId: String(data.caregiverId ?? user.uid),
            timestamp: tsToDate(data.timestamp),
            status: coerceStatus(data.status),
            urgencyScore: coerceUrgency(data.urgencyScore),
            transcription: String(data.transcription ?? ''),
            translatedText: String(data.translatedText ?? ''),
            aiSummary: String(data.aiSummary ?? ''),
            language: String(data.language ?? 'en-IN'),
            audioBase64: String(data.audioBase64 ?? ''),
            audioStoragePath: String(data.audioStoragePath ?? ''),
            audioURL: String(data.audioURL ?? ''),
            ttsAudioURL:
              typeof data.ttsAudioURL === 'string' && data.ttsAudioURL
                ? (data.ttsAudioURL as string)
                : null,
            acknowledgedAt: tsToDateOrNull(data.acknowledgedAt),
            acknowledgedBy:
              typeof data.acknowledgedBy === 'string' && data.acknowledgedBy
                ? (data.acknowledgedBy as string)
                : null,
          });
        });
        setAllSosEvents(rows);
        setIsLoading(false);
      },
      (err) => {
        console.error('[SOSContext] snapshot error', err);
        setAllSosEvents([]);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const pendingSosEvents = useMemo(
    () => allSosEvents.filter((e) => e.status === 'pending'),
    [allSosEvents]
  );

  const unacknowledgedCount = pendingSosEvents.length;

  const acknowledgeEvent = useCallback(
    async (eventId: string) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, `${SOS_COLLECTION}/${eventId}`), {
          status: 'acknowledged',
          acknowledgedAt: serverTimestamp(),
          acknowledgedBy: user.uid,
        });
      } catch (err) {
        console.error('[SOSContext] acknowledge failed', err);
        throw err;
      }
    },
    [user]
  );

  const value: SosContextValue = {
    pendingSosEvents,
    allSosEvents,
    unacknowledgedCount,
    acknowledgeEvent,
    isLoading,
  };

  return <SOSContext.Provider value={value}>{children}</SOSContext.Provider>;
};

export const useSOS = (): SosContextValue => {
  const ctx = useContext(SOSContext);
  if (!ctx) throw new Error('useSOS must be used within SOSProvider');
  return ctx;
};
