import { useState, useEffect } from 'react';

export const useVoiceInput = () => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);

  const parseSpeechToMedicine = (transcript) => {
    console.log('Speech transcript:', transcript);
    const text = transcript.toLowerCase();
    
    const commonMedicines = [
      'paracetamol', 'acetaminophen', 'ibuprofen', 'aspirin', 'amoxicillin', 'metformin',
      'lisinopril', 'atorvastatin', 'omeprazole', 'levothyroxine', 'amlodipine', 'simvastatin',
      'losartan', 'gabapentin', 'sertraline', 'tramadol', 'albuterol', 'furosemide',
      'vitamin d', 'vitamin c', 'vitamin b', 'calcium', 'iron', 'magnesium', 'zinc', 'omega'
    ];
    
    let name = '';
    let dosage = '';
    
    for (const medicine of commonMedicines) {
      if (text.includes(medicine)) {
        name = medicine.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        break;
      }
    }
    
    const dosageMatch = text.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|microgram|milligram|gram|g|ml|milliliter|iu|international\s*unit|unit|tablet|capsule)/i);
    if (dosageMatch) {
      let unit = dosageMatch[2].toLowerCase();
      if (unit.includes('microgram')) unit = 'mcg';
      if (unit.includes('milligram')) unit = 'mg';
      if (unit.includes('milliliter')) unit = 'ml';
      if (unit.includes('international') || unit === 'iu') unit = 'IU';
      if (unit.includes('tablet') || unit.includes('capsule')) unit = 'tablet';
      
      dosage = dosageMatch[1] + unit;
    }
    
    if (!name) {
      const cleanText = text.replace(/\b(add|take|medicine|medication|tablet|capsule|pill|mg|mcg|gram|ml|iu|unit|\d+|once|twice|three|times|daily|morning|evening|night|am|pm|o'clock)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      const words = cleanText.split(' ').filter(word => word.length >= 3);
      
      const excludeWords = ['the', 'and', 'for', 'with', 'from', 'this', 'that', 'each'];
      const validWords = words.filter(word => !excludeWords.includes(word.toLowerCase()));
      
      if (validWords.length >= 1) {
        name = validWords.slice(0, 2).join(' ').split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      }
    }
    
    let frequency = '';
    if (text.includes('once')) frequency = 'Once daily';
    else if (text.includes('twice')) frequency = 'Twice daily';
    else if (text.includes('three times')) frequency = 'Three times daily';
    
    const timeMatch = text.match(/(\d{1,2})\s*(am|pm|o\'clock)/i);
    let time = '';
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const period = timeMatch[2].toLowerCase();
      const hour24 = period.includes('pm') && hour !== 12 ? hour + 12 : (period.includes('am') && hour === 12 ? 0 : hour);
      time = hour24.toString().padStart(2, '0') + ':00';
    }
    
    return {
      name,
      dosage: dosage || 'Not specified',
      frequency,
      time,
      color: '#3b82f6'
    };
  };

  const startVoiceInput = async (onSuccess, onError) => {
    if (!recognition) {
      onError('Voice recognition not available');
      return;
    }
    
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      onError('Microphone access required for voice input. Please allow microphone access and try again.');
      return;
    }
    
    if (!isListening) {
      setIsListening(true);
      try {
        recognition.start();
      } catch (error) {
        console.error('Speech recognition start error:', error);
        setIsListening(false);
        onError('Voice recognition not available. Please try manual input.');
      }
    }
  };

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Speech result:', transcript);
        const result = parseSpeechToMedicine(transcript);
        
        if (result.name) {
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`Detected ${result.name}${result.dosage ? ' ' + result.dosage : ''}. Please review and save.`);
            speechSynthesis.speak(utterance);
          }
        }
        
        setIsListening(false);
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access in your browser settings and try again.');
        }
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    }
  }, []);

  return {
    isListening,
    recognition,
    startVoiceInput,
    parseSpeechToMedicine
  };
};