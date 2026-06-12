import type { LanguageCode } from '../context/SettingsContext';
import type { SarvamAI } from 'sarvamai';
import { SarvamChatService } from './sarvamChatService';
import { SarvamDocumentService } from './sarvamDocumentService';
import { SarvamSpeechService } from './sarvamSpeechService';
import { clearSarvamApiKeyOverride, setSarvamApiKeyOverride } from './sarvamConfig';

export class SarvamService {
  public static setApiKey(key: string) {
    if (key.trim()) {
      setSarvamApiKeyOverride(key);
    } else {
      clearSarvamApiKeyOverride();
    }
  }

  public static async speechToText(audioBlob: Blob, languageCode: LanguageCode): Promise<string> {
    console.log(
  "LANGUAGE:",
  languageCode,
  this.mapLanguageCode(languageCode)
);

    const response = await SarvamSpeechService.transcribe({
      file: audioBlob,
      language_code: this.mapLanguageCode(languageCode) as SarvamAI.SpeechToTextLanguage,
    });

    return response.transcript;
  }

  public static async textToSpeech(text: string, languageCode: LanguageCode): Promise<string> {
    const response = await SarvamSpeechService.textToSpeech({
      text,
      target_language_code: this.mapLanguageCode(languageCode) as SarvamAI.TextToSpeechLanguage,
      model: 'bulbul:v3',
      speaker: 'shubh',
      speech_sample_rate: 24000,
    });

    const audioBase64 = response.audios[0] || '';

    if (typeof window !== 'undefined' && audioBase64) {
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      await audio.play();
    }

    return audioBase64;
  }

