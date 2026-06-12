import React, { useState, useEffect, useRef } from 'react';
import { useMedication } from '../context/MedicationContext';
import { useSettings } from '../context/SettingsContext';
import { SarvamService } from '../services/sarvamService';
import {
  Send,
  User as UserIcon,
  Bot,
  Volume2,
  Mic,
  Square,
  FileText as FileIcon,
  Sparkles,
  Heart,
  Flame,
} from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

type Mode = 'general' | 'document';

const formatTime = (d: Date) => {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const Assistant: React.FC = () => {
  const { medications, documents, streak, adherenceRate } = useMedication();
  const { language, t } = useSettings();

  const [mode, setMode] = useState<Mode>('general');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Welcome message resets when language changes
  useEffect(() => {
    setMessages([
      { sender: 'bot', text: t.botWelcome, timestamp: new Date() },
    ]);
  }, [language]);

  // Default selection when documents arrive
  useEffect(() => {
    if (!selectedDocId && documents.length > 0) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  // Smooth scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // External voice from layout's mic
  useEffect(() => {
    const handler = async (e: Event) => {
      const text = (e as CustomEvent).detail;
      if (text) handleSendMessage(text);
    };
    window.addEventListener('pulse_voice_chat', handler);
    return () => window.removeEventListener('pulse_voice_chat', handler);
  }, [language, mode, selectedDocId, documents]);

  const selectedDoc = documents.find(d => d.id === selectedDocId) || null;

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    setMessages(prev => [...prev, { sender: 'user', text: textToSend, timestamp: new Date() }]);
    setInput('');
    setIsTyping(true);

    try {
      let reply = '';
      if (mode === 'document' && selectedDoc) {
        const docText = selectedDoc.extractedText || '';
        if (!docText.trim()) {
          reply =
            language === 'hi'
              ? 'इस दस्तावेज़ का टेक्स्ट अभी प्रोसेस नहीं हुआ है।'
              : 'This document has not been processed yet — try a PDF prescription.';
        } else {
          reply = await SarvamService.chatWithDocument(docText, textToSend, language);
        }
      } else {
        reply = await SarvamService.chatSaaras(textToSend, language);
      }

      setMessages(prev => [...prev, { sender: 'bot', text: reply, timestamp: new Date() }]);

      if (reply && reply.trim()) {
        await SarvamService.textToSpeech(reply, language);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text:
            language === 'hi'
              ? 'क्षमा करें, उत्तर लाने में समस्या हुई।'
              : 'Sorry, I had trouble getting a response.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSpeakAloud = async (text: string) => {
    await SarvamService.textToSpeech(text, language);
  };

  const handleVoiceInput = async () => {
    try {
      if (!recording) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (event) => chunks.push(event.data);
        recorder.onstop = async () => {
          try {
            const audioBlob = new Blob(chunks, { type: 'audio/webm' });
            const transcript = await SarvamService.speechToText(audioBlob, language);
            if (transcript) {
              setInput(transcript);
              await handleSendMessage(transcript);
            }
          } catch (err) {
            console.error('STT failed:', err);
          }
          stream.getTracks().forEach(t => t.stop());
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
        setRecording(true);
      } else {
        mediaRecorderRef.current?.stop();
        setRecording(false);
      }
    } catch (err) {
      console.error('Mic error:', err);
    }
  };

  // Localised suggestion chips
  const generalChips: Record<string, string[]> = {
    hi: [
      'मेटफॉर्मिन खाली पेट ले सकते हैं?',
      'एस्पिरिन किस समय लेनी चाहिए?',
      'दवाई छूटने पर क्या करें?',
      'दवाइयों के साइड इफेक्ट्स क्या हैं?',
    ],
    ta: [
      'மெட்ஃபார்மின் வெறும் வயிற்றில் சாப்பிடலாமா?',
      'ஆஸ்பிரின் எப்போது உட்கொள்ள வேண்டும்?',
      'மருந்து தவறினால் என்ன செய்வது?',
      'பக்க விளைவுகள் என்னென்ன?',
    ],
    en: [
      'Can I take Metformin on empty stomach?',
      'When is the best time to take Aspirin?',
      'What should I do if I miss a dose?',
      'What are common medicine side effects?',
    ],
  };

  const documentChips: Record<string, string[]> = {
    hi: [
      'इस रिपोर्ट में मुख्य निष्कर्ष क्या हैं?',
      'क्या कोई असामान्य मान है?',
      'इन दवाइयों का उद्देश्य क्या है?',
      'मुझे आगे क्या करना चाहिए?',
    ],
    en: [
      'Summarise the key findings of this report.',
      'Are any values out of normal range?',
      'What are these prescribed medicines for?',
      'What follow-up steps should I take?',
    ],
  };

  const chips =
    mode === 'document'
      ? documentChips[language] || documentChips.en
      : generalChips[language] || generalChips.en;

  return (
    <div className="space-y-5 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles size={20} className="text-accent" />
            <span>Pulse Assistant</span>
          </h2>
          <p className="text-sm text-navy-700 mt-0.5">
            {language === 'hi'
              ? 'दवाइयों, स्वास्थ्य या किसी अपलोड किए गए दस्तावेज़ के बारे में पूछें'
              : 'Ask about your medicines, health, or any uploaded document'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="inline-flex p-1 bg-navy-900 border border-navy-800 rounded-card self-start sm:self-auto">
          <button
            onClick={() => setMode('general')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md tactile-btn ${
              mode === 'general' ? 'bg-accent text-white' : 'text-navy-100 hover:text-white'
            }`}
          >
            <Heart size={12} className="inline mr-1" />
            {language === 'hi' ? 'सामान्य' : 'General'}
          </button>
          <button
            onClick={() => setMode('document')}
            disabled={documents.length === 0}
            className={`px-3 py-1.5 text-xs font-bold rounded-md tactile-btn disabled:opacity-40 disabled:cursor-not-allowed ${
              mode === 'document' ? 'bg-accent text-white' : 'text-navy-100 hover:text-white'
            }`}
          >
            <FileIcon size={12} className="inline mr-1" />
            {language === 'hi' ? 'दस्तावेज़' : 'Document'}
          </button>
        </div>
      </div>

      {/* Body grid: chat (main) + summary side card on xl */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* ======= CHAT PANEL ======= */}
        <div className="xl:col-span-3">
          <div className="card-navy flex flex-col h-[70vh] xl:h-[78vh] overflow-hidden p-0">
            {/* Top selector / status */}
            <div className="p-4 border-b border-navy-800 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center text-white shrink-0">
                  <Bot size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Pulse Assistant</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-success font-bold">
                      <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>
                      Online
                    </span>
                  </div>
                  <span className="text-[11px] text-navy-700">
                    {mode === 'document'
                      ? language === 'hi'
                        ? 'दस्तावेज़ के साथ चैट कर रहे हैं'
                        : 'Chatting with selected document'
                      : language === 'hi'
                      ? 'सामान्य स्वास्थ्य सहायक'
                      : 'General health assistant'}
                  </span>
                </div>
              </div>

              {mode === 'document' && (
                <select
                  value={selectedDocId || ''}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="bg-navy-950 border border-navy-800 rounded-card py-2 px-3 text-sm text-white outline-none focus:border-accent cursor-pointer min-w-0 sm:min-w-[240px] w-full sm:w-auto"
                >
                  {documents.length === 0 ? (
                    <option value="">No documents uploaded</option>
                  ) : (
                    documents.map(d => (
                      <option key={d.id} value={d.id}>
                        📄 {d.name}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-4">
              {messages.map((msg, idx) => {
                const isBot = msg.sender === 'bot';
                return (
                  <div
                    key={idx}
                    className={`flex items-end gap-2.5 ${
                      isBot ? '' : 'flex-row-reverse'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
                        isBot
                          ? 'bg-accent/10 border-accent/30 text-accent'
                          : 'bg-navy-850 border-navy-800 text-white'
                      }`}
                    >
                      {isBot ? <Bot size={14} /> : <UserIcon size={14} />}
                    </div>

                    <div
                      className={`max-w-[80%] sm:max-w-[70%] ${
                        isBot ? '' : 'items-end text-right'
                      } flex flex-col gap-1`}
                    >
                      <div
                        className={`rounded-card px-4 py-3 text-sm leading-relaxed shadow-md whitespace-pre-wrap ${
                          isBot
                            ? 'bg-navy-950 text-white border border-navy-800 rounded-bl-sm'
                            : 'bg-accent text-white border border-accent-dark rounded-br-sm'
                        }`}
                      >
                        {msg.text}
                      </div>

                      <div
                        className={`flex items-center gap-2 text-[10px] text-navy-700 font-semibold ${
                          isBot ? '' : 'flex-row-reverse'
                        }`}
                      >
                        <span>{formatTime(msg.timestamp)}</span>
                        {isBot && idx > 0 && (
                          <button
                            onClick={() => handleSpeakAloud(msg.text)}
                            className="inline-flex items-center gap-1 hover:text-navy-100 tactile-btn"
                          >
                            <Volume2 size={11} />
                            <span>{language === 'hi' ? 'सुनें' : 'Speak'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex items-end gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/30 text-accent flex items-center justify-center animate-pulse shrink-0">
                    <Bot size={14} />
                  </div>
                  <div className="bg-navy-950 text-navy-700 rounded-card px-4 py-3 border border-navy-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-navy-700 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-navy-700 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1.5 h-1.5 bg-navy-700 rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggestion chips */}
            {messages.length <= 1 && (
              <div className="px-4 pt-3">
                <div className="text-[10px] uppercase font-bold text-navy-700 tracking-widest mb-2">
                  {language === 'hi' ? 'सुझाए गए सवाल' : 'Suggested Questions'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(chip)}
                      className="bg-navy-950 border border-navy-800 hover:border-accent/40 hover:bg-accent/5 rounded-full px-3 py-1.5 text-xs text-navy-100 hover:text-white font-medium tactile-btn"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(input);
              }}
              className="p-4 border-t border-navy-800 mt-3 flex items-end gap-2"
            >
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`shrink-0 w-12 h-12 rounded-card border flex items-center justify-center text-white tactile-btn ${
                  recording
                    ? 'bg-rose-500 border-rose-500 animate-pulse'
                    : 'bg-navy-850 border-navy-800 hover:bg-navy-800'
                }`}
                aria-label="Voice input"
              >
                {recording ? <Square size={16} fill="white" /> : <Mic size={18} />}
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(input);
                  }
                }}
                rows={1}
                placeholder={
                  mode === 'document'
                    ? language === 'hi'
                      ? 'इस रिपोर्ट के बारे में पूछें…'
                      : 'Ask about this report…'
                    : t.chatPlaceholder
                }
                className="flex-1 bg-navy-950 border border-navy-800 rounded-card py-3 px-4 text-sm text-white outline-none focus:border-accent resize-none max-h-32 thin-scroll"
              />

              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="shrink-0 w-12 h-12 rounded-card bg-accent hover:bg-accent-dark border border-accent text-white tactile-btn shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>

        {/* ======= SIDE SUMMARY (xl only) ======= */}
        <aside className="hidden xl:flex flex-col gap-4">
          <div className="card-navy">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={16} className="text-rose-500 fill-rose-500" />
              <h3 className="text-xs font-bold text-navy-100 uppercase tracking-widest">
                Health Summary
              </h3>
            </div>

            <div className="space-y-3">
              <div className="bg-navy-950 border border-navy-800 rounded-card p-3">
                <div className="text-2xl font-extrabold text-accent">{adherenceRate}%</div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-navy-700 mt-1">
                  {t.adherenceRate}
                </div>
              </div>
              <div className="bg-navy-950 border border-navy-800 rounded-card p-3">
                <div className="text-2xl font-extrabold text-orange-500 flex items-center gap-1.5">
                  <Flame size={20} fill="#F97316" stroke="none" />
                  <span>{streak}</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-navy-700 mt-1">
                  {t.streakText}
                </div>
              </div>
              <div className="bg-navy-950 border border-navy-800 rounded-card p-3">
                <div className="text-2xl font-extrabold text-white">{medications.length}</div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-navy-700 mt-1">
                  Active Medicines
                </div>
              </div>
            </div>
          </div>

          {documents.length > 0 && (
            <div className="card-navy">
              <h3 className="text-xs font-bold text-navy-100 uppercase tracking-widest mb-3">
                Recent Documents
              </h3>
              <div className="space-y-2">
                {documents.slice(0, 4).map(d => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setMode('document');
                      setSelectedDocId(d.id);
                    }}
                    className={`w-full flex items-center gap-2 p-2 rounded-card border text-left transition-all tactile-btn ${
                      selectedDocId === d.id && mode === 'document'
                        ? 'border-accent/40 bg-accent/5'
                        : 'border-navy-800 bg-navy-950 hover:border-navy-750'
                    }`}
                  >
                    <FileIcon size={14} className="text-accent shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{d.name}</div>
                      <div className="text-[10px] text-navy-700 truncate">{d.doctor}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Assistant;
