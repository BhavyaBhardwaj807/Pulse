import { useState, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import EnhancedScanner from '../EnhancedScanner';

export const useScanner = () => {
  const [stream, setStream] = useState(null);
  const [tesseract, setTesseract] = useState(null);
  const [enhancedScanner, setEnhancedScanner] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const loadLibraries = async () => {
    try {
      const scanner = new EnhancedScanner();
      await scanner.initialize();
      setEnhancedScanner(scanner);
      console.log('Enhanced scanner loaded successfully');
      
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      setTesseract(worker);
      console.log('OCR loaded successfully');
    } catch (err) {
      console.error('Scanner failed to load:', err);
      setTesseract('failed');
    }
  };

  const startCamera = async () => {
    try {
      // Stop any existing stream first
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      // Wait for video element to be available
      setTimeout(() => {
        const video = document.getElementById('camera-video');
        if (video && mediaStream) {
          video.srcObject = mediaStream;
          video.play().catch(e => console.log('Video play failed:', e));
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      setStream(null);
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('Camera access required for medicine scanning.');
        speechSynthesis.speak(utterance);
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      setStream(null);
    }
    
    // Clear video element
    const video = document.getElementById('camera-video');
    if (video) {
      video.srcObject = null;
    }
  };

  const extractMedicineInfo = (text) => {
    console.log('Fallback extracting from:', text);
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 2);
    let detectedName = '';
    let detectedDosage = '';
    
    const dosageRegex = /(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|tablets?)/i;
    for (const line of lines) {
      const match = line.match(dosageRegex);
      if (match) {
        detectedDosage = match[1] + match[2].toLowerCase();
        break;
      }
    }
    
    const excludeWords = ['tablet', 'capsule', 'syrup', 'mg', 'mcg', 'use', 'take', 'daily'];
    
    for (const line of lines) {
      const cleanLine = line.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const words = cleanLine.split(' ').filter(w => w.length >= 2);
      const validWords = words.filter(w => !excludeWords.includes(w.toLowerCase()));
      
      if (validWords.length >= 1) {
        const candidateName = validWords.slice(0, 3).join(' ');
        if (candidateName.length > detectedName.length) {
          detectedName = candidateName.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
        }
      }
    }
    
    return { name: detectedName, dosage: detectedDosage };
  };

  const scanMedicine = async (onSuccess, onError) => {
    setIsScanning(true);
    
    try {
      const video = document.getElementById('camera-video');
      if (!video) {
        throw new Error('Camera not ready');
      }
      
      let result = { name: '', dosage: '' };
      
      if (enhancedScanner) {
        try {
          result = await enhancedScanner.scanText(video);
          console.log('Enhanced scanner result:', result);
        } catch (error) {
          console.log('Enhanced scanner failed, falling back to Tesseract:', error);
        }
      }
      
      if ((!result.name || result.name.length < 3) && tesseract && tesseract !== 'failed') {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 640;
        canvas.height = 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const { data: { text, confidence } } = await tesseract.recognize(canvas);
        console.log('Tesseract result:', { text, confidence });
        
        if (text && text.trim().length >= 3) {
          result = extractMedicineInfo(text);
        }
      }
      
      if (result.name && result.name.length >= 3) {
        setIsScanning(false);
        onSuccess(result);
        
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(`Medicine detected: ${result.name}${result.dosage ? ' ' + result.dosage : ''}. Please verify the details.`);
          speechSynthesis.speak(utterance);
        }
      } else {
        setIsScanning(false);
        onError('Could not detect medicine name. Please ensure the text is clear and well-lit.');
      }
    } catch (error) {
      console.error('Scanning error:', error);
      setIsScanning(false);
      onError(`Scanning failed: ${error.message}. Please try again or enter manually.`);
    }
  };

  useEffect(() => {
    loadLibraries();
  }, []);

  return {
    stream,
    isScanning,
    startCamera,
    stopCamera,
    scanMedicine,
    extractMedicineInfo
  };
};