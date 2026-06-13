// PULSE — modified
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useSOS } from '../context/SOSContext';
import type { SosEvent, SosStatus, UrgencyScore } from '../context/SOSContext';

const PAGE_SIZE = 20;

const URGENCY_PILL: Record<UrgencyScore, string> = {
  HIGH: 'bg-red-600 text-white',
  MED: 'bg-amber-500 text-white',
  LOW: 'bg-gray-400 text-white',
};

const URGENCY_LABEL = (u: UrgencyScore, lang: string): string => {
  if (lang === 'hi') {
    return u === 'HIGH' ? 'अति' : u === 'MED' ? 'मध्यम' : 'कम';
  }
  if (lang === 'ta') {
    return u === 'HIGH' ? 'அதிகம்' : u === 'MED' ? 'நடுத்தரம்' : 'குறைந்தது';
  }
  return u;
};

const STATUS_PILL: Record<SosStatus, string> = {
  pending: 'bg-red-600 text-white',
  acknowledged: 'bg-gray-500 text-white',
  resolved: 'bg-green-600 text-white',
};

const STATUS_LABEL = (s: SosStatus, lang: string): string => {
  if (lang === 'hi') {
    return s === 'pending'
      ? 'लंबित'
      : s === 'acknowledged'
      ? 'स्वीकृत'
      : 'सुलझाया';
  }
  if (lang === 'ta') {
    return s === 'pending'
      ? 'நிலுவையில்'
      : s === 'acknowledged'
      ? 'ஒப்புக்கொண்டது'
      : 'தீர்க்கப்பட்டது';
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const initials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatDateTime = (d: Date, lang: string): string => {
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'ta' ? 'ta-IN' : 'en-GB';
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface FeedCardProps {
  event: SosEvent;
  expanded: boolean;
  onToggle: () => void;
  onAck: () => void;
  acking: boolean;
}

const FeedCard: React.FC<FeedCardProps> = ({
  event,
  expanded,
  onToggle,
  onAck,
  acking,
}) => {
  const { language } = useSettings();
  const lang = language;

  // PULSE — modified: prefer Cloudinary URL when present, fall back to
  // the inline base64 data URI so this card works regardless of which
  // VITE_AUDIO_STORAGE strategy created the event.
  const audioSrc = event.audioURL || event.audioBase64 || '';

  return (
    <article
      className="surface-inset p-4 sm:p-5 flex flex-col gap-3"
      aria-label={`SOS from ${event.patientName} — ${event.urgencyScore}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="w-12 h-12 rounded-card bg-navy-850 border border-navy-800 flex items-center justify-center font-medium text-navy-50 shrink-0"
        >
          {initials(event.patientName)}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-medium text-navy-50 truncate">
              {event.patientName}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-pill text-xs font-medium uppercase tracking-wider ${URGENCY_PILL[event.urgencyScore]}`}
            >
              {URGENCY_LABEL(event.urgencyScore, lang)}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-pill text-xs font-medium uppercase tracking-wider ${STATUS_PILL[event.status]}`}
            >
              {STATUS_LABEL(event.status, lang)}
            </span>
          </div>
          <p className="mt-2 text-base text-navy-50 leading-snug">
            {event.aiSummary || event.translatedText || event.transcription || '—'}
          </p>
          <div className="mt-2 text-xs font-medium text-navy-700">
            {formatDateTime(event.timestamp, lang)} · {event.language}
          </div>
        </div>

        {event.status === 'pending' && (
          <button
            onClick={onAck}
            disabled={acking}
            aria-label={
              lang === 'hi'
                ? 'स्वीकार करें'
                : lang === 'ta'
                ? 'ஒப்புக்கொள்'
                : 'Acknowledge'
            }
            className="hidden sm:inline-flex items-center gap-1.5 bg-accent hover:bg-accent-dark text-white text-sm font-medium px-4 rounded-card shadow-soft tactile-btn shrink-0 disabled:opacity-60"
            style={{ minHeight: 48 }}
          >
            {acking ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} strokeWidth={2.5} />
            )}
            <span>
              {lang === 'hi' ? 'स्वीकार' : lang === 'ta' ? 'ஒப்பு' : 'Ack'}
            </span>
          </button>
        )}
      </div>

      {/* Mobile-only ack button (full-width) */}
      {event.status === 'pending' && (
        <button
          onClick={onAck}
          disabled={acking}
          aria-label={
            lang === 'hi'
              ? 'स्वीकार करें'
              : lang === 'ta'
              ? 'ஒப்புக்கொள்'
              : 'Acknowledge'
          }
          className="sm:hidden w-full inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white text-sm font-medium px-4 rounded-card shadow-soft tactile-btn disabled:opacity-60"
          style={{ minHeight: 48 }}
        >
          {acking ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Check size={16} strokeWidth={2.5} />
          )}
          <span>
            {lang === 'hi'
              ? 'स्वीकार करें'
              : lang === 'ta'
              ? 'ஒப்புக்கொள்'
              : 'Acknowledge'}
          </span>
        </button>
      )}

      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? lang === 'hi'
              ? 'विवरण छिपाएँ'
              : 'Hide details'
            : lang === 'hi'
            ? 'विवरण देखें'
            : 'Show details'
        }
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-dark tactile-btn self-start"
        style={{ minHeight: 36, paddingInline: 4 }}
      >
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        <span>
          {expanded
            ? lang === 'hi'
              ? 'विवरण छिपाएँ'
              : lang === 'ta'
              ? 'மறை'
              : 'Hide details'
            : lang === 'hi'
            ? 'विवरण देखें'
            : lang === 'ta'
            ? 'விரிவாக்கு'
            : 'Show details'}
        </span>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-navy-800">
          <div className="bg-navy-900 border border-navy-800 rounded-card p-3">
            <div className="text-xs font-medium uppercase tracking-wider text-navy-700 mb-1">
              {lang === 'hi'
                ? 'मूल भाषा में लिप्यंतरण'
                : lang === 'ta'
                ? 'அசல் மொழி'
                : 'Original transcription'}
            </div>
            <p className="text-sm text-navy-50 leading-snug whitespace-pre-wrap break-words">
              {event.transcription || '—'}
            </p>
          </div>
          <div className="bg-navy-900 border border-navy-800 rounded-card p-3">
            <div className="text-xs font-medium uppercase tracking-wider text-navy-700 mb-1">
              {lang === 'hi'
                ? 'अंग्रेजी अनुवाद'
                : lang === 'ta'
                ? 'ஆங்கில மொழிபெயர்ப்பு'
                : 'English translation'}
            </div>
            <p className="text-sm text-navy-50 leading-snug whitespace-pre-wrap break-words">
              {event.translatedText || '—'}
            </p>
          </div>
          {audioSrc && (
            <div className="md:col-span-2 bg-navy-900 border border-navy-800 rounded-card p-3">
              <div className="text-xs font-medium uppercase tracking-wider text-navy-700 mb-2">
                {lang === 'hi'
                  ? 'वॉयस नोट'
                  : lang === 'ta'
                  ? 'குரல் குறிப்பு'
                  : 'Voice note'}
              </div>
              <audio
                src={audioSrc}
                controls
                preload="none"
                className="w-full"
                aria-label={
                  lang === 'hi'
                    ? 'मरीज़ का मूल वॉयस नोट'
                    : 'Patient original voice note'
                }
              />
            </div>
          )}
          {event.status === 'acknowledged' && event.acknowledgedAt && (
            <div className="md:col-span-2 text-xs font-medium text-navy-700">
              {lang === 'hi' ? 'स्वीकृत' : 'Acknowledged'}{' '}
              {event.acknowledgedBy ? `by ${event.acknowledgedBy.slice(0, 6)}…` : ''}{' '}
              {lang === 'hi' ? 'पर' : 'at'}{' '}
              {formatDateTime(event.acknowledgedAt, lang)}
            </div>
          )}
        </div>
      )}
    </article>
  );
};

/**
 * Caregiver-side history of every SOS event linked to the signed-in
 * caregiver. Reads from SOSContext (no extra Firestore listener) and
 * paginates locally in 20-event pages. Pending events bubble to the
 * top, then acknowledged / resolved in chronological order.
 */
export const SOSHistoryFeed: React.FC = () => {
  const { language } = useSettings();
  const { allSosEvents, acknowledgeEvent, isLoading } = useSOS();

  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [ackingId, setAckingId] = useState<string | null>(null);

  const ordered = useMemo(() => {
    // Pending first (most recent), then acknowledged/resolved (most recent).
    const pending: SosEvent[] = [];
    const settled: SosEvent[] = [];
    for (const e of allSosEvents) {
      (e.status === 'pending' ? pending : settled).push(e);
    }
    pending.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    settled.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return [...pending, ...settled];
  }, [allSosEvents]);

  const visible = ordered.slice(0, page * PAGE_SIZE);
  const hasMore = ordered.length > visible.length;

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAck = async (id: string) => {
    setAckingId(id);
    try {
      await acknowledgeEvent(id);
    } finally {
      setAckingId(null);
    }
  };

  const labels = (() => {
    if (language === 'hi') {
      return {
        title: 'SOS इतिहास',
        sub: 'आपके मरीज़ों से सभी SOS अलर्ट',
        empty: 'अभी तक कोई SOS अलर्ट नहीं — यह अच्छी खबर है।',
        loading: 'लोड हो रहा है…',
        loadMore: 'और देखें',
      };
    }
    if (language === 'ta') {
      return {
        title: 'SOS வரலாறு',
        sub: 'உங்கள் நோயாளிகளின் அனைத்து SOS எச்சரிக்கைகள்',
        empty: 'இதுவரை SOS எச்சரிக்கைகள் இல்லை — இது நல்ல செய்தி.',
        loading: 'ஏற்றுகிறது…',
        loadMore: 'மேலும் ஏற்றுக',
      };
    }
    return {
      title: 'SOS History',
      sub: 'All SOS alerts from your linked patients',
      empty: 'No SOS alerts yet — that is good news.',
      loading: 'Loading…',
      loadMore: 'Load more',
    };
  })();

  return (
    <section
      id="sos-history"
      aria-labelledby="sos-history-title"
      className="card-navy"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2
            id="sos-history-title"
            className="text-xl font-medium text-navy-50 tracking-tight flex items-center gap-2"
          >
            <ShieldAlert size={20} className="text-danger" aria-hidden="true" />
            {labels.title}
          </h2>
          <p className="text-sm text-navy-700 mt-0.5">{labels.sub}</p>
        </div>
        {ordered.length > 0 && (
          <span className="text-xs font-medium uppercase tracking-wider text-navy-700">
            {ordered.length} {language === 'hi' ? 'कुल' : 'total'}
          </span>
        )}
      </div>

      {isLoading && allSosEvents.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-navy-700 py-6">
          <Loader2 size={16} className="animate-spin" />
          <span>{labels.loading}</span>
        </div>
      ) : ordered.length === 0 ? (
        <div className="flex items-center gap-3 text-sm font-medium text-navy-700 py-8 justify-center">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{labels.empty}</span>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((event) => (
            <FeedCard
              key={event.id}
              event={event}
              expanded={expandedIds.has(event.id)}
              onToggle={() => toggleExpanded(event.id)}
              onAck={() => handleAck(event.id)}
              acking={ackingId === event.id}
            />
          ))}
          {hasMore && (
            <button
              onClick={() => setPage((p) => p + 1)}
              className="w-full inline-flex items-center justify-center gap-2 bg-navy-850 hover:bg-navy-800 text-navy-50 text-sm font-medium px-4 rounded-card border border-navy-800 hover:border-accent tactile-btn"
              style={{ minHeight: 48 }}
            >
              <ChevronDown size={16} />
              <span>{labels.loadMore}</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default SOSHistoryFeed;
