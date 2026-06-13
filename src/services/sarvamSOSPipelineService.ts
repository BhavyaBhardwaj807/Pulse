// PULSE — modified
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { SarvamAI } from 'sarvamai';
import { db } from '../firebase';
import { SarvamChatService } from './sarvamChatService';
import { SarvamSpeechService } from './sarvamSpeechService';
import { SarvamTranslationService } from './sarvamTranslationService';

/**
 * SOS voice-note pipeline. Owns the full client-side chain:
 *
 *   STT  →  Translate  →  LLM triage  →  Audio attach  →  Firestore write
 *                                                          ↓
 *                                                      TTS (async, non-blocking)
 *
 * The Firestore write happens once, atomically, with every field
 * populated. TTS is best-effort and patches the document afterwards;
 * its failure must never block the SOS reaching the caregiver.
 *
 * Audio storage strategy is selected at runtime via `VITE_AUDIO_STORAGE`:
 *
 *   - 'base64' (default, no extra services): we encode the raw
 *     MediaRecorder blob as a `data:` URI and stash it directly in the
 *     Firestore document. Works without provisioning Firebase Storage.
 *   - 'cloudinary': unsigned upload to Cloudinary's free tier; the
 *     returned `secure_url` lands in `audioURL` and `public_id` in
 *     `audioStoragePath`.
 *
 * `VITE_DEMO_MODE === 'true'` shorts the AI + audio steps and writes
 * a deterministic demo document so the rest of the UI (banner, dot,
 * history feed) can be exercised without burning Sarvam quota.
 */

const SOS_COLLECTION = 'sosEvents';
const DEMO_DELAY_MS = 1500;
// 800 KB cap for any base64 string we put into a Firestore document.
// Firestore enforces a hard 1 MB per-document limit; this leaves room
// for transcription/translation/summary/timestamps in the same doc.
const MAX_BASE64_BYTES = 800_000;

const SOS_SYSTEM_PROMPT = `You are a medical emergency triage assistant for elderly patients in India.
Analyse the following patient message and respond with ONLY a valid JSON object — no markdown, no explanation.
The JSON must have exactly three fields:
{
  "urgencyScore": "HIGH" | "MED" | "LOW",
  "aiSummary": "<one sentence in plain English, max 20 words>",
  "keywords": ["<key symptom or concern 1>", "<key symptom or concern 2>"]
}

Rules for urgencyScore:
- HIGH: chest pain, difficulty breathing, fall, unconscious, stroke symptoms, severe bleeding, "can't breathe", "fell down", "heart"
- LOW: missed medicine, general discomfort, asking a question, needs help with something non-urgent
- MED: everything else`;

const FALLBACK_AI_SUMMARY = 'Voice note recorded — AI processing unavailable';
const FALLBACK_PARSE_SUMMARY = 'Voice note recorded.';

type AudioStorageStrategy = 'base64' | 'cloudinary';

const isDemoMode = (): boolean =>
  String(import.meta.env.VITE_DEMO_MODE).toLowerCase() === 'true';

const resolveAudioStrategy = (): AudioStorageStrategy => {
  const raw = (import.meta.env.VITE_AUDIO_STORAGE ?? '').toString().trim().toLowerCase();
  return raw === 'cloudinary' ? 'cloudinary' : 'base64';
};

/**
 * Pulls the BCP-47 language tag the STT model returned (or 'en-IN' as a
 * safe default). Sarvam STT can omit `language_code` when the audio is
 * silent, so we collapse undefined/null to a sensible fallback.
 */
const normaliseLanguageCode = (raw: string | undefined | null): string => {
  if (!raw) return 'en-IN';
  const trimmed = raw.trim();
  if (!trimmed) return 'en-IN';
  return trimmed;
};

/**
 * Crops the model output to a single JSON object — Sarvam-30b sometimes
 * frames JSON in markdown fences or chats around the response.
 */
