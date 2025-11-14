import React from 'react';

const MedicationGrid = ({ 
  medications, 
  setShowAddForm, 
  toggleTaken, 
  deleteMedication 
}) => {
  return (
    <div className="medications-grid">
      {medications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-animation">
            <div className="floating-pills">
              <div className="pill">💊</div>
              <div className="pill">💉</div>
              <div className="pill">🩺</div>
            </div>
          </div>
          <h3>Ready to start your health journey?</h3>
          <p>Add your first medication and let Pulse keep you on track</p>
          <button className="cta-btn" onClick={() => setShowAddForm(true)}>
            Get Started
          </button>
        </div>
      ) : (
        medications.map((med, index) => (
          <div 
            key={med.id} 
            className={`med-card ${med.taken ? 'taken' : ''} animate-card`}
            style={{ 
              animationDelay: `${index * 0.1}s`,
              borderLeftColor: med.color || '#3b82f6'
            }}
          >
            <div className="med-header">
              <div className="med-title">
                <div className="med-icon" style={{ backgroundColor: med.color || '#3b82f6' }}>💊</div>
                <h3>{med.name}</h3>
              </div>
              <div className="med-actions">
                <button 
                  className="action-btn edit-btn"
                  title="Edit"
                >
                  ✏️
                </button>
                <button 
                  className="action-btn delete-btn"
                  onClick={() => deleteMedication(med.id)}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
            
            <div className="med-details">
              <div className="detail-item">
                <span className="detail-icon">📏</span>
                <span className="detail-text">{med.dosage}</span>
              </div>
              {med.frequency && (
                <div className="detail-item">
                  <span className="detail-icon">🔄</span>
                  <span className="detail-text">{med.frequency}</span>
                </div>
              )}
              {med.time && (
                <div className="detail-item">
                  <span className="detail-icon">⏰</span>
                  <span className="detail-text">{med.time}</span>
                </div>
              )}
            </div>
            
            <button 
              className={`take-btn ${med.taken ? 'taken' : ''}`}
              onClick={() => toggleTaken(med.id)}
            >
              <span className="btn-icon">{med.taken ? '✅' : '⭕'}</span>
              <span className="btn-text">{med.taken ? 'Completed' : 'Take Now'}</span>
              {med.taken && (
                <div className="success-animation">
                  <div className="checkmark">✓</div>
                </div>
              )}
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default MedicationGrid;