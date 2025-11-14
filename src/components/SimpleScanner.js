import React, { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';

const SimpleScanner = ({ showCamera, setShowCamera, onScanResult }) => {
  const [stream, setStream] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [ocrWorker, setOcrWorker] = useState(null);
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (showCamera) {
      startCamera();
      initOCR();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
      if (ocrWorker) {
        ocrWorker.terminate();
      }
    };
  }, [showCamera]);

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleVoiceResult(transcript);
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
        alert('Voice recognition failed. Please try again.');
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      alert('Camera access denied. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const initOCR = async () => {
    try {
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      setOcrWorker(worker);
    } catch (error) {
      console.error('OCR initialization failed:', error);
    }
  };

  const handleScan = async () => {
    if (!ocrWorker || !videoRef.current) {
      alert('Scanner not ready. Please try again.');
      return;
    }

    setIsScanning(true);
    
    try {
      // Capture frame from video
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      
      // Perform OCR
      const { data: { text } } = await ocrWorker.recognize(canvas);
      
      if (text && text.trim().length > 2) {
        const result = extractMedicineInfo(text);
        if (result.name) {
          onScanResult(result);
          setShowCamera(false);
        } else {
          fallbackToManual('Could not detect medicine name from image.');
        }
      } else {
        fallbackToManual('No text detected. Please ensure good lighting and clear text.');
      }
    } catch (error) {
      console.error('Scanning error:', error);
      fallbackToManual('Scanning failed. Please try again.');
    }
    
    setIsScanning(false);
  };

  const extractMedicineInfo = (text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 2);
    let bestName = '';
    let dosage = '';
    
    // Extract dosage first
    const dosageRegex = /(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|tablets?)/i;
    for (const line of lines) {
      const match = line.match(dosageRegex);
      if (match) {
        dosage = match[1] + match[2].toLowerCase();
        break;
      }
    }
    
    // Common medicine patterns and exclude words
    const excludeWords = [
      'tablet', 'capsule', 'syrup', 'mg', 'mcg', 'use', 'take', 'daily', 'exp', 'mfg',
      'batch', 'lot', 'date', 'pack', 'strip', 'bottle', 'box', 'label', 'pharma',
      'ltd', 'inc', 'corp', 'company', 'manufacturing', 'manufactured', 'by'
    ];
    
    const commonMedicines = [
      'paracetamol', 'acetaminophen', 'ibuprofen', 'aspirin', 'amoxicillin', 'metformin',
      'lisinopril', 'atorvastatin', 'omeprazole', 'levothyroxine', 'amlodipine', 'simvastatin',
      'losartan', 'gabapentin', 'sertraline', 'tramadol', 'albuterol', 'furosemide',
      'vitamin d', 'vitamin c', 'vitamin b', 'calcium carbonate', 'iron sulfate', 'folic acid'
    ];
    
    // First, look for known medicine names
    const fullText = text.toLowerCase();
    for (const medicine of commonMedicines) {
      if (fullText.includes(medicine)) {
        bestName = medicine.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        break;
      }
    }
    
    // If no known medicine found, extract from lines
    if (!bestName) {
      let candidates = [];
      
      for (const line of lines) {
        // Clean the line but preserve spaces
        const cleanLine = line.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const words = cleanLine.split(' ').filter(w => w.length >= 3);
        const validWords = words.filter(w => !excludeWords.includes(w.toLowerCase()));
        
        if (validWords.length >= 1) {
          // Try different combinations of words
          for (let i = 0; i < validWords.length; i++) {
            // Single word
            candidates.push(validWords[i]);
            
            // Two words
            if (i < validWords.length - 1) {
              candidates.push(validWords[i] + ' ' + validWords[i + 1]);
            }
            
            // Three words
            if (i < validWords.length - 2) {
              candidates.push(validWords[i] + ' ' + validWords[i + 1] + ' ' + validWords[i + 2]);
            }
          }
        }
      }
      
      // Score candidates by length and position (prefer longer, earlier names)
      candidates = candidates.filter(c => c.length >= 4);
      if (candidates.length > 0) {
        // Sort by length (longer first) then by alphabetical order
        candidates.sort((a, b) => b.length - a.length || a.localeCompare(b));
        bestName = candidates[0];
      }
    }
    
    // Format the name properly
    if (bestName) {
      bestName = bestName.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    }
    
    return { name: bestName, dosage: dosage || 'Not specified' };
  };

  const fallbackToManual = (message) => {
    const name = prompt(`${message}\n\nEnter medicine name manually:`);
    if (name && name.trim()) {
      const dosage = prompt('Enter dosage (e.g., 500mg, 2 tablets):') || 'Not specified';
      onScanResult({ 
        name: name.trim().split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' '), 
        dosage 
      });
      setShowCamera(false);
    }
  };

  const handleVoice = () => {
    if (!recognitionRef.current) {
      alert('Voice recognition not supported');
      return;
    }
    setIsListening(true);
    recognitionRef.current.start();
  };

  const handleVoiceResult = (transcript) => {
    const text = transcript.toLowerCase();
    let name = '';
    let dosage = '';

    // Simple parsing
    const words = text.split(' ');
    const medicineWords = words.filter(word => 
      !['add', 'take', 'medicine', 'mg', 'tablet', 'daily'].includes(word)
    );
    
    if (medicineWords.length > 0) {
      name = medicineWords[0].charAt(0).toUpperCase() + medicineWords[0].slice(1);
    }

    const dosageMatch = text.match(/(\d+)\s*(mg|tablet|ml)/);
    if (dosageMatch) {
      dosage = dosageMatch[1] + dosageMatch[2];
    }

    if (name) {
      onScanResult({ name, dosage: dosage || 'Not specified' });
      setShowCamera(false);
    } else {
      alert('Could not understand. Please try again.');
    }
  };

  if (!showCamera) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowCamera(false)}>
      <div className="camera-modal glass-card" onClick={e => e.stopPropagation()}>
        <div className="form-header">
          <h3>📷🎤 Smart Medicine Add</h3>
          <button type="button" className="close-btn" onClick={() => setShowCamera(false)}>×</button>
        </div>
        
        <div className="camera-container">
          <div className="camera-preview">
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted
              style={{
                width: '100%',
                height: '300px',
                objectFit: 'cover',
                borderRadius: '12px',
                backgroundColor: '#000'
              }}
            />
            {isScanning && (
              <div className="scanning-overlay">
                <p>🔍 Scanning...</p>
              </div>
            )}
            {isListening && (
              <div className="listening-overlay">
                <p>🎤 Listening...</p>
              </div>
            )}
          </div>
          
          <div className="scan-controls">
            <button 
              className="scan-action-btn"
              onClick={handleScan}
              disabled={isScanning || !stream || !ocrWorker}
            >
              {isScanning ? 'Scanning...' : !ocrWorker ? 'Loading OCR...' : '🔍 Scan Medicine'}
            </button>
            <button 
              className="voice-action-btn"
              onClick={handleVoice}
              disabled={isListening}
            >
              {isListening ? '🎤 Listening...' : '🎤 Start Voice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleScanner;