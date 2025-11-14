import React from 'react';

const SmartScanner = ({ 
  showCamera, 
  setShowCamera, 
  isScanning, 
  isListening, 
  setIsListening, 
  stream, 
  scanMedicine, 
  startVoiceInput, 
  recognition 
}) => {
  if (!showCamera) return null;

  return (
    <div className="modal-overlay animate-in" onClick={() => setShowCamera(false)}>
      <div className="camera-modal glass-card" onClick={e => e.stopPropagation()}>
        <div className="form-header">
          <h3>📷🎤 Smart Medicine Add</h3>
          <button type="button" className="close-btn" onClick={() => setShowCamera(false)}>×</button>
        </div>
        
        <div className="smart-add-tabs">
          <button 
            className={`tab-btn ${!isListening ? 'active' : ''}`}
            onClick={() => setIsListening(false)}
          >
            📷 Scan
          </button>
          <button 
            className={`tab-btn ${isListening ? 'active' : ''}`}
            onClick={() => setIsListening(false)}
          >
            🎤 Voice
          </button>
        </div>
        
        <div className="camera-container">
          <div className="camera-preview">
            <video 
              id="camera-video" 
              autoPlay 
              playsInline 
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '12px'
              }}
            />
            {isScanning && (
              <div className="scanning-overlay">
                <div className="scan-line"></div>
                <p>🔍 Analyzing medicine...</p>
                <div className="loading-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            {isListening && (
              <div className="listening-overlay">
                <div className="voice-animation">
                  <div className="voice-circle"></div>
                  <div className="voice-circle"></div>
                  <div className="voice-circle"></div>
                </div>
                <p>🎤 Listening for medicine...</p>
              </div>
            )}
          </div>
          
          <div className="scan-controls">
            <button 
              className="scan-action-btn"
              onClick={scanMedicine}
              disabled={isScanning || !stream}
            >
              {isScanning ? 'Scanning...' : '🔍 Scan Medicine'}
            </button>
            <button 
              className="voice-action-btn"
              onClick={startVoiceInput}
              disabled={isListening || !recognition}
            >
              {isListening ? '🎤 Listening...' : '🎤 Start Voice'}
            </button>
            <p className="scan-tip">📷 Point camera directly at medicine name (ensure good lighting) or 🎤 say "Add Paracetamol 500mg"</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartScanner;