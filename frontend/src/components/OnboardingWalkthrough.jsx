import React, { useState } from 'react';
import { useTranslation } from '../context/TranslationContext';

export default function OnboardingWalkthrough({ isOpen, onClose }) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: "Welcome to Smart Pest Detector",
      description: "This dashboard allows you to monitor and manage your farm's pest defense system autonomously. Let's take a quick tour of the key features.",
    },
    {
      title: "Real-Time Telemetry HUD",
      description: "Monitor the physical state of the rover: battery charge, motor temperature, speed, heading, and sensor readings. The rover will auto-return to dock if its battery falls below 20%.",
    },
    {
      title: "Live Pest Risk Map",
      description: "View the heat map of pest activity across the farm. Centroids of detections are mapped using the rover's live GPS fixes, color-coded by severity.",
    },
    {
      title: "Scheduled Autonomous Runs",
      description: "Set dates and daily scanning schedules (e.g., scanning rows 1–10 daily at 6 AM) to keep surveillance consistent without manual starts.",
    },
    {
      title: "Hard Human Safety Stop",
      description: "If a human is detected in front of the camera, the rover pauses actions instantly to prevent collision, bypassing server latency.",
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-all duration-300">
      <div className="relative w-full max-w-lg rounded-2xl border border-emerald-800 bg-zinc-950 p-8 shadow-2xl transition-transform duration-300 transform scale-100">
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mr-2 -mt-2 h-16 w-16 rounded-bl-full bg-emerald-500/10" />
        <div className="absolute bottom-0 left-0 -ml-2 -mb-2 h-16 w-16 rounded-tr-full bg-emerald-500/10" />

        {/* Progress indicator */}
        <div className="mb-6 flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            {t('onboarding')} &bull; Step {currentStep + 1} of {steps.length}
          </span>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors text-sm font-semibold"
          >
            Skip
          </button>
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-white tracking-tight">
            {step.title}
          </h3>
          <p className="text-zinc-300 leading-relaxed text-sm">
            {step.description}
          </p>
        </div>

        {/* Steps dots */}
        <div className="mt-8 flex items-center space-x-2">
          {steps.map((_, idx) => (
            <div 
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentStep ? 'w-6 bg-emerald-500' : 'w-2 bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
              currentStep === 0 
                ? 'border-zinc-800 text-zinc-600 cursor-not-allowed' 
                : 'border-zinc-700 text-zinc-300 hover:bg-zinc-900 hover:text-white'
            }`}
          >
            Back
          </button>
          
          <button
            onClick={handleNext}
            className="px-6 py-2 text-sm font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all"
          >
            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
