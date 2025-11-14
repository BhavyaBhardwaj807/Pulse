import React from 'react';
import AgoraUIKit from 'agora-react-uikit';

const AgoraVoice = ({ 
  showAgoraVoice, 
  setShowAgoraVoice, 
  agoraRtcProps, 
  agoraCallbacks 
}) => {
  if (!showAgoraVoice) return null;

  return (
    <div className="modal-overlay animate-in" onClick={() => setShowAgoraVoice(false)}>
      <div className="agora-modal glass-card" onClick={e => e.stopPropagation()}>
        <div className="form-header">
          <h3>🎤 Agora Voice Input</h3>
          <button type="button" className="close-btn" onClick={() => setShowAgoraVoice(false)}>×</button>
        </div>
        
        <div className="agora-container">
          <AgoraUIKit 
            rtcProps={agoraRtcProps} 
            callbacks={agoraCallbacks}
            styleProps={{
              localBtnContainer: { backgroundColor: 'rgba(59, 130, 246, 0.1)' },
              maxViewStyles: { height: '200px' }
            }}
          />
          <p className="agora-tip">🎤 Speak clearly: "Add [medicine name] [dosage]"</p>
        </div>
      </div>
    </div>
  );
};

export default AgoraVoice;