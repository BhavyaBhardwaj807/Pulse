import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { LanguageCode } from '../context/SettingsContext';
import { SarvamChatService } from './sarvamChatService';

export interface MedicineInfo {
  purpose: string;
  sideEffects: string;
  instructions: string;
  missedDose: string;
}

/**
 * Firestore-safe doc id for the cache. Lowercases and replaces any
 * character that's risky in a Firestore document path (slashes, dots,
 * leading underscores, etc.) with an underscore. Suffixed with the
 * language code so the same medicine cached in different languages
 * doesn't collide.
 */
const cacheDocId = (medicineName: string, lang: LanguageCode): string => {
  const slug = medicineName
    .trim()
    .toLowerCase()
    .replace(/[\s/\\.#$\[\]]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'med';
  return `${slug}__${lang}`;
};

const cacheDocRef = (
  patientId: string,
  medicineName: string,
  lang: LanguageCode
) =>
  doc(db, `users/${patientId}/medicineInfo/${cacheDocId(medicineName, lang)}`);

const languageName: Record<LanguageCode, string> = {
  hi: 'Hindi',
  ta: 'Tamil',
  gu: 'Gujarati',
  mr: 'Marathi',
  te: 'Telugu',
  bn: 'Bengali',
  kn: 'Kannada',
  ml: 'Malayalam',
  en: 'English',
};

const buildPrompt = (medName: string, lang: LanguageCode): string => `In simple language suitable for an elderly patient, explain the medicine "${medName}":

- What is it used for?
- Common side effects to watch for
- Important instructions (e.g. take with food, avoid alcohol)
- What to do if a dose is missed

Respond in ${languageName[lang]}. Keep each point to 1-2 short sentences. Use everyday words, not medical jargon.

Return ONLY valid JSON in this exact shape, with NO markdown fences and NO commentary:
{
  "purpose": "...",
  "sideEffects": "...",
  "instructions": "...",
  "missedDose": "..."
}`;

const sanitiseJson = (raw: string): string =>
  raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

const fallbackText: Record<LanguageCode, MedicineInfo> = {
  hi: {
    purpose:
      'इस दवा की जानकारी अभी उपलब्ध नहीं है। कृपया अपने डॉक्टर या फार्मासिस्ट से पूछें।',
    sideEffects: 'दुष्प्रभाव की पूरी सूची के लिए अपने डॉक्टर से सलाह लें।',
    instructions:
      'पर्चे पर लिखे निर्देशों का पालन करें। शराब और अन्य दवाओं के साथ बातचीत के बारे में डॉक्टर से पूछें।',
    missedDose:
      'जैसे ही याद आए, खुराक लें। अगर अगली खुराक का समय हो गया है, तो छूटी हुई खुराक छोड़ दें।',
  },
  ta: {
    purpose:
      'இந்த மருந்தின் தகவல் தற்போது கிடைக்கவில்லை. தயவுசெய்து உங்கள் மருத்துவரிடம் கேளுங்கள்.',
    sideEffects: 'பக்க விளைவுகளுக்கு உங்கள் மருத்துவரை அணுகவும்.',
    instructions: 'மருந்து சீட்டில் கொடுக்கப்பட்ட வழிமுறைகளைப் பின்பற்றவும்.',
    missedDose:
      'நினைவுக்கு வந்தவுடன் எடுத்துக்கொள்ளுங்கள். அடுத்த நேரம் வந்துவிட்டால் தவறிய மருந்தை விட்டுவிடவும்.',
  },
  gu: {
    purpose: 'આ દવાની માહિતી હાલમાં ઉપલબ્ધ નથી. કૃપા કરી ડૉક્ટરનો સંપર્ક કરો.',
    sideEffects: 'આડઅસર માટે તમારા ડૉક્ટરની સલાહ લો.',
    instructions: 'દવાના ચિઠ્ઠી મુજબ ઉપયોગ કરો.',
    missedDose: 'યાદ આવે ત્યારે લો; આગળની ડોઝનો સમય આવી ગયો હોય તો છોડી દો.',
  },
  mr: {
    purpose: 'या औषधाची माहिती सध्या उपलब्ध नाही. कृपया डॉक्टरांना विचारा.',
    sideEffects: 'दुष्परिणामांसाठी डॉक्टरांचा सल्ला घ्या.',
    instructions: 'चिठ्ठीनुसार सेवन करा.',
    missedDose: 'आठवल्यावर घ्या; पुढच्या डोसचा वेळ आला असेल तर सोडून द्या.',
  },
  te: {
    purpose: 'ఈ మందు సమాచారం ప్రస్తుతం అందుబాటులో లేదు. దయచేసి మీ వైద్యుడిని సంప్రదించండి.',
    sideEffects: 'దుష్ప్రభావాల గురించి వైద్యుడిని అడగండి.',
    instructions: 'ప్రిస్క్రిప్షన్ ప్రకారం వాడండి.',
    missedDose: 'గుర్తొచ్చిన వెంటనే తీసుకోండి; తదుపరి సమయం వచ్చేస్తే వదిలేయండి.',
  },
  bn: {
    purpose: 'এই ওষুধের তথ্য এখন পাওয়া যাচ্ছে না। অনুগ্রহ করে ডাক্তারের সাথে পরামর্শ করুন।',
    sideEffects: 'পার্শ্বপ্রতিক্রিয়ার জন্য ডাক্তারের সাথে কথা বলুন।',
    instructions: 'প্রেসক্রিপশন অনুযায়ী খান।',
    missedDose: 'মনে পড়লে নিন; পরের সময় এসে গেলে বাদ দিন।',
  },
  kn: {
    purpose: 'ಈ ಔಷಧದ ಮಾಹಿತಿ ಈಗ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
    sideEffects: 'ಅಡ್ಡ ಪರಿಣಾಮಗಳಿಗಾಗಿ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
    instructions: 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಪ್ರಕಾರ ಸೇವಿಸಿ.',
    missedDose: 'ನೆನಪಾದಾಗ ತೆಗೆದುಕೊಳ್ಳಿ; ಮುಂದಿನ ಸಮಯ ಬಂದಿದ್ದರೆ ಬಿಡಿ.',
  },
  ml: {
    purpose: 'ഈ മരുന്നിന്റെ വിവരം ഇപ്പോൾ ലഭ്യമല്ല. ദയവായി ഡോക്ടറെ കാണുക.',
    sideEffects: 'പാർശ്വഫലങ്ങൾക്കായി ഡോക്ടറെ സമീപിക്കുക.',
    instructions: 'കുറിപ്പടി പ്രകാരം ഉപയോഗിക്കുക.',
    missedDose: 'ഓർമ്മ വന്നാൽ ഉടനെ കഴിക്കുക; അടുത്ത സമയം എത്തിയിട്ടുണ്ടെങ്കിൽ ഒഴിവാക്കുക.',
  },
  en: {
    purpose:
      'Information for this medicine is not available right now. Please ask your doctor or pharmacist.',
    sideEffects: 'Talk to your doctor about possible side effects.',
    instructions:
      'Follow the directions on your prescription. Ask your doctor about interactions with food, alcohol, or other medicines.',
    missedDose:
      'Take the missed dose as soon as you remember. If it is almost time for the next dose, skip the missed one.',
  },
};

/**
 * Calls the Sarvam chat completion to generate a structured, simple-
 * language Medicine Info object. Falls back to a localized stub on
 * any error so the UI always has something to show.
 */
export const generateMedicineInfo = async (
  medName: string,
  lang: LanguageCode
): Promise<MedicineInfo> => {
  try {
    const response = await SarvamChatService.completions({
      model: 'sarvam-30b',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a friendly pharmacist explaining medicines to elderly patients in India. Always return valid JSON only — no markdown, no commentary.',
        },
        {
          role: 'user',
          content: buildPrompt(medName, lang),
        },
      ],
    });

    const raw = (response as any)?.choices?.[0]?.message?.content;
    if (typeof raw !== 'string' || !raw.trim()) {
      console.warn('[medicineInfoService] empty Sarvam response for', medName);
      return fallbackText[lang] || fallbackText.en;
    }

    const cleaned = sanitiseJson(raw);
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.warn('[medicineInfoService] could not parse Sarvam JSON', { raw, err });
      return fallbackText[lang] || fallbackText.en;
    }

    const fb = fallbackText[lang] || fallbackText.en;
    return {
      purpose: typeof parsed.purpose === 'string' && parsed.purpose.trim() ? parsed.purpose.trim() : fb.purpose,
      sideEffects:
        typeof parsed.sideEffects === 'string' && parsed.sideEffects.trim()
          ? parsed.sideEffects.trim()
          : fb.sideEffects,
      instructions:
        typeof parsed.instructions === 'string' && parsed.instructions.trim()
          ? parsed.instructions.trim()
          : fb.instructions,
      missedDose:
        typeof parsed.missedDose === 'string' && parsed.missedDose.trim()
          ? parsed.missedDose.trim()
          : fb.missedDose,
    };
  } catch (err) {
    console.warn('[medicineInfoService] Sarvam call failed', err);
    return fallbackText[lang] || fallbackText.en;
  }
};

