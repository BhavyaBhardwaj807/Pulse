import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert, X, AlertTriangle, MapPin, Loader2 } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { useRole, useActivePatient } from '../context/RoleContext';
import { useSettings } from '../context/SettingsContext';
import {
  buildSOSMessage,
  createSOSAlert,
  getCurrentPositionSafe,
  sendSOSNotification,
  type SOSAlert,
} from '../services/sosService';

type Phase = 'idle' | 'pressing' | 'sending' | 'sent' | 'error';

const HOLD_MS = 2000;
const RING_SIZE = 88;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_RADIUS;

interface SentAlertState {
  id: string;
  alert: SOSAlert;
  message: string;
  hasCoords: boolean;
}

/**
 * Patient-only floating SOS button. Rendered from `Home.tsx` so it
 * stays scoped to the home dashboard. Hold for 2 seconds to fire an
 * alert into `sosAlerts`; release early to cancel.
 */
export const SOSButton: React.FC = () => {
  const { user } = useFirebase();
  const { role, profile } = useRole();
  const { isCaregiverViewing } = useActivePatient();
  const { language } = useSettings();

  const [phase, setPhase] = useState<Phase>('idle');
  const [pressProgress, setPressProgress] = useState(0);
  const [sent, setSent] = useState<SentAlertState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const triggeredRef = useRef<boolean>(false);

  const cancelLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const fireAlert = useCallback(async () => {
    if (!user) return;
    setPhase('sending');
    setErrorMsg(null);
    try {
      const coords = await getCurrentPositionSafe();
      const patientName =
        profile?.displayName || user.email || 'PULSE Patient';
      const linkedCaregiverIds = profile?.linkedCaregiverIds ?? [];

      const ref = await createSOSAlert({
        patientId: user.uid,
        patientName,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        notifiedCaregiverIds: linkedCaregiverIds,
      });

      const now = new Date();
      const alertDoc: SOSAlert = {
        patientId: user.uid,
        patientName,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        timestamp: now,
        status: 'triggered',
        notifiedCaregiverIds: linkedCaregiverIds,
      };
      const message = buildSOSMessage(
        patientName,
        coords?.lat ?? null,
        coords?.lng ?? null,
        now
      );

      // Fire-and-forget stub — actual Twilio/WhatsApp call lives in
      // sosService.sendSOSNotification. We deliberately do not await
      // long enough to block the success overlay.
      sendSOSNotification({ ...alertDoc, id: ref.id }).catch((err) =>
        console.warn('[SOSButton] notification stub rejected', err)
      );

      setSent({
        id: ref.id,
        alert: alertDoc,
        message,
        hasCoords: coords != null,
      });
      setPhase('sent');
    } catch (err: any) {
      console.error('[SOSButton] failed to create alert', err);
      setErrorMsg(err?.message || 'Could not send the alert.');
      setPhase('error');
    } finally {
      setPressProgress(0);
    }
  }, [user, profile]);

  const tick = useCallback(
    (now: number) => {
      const elapsed = now - startedAtRef.current;
      const pct = Math.min(1, elapsed / HOLD_MS);
      setPressProgress(pct);
      if (pct >= 1) {
        if (!triggeredRef.current) {
          triggeredRef.current = true;
          cancelLoop();
          void fireAlert();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [cancelLoop, fireAlert]
  );

  const handlePressStart = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (phase === 'sending' || phase === 'sent') return;
      e.preventDefault();
      try {
        (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
      } catch {}
      triggeredRef.current = false;
      startedAtRef.current = performance.now();
      setPhase('pressing');
      setPressProgress(0);
      cancelLoop();
      rafRef.current = requestAnimationFrame(tick);
    },
    [cancelLoop, tick, phase]
  );

  const handlePressEnd = useCallback(() => {
    if (triggeredRef.current) return;
    cancelLoop();
    if (phase === 'pressing') {
      setPhase('idle');
    }
    setPressProgress(0);
  }, [cancelLoop, phase]);

  // Reset triggered flag whenever we leave the sending/sent/error states
  useEffect(() => {
    if (phase === 'idle') {
      triggeredRef.current = false;
    }
  }, [phase]);

  // Cleanup on unmount
  useEffect(() => () => cancelLoop(), [cancelLoop]);

  // Hide for caregivers and for caregivers viewing a patient
  if (role !== 'patient' || isCaregiverViewing) return null;

  const ringDashOffset = RING_C * (1 - pressProgress);

  // Localised strings (hi / ta / en — fall back to en for other langs)
  const labels = (() => {
    if (language === 'hi') {
      return {
        srLabel: 'आपातकालीन SOS — 2 सेकंड दबाए रखें',
        helper: 'दबाए रखें',
        sending: 'अलर्ट भेजा जा रहा है…',
        sent: 'अलर्ट आपके केयरगिवर को भेज दिया गया',
        noLocation: 'स्थान उपलब्ध नहीं — अलर्ट बिना स्थान के भेजा गया',
        message: 'भेजा गया संदेश',
        dismiss: 'बंद करें',
        retry: 'फिर कोशिश करें',
        errorTitle: 'अलर्ट नहीं भेजा जा सका',
      };
    }
    if (language === 'ta') {
      return {
        srLabel: 'அவசர SOS — 2 விநாடிகள் அழுத்திப் பிடிக்கவும்',
        helper: 'அழுத்திப் பிடிக்கவும்',
        sending: 'எச்சரிக்கை அனுப்பப்படுகிறது…',
        sent: 'உங்கள் காப்பாளருக்கு எச்சரிக்கை அனுப்பப்பட்டது',
        noLocation: 'இடம் கிடைக்கவில்லை — இடமின்றி எச்சரிக்கை அனுப்பப்பட்டது',
        message: 'அனுப்பப்பட்ட செய்தி',
        dismiss: 'மூடு',
        retry: 'மீண்டும் முயற்சிக்கவும்',
        errorTitle: 'எச்சரிக்கையை அனுப்ப முடியவில்லை',
      };
    }
    return {
      srLabel: 'Emergency SOS — hold for 2 seconds',
      helper: 'Hold to send',
      sending: 'Sending alert…',
      sent: 'Alert sent to your caregivers',
      noLocation: 'Location unavailable — alert sent without location',
      message: 'Message sent',
      dismiss: 'Dismiss',
      retry: 'Try again',
      errorTitle: 'Could not send the alert',
    };
  })();

  const isBusy = phase === 'sending';
  const showOverlay = phase === 'sending' || phase === 'sent' || phase === 'error';

  return (
    <>
      {/* === Floating SOS FAB === */}
      <div
        className="fixed right-6 bottom-24 lg:bottom-6 z-30 flex flex-col items-center select-none"
        style={{ touchAction: 'none' }}
      >
        <div
          className="relative"
          style={{ width: RING_SIZE, height: RING_SIZE }}
        >
          {/* Idle pulse halo (hidden while pressing/sending so it doesn't
              compete with the countdown ring) */}
          {phase === 'idle' && (
            <>
              <span className="absolute inset-0 rounded-full bg-rose-600/30 animate-ping pointer-events-none" />
              <span className="absolute inset-1 rounded-full bg-rose-600/20 animate-pulse pointer-events-none" />
            </>
          )}

          {/* Countdown ring */}
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            className="absolute inset-0 -rotate-90 pointer-events-none"
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="transparent"
              strokeWidth={RING_STROKE}
              className="stroke-rose-900/60"
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="transparent"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={ringDashOffset}
              className="stroke-white transition-[stroke-dashoffset] duration-100 ease-linear"
            />
          </svg>

          <button
            type="button"
            aria-label={labels.srLabel}
            onPointerDown={handlePressStart}
            onPointerUp={handlePressEnd}
            onPointerLeave={handlePressEnd}
            onPointerCancel={handlePressEnd}
            onContextMenu={(e) => e.preventDefault()}
            disabled={isBusy}
            className={`absolute inset-2 rounded-full flex items-center justify-center text-white shadow-2xl shadow-rose-900/50 border-2 border-white/20 tactile-btn transition-transform ${
              phase === 'pressing'
                ? 'bg-rose-700 scale-95'
                : 'bg-rose-600 hover:bg-rose-500'
            } ${isBusy ? 'opacity-90 cursor-wait' : 'cursor-pointer'}`}
          >
            {isBusy ? (
              <Loader2 size={28} className="animate-spin" />
            ) : (
              <ShieldAlert size={30} strokeWidth={2.4} />
            )}
          </button>
        </div>

        {/* Helper chip — appears under the button on idle */}
        {phase === 'idle' && (
          <span className="mt-1.5 px-2 py-0.5 rounded-full bg-rose-600/90 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
            SOS · {labels.helper}
          </span>
        )}
      </div>

      {/* === Confirmation / status overlay === */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50 bg-navy-950/95 backdrop-blur flex flex-col items-center justify-center px-6 py-10 animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          {/* Pulsing red rings */}
          <div className="relative w-40 h-40 flex items-center justify-center mb-8">
            <span className="absolute inset-0 rounded-full bg-rose-600/30 animate-ping" />
            <span className="absolute inset-6 rounded-full bg-rose-600/50 animate-pulse" />
            <div className="relative w-24 h-24 rounded-full bg-rose-600 flex items-center justify-center border-4 border-navy-950 shadow-2xl shadow-rose-900/60 text-white">
              {phase === 'sending' ? (
                <Loader2 size={40} className="animate-spin" />
              ) : phase === 'error' ? (
                <AlertTriangle size={40} />
              ) : (
                <ShieldAlert size={40} strokeWidth={2.4} />
              )}
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-center max-w-md leading-tight">
            {phase === 'sending'
              ? labels.sending
              : phase === 'error'
              ? labels.errorTitle
              : labels.sent}
          </h2>

          {phase === 'sent' && sent && !sent.hasCoords && (
            <p className="mt-3 flex items-center gap-2 text-rose-200 text-sm font-semibold text-center max-w-md">
              <MapPin size={14} className="shrink-0" />
              <span>{labels.noLocation}</span>
            </p>
          )}

          {phase === 'error' && errorMsg && (
            <p className="mt-3 text-rose-200 text-sm font-medium text-center max-w-md">
              {errorMsg}
            </p>
          )}

          {phase === 'sent' && sent && (
            <div className="mt-6 w-full max-w-md bg-navy-900 border border-navy-800 rounded-card p-4 shadow-xl">
              <div className="text-[10px] font-bold uppercase tracking-widest text-navy-700 mb-2">
                {labels.message}
              </div>
              <p className="text-sm text-white leading-relaxed break-words">
                {sent.message}
              </p>
            </div>
          )}

          <div className="mt-8 flex items-center gap-3">
            {phase === 'error' && (
              <button
                onClick={() => {
                  setPhase('idle');
                  setErrorMsg(null);
                }}
                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-6 rounded-card border-2 border-rose-500 shadow-lg tactile-btn"
                style={{ minHeight: 48 }}
              >
                <span>{labels.retry}</span>
              </button>
            )}
            <button
              onClick={() => {
                setPhase('idle');
                setSent(null);
                setErrorMsg(null);
                setPressProgress(0);
              }}
              disabled={phase === 'sending'}
              className="inline-flex items-center gap-2 bg-navy-900 hover:bg-navy-850 text-white font-bold py-3 px-6 rounded-card border-2 border-navy-800 shadow-lg tactile-btn disabled:opacity-50"
              style={{ minHeight: 48 }}
            >
              <X size={16} />
              <span>{labels.dismiss}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SOSButton;
