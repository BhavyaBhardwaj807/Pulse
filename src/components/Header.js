import React from 'react';

const Header = ({ currentTime, onProfileClick }) => {
  return (
    <header className="header">
      <div className="header-content">
        <button 
          className="profile-btn-header"
          onClick={onProfileClick}
          title="Profile & Settings"
        >
          👤
        </button>
        <div className="logo-container">
          <div className="pulse-icon-animated">💊</div>
          <h1 className="logo">Pulse</h1>
        </div>
        <p className="tagline">Stay ahead of your Meds!!</p>
        <div className="time-display">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </header>
  );
};

export default Header;