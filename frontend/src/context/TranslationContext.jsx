import React, { createContext, useContext, useState } from 'react';

const TranslationContext = createContext();

const translations = {
  en: {
    dashboardTitle: "Smart Pest Detector - Dashboard",
    roverHealth: "Rover Health & Telemetry",
    battery: "Battery",
    runtime: "Est. Runtime",
    speed: "Speed",
    heading: "Heading",
    signalStrength: "Signal Strength",
    motorTemp: "Motor Temp",
    runRoute: "Run Route",
    pauseRover: "Pause Rover",
    resumeRover: "Resume Rover",
    pestFeed: "Pest Detection Feed",
    telemetryHud: "Real-Time Telemetry HUD",
    irrigationControl: "Smart Irrigation Control",
    scheduledRuns: "Scheduled Autonomous Runs",
    alertsCenter: "Alerts Center",
    riskMap: "Risk Map",
    preferences: "Preferences",
    language: "Language",
    english: "English",
    tamil: "தமிழ்",
    logout: "Log Out",
    login: "Log In",
    signup: "Sign Up",
    username: "Username",
    password: "Password",
    role: "Role",
    welcome: "Welcome",
    notifications: "Notification Settings",
    exportCsv: "Export CSV",
    exportPdf: "Export PDF",
    noDetections: "No pest detections recorded yet.",
    personDetected: "PERSON IN FRAME - SAFETY STOP ENFORCED",
    advisory: "Advisory Details",
    severity: "Severity",
    lifestage: "Life Stage",
    trackId: "Track ID",
    onboarding: "Guided Onboarding",
    startOnboarding: "Start Tutorial",
    channels: "Channels",
    frequency: "Frequency",
    instant: "Instant",
    daily: "Daily Digest",
    savePrefs: "Save Preferences",
    reports: "Reports & Logs",
    confidence: "Confidence",
    dateRange: "Date Range",
    species: "Species",
    zone: "Zone",
    applyFilters: "Apply Filters",
    esevaiPortal: "Tamil Nadu e-Sevai Portal",
    esevaiSubtitle: "Connect with TNeGA e-Governance services, crop subsidies, and agricultural schemes.",
    esevaiApplySubsidies: "Apply for Subsidies",
    esevaiCropInsurance: "Apply for Crop Insurance",
    esevaiSoilHealth: "Soil Health Card Service",
    esevaiPestCompensation: "Claim Pest Damage Compensation",
    esevaiGovtPortal: "Open Official e-Sevai Portal"
  },
  ta: {
    dashboardTitle: "ஸ்மார்ட் பூச்சி கண்டறிவி - கட்டுப்பாட்டு அறை",
    roverHealth: "ரோவர் ஆரோக்கியம் & தொலைஅளவியல்",
    battery: "பேட்டரி",
    runtime: "இயக்க நேரம்",
    speed: "வேகம்",
    heading: "திசை",
    signalStrength: "சிக்னல் வலிமை",
    motorTemp: "மோட்டார் வெப்பநிலை",
    runRoute: "வழியை இயக்கு",
    pauseRover: "ரோவரை நிறுத்து",
    resumeRover: "ரோவரை தொடங்கு",
    pestFeed: "பூச்சி கண்டறிதல் ஊட்டம்",
    telemetryHud: "நிகழ்நேர தொலைஅளவியல் HUD",
    irrigationControl: "ஸ்மார்ட் பாசனக் கட்டுப்பாடு",
    scheduledRuns: "திட்டமிடப்பட்ட தன்னாட்சி ஓட்டங்கள்",
    alertsCenter: "எச்சரிக்கை மையம்",
    riskMap: "அபாய வரைபடம்",
    preferences: "விருப்பங்கள்",
    language: "மொழி",
    english: "ஆங்கிலம்",
    tamil: "தமிழ்",
    logout: "வெளியேறு",
    login: "உள்நுழை",
    signup: "பதிவு செய்",
    username: "பயனர் பெயர்",
    password: "கடவுச்சொல்",
    role: "பங்கு",
    welcome: "வரவேற்கிறோம்",
    notifications: "அறிவிப்பு அமைப்புகள்",
    exportCsv: "CSV ஏற்றுமதி",
    exportPdf: "PDF ஏற்றுமதி",
    noDetections: "பூச்சி கண்டறிதல் இன்னும் பதிவு செய்யப்படவில்லை.",
    personDetected: "மனிதர் கண்டறியப்பட்டார் - பாதுகாப்பு நிறுத்தம் அமல்படுத்தப்பட்டது",
    advisory: "ஆலோசனை விவரங்கள்",
    severity: "தீவிரம்",
    lifestage: "வாழ்க்கை நிலை",
    trackId: "தடமறிதல் ஐடி",
    onboarding: "வழிகாட்டப்பட்ட அறிமுகம்",
    startOnboarding: "டுடோரியலைத் தொடங்கு",
    channels: "சேனல்கள்",
    frequency: "அதிர்வெண்",
    instant: "உடனடி",
    daily: "தினசரி தொகுப்பு",
    savePrefs: "விருப்பங்களைச் சேமி",
    reports: "அறிக்கைகள் & பதிவுகள்",
    confidence: "நம்பகத்தன்மை",
    dateRange: "தேதி வரம்பு",
    species: "பூச்சி வகை",
    zone: "மண்டலம்",
    applyFilters: "வடிகட்டிகளைப் பயன்படுத்து",
    esevaiPortal: "தமிழ்நாடு இ-சேவை மையம்",
    esevaiSubtitle: "TNeGA மின்-ஆளுமை சேவைகள், பயிர் மானியங்கள் மற்றும் விவசாயத் திட்டங்களை அணுகவும்.",
    esevaiApplySubsidies: "விவசாய மானியத்திற்கு விண்ணப்பிக்கவும்",
    esevaiCropInsurance: "பயிர் காப்பீட்டிற்கு விண்ணப்பிக்கவும்",
    esevaiSoilHealth: "மண் வள அட்டை சேவை",
    esevaiPestCompensation: "பூச்சி சேத இழப்பீடு கோரவும்",
    esevaiGovtPortal: "அதிகாரப்பூர்வ இ-சேவை போர்டல்"
  }
};

export const TranslationProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('smart_pest_lang') || 'en';
  });

  const setLanguage = (lang) => {
    setLanguageState(lang);
    localStorage.setItem('smart_pest_lang', lang);
  };

  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
