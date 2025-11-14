import React from 'react';

const ProfileForm = ({ 
  showProfile, 
  setShowProfile, 
  userProfile, 
  setUserProfile, 
  saveProfile 
}) => {
  if (!showProfile) return null;

  return (
    <div className="modal-overlay animate-in" onClick={() => setShowProfile(false)}>
      <form className="profile-form glass-card" onClick={e => e.stopPropagation()} onSubmit={saveProfile}>
        <div className="form-header">
          <h3>👤 Profile & Reminders</h3>
          <button type="button" className="close-btn" onClick={() => setShowProfile(false)}>×</button>
        </div>
        
        <div className="form-group">
          <label>📧 Gmail Address</label>
          <input
            type="email"
            placeholder="your.email@gmail.com"
            value={userProfile.email}
            onChange={(e) => setUserProfile({...userProfile, email: e.target.value})}
            required
          />
        </div>
        
        <div className="form-group">
          <label>👤 Full Name</label>
          <input
            type="text"
            placeholder="Your full name"
            value={userProfile.name}
            onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
            required
          />
        </div>
        
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={userProfile.remindersEnabled}
              onChange={(e) => setUserProfile({...userProfile, remindersEnabled: e.target.checked})}
            />
            📅 Enable Google Calendar Reminders
          </label>
          <p className="reminder-note">When enabled, medication times will be added to your Google Calendar</p>
        </div>
        
        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={() => setShowProfile(false)}>Cancel</button>
          <button type="submit" className="submit-btn">Save Profile</button>
        </div>
      </form>
    </div>
  );
};

export default ProfileForm;