/**
 * Returns Medicine Info, served from Firestore cache when available
 * and not too stale (7 days). On a cache miss generates a fresh copy
 * and writes it back. Write failures (e.g. caregiver hitting a
 * restrictive rule) are logged and swallowed — the user still sees
 * the freshly generated info.
 */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const loadMedicineInfo = async (
  patientId: string,
  medicineName: string,
  lang: LanguageCode,
  options?: { forceRefresh?: boolean }
): Promise<{ info: MedicineInfo; cached: boolean }> => {
  const ref = cacheDocRef(patientId, medicineName, lang);

  if (!options?.forceRefresh) {
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        const generatedAt =
          data?.generatedAt?.toMillis?.() ??
          (typeof data?.generatedAtMs === 'number' ? data.generatedAtMs : null);
        const isFresh =
          !generatedAt || Date.now() - generatedAt < CACHE_TTL_MS;
        if (
          isFresh &&
          typeof data?.purpose === 'string' &&
          typeof data?.sideEffects === 'string' &&
          typeof data?.instructions === 'string' &&
          typeof data?.missedDose === 'string'
        ) {
          return {
            info: {
              purpose: data.purpose,
              sideEffects: data.sideEffects,
              instructions: data.instructions,
              missedDose: data.missedDose,
            },
            cached: true,
          };
        }
      }
    } catch (err) {
      console.warn('[medicineInfoService] cache read failed', err);
    }
  }

  const info = await generateMedicineInfo(medicineName, lang);

  // Write-through cache. Permission errors are swallowed so the UI
  // still shows the in-memory result even if the user can't persist.
  try {
    await setDoc(ref, {
      ...info,
      medicineName,
      language: lang,
      generatedAt: serverTimestamp(),
      generatedAtMs: Date.now(),
    });
  } catch (err) {
    console.warn('[medicineInfoService] cache write failed', err);
  }

  return { info, cached: false };
};

/**
 * Concatenates the four sections into one paragraph suitable for the
 * Speak Aloud button.
 */
export const flattenMedicineInfo = (info: MedicineInfo): string =>
  [info.purpose, info.sideEffects, info.instructions, info.missedDose]
    .filter((s) => s && s.trim().length > 0)
    .join(' ');
