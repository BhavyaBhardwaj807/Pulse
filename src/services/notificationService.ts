// Notification Service - Web Push and Multilingual TTS Audio Alarms
import type { LanguageCode } from '../context/SettingsContext';
import { SarvamService } from './sarvamService';

export class NotificationService {
  private static registeredReminders: Record<string, any> = {};

  // Request browser notification permissions
  public static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  // Schedule a dose alarm that triggers a popup notification AND plays a beautiful TTS alarm voice!
  public static scheduleDoseReminder(
    medId: string,
    medName: string,
    dosage: string,
    timeSlot: string,
    scheduledTimeStr: string, // "HH:MM" format
    lang: LanguageCode
  ) {
    const key = `${medId}_${timeSlot}`;
    
    // Clear existing timer if rescheduled
    if (this.registeredReminders[key]) {
      clearTimeout(this.registeredReminders[key]);
    }

    // Calculate time offset
    const now = new Date();
    const [hours, minutes] = scheduledTimeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // If target time is past today, schedule for tomorrow
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();

    // Schedule the timeout
    const timeout = setTimeout(() => {
      this.triggerDoseAlert(medName, dosage, timeSlot, lang);
      // Re-schedule for next day
      this.scheduleDoseReminder(medId, medName, dosage, timeSlot, scheduledTimeStr, lang);
    }, delay);

    this.registeredReminders[key] = timeout;
    console.log(`Scheduled reminder for ${medName} (${timeSlot}) in ${Math.round(delay/1000/60)} minutes.`);
  }