const extractJsonObject = (raw: string): string | null => {
  if (!raw) return null;
  const stripped = raw.replace(/```(?:json|JSON)?/g, '').replace(/```/g, '').trim();
  const start = stripped.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < stripped.length; i += 1) {
    const ch = stripped[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }
  return null;
};

interface TriageResult {
  urgencyScore: 'HIGH' | 'MED' | 'LOW';
  aiSummary: string;
  keywords: string[];
}

const FALLBACK_TRIAGE: TriageResult = {
  urgencyScore: 'MED',
  aiSummary: FALLBACK_PARSE_SUMMARY,
  keywords: [],
};

const coerceTriage = (parsed: unknown): TriageResult => {
  if (!parsed || typeof parsed !== 'object') return FALLBACK_TRIAGE;
  const p = parsed as Record<string, unknown>;
  const urgency =
    p.urgencyScore === 'HIGH' || p.urgencyScore === 'LOW' || p.urgencyScore === 'MED'
      ? p.urgencyScore
      : 'MED';
  const summary =
    typeof p.aiSummary === 'string' && p.aiSummary.trim()
      ? p.aiSummary.trim().slice(0, 240)
      : FALLBACK_PARSE_SUMMARY;
  const keywords = Array.isArray(p.keywords)
    ? p.keywords
        .filter((k) => typeof k === 'string')
        .map((k) => (k as string).trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  return { urgencyScore: urgency, aiSummary: summary, keywords };
};

/**
 * Runs Sarvam STT against the patient's audio blob. The model is left
 * on its default (`saarika:v2.5`) and `language_code: 'unknown'` so the
 * response includes the BCP-47 tag we save in Firestore.
 */
const runSpeechToText = async (
  audioBlob: Blob
): Promise<{ transcript: string; languageCode: string }> => {
  try {
    // PULSE — modified: Chrome's MediaRecorder hands back blobs with
    // type = "audio/webm;codecs=opus". Sarvam's allowlist exact-matches
    // "audio/webm" (and a handful of other bare types), so the codec
    // parameter triggers a 400 invalid_request_error. We strip the
    // parameter and pick a Sarvam-allowlisted bare MIME.
    const rawType = audioBlob.type || 'audio/webm';
    const sttMime = rawType.split(';')[0].trim() || 'audio/webm';
    const file = new File([audioBlob], 'sos.webm', { type: sttMime });
    // #region agent log
    fetch('http://127.0.0.1:7869/ingest/996fcf05-cca1-43b0-b221-285c62549335',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7d472'},body:JSON.stringify({sessionId:'d7d472',runId:'post-fix',hypothesisId:'H1+H2+H3',location:'sarvamSOSPipelineService.ts:runSpeechToText:before',message:'STT mime cleanup before SDK call',data:{rawType,sttMime,blobSize:audioBlob.size,fileType:file.type,fileName:file.name},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const response = await SarvamSpeechService.transcribe({
      file,
      language_code: 'unknown' as SarvamAI.SpeechToTextLanguage,
    });
    // #region agent log
    fetch('http://127.0.0.1:7869/ingest/996fcf05-cca1-43b0-b221-285c62549335',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7d472'},body:JSON.stringify({sessionId:'d7d472',runId:'post-fix',hypothesisId:'H1+H2',location:'sarvamSOSPipelineService.ts:runSpeechToText:success',message:'STT returned',data:{transcriptLen:(response.transcript ?? '').length,languageCode:response.language_code},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return {
      transcript: (response.transcript ?? '').trim(),
      languageCode: normaliseLanguageCode(response.language_code),
    };
  } catch (err) {
    // #region agent log
    const e = err as { status?: number; message?: string; body?: unknown };
    fetch('http://127.0.0.1:7869/ingest/996fcf05-cca1-43b0-b221-285c62549335',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7d472'},body:JSON.stringify({sessionId:'d7d472',runId:'post-fix',hypothesisId:'H1+H2',location:'sarvamSOSPipelineService.ts:runSpeechToText:catch',message:'STT threw after mime cleanup',data:{status:e?.status,errMessage:e?.message?.slice(0,400)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.warn('[SOS pipeline] STT failed', err);
    return { transcript: '', languageCode: 'en-IN' };
  }
};

/**
 * Translates `text` to en-IN. If the input is already English we skip
 * the API call. If the API errors, we fall back to the original text so
 * downstream LLM still has something to score.
 */
const runTranslation = async (
  text: string,
  sourceLanguage: string
): Promise<string> => {
  if (!text.trim()) return '';
  if (sourceLanguage.toLowerCase().startsWith('en')) return text;
  try {
    const response = await SarvamTranslationService.translate({
      input: text,
      source_language_code: 'auto' as SarvamAI.TranslateSourceLanguage,
      target_language_code: 'en-IN' as SarvamAI.TranslateTargetLanguage,
    });
    return (response.translated_text ?? text).trim() || text;
  } catch (err) {
    console.warn('[SOS pipeline] translation failed', err);
    return text;
  }
};

/**
 * Sends the English voice-note text to Sarvam-30b with the triage
 * system prompt. We disable the hidden reasoning budget (same trick
 * as the prescription extractor) so every token is pure JSON output.
 */
const runUrgencyScoring = async (translatedText: string): Promise<TriageResult> => {
  if (!translatedText.trim()) return FALLBACK_TRIAGE;
  try {
    const response = await SarvamChatService.completions({
      model: 'sarvam-30b',
      temperature: 0,
      reasoning_effort: null as any,
      max_tokens: 512,
      messages: [
        { role: 'system', content: SOS_SYSTEM_PROMPT },
        { role: 'user', content: translatedText },
      ],
    });
    const content = (response as any)?.choices?.[0]?.message?.content ?? '';
    const candidate = extractJsonObject(content);
    if (!candidate) return FALLBACK_TRIAGE;
    try {
      return coerceTriage(JSON.parse(candidate));
    } catch (parseErr) {
      console.warn('[SOS pipeline] triage JSON parse failed', parseErr, content);
      return FALLBACK_TRIAGE;
    }
  } catch (err) {
    console.warn('[SOS pipeline] LLM triage failed', err);
    return FALLBACK_TRIAGE;
  }
};

/**
 * Reads a Blob into a `data:<mime>;base64,...` URI string. Stays in
 * memory; never writes to disk. Returns the empty string on read error
 * so the surrounding pipeline can keep going (audio is best-effort).
 */
const blobToBase64DataUri = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });

interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Unsigned upload to Cloudinary. Audio (webm/wav/etc.) must use the
 * `video` resource_type — Cloudinary rejects `audio/*` blobs from the
 * `image` and `raw` endpoints. The folder + public_id keep uploads
 * partitioned per patient/event for easy moderation.
 *
 * Throws on missing env vars or non-2xx response so the caller's
 * try/catch can record the failure and fall through to writing the
 * Firestore doc with empty audio fields.
 */
const uploadAudioToCloudinary = async (
  blob: Blob,
  patientId: string,
  eventId: string,
  publicIdSuffix: string = ''
): Promise<CloudinaryUploadResult> => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary env vars not set (VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET)');
  }

  const fileExt = blob.type.includes('wav') ? 'wav' : 'webm';
  const formData = new FormData();
  formData.append('file', blob, `sos_${patientId}_${eventId}${publicIdSuffix}.${fileExt}`);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', `pulse_sos/${patientId}`);
  formData.append('public_id', `${eventId}${publicIdSuffix}`);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    throw new Error(`Cloudinary upload failed: ${response.status}`);
  }

  const data: { secure_url?: string; public_id?: string } = await response.json();
  if (!data.secure_url || !data.public_id) {
    throw new Error('Cloudinary response missing secure_url/public_id');
  }
  return { url: data.secure_url, publicId: data.public_id };
};

const base64ToBlob = (base64: string, mime: string): Blob => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