  public static async extractMedicationFromText(text: string) {
    console.log("USING SarvamService.extractMedicationFromText");
  const prompt = `
Extract medication details from this transcript.

Return ONLY valid JSON.

{
  "name": "",
  "dosage": "",
  "frequency": "",
  "timing": [],
  "instructions": ""
}

Transcript:
${text}
`;
console.log("BEFORE API");
  const response = await SarvamChatService.completions({
    model: 'sarvam-30b',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `
'Extract medication details and return ONLY JSON. No explanation.',
`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });
  console.log("After API");

  console.log("FULL RESPONSE:");
console.log(response);
console.log(JSON.stringify(response, null, 2));
console.log("FINISH REASON:");
console.log((response as any)?.choices?.[0]?.finish_reason);

console.log("MESSAGE:");
console.log((response as any)?.choices?.[0]?.message);

const content =
  (response as any)?.choices?.[0]?.message?.content;

console.log("CONTENT:", content);

  console.log('SARVAM RAW:', content);

  try {
    const cleaned = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      name: parsed.name ?? '',
      dosage: parsed.dosage ?? '',
      frequency: parsed.frequency ?? 'Once Daily',
      timing: Array.isArray(parsed.timing)
        ? parsed.timing
        : ['morning'],
      startDate: new Date().toISOString().split('T')[0],
      instructions: parsed.instructions ?? '',
    };
  } catch (err) {
    console.error('Invalid JSON:', content);

    return {
      name: text,
      dosage: '1 Tablet',
      frequency: 'Once Daily',
      timing: ['morning'],
      startDate: new Date().toISOString().split('T')[0],
      instructions: '',
    };
  }
}

  public static parseMedicationFromVoice(text: string): Omit<any, 'id'> {
    const textLower = text.toLowerCase();

    let name = 'Paracetamol';
    let dosage = '1 Tablet';
    let timing: ('morning' | 'afternoon' | 'evening' | 'night')[] = ['morning'];
    let instructions = 'After meals';

    if (textLower.includes('aspirin') || textLower.includes('एस्पिरिन')) {
      name = 'Aspirin (75mg)';
      dosage = '1 Tablet';
      timing = ['morning'];
      instructions = 'After breakfast';
    } else if (textLower.includes('metformin') || textLower.includes('मेटफॉर्मिन')) {
      name = 'Metformin (500mg)';
      dosage = '1 Tablet';
      timing = ['morning', 'night'];
      instructions = 'With meals';
    } else if (textLower.includes('insulin') || textLower.includes('इंसुलिन')) {
      name = 'Insulin Glargine';
      dosage = '10 Units';
      timing = ['night'];
      instructions = 'Before sleeping';
    } else {
      const match = text.match(/(?:दवाई|दवा|medicine|tablet|capsule|सिरप)?\s*([a-zA-Z\u0900-\u097F]+)/);
      if (match && match[1]) {
        name = match[1];
      }
    }

    if (textLower.includes('दोपहर') || textLower.includes('noon') || textLower.includes('lunch')) {
      timing = ['afternoon'];
      instructions = 'After lunch';
    }
    if (textLower.includes('रात') || textLower.includes('night') || textLower.includes('dinner') || textLower.includes('शाम')) {
      if (textLower.includes('सुबह') || textLower.includes('morning')) {
        timing = ['morning', 'night'];
      } else {
        timing = ['night'];
      }
      instructions = 'After dinner';
    }

    return {
      name,
      dosage,
      frequency: timing.length === 1 ? 'Once Daily' : 'Twice Daily',
      timing,
      startDate: new Date().toISOString().split('T')[0],
      instructions,
    };
  }

  public static async extractTextFromBase64(base64Data: string): Promise<{ extractedText: string }> {
    const extractedText = await SarvamDocumentService.extractTextFromSource(base64Data);
    return { extractedText };
  }
  
  public static async chatWithDocument(extractedText: string, question: string, lang = 'en'): Promise<string> {
    return SarvamChatService.askWithContext({
      context: extractedText,
      question,
      languageCode: lang,
    });
  }

  /**
   * General-purpose health & medication chat (used by the Pulse Assistant).
   * Falls back to a clinically-cautious local response when the API call fails,
   * so the UI always renders a useful answer in demo mode.
   */
  public static async chatSaaras(question: string, languageCode: LanguageCode = 'hi'): Promise<string> {
    try {
      const reply = await SarvamChatService.askWithContext({
        context:
          'You are PULSE, a friendly multilingual caregiver assistant for elderly patients in India. ' +
          'Provide clear, simple, and clinically-cautious guidance on medication adherence, dosage timing, ' +
          'side effects, and general health questions. Always remind the user to consult their doctor ' +
          'for serious concerns.',
        question,
        languageCode: this.mapLanguageCode(languageCode),
      });
      if (reply && reply.trim()) return reply;
    } catch (err) {
      console.warn('chatSaaras: falling back to local response.', err);
    }

    // Local fallbacks per language
    const fallback: Record<LanguageCode, string> = {
      hi: 'मैं आपकी दवाइयों और स्वास्थ्य के बारे में मदद कर सकता हूँ। कृपया अधिक विशिष्ट प्रश्न पूछें या अपने डॉक्टर से सलाह लें।',
      ta: 'உங்கள் மருந்துகள் மற்றும் ஆரோக்கியம் குறித்து உதவ முடியும். மேலும் தெளிவான கேள்வி கேளுங்கள் அல்லது உங்கள் மருத்துவரை அணுகவும்.',
      gu: 'હું તમારી દવાઓ અને આરોગ્ય વિશે મદદ કરી શકું છું. કૃપા કરીને વધુ સ્પષ્ટ પ્રશ્ન પૂછો અથવા તમારા ડૉક્ટરનો સંપર્ક કરો.',
      mr: 'मी तुमच्या औषधांविषयी आणि आरोग्याविषयी मदत करू शकतो. कृपया अधिक स्पष्ट प्रश्न विचारा किंवा डॉक्टरांचा सल्ला घ्या.',
      te: 'మీ మందులు మరియు ఆరోగ్యం గురించి నేను సహాయం చేయగలను. దయచేసి స్పష్టమైన ప్రశ్న అడగండి లేదా మీ వైద్యుడిని సంప్రదించండి.',
      bn: 'আমি আপনার ওষুধ ও স্বাস্থ্য সম্পর্কে সাহায্য করতে পারি। আরও নির্দিষ্ট প্রশ্ন করুন বা আপনার ডাক্তারের সাথে পরামর্শ নিন।',
      kn: 'ನಿಮ್ಮ ಔಷಧಿ ಮತ್ತು ಆರೋಗ್ಯ ಕುರಿತು ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟ ಪ್ರಶ್ನೆ ಕೇಳಿ ಅಥವಾ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
      ml: 'നിങ്ങളുടെ മരുന്നുകളെയും ആരോഗ്യത്തെയും കുറിച്ച് സഹായിക്കാൻ കഴിയും. വ്യക്തമായ ചോദ്യം ചോദിക്കുക അല്ലെങ്കിൽ ഡോക്ടറെ കാണുക.',
      en: 'I can help with your medication and general health questions. Please ask a specific question, or consult your doctor for clinical advice.',
    };
    return fallback[languageCode] || fallback.en;
  }

  private static mapLanguageCode(code: LanguageCode): string {
    const map: Record<LanguageCode, string> = {
      hi: 'hi-IN',
      ta: 'ta-IN',
      gu: 'gu-IN',
      mr: 'mr-IN',
      te: 'te-IN',
      bn: 'bn-IN',
      kn: 'kn-IN',
      ml: 'ml-IN',
      en: 'en-IN',
    };

    return map[code] || 'hi-IN';
  }
}