  // Play spoken vocal alarm AND show browser notification
  public static async triggerDoseAlert(
    medName: string,
    dosage: string,
    timeSlot: string,
    lang: LanguageCode
  ) {
    // 1. Compile spoken audio sentence in selected Indian language!
    const reminders: Record<LanguageCode, string> = {
      hi: `नमस्ते! आपकी ${timeSlot} की खुराक ${medName} लेने का समय हो गया है। कृपया अपनी ${dosage} दवाई अभी ले लें। धन्यवाद।`,
      ta: `வணக்கம்! உங்கள் ${timeSlot} மருந்து ${medName} சாப்பிட வேண்டிய நேரம் இது. தயவுசெய்து உங்கள் ${dosage} மருந்தை உடனே உட்கொள்ளுங்கள். நன்றி.`,
      gu: `નમસ્તે! તમારી ${timeSlot} ની દવા ${medName} લેવાનો સમય થઈ ગયો છે. કૃપા કરીને તમારી ${dosage} દવા લઈ લો. આભાર.`,
      mr: `नमस्कार! आपली ${timeSlot} ची औषध ${medName} घेण्याची वेळ झाली आहे. कृपया आपली ${dosage} औषध आता घ्या. धन्यवाद.`,
      te: `నమస్కారం! మీ ${timeSlot} మోతాదు ${medName} వేసుకునే సమయం అయింది. దయచేసి మీ ${dosage} మందును వేసుకోండి. ధన్యవాదాలు.`,
      bn: `নমস্কার! আপনার ${timeSlot} এর ওষুধ ${medName} নেওয়ার সময় হয়েছে। দয়া করে আপনার ${dosage} ওষুধ নিয়ে নিন। ধন্যবাদ।`,
      kn: `ನಮಸ್ಕಾರ! ನಿಮ್ಮ ${timeSlot} ಔಷಧಿ ${medName} ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯವಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ${dosage} ಔಷಧಿಯನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ. ಧನ್ಯವಾದಗಳು.`,
      ml: `നമസ്കാരം! നിങ്ങളുടെ ${timeSlot} മരുന്ന് ${medName} കഴിക്കാനുള്ള സമയമായി. ദയവായി നിങ്ങളുടെ ${dosage} മരുന്ന് കഴിക്കുക. നന്ദി.`,
      en: `Namaste! It is time to take your ${timeSlot} dose of ${medName}. Please take your ${dosage} medication now. Thank you.`
    };

    const text = reminders[lang] || reminders['hi'];

    // 2. Display System Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification("PULSE Medication Reminder", {
        body: `${medName} (${dosage}) - Scheduled for ${timeSlot}`,
        icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230B132B"/><text y=".9em" font-size="90">⚡</text></svg>',
        tag: 'pulse-dose-alert'
      });
    }

    // 3. Spoken alarm playback via Sarvam TTS / browser voice synthesizer
    try {
      await SarvamService.textToSpeech(text, lang);
    } catch (err) {
      console.warn("Speech Synthesis play fail:", err);
    }
  }

  // Clear all pending reminders
  public static clearAllReminders() {
    Object.values(this.registeredReminders).forEach(clearTimeout);
    this.registeredReminders = {};
  }

  // ============================================================
  // Appointment reminders (mirrors the dose-reminder pattern).
  // Fires 24 hours before the scheduled appointmentDate. Like dose
  // reminders this uses setTimeout, so it only fires while the tab
  // is alive — same trade-off as the existing medication alerts.
  // ============================================================

  private static appointmentKey(id: string): string {
    return `apt_${id}`;
  }

  public static scheduleAppointmentReminder(
    appointment: {
      id: string;
      doctorName: string;
      hospitalName?: string;
      appointmentDate: Date;
    },
    lang: LanguageCode
  ): void {
    const key = this.appointmentKey(appointment.id);

    // Clear any existing timer so re-scheduling is idempotent.
    if (this.registeredReminders[key]) {
      clearTimeout(this.registeredReminders[key]);
      delete this.registeredReminders[key];
    }

    const triggerAt = appointment.appointmentDate.getTime() - 24 * 60 * 60 * 1000;
    const delay = triggerAt - Date.now();
    if (delay <= 0) {
      // Already inside the 24h window — no future reminder to schedule.
      return;
    }
    // setTimeout's delay arg is a 32-bit signed int in browsers (~24.8
    // days). For longer-dated appointments we just skip — the user will
    // re-open the tab closer to the date and re-trigger scheduling.
    if (delay > 2_147_000_000) {
      console.log(
        `[NotificationService] appointment ${appointment.id} is >24 days away; deferring scheduling.`
      );
      return;
    }

    const timeout = setTimeout(() => {
      this.triggerAppointmentAlert(
        appointment.doctorName,
        appointment.hospitalName,
        appointment.appointmentDate,
        lang
      );
      delete this.registeredReminders[key];
    }, delay);

    this.registeredReminders[key] = timeout;
    console.log(
      `Scheduled appointment reminder for ${appointment.doctorName} in ${Math.round(delay / 1000 / 60)} minutes.`
    );
  }

  public static cancelAppointmentReminder(id: string): void {
    const key = this.appointmentKey(id);
    if (this.registeredReminders[key]) {
      clearTimeout(this.registeredReminders[key]);
      delete this.registeredReminders[key];
    }
  }

  public static cancelAllAppointmentReminders(): void {
    Object.keys(this.registeredReminders).forEach((key) => {
      if (key.startsWith('apt_')) {
        clearTimeout(this.registeredReminders[key]);
        delete this.registeredReminders[key];
      }
    });
  }

  public static async triggerAppointmentAlert(
    doctorName: string,
    hospitalName: string | undefined,
    appointmentDate: Date,
    lang: LanguageCode
  ): Promise<void> {
    const timeStr = appointmentDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const where = hospitalName ? ` ${hospitalName}` : '';

    const reminders: Record<LanguageCode, string> = {
      hi: `नमस्ते! कल ${timeStr} बजे डॉक्टर ${doctorName} के साथ${where ? ' ' + where + ' में' : ''} आपकी अपॉइंटमेंट है। कृपया तैयार रहें।`,
      ta: `வணக்கம்! நாளை ${timeStr} மணிக்கு டாக்டர் ${doctorName} உடன்${where ? ' ' + where + ' இல்' : ''} உங்கள் சந்திப்பு உள்ளது.`,
      gu: `નમસ્તે! આવતી કાલે ${timeStr} વાગ્યે ડૉક્ટર ${doctorName} સાથે${where ? ' ' + where + ' માં' : ''} તમારી અપોઈન્ટમેન્ટ છે.`,
      mr: `नमस्कार! उद्या ${timeStr} वाजता डॉक्टर ${doctorName} सोबत${where ? ' ' + where + ' मध्ये' : ''} आपली अपॉइंटमेंट आहे.`,
      te: `నమస్కారం! రేపు ${timeStr} గంటలకు డాక్టర్ ${doctorName} తో${where ? ' ' + where + ' లో' : ''} మీ అపాయింట్‌మెంట్ ఉంది.`,
      bn: `নমস্কার! আগামীকাল ${timeStr}-এ ডাক্তার ${doctorName}-এর সাথে${where ? ' ' + where + '-এ' : ''} আপনার অ্যাপয়েন্টমেন্ট রয়েছে।`,
      kn: `ನಮಸ್ಕಾರ! ನಾಳೆ ${timeStr} ಗಂಟೆಗೆ ಡಾಕ್ಟರ್ ${doctorName} ಅವರೊಂದಿಗೆ${where ? ' ' + where + ' ನಲ್ಲಿ' : ''} ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಇದೆ.`,
      ml: `നമസ്കാരം! നാളെ ${timeStr}-ന് ഡോക്ടർ ${doctorName}-മായി${where ? ' ' + where + '-ൽ' : ''} നിങ്ങളുടെ അപ്പോയിന്റ്മെന്റ് ഉണ്ട്.`,
      en: `Hello! Tomorrow at ${timeStr} you have an appointment with Dr. ${doctorName}${where ? ' at' + where : ''}. Please be ready.`,
    };

    const text = reminders[lang] || reminders['en'];

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('PULSE Appointment Reminder', {
          body: `Dr. ${doctorName}${hospitalName ? ' • ' + hospitalName : ''} — ${appointmentDate.toLocaleString()}`,
          icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230B132B"/><text y=".9em" font-size="90">⚡</text></svg>',
          tag: 'pulse-appointment-alert',
        });
      } catch (err) {
        console.warn('Appointment notification failed', err);
      }
    }

    try {
      await SarvamService.textToSpeech(text, lang);
    } catch (err) {
      console.warn('Appointment TTS playback failed', err);
    }
  }
}