interface ResolvedAudio {
  audioBase64: string;
  audioURL: string;
  audioStoragePath: string;
}

const EMPTY_AUDIO: ResolvedAudio = {
  audioBase64: '',
  audioURL: '',
  audioStoragePath: '',
};

/**
 * Strategy dispatcher used by the recording side of the pipeline. The
 * SOS doc is always written with a single audio source filled in:
 * either `audioBase64` (default) or `audioURL` (cloudinary). Failures
 * are non-blocking — we return EMPTY_AUDIO and the SOS still goes out.
 */
const resolveRecordingAudio = async (
  blob: Blob,
  patientId: string,
  eventId: string,
  strategy: AudioStorageStrategy
): Promise<ResolvedAudio> => {
  if (strategy === 'cloudinary') {
    try {
      const { url, publicId } = await uploadAudioToCloudinary(blob, patientId, eventId);
      // #region agent log
      fetch('http://127.0.0.1:7869/ingest/996fcf05-cca1-43b0-b221-285c62549335',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7d472'},body:JSON.stringify({sessionId:'d7d472',hypothesisId:'POST-FIX',runId:'post-fix',location:'sarvamSOSPipelineService.ts:resolveRecordingAudio:cloudinary',message:'cloudinary upload ok',data:{eventId,strategy,urlLen:url.length,publicId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return { audioBase64: '', audioURL: url, audioStoragePath: publicId };
    } catch (err) {
      console.error('PULSE SOS: Cloudinary upload failed, continuing without audio URL', err);
      return EMPTY_AUDIO;
    }
  }

  // base64 (default)
  try {
    const dataUri = await blobToBase64DataUri(blob);
    const tooBig = dataUri.length > MAX_BASE64_BYTES;
    if (tooBig) {
      console.warn('PULSE SOS: audio too large for Firestore, skipping base64 storage');
    }
    const audioBase64 = tooBig ? '' : dataUri;
    // #region agent log
    fetch('http://127.0.0.1:7869/ingest/996fcf05-cca1-43b0-b221-285c62549335',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7d472'},body:JSON.stringify({sessionId:'d7d472',hypothesisId:'POST-FIX',runId:'post-fix',location:'sarvamSOSPipelineService.ts:resolveRecordingAudio:base64',message:'base64 audio resolved',data:{eventId,strategy,blobSize:blob.size,blobType:blob.type,dataUriLen:dataUri.length,storedLen:audioBase64.length,tooBig},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return { audioBase64, audioURL: '', audioStoragePath: '' };
  } catch (err) {
    console.error('PULSE SOS: base64 conversion failed', err);
    return EMPTY_AUDIO;
  }
};

/**
 * Best-effort TTS of the English summary. We hand the resulting
 * "URL" (data URI for base64 strategy, Cloudinary secure_url for
 * cloudinary strategy) back to the caller so it can patch the
 * Firestore document via updateDoc.
 */
const generateTtsAudioUrl = async (
  summary: string,
  patientId: string,
  eventId: string,
  strategy: AudioStorageStrategy
): Promise<string | null> => {
  if (!summary.trim()) return null;
  try {
    // PULSE — modified: 'meera' was retired from bulbul:v2 (server
     // returns 400 invalid_request_error with the up-to-date allowlist).
     // 'anushka' is the canonical female Indian-English voice on v2 and
     // is intelligible for the elderly caregiver target audience.
    const response = await SarvamSpeechService.textToSpeech({
      text: summary,
      target_language_code: 'en-IN' as SarvamAI.TextToSpeechLanguage,
      model: 'bulbul:v2' as SarvamAI.TextToSpeechModel,
      speaker: 'anushka' as SarvamAI.TextToSpeechSpeaker,
      speech_sample_rate: 22050,
    });
    // #region agent log
    fetch('http://127.0.0.1:7869/ingest/996fcf05-cca1-43b0-b221-285c62549335',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7d472'},body:JSON.stringify({sessionId:'d7d472',runId:'post-fix',hypothesisId:'H_TTS',location:'sarvamSOSPipelineService.ts:generateTtsAudioUrl:tts-ok',message:'TTS returned audio',data:{audioCount:response.audios?.length ?? 0,base64Len:response.audios?.[0]?.length ?? 0,strategy},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const base64 = response.audios?.[0];
    if (!base64) return null;

    if (strategy === 'cloudinary') {
      const blob = base64ToBlob(base64, 'audio/wav');
      const { url } = await uploadAudioToCloudinary(blob, patientId, eventId, '_tts');
      return url;
    }

    // base64 strategy: ttsAudioURL is itself a data URI. Apply the same
    // size cap so a long narration doesn't push the doc over 1 MB.
    const dataUri = `data:audio/wav;base64,${base64}`;
    if (dataUri.length > MAX_BASE64_BYTES) {
      console.warn('PULSE SOS: TTS audio too large for Firestore, skipping');
      return null;
    }
    return dataUri;
  } catch (err) {
    // #region agent log
    const e = err as { status?: number; message?: string };
    fetch('http://127.0.0.1:7869/ingest/996fcf05-cca1-43b0-b221-285c62549335',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7d472'},body:JSON.stringify({sessionId:'d7d472',runId:'post-fix',hypothesisId:'H_TTS',location:'sarvamSOSPipelineService.ts:generateTtsAudioUrl:catch',message:'TTS threw after speaker swap',data:{status:e?.status,errMessage:e?.message?.slice(0,400),strategy},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.warn('[SOS pipeline] TTS generation failed', err);
    return null;
  }
};

interface SosFirestoreDoc {
  patientId: string;
  patientName: string;
  caregiverId: string;
  timestamp: ReturnType<typeof serverTimestamp>;
  status: 'pending';
  urgencyScore: 'HIGH' | 'MED' | 'LOW';
  transcription: string;
  translatedText: string;
  aiSummary: string;
  language: string;
  audioBase64: string;
  audioStoragePath: string;
  audioURL: string;
  ttsAudioURL: string | null;
  acknowledgedAt: null;
  acknowledgedBy: null;
}

const writeSosDocument = async (
  eventId: string,
  payload: Omit<SosFirestoreDoc, 'timestamp' | 'status' | 'acknowledgedAt' | 'acknowledgedBy'>
): Promise<void> => {
  const docPayload: SosFirestoreDoc = {
    ...payload,
    timestamp: serverTimestamp(),
    status: 'pending',
    acknowledgedAt: null,
    acknowledgedBy: null,
  };
  // #region agent log
  fetch('http://127.0.0.1:7869/ingest/996fcf05-cca1-43b0-b221-285c62549335',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7d472'},body:JSON.stringify({sessionId:'d7d472',hypothesisId:'H3',runId:'post-fix',location:'sarvamSOSPipelineService.ts:writeSosDocument:before',message:'about to write SOS Firestore doc',data:{eventId,audioBase64Len:payload.audioBase64.length,hasAudioURL:!!payload.audioURL,audioStoragePath:payload.audioStoragePath,urgency:payload.urgencyScore,patientId:payload.patientId,caregiverId:payload.caregiverId},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  try {
    await setDoc(doc(db, `${SOS_COLLECTION}/${eventId}`), docPayload);
    // #region agent log
    fetch('http://127.0.0.1:7869/ingest/996fcf05-cca1-43b0-b221-285c62549335',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7d472'},body:JSON.stringify({sessionId:'d7d472',hypothesisId:'H3',runId:'post-fix',location:'sarvamSOSPipelineService.ts:writeSosDocument:success',message:'SOS Firestore doc written',data:{eventId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  } catch (err) {
    // #region agent log
    const e = err as { code?: string; message?: string };
    fetch('http://127.0.0.1:7869/ingest/996fcf05-cca1-43b0-b221-285c62549335',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7d472'},body:JSON.stringify({sessionId:'d7d472',hypothesisId:'H3',runId:'post-fix',location:'sarvamSOSPipelineService.ts:writeSosDocument:catch',message:'Firestore write threw',data:{eventId,errCode:e?.code,errMessage:e?.message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw err;
  }
};

/**
 * Single entry point used by the SOSButton. The SOS goes through the
 * full pipeline and the calling component only awaits this promise —
 * by the time it resolves, the caregiver banner / dot / history feed
 * are already populated via their shared onSnapshot listener.
 */
export const processSosVoiceNote = async (
  audioBlob: Blob,
  patientId: string,
  caregiverId: string,
  patientName: string
): Promise<void> => {
  const eventRef = doc(collection(db, SOS_COLLECTION));
  const eventId = eventRef.id;
  const strategy = resolveAudioStrategy();
  // #region agent log
  fetch('http://127.0.0.1:7869/ingest/996fcf05-cca1-43b0-b221-285c62549335',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7d472'},body:JSON.stringify({sessionId:'d7d472',hypothesisId:'POST-FIX',runId:'post-fix',location:'sarvamSOSPipelineService.ts:processSosVoiceNote:entry',message:'pipeline entry',data:{eventId,patientId,caregiverId,patientName,blobSize:audioBlob.size,blobType:audioBlob.type,demoMode:isDemoMode(),strategy,audioStorageEnv:import.meta.env.VITE_AUDIO_STORAGE},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (isDemoMode()) {
    await new Promise((resolve) => setTimeout(resolve, DEMO_DELAY_MS));
    await writeSosDocument(eventId, {
      patientId,
      patientName,
      caregiverId,
      urgencyScore: 'HIGH',
      transcription: 'मुझे बहुत तकलीफ हो रही है, दवाई नहीं ली',
      translatedText: 'I am in a lot of pain, I have not taken my medicine',
      aiSummary: 'Patient reports severe discomfort and missed medication.',
      language: 'hi-IN',
      audioBase64: '',
      audioStoragePath: '',
      audioURL: '',
      ttsAudioURL: null,
    });
    return;
  }

  // ------- Real Sarvam pipeline -------
  const { transcript, languageCode } = await runSpeechToText(audioBlob);

  // STT empty: skip translation + LLM, write a fallback doc so the
  // caregiver still sees something actionable, and try to keep the
  // audio so they can listen to it directly.
  if (!transcript) {
    const audio = await resolveRecordingAudio(audioBlob, patientId, eventId, strategy);
    await writeSosDocument(eventId, {
      patientId,
      patientName,
      caregiverId,
      urgencyScore: 'MED',
      transcription: '',
      translatedText: '',
      aiSummary: FALLBACK_AI_SUMMARY,
      language: languageCode,
      ...audio,
      ttsAudioURL: null,
    });
    return;
  }

  const translatedText = await runTranslation(transcript, languageCode);
  const triage = await runUrgencyScoring(translatedText);

  const audio = await resolveRecordingAudio(audioBlob, patientId, eventId, strategy);

  await writeSosDocument(eventId, {
    patientId,
    patientName,
    caregiverId,
    urgencyScore: triage.urgencyScore,
    transcription: transcript,
    translatedText,
    aiSummary: triage.aiSummary,
    language: languageCode,
    ...audio,
    ttsAudioURL: null,
  });

  // TTS runs after the Firestore write so a slow/failing TTS call can
  // never delay the alert reaching the caregiver. We patch ttsAudioURL
  // in once it lands; the banner re-renders via its onSnapshot.
  void generateTtsAudioUrl(triage.aiSummary, patientId, eventId, strategy)
    .then(async (ttsAudioURL) => {
      if (!ttsAudioURL) return;
      try {
        await updateDoc(doc(db, `${SOS_COLLECTION}/${eventId}`), {
          ttsAudioURL,
        });
      } catch (err) {
        console.warn('[SOS pipeline] failed to patch ttsAudioURL', err);
      }
    })
    .catch((err) => console.warn('[SOS pipeline] TTS task rejected', err));
};
