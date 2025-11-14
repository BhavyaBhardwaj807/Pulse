import React from 'react';

const AddMedicationForm = ({ 
  showAddForm, 
  setShowAddForm, 
  newMed, 
  setNewMed, 
  addMedication, 
  colors 
}) => {
  if (!showAddForm) return null;

  return (
    <div className="modal-overlay animate-in" onClick={() => setShowAddForm(false)}>
      <form className="add-form glass-card" onClick={e => e.stopPropagation()} onSubmit={addMedication}>
        <div className="form-header">
          <h3>Add New Medication</h3>
          <button type="button" className="close-btn" onClick={() => setShowAddForm(false)}>×</button>
        </div>
        
        <div className="form-group">
          <label>💊 Medication Name</label>
          <input
            type="text"
            placeholder="Enter medication name"
            value={newMed.name}
            onChange={(e) => setNewMed({...newMed, name: e.target.value})}
            required
          />
        </div>
        
        <div className="form-group">
          <label>📏 Dosage</label>
          <input
            type="text"
            placeholder="e.g., 10mg, 2 tablets"
            value={newMed.dosage}
            onChange={(e) => setNewMed({...newMed, dosage: e.target.value})}
            required
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label>🔄 Frequency</label>
            <select
              value={newMed.frequency}
              onChange={(e) => setNewMed({...newMed, frequency: e.target.value})}
            >
              <option value="">Select frequency</option>
              <option value="Once daily">Once daily</option>
              <option value="Twice daily">Twice daily</option>
              <option value="Three times daily">Three times daily</option>
              <option value="As needed">As needed</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>⏰ Time</label>
            <input
              type="time"
              value={newMed.time}
              onChange={(e) => setNewMed({...newMed, time: e.target.value})}
            />
          </div>
        </div>
        
        <div className="form-group">
          <label>🎨 Color Theme</label>
          <div className="color-picker">
            {colors.map(color => (
              <button
                key={color}
                type="button"
                className={`color-option ${newMed.color === color ? 'selected' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setNewMed({...newMed, color})}
              />
            ))}
          </div>
        </div>
        
        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={() => setShowAddForm(false)}>Cancel</button>
          <button type="submit" className="submit-btn">Add Medication</button>
        </div>
      </form>
    </div>
  );
};

export default AddMedicationForm;