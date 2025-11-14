import React from 'react';

const AdherenceReport = ({ 
  showReport, 
  setShowReport, 
  adherenceHistory, 
  medications, 
  medicationStats, 
  medicalHistory,
  additionalDetails,
  setAdditionalDetails,
  showAdditionalDetails,
  setShowAdditionalDetails
}) => {
  if (!showReport) return null;

  return (
    <div className="modal-overlay animate-in" onClick={() => setShowReport(false)}>
      <div className="report-modal glass-card" onClick={e => e.stopPropagation()}>
        <div className="form-header">
          <h3>📊 Detailed Adherence Report</h3>
          <button type="button" className="close-btn" onClick={() => setShowReport(false)}>×</button>
        </div>
        
        <div className="report-stats">
          <div className="report-stat">
            <div className="stat-number">{Math.round(adherenceHistory.reduce((acc, day) => acc + day.percentage, 0) / adherenceHistory.length)}%</div>
            <div className="stat-label">Overall Adherence</div>
          </div>
          <div className="report-stat">
            <div className="stat-number">{adherenceHistory.reduce((acc, day) => acc + day.taken, 0)}/{adherenceHistory.reduce((acc, day) => acc + day.total, 0)}</div>
            <div className="stat-label">Doses Taken</div>
          </div>
          <div className="report-stat">
            <div className="stat-number">{adherenceHistory.reduce((acc, day) => acc + day.total - day.taken, 0)}</div>
            <div className="stat-label">Missed Doses</div>
          </div>
        </div>
        
        <div className="medication-breakdown">
          <h4>📋 Medication Breakdown</h4>
          <div className="med-list">
            {medications.map(med => {
              const stats = medicationStats[med.id] || { expectedWeekly: 7, actualTaken: 5, adherenceRate: 71 };
              const missedDoses = stats.expectedWeekly - stats.actualTaken;
              
              return (
                <div key={med.id} className="med-breakdown">
                  <div className="med-info">
                    <div className="med-name-dose">
                      <span className="med-name">{med.name}</span>
                      <span className="med-dose">{med.dosage}</span>
                    </div>
                    <div className="med-schedule">{med.frequency} at {med.time}</div>
                  </div>
                  <div className="med-stats">
                    <div className="stat-item">
                      <span className="stat-label">Expected:</span>
                      <span className="stat-value">{stats.expectedWeekly} doses</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Taken:</span>
                      <span className="stat-value">{stats.actualTaken} doses</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Missed:</span>
                      <span className="stat-value missed">{missedDoses} doses</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Adherence:</span>
                      <span className={`stat-value ${stats.adherenceRate >= 80 ? 'good' : stats.adherenceRate >= 60 ? 'fair' : 'poor'}`}>{stats.adherenceRate}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="adherence-chart">
          <h4>📈 Daily Adherence Trend</h4>
          <div className="chart-bars">
            {adherenceHistory.map((day, i) => (
              <div key={i} className="chart-day">
                <div 
                  className="chart-bar" 
                  style={{
                    height: `${Math.max(day.percentage * 1.5, 15)}px`,
                    '--height': `${Math.max(day.percentage * 1.5, 15)}px`
                  }}
                ></div>
                <div className="chart-label">{new Date(day.date).toLocaleDateString('en', {weekday: 'short'})}</div>
                <div className="chart-value">{day.taken}/{day.total}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="insights">
          <h4>💡 Insights & Recommendations</h4>
          <div className="insight-list">
            <div className="insight-item">
              <span className="insight-icon">⏰</span>
              <span>Most missed doses occur in the evening (8-10 PM)</span>
            </div>
            <div className="insight-item">
              <span className="insight-icon">📱</span>
              <span>Consider setting phone reminders for better adherence</span>
            </div>
            <div className="insight-item">
              <span className="insight-icon">🎯</span>
              <span>Your adherence improved by 15% this week - keep it up!</span>
            </div>
          </div>
        </div>
        
        <div className="medical-history-section">
          <h4>🏥 Medical History</h4>
          <div className="patient-info">
            <div className="patient-header">
              <span className="patient-name">{medicalHistory.patientName}</span>
              <span className="patient-dob">DOB: {new Date(medicalHistory.dateOfBirth).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="conditions-list">
            {medicalHistory.medicalHistory.map((condition, index) => (
              <div key={index} className="condition-card">
                <div className="condition-header">
                  <div className="condition-title">
                    <span className="condition-name">{condition.condition}</span>
                    <span className={`condition-status ${condition.status.toLowerCase()}`}>{condition.status}</span>
                  </div>
                  <div className="condition-meta">
                    <span className="diagnosis-info">Diagnosed at age {condition.diagnosedAt} ({new Date(condition.diagnosisDate).getFullYear()})</span>
                    <span className={`severity ${condition.severity.toLowerCase()}`}>{condition.severity}</span>
                  </div>
                </div>
                
                <div className="condition-details">
                  <div className="medicines-section">
                    <h5>💊 Prescribed Medicines:</h5>
                    {condition.prescribedMedicines.map((med, medIndex) => (
                      <div key={medIndex} className="prescribed-med">
                        <div className="med-name-dosage">
                          <span className="med-name">{med.name}</span>
                          <span className="med-dosage">{med.dosage}</span>
                        </div>
                        <div className="med-schedule">{med.frequency} - {med.duration}</div>
                        {med.notes && <div className="med-notes">📝 {med.notes}</div>}
                      </div>
                    ))}
                  </div>
                  
                  {condition.symptoms && (
                    <div className="symptoms-section">
                      <h5>🔍 Symptoms:</h5>
                      <div className="symptoms-list">
                        {condition.symptoms.map((symptom, symIndex) => (
                          <span key={symIndex} className="symptom-tag">{symptom}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {condition.notes && (
                    <div className="condition-notes">
                      <strong>📋 Notes:</strong> {condition.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {medicalHistory.allergies && medicalHistory.allergies.length > 0 && (
            <div className="allergies-section">
              <h5>⚠️ Allergies:</h5>
              <div className="allergies-list">
                {medicalHistory.allergies.map((allergy, index) => (
                  <div key={index} className="allergy-item">
                    <span className="allergen">{allergy.allergen}</span>
                    <span className={`allergy-severity ${allergy.severity.toLowerCase()}`}>{allergy.severity}</span>
                    <span className="allergy-reaction">{allergy.reaction}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {medicalHistory.familyHistory && medicalHistory.familyHistory.length > 0 && (
            <div className="family-history-section">
              <h5>👨👩👧👦 Family History:</h5>
              <div className="family-history-list">
                {medicalHistory.familyHistory.map((family, index) => (
                  <div key={index} className="family-item">
                    <span className="relation">{family.relation}:</span>
                    <span className="family-conditions">{family.conditions.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="additional-details-section">
          <div className="section-header">
            <h4>📝 Additional Details</h4>
            <button 
              className="toggle-details-btn"
              onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
            >
              {showAdditionalDetails ? '➖ Hide' : '➕ Add More Details'}
            </button>
          </div>
          
          {showAdditionalDetails && (
            <div className="details-form">
              <textarea
                className="details-textarea"
                placeholder="Add any additional notes, side effects, concerns, or observations about your medication adherence..."
                value={additionalDetails}
                onChange={(e) => setAdditionalDetails(e.target.value)}
                rows={4}
              />
              <div className="details-actions">
                <button 
                  className="save-details-btn"
                  onClick={() => {
                    localStorage.setItem('pulse-additional-details', additionalDetails);
                    alert('Additional details saved successfully!');
                  }}
                >
                  💾 Save Details
                </button>
                <button 
                  className="clear-details-btn"
                  onClick={() => setAdditionalDetails('')}
                >
                  🗑️ Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdherenceReport;