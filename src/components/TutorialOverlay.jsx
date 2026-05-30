import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, PartyPopper } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';

// Each step: tab to navigate to, where the pulsing spotlight goes (% of screen), what to show
const STEPS = [
  {
    title: 'Your Smart Pantry',
    tab: 'pantry',
    emoji: '🥦',
    spotlight: { x: '50%', y: '30%' },
    arrow: 'down',
    lines: [
      'Snap a grocery receipt or scan a barcode — AI parses quantities and auto-fills expiry dates.',
      'Items are grouped by category. Tap any category bubble to see all items inside.',
      'Each item shows expiry date, nutrition, and price. Tap to edit any detail.',
    ],
  },
  {
    title: 'Recipe Explorer',
    tab: 'recipes',
    emoji: '👨‍🍳',
    spotlight: { x: '50%', y: '25%' },
    arrow: 'down',
    lines: [
      'Pick a mood — Tired, Post-Workout, Adventurous — to instantly boost matching recipes.',
      'Green dots = you have the ingredient. Amber = almost. Your pantry match % is shown on each card.',
      'Tap ✨ AI to pick pantry items and get a custom recipe invented just for you.',
    ],
  },
  {
    title: 'Inside a Recipe',
    tab: 'recipes',
    emoji: '📋',
    spotlight: { x: '50%', y: '40%' },
    arrow: 'up',
    lines: [
      'Tap any recipe card to open it. The title, star, and share stay pinned as you scroll.',
      'One tap: Make Vegetarian, Make Vegan, Proteinize. The AI adapts the whole recipe.',
      'Add All Missing fills your shopping list. Start Cooking launches the Virtual Sous Chef.',
    ],
  },
  {
    title: 'Virtual Sous Chef',
    tab: 'recipes',
    emoji: '🎙️',
    spotlight: { x: '50%', y: '60%' },
    arrow: 'up',
    lines: [
      'Say Next, Back, Repeat, or Ingredients — completely hands-free.',
      'Say I don\'t have cumin and the AI suggests a real-time pantry substitution.',
      'Tap Cooked! to auto-subtract ingredients and log the meal to your history.',
    ],
  },
  {
    title: 'Shopping List',
    tab: 'shopping',
    emoji: '🛒',
    spotlight: { x: '50%', y: '35%' },
    arrow: 'down',
    lines: [
      'Items are auto-grouped by aisle — Produce, Dairy, Meat, Bakery, and more.',
      'Double-tap any item to rename it. Tap the 👥 icon to move it to a household list.',
      'Tap ✨ next to any item to get a smarter alternative based on your nutrition goal.',
    ],
  },
  {
    title: 'Personal Shopper',
    tab: 'shopping',
    emoji: '🏪',
    spotlight: { x: '85%', y: '12%' },
    arrow: 'up',
    lines: [
      'Tap Go Shopping at the top right to launch Personal Shopper mode.',
      'Pick your store — aisle locations update instantly for 13+ stores.',
      'Can\'t find an item? Tap Can\'t find it? for an AI substitution suggestion.',
    ],
  },
  {
    title: 'Household & Settle Up',
    tab: 'household',
    emoji: '🏠',
    spotlight: { x: '50%', y: '30%' },
    arrow: 'down',
    lines: [
      'Create or join a household with an invite code — share pantry, list, and recipes.',
      'Settle Up calculates each member\'s share and opens Venmo or Splitwise pre-filled.',
      'The At the Store banner appears when a roommate is grocery shopping.',
    ],
  },
  {
    title: 'Events & Potluck',
    tab: 'potluck',
    emoji: '🎉',
    spotlight: { x: '50%', y: '35%' },
    arrow: 'down',
    lines: [
      'Create a named event with a date, time, and venue. Share the invite code with friends.',
      'Anyone can claim items — Buns ✓, Ice ✓. The readiness bar fills in real-time.',
      'Tap View Full Details to see dietary restrictions and who\'s bringing what.',
    ],
  },
  {
    title: 'Community Recipes',
    tab: 'community',
    emoji: '🌍',
    spotlight: { x: '50%', y: '40%' },
    arrow: 'down',
    lines: [
      'Browse 14+ category rows: Trending, Indian, Italian, High Protein, Quick & Easy…',
      'Tap the arrow at the end of a row — or View All — to see the full grid.',
      'Search any dish to pull up full ingredients and steps from a global database.',
    ],
  },
  {
    title: 'Friends & Profiles',
    tab: 'friends',
    emoji: '👥',
    spotlight: { x: '50%', y: '30%' },
    arrow: 'down',
    lines: [
      'Add friends by sharing your 8-character Friend Code or searching by name.',
      'Tap any friend to see their public Chef History feed and saved recipe favorites.',
      'Household members get an Add Friend button so you\'re always connected.',
    ],
  },
  {
    title: 'Analytics & Taste Profile',
    tab: 'analytics',
    emoji: '📊',
    spotlight: { x: '50%', y: '40%' },
    arrow: 'down',
    lines: [
      'The Taste Profile heat map shows every world cuisine you\'ve cooked — with mastery badges.',
      'Set a macro goal in the AI Nutrition Coach for custom ingredient and recipe suggestions.',
      'Chef History logs every dish you\'ve cooked. Tap Remix Leftovers to invent a new recipe.',
    ],
  },
];

