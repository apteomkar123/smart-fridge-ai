import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';

export default function CookingMode({ steps, onClose }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [speechRecognition, setSpeechRecognition] = useState(null);
  const isMounted = useRef(true);
  const utteranceRef = useRef(null);

  useEffect(() => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        console.log('Voice command:', transcript);
        if (transcript.includes('next step') || transcript.includes('next')) {
          handleNextStep();
        } else if (transcript.includes('previous step') || transcript.includes('back')) {
          handlePreviousStep();
        } else if (transcript.includes('read step') || transcript.includes('repeat')) {
          readCurrentStep();
        } else if (transcript.includes('stop cooking') || transcript.includes('exit')) {
          handleTerminate();
        }
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        if (isListening && isMounted.current) { // Check if still active and mounted
          recognition.start();
        }
      };

      setSpeechRecognition(recognition);
    } else {
      console.warn('Web Speech API not supported in this browser.');
    }

    // Initialize Speech Synthesis
    utteranceRef.current = new SpeechSynthesisUtterance();
    utteranceRef.current.lang = 'en-US';

    return () => {
      isMounted.current = false;
      if (speechRecognition) speechRecognition.stop();
      if (utteranceRef.current) speechSynthesis.cancel();
    };
  }, []);

  const handleTerminate = () => {
    if (speechRecognition) speechRecognition.stop();
    if (utteranceRef.current) window.speechSynthesis.cancel();
    setIsListening(false);
    onClose();
  };

  const toggleListening = () => {
    if (speechRecognition) {
      if (isListening) {
        speechRecognition.stop();
      } else {
        speechRecognition.start();
      }
      setIsListening(!isListening);
    }
  };

  const readCurrentStep = () => {
    if (utteranceRef.current && steps[currentStepIndex]) {
      speechSynthesis.cancel(); // Stop any ongoing speech
      utteranceRef.current.text = `Step ${currentStepIndex + 1}: ${steps[currentStepIndex]}`;
      speechSynthesis.speak(utteranceRef.current);
    }
  };

  const handleNextStep = () => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    readCurrentStep();
  };

  const handlePreviousStep = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
    readCurrentStep();
  };

  return (
    <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 z-50 text-white">
      <div className="w-full max-w-3xl bg-white/10 rounded-[2.5rem] border border-white/20 shadow-2xl p-6 flex flex-col h-full max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white">Cooking Mode</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors"><X size={28} /></button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 overflow-y-auto custom-scrollbar">
          <p className="text-sm font-bold text-white/60 uppercase tracking-widest">Step {currentStepIndex + 1} of {steps.length}</p>
          <p className="text-3xl font-bold leading-relaxed">{steps[currentStepIndex]}</p>
        </div>
        <div className="flex justify-center items-center gap-4 mt-6">
          <button onClick={handlePreviousStep} disabled={currentStepIndex === 0} className="p-3 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50 transition-all"><ChevronLeft size={24} /></button>
          <button onClick={toggleListening} className={`p-4 rounded-full ${isListening ? 'bg-red-500' : 'bg-[#6BAEE0]'} text-white shadow-lg transition-all`}>
            {isListening ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
          <button onClick={readCurrentStep} className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-all"><Volume2 size={24} /></button>
          <button onClick={handleNextStep} disabled={currentStepIndex === steps.length - 1} className="p-3 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50 transition-all"><ChevronRight size={24} /></button>
        </div>
        <p className="text-xs text-white/50 text-center mt-4">Say "Next step", "Previous step", "Read step", or "Stop cooking"</p>
      </div>
    </div>
  );
}