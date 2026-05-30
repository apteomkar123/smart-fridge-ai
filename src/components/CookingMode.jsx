import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff, ChevronLeft, ChevronRight, Volume2, List, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';

const CUISINE_GENRE_MAP = {
  italian: 'classical', french: 'jazz', indian: 'world-music', japanese: 'ambient',
  mexican: 'latin', thai: 'world-music', chinese: 'world-music', greek: 'classical',
  american: 'country', korean: 'k-pop', spanish: 'flamenco', mediterranean: 'jazz',
};
function cuisineToGenre(cuisine) {
  if (!cuisine) return 'lo-fi';
  return CUISINE_GENRE_MAP[cuisine.toLowerCase()] || 'lo-fi';
}

export default function CookingMode({ steps, ingredients, recipeName, cuisine, onClose }) {
  const { user } = useUser();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [substituteMsg, setSubstituteMsg] = useState(null);
  const [fetchingSub, setFetchingSub] = useState(false);

  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const wakeLockRef = useRef(null);
  const isListeningRef = useRef(false);
  const isMounted = useRef(true);
  const currentStepRef = useRef(0);

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { currentStepRef.current = currentStepIndex; }, [currentStepIndex]);

  const speak = useCallback((text) => {
    if (!utteranceRef.current) return;
    window.speechSynthesis.cancel();
    utteranceRef.current.text = text;
    window.speechSynthesis.speak(utteranceRef.current);
  }, []);

  const readStep = useCallback((index) => {
    if (!steps[index]) return;
    speak(`Step ${index + 1}: ${steps[index]}`);
  }, [steps, speak]);

  const goToStep = useCallback((index) => {
    const next = Math.max(0, Math.min(index, steps.length - 1));
    setCurrentStepIndex(next);
    readStep(next);
  }, [steps, readStep]);

  // Keep screen awake during cooking
  useEffect(() => {
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then(lock => {
        wakeLockRef.current = lock;
      }).catch(() => {});
    }
    return () => { wakeLockRef.current?.release().catch(() => {}); };
  }, []);

  // Feature #1: Kitchen Concert — signal Jukebox to queue a cuisine-matched playlist
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('cross_app_activity').insert({
      user_id: user.id,
      app: 'hungry',
      activity_type: 'cooking_started',
      is_public: false,
      payload: {
        recipe_name: recipeName || '',
        cuisine: cuisine || '',
        genre_seed: cuisineToGenre(cuisine),
      },
    }).then(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch substitution suggestion from AI
  const fetchSubstitute = useCallback(async (ingredientMentioned) => {
    setFetchingSub(true);
    setSubstituteMsg(null);
    try {
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customPrompt: `The user is cooking and says they don't have "${ingredientMentioned}". Suggest a quick, practical substitution from common pantry items. Keep your answer under 20 words.`,
          directMode: true,
        }),
      });
      const text = await res.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      let msg = cleaned;
      try { msg = JSON.parse(cleaned)?.answer || cleaned; } catch {}
      setSubstituteMsg(msg);
      speak(`Substitution for ${ingredientMentioned}: ${msg}`);
    } catch {
      setSubstituteMsg('Could not find a substitution. Try using a similar ingredient.');
    } finally {
      setFetchingSub(false);
    }
  }, [speak]);

  useEffect(() => {
    isMounted.current = true;
    utteranceRef.current = new SpeechSynthesisUtterance();
    utteranceRef.current.lang = 'en-US';

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();

        if (transcript.includes('next')) {
          goToStep(currentStepRef.current + 1);
        } else if (transcript.includes('back') || transcript.includes('previous')) {
          goToStep(currentStepRef.current - 1);
        } else if (transcript.includes('repeat') || transcript.includes('read') || transcript.includes('again')) {
          readStep(currentStepRef.current);
        } else if (transcript.includes('stop') || transcript.includes('exit') || transcript.includes('close')) {
          onClose();
        } else if (transcript.includes('ingredients') || transcript.includes('what do i need')) {
          setShowIngredients(true);
          speak('Showing your ingredient list.');
        } else if (transcript.includes("don't have") || transcript.includes("do not have") || transcript.includes("out of") || transcript.includes("no ")) {
          // Extract ingredient name after "don't have" / "out of"
          const patterns = [/(?:don't have|do not have|out of|no )\s+(?:any\s+)?(.+)/];
          for (const p of patterns) {
            const m = transcript.match(p);
            if (m && m[1]) {
              fetchSubstitute(m[1].trim());
              break;
            }
          }
        } else if (transcript.includes('substitute') || transcript.includes('replace') || transcript.includes('swap')) {
          // "substitute for garlic" / "replace the butter"
          const m = transcript.match(/(?:substitute|replace|swap)(?:\s+(?:for|the))?\s+(.+)/);
          if (m?.[1]) fetchSubstitute(m[1].trim());
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'aborted') return;
        if (!isMounted.current) return;
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognition.onend = () => {
        if (isListeningRef.current && isMounted.current) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      isMounted.current = false;
      try { recognitionRef.current?.stop(); } catch (e) {}
      window.speechSynthesis.cancel();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      try { recognitionRef.current.stop(); } catch (e) {}
    } else {
      isListeningRef.current = true;
      setIsListening(true);
      try { recognitionRef.current.start(); } catch (e) {
        isListeningRef.current = false;
        setIsListening(false);
      }
    }
  };

  const handleClose = () => {
    isListeningRef.current = false;
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch (e) {}
    window.speechSynthesis.cancel();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 z-[100] text-white">
      <div className="w-full max-w-3xl bg-white/10 rounded-[2.5rem] border border-white/20 shadow-2xl p-6 flex flex-col h-full max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-black text-white">Cooking Mode</h2>
          <div className="flex items-center gap-2">
            {ingredients?.length > 0 && (
              <button
                onClick={() => setShowIngredients(v => !v)}
                className={`p-2 rounded-xl transition-colors ${showIngredients ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25'}`}
                title="Toggle ingredient list"
              >
                <List size={20} />
              </button>
            )}
            <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors p-2">
              <X size={28} />
            </button>
          </div>
        </div>

        {/* Ingredient panel */}
        {showIngredients && ingredients?.length > 0 && (
          <div className="bg-white/10 rounded-2xl border border-white/20 p-4 mb-4 max-h-44 overflow-y-auto">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">Ingredients</p>
            <div className="space-y-1">
              {ingredients.map((ing, i) => (
                <p key={i} className="text-xs text-white/80 font-medium">{ing}</p>
              ))}
            </div>
          </div>
        )}

        {/* Substitute suggestion */}
        {(fetchingSub || substituteMsg) && (
          <div className="bg-amber-400/20 border border-amber-300/30 rounded-2xl px-4 py-3 mb-4 flex items-start gap-2">
            {fetchingSub
              ? <Loader2 size={14} className="animate-spin text-amber-300 mt-0.5 shrink-0" />
              : <RefreshCw size={14} className="text-amber-300 mt-0.5 shrink-0" />}
            <p className="text-xs text-amber-100 leading-relaxed">{fetchingSub ? 'Finding a substitution…' : substituteMsg}</p>
            {substituteMsg && !fetchingSub && (
              <button onClick={() => setSubstituteMsg(null)} className="ml-auto text-white/40 hover:text-white/80 shrink-0">
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Step display */}
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 overflow-y-auto">
          <p className="text-sm font-bold text-white/60 uppercase tracking-widest">Step {currentStepIndex + 1} of {steps.length}</p>
          <p className="text-3xl font-bold leading-relaxed">{steps[currentStepIndex]}</p>
        </div>

        {/* Controls */}
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => goToStep(currentStepIndex - 1)}
            disabled={currentStepIndex === 0}
            className="p-3 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50 transition-all"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={toggleListening}
            className={`p-4 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-[#6BAEE0]'} text-white shadow-lg transition-all`}
          >
            {isListening ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
          <button onClick={() => readStep(currentStepIndex)} className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-all">
            <Volume2 size={24} />
          </button>
          <button
            onClick={() => goToStep(currentStepIndex + 1)}
            disabled={currentStepIndex === steps.length - 1}
            className="p-3 rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50 transition-all"
          >
            <ChevronRight size={24} />
          </button>
        </div>
        <p className="text-xs text-white/50 text-center mt-3">Say "Next", "Back", "Repeat", "I don't have [ingredient]", or "Ingredients"</p>
      </div>
    </div>
  );
}