export default function TutorialOverlay({ onComplete, onSkip, onSwitchTab }) {
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [spotVisible, setSpotVisible] = useState(true);
  const prevTab = useRef(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Auto-navigate to the relevant tab when step changes
  useEffect(() => {
    if (onSwitchTab && current.tab !== prevTab.current) {
      onSwitchTab(current.tab);
      prevTab.current = current.tab;
    }
    // Pulse the spotlight in/out on step change
    setSpotVisible(false);
    const t = setTimeout(() => setSpotVisible(true), 150);
    return () => clearTimeout(t);
  }, [step, current.tab, onSwitchTab]);

  const handleComplete = async () => {
    setFinishing(true);
    try {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({ particleCount: 180, spread: 100, origin: { y: 0.5 }, colors: ['#6BAEE0', '#1F6FB8', '#ffffff', '#a78bfa'] });
      }).catch(() => {});
      if (user) {
        await supabase.from('profiles').update({ hungry_tutorial_done: true }).eq('id', user.id);
      }
    } catch {}
    onComplete();
  };

  const handleSkip = async () => {
    try {
      if (user) {
        await supabase.from('profiles').update({ hungry_tutorial_done: true }).eq('id', user.id);
      }
    } catch {}
    onSkip();
  };

  const goNext = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  return (
    <div className="fixed inset-0 z-200 flex flex-col" style={{ background: 'rgba(10,20,50,0.65)', backdropFilter: 'blur(4px)' }}>

      {/* ── Spotlight pulsing indicator ─────────────────────────────────── */}
      <div
        className="absolute pointer-events-none"
        style={{ left: current.spotlight.x, top: current.spotlight.y, transform: 'translate(-50%, -50%)' }}
      >
        {/* Outer ripple rings */}
        <div className={`absolute inset-0 rounded-full transition-opacity duration-300 ${spotVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-20 h-20 -ml-10 -mt-10 rounded-full border-2 border-[#6BAEE0]/40 animate-ping" />
        </div>
        <div className={`absolute inset-0 rounded-full transition-opacity duration-500 delay-75 ${spotVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-12 h-12 -ml-6 -mt-6 rounded-full border-2 border-[#6BAEE0]/60 animate-ping" style={{ animationDelay: '0.2s' }} />
        </div>
        {/* Center dot */}
        <div className={`w-4 h-4 -ml-2 -mt-2 rounded-full bg-[#6BAEE0] shadow-lg shadow-sky-400/60 transition-all duration-300 ${spotVisible ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
        {/* "Look here" label */}
        <div className={`absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap transition-all duration-300 ${spotVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
          <span className="text-[10px] font-black text-white/80 bg-[#6BAEE0]/80 px-2 py-0.5 rounded-full tracking-widest">👆 HERE</span>
        </div>
      </div>

      {/* ── Tutorial card anchored at bottom ───────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-6">
        <div
          className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl border border-white/50 overflow-hidden"
          style={{ animation: 'slideInUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards' }}
        >
          {/* Progress bar */}
          <div className="h-1 bg-blue-50">
            <div
              className="h-full bg-linear-to-r from-[#6BAEE0] to-[#4d96d1] transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-6">
            {/* Header row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-sky-100 to-blue-100 flex items-center justify-center text-2xl shadow-sm shrink-0">
                  {current.emoji}
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{step + 1} of {STEPS.length}</p>
                  <h2 className="logo-text text-xl text-[#1F6FB8] leading-tight">{current.title}</h2>
                </div>
              </div>
              <button onClick={handleSkip} className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Intro text on first step */}
            {step === 0 && (
              <p className="text-xs font-black text-[#6BAEE0] italic mb-3">
                Everyone skips tutorials, but you won't want to skip this one. You can do a lot with this app.
              </p>
            )}

            {/* Bullet lines */}
            <ul className="space-y-2 mb-5">
              {current.lines.map((line, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-[#6BAEE0]/15 text-[#6BAEE0] flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black">{i + 1}</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{line}</p>
                </li>
              ))}
            </ul>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={goBack}
                disabled={step === 0}
                className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={14} /> Back
              </button>

              {/* Step dots */}
              <div className="flex items-center gap-1">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={`rounded-full transition-all ${i === step ? 'w-4 h-2 bg-[#6BAEE0]' : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'}`}
                  />
                ))}
              </div>

              {isLast ? (
                <button
                  onClick={handleComplete}
                  disabled={finishing}
                  className="flex items-center gap-2 bg-linear-to-r from-[#6BAEE0] to-[#4d96d1] text-white font-black px-5 py-2.5 rounded-2xl text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-60"
                >
                  <PartyPopper size={15} /> {finishing ? 'Done!' : "Let's Cook!"}
                </button>
              ) : (
                <button
                  onClick={goNext}
                  className="flex items-center gap-2 bg-linear-to-r from-[#6BAEE0] to-[#4d96d1] text-white font-black px-5 py-2.5 rounded-2xl text-sm shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  Next <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
