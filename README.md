# Pulse - Smart Medication Tracker

A modern React-based medication adherence tracking application with smart scanning capabilities and comprehensive medical history management.

## Features

### 🏠 Core Functionality
- **Medication Management**: Add, track, and manage daily medications
- **Smart Adherence Tracking**: Monitor medication intake with streak counters
- **Progress Analytics**: Visual progress tracking with completion rates

### 📱 Smart Input Methods
- **OCR Medicine Scanning**: Camera-based medicine name detection using OpenCV and Tesseract
- **Voice Input**: Text-based voice input for hands-free medication entry
- **Manual Entry**: Traditional form-based medication input

### 📊 Advanced Reporting
- **Detailed Adherence Reports**: Weekly medication statistics and trends
- **Medical History Integration**: Comprehensive patient medical history tracking
- **Visual Analytics**: Charts and graphs for adherence patterns

### 🏥 Medical History Features
- **Condition Tracking**: Monitor ongoing and resolved medical conditions
- **Prescription History**: Track prescribed medications with dosages and notes
- **Allergy Management**: Record and display patient allergies
- **Family History**: Maintain family medical history records

### 🔧 Technical Features
- **Google Calendar Integration**: Sync medication reminders
- **Local Storage**: Persistent data storage
- **Responsive Design**: Mobile-friendly interface
- **Real-time Updates**: Live medication tracking

## Technology Stack

- **Frontend**: React 18, CSS3
- **OCR**: Tesseract.js, OpenCV.js
- **Voice**: Agora react UI kit
- **Storage**: LocalStorage
- **Styling**: Custom CSS with glassmorphism design

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/pulse-medication-tracker.git
cd pulse-medication-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) to view the app.

## Usage

### Adding Medications
1. Click "Smart Add" for camera/voice input or "Manual Add" for form entry
2. Use camera to scan medicine packaging or type medicine details
3. Set dosage, frequency, and timing
4. Save to your medication list

### Tracking Adherence
1. Mark medications as taken using the "Take Now" button
2. View daily progress in the stats dashboard
3. Check detailed reports for weekly trends

### Medical History
1. Access comprehensive medical history in the adherence report
2. View past conditions, prescriptions, and family history
3. Track allergies and important medical notes

## Project Structure

```
pulse/
├── public/
│   └── index.html
├── src/
│   ├── App.js              # Main application component
│   ├── App.css             # Styling and animations
│   ├── EnhancedScanner.js  # OCR and image processing
│   ├── OpenCVProcessor.js  # OpenCV image enhancement
│   ├── medicalHistory.json # Sample medical history data
│   ├── index.js            # React entry point
│   └── index.css           # Global styles
├── package.json
└── README.md
```

## Features in Detail

### Smart Medicine Scanning
- OpenCV-based image preprocessing for better OCR accuracy
- Text region detection to focus on medicine names
- Multi-word medicine name extraction
- Dosage detection with unit normalization

### Medical History Management
- Comprehensive condition tracking with diagnosis dates
- Prescription medication history with detailed notes
- Symptom tracking and lab value storage
- Allergy and family history management

### Adherence Analytics
- Daily, weekly, and monthly adherence tracking
- Visual progress indicators and trend charts
- Missed dose tracking and insights
- Personalized recommendations

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenCV.js for image processing capabilities
- Tesseract.js for OCR functionality
- React team for the excellent framework
- Medical professionals for feature guidance
