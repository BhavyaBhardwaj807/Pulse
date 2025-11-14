import React from 'react';

const StatsGrid = ({ completionRate, todaysTaken, totalToday, streak, medications }) => {
  return (
    <div className="stats-grid">
      <div className="stat-card completion">
        <div className="stat-icon">📊</div>
        <div className="stat-content">
          <h3>Today's Progress</h3>
          <div className="progress-ring">
            <div className="progress-value">{completionRate}%</div>
          </div>
          <p>{todaysTaken} of {totalToday} taken</p>
        </div>
      </div>
      <div className="stat-card streak">
        <div className="stat-icon">🔥</div>
        <div className="stat-content">
          <h3>Streak</h3>
          <div className="streak-number">{streak}</div>
          <p>doses in a row</p>
        </div>
      </div>
      <div className="stat-card next">
        <div className="stat-icon">⏰</div>
        <div className="stat-content">
          <h3>Next Dose</h3>
          <div className="next-time">
            {medications.find(m => !m.taken)?.time || '--:--'}
          </div>
          <p>{medications.find(m => !m.taken)?.name || 'All done!'}</p>
        </div>
      </div>
    </div>
  );
};

export default StatsGrid;