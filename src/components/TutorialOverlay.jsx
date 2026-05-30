import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, PartyPopper } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';

const STEPS = [
  {
    title: 'Your Smart Pantry',
    tab: 'pantry',
    emoji: '🥦',
    lines: [
      'Snap a grocery receipt or scan a barcode — AI parses quantities and auto-fills expiry dates.',
      'Items are grouped by category (Proteins, Dairy, Spices) and toggle between Personal and Household stock.',
      'Tap any item to see its nutritional info, edit quantity with the stepper, or view its value.',
    ],
  },
  {
    title: 'Recipe Explorer',
    tab: 'recipes',
    emoji: '👨‍🍳',
    lines: [
      'Choose a mood — Tired, Post-Workout, Adventurous — to instantly filter recipes that fit.',
      'Green and amber dots show exactly which ingredients you have. No more running out of eggs.',
      'Tap the ✨ AI icon to pick pantry items and get a custom recipe invented just for you.',
    ],
  },
  {
    title: 'Inside a Recipe Card',
    tab: 'recipes',
    emoji: '📋',
    lines: [
      'The title, star, share, and ✕ are pinned at the top — they stay visible as you scroll.',
      'Make Vegetarian, Make Vegan, or Proteinize with one tap. The AI adapts the whole recipe.',
      'Add All Missing fills your shopping list instantly. Start Cooking launches the Virtual Sous Chef.',
    ],
  },
  {
    title: 'Virtual Sous Chef',
    tab: 'recipes',
    emoji: '🎙️',
    lines: [
      'Hands-free voice navigation: say Next, Back, Repeat, or Ingredients.',
      'Say I don\'t have cumin and the AI will suggest a real-time pantry substitution.',
      'Tap Cooked! when you\'re done to auto-subtract ingredients and log the meal to your history.',
    ],
  },
  {
    title: 'Personal Shopper',
    tab: 'shopping',
    emoji: '🛒',
    lines: [
      'Items are auto-grouped by aisle for 13+ stores (Trader Joe\'s, Walmart, Whole Foods…).',
      'Pick your store at the top — aisle locations update instantly.',
      'Move items between your personal list and a shared household list.',
    ],
  },
  {
    title: 'Household & Settle Up',
    tab: 'household',
    emoji: '🏠',
    lines: [
      'Create or join a household with an invite code. Share your pantry, shopping list, and recipes.',
      'Settle Up calculates each member\'s share and opens Venmo or Splitwise with the right amount pre-filled.',
      'Add members as friends from inside the Household tab.',
    ],
  },
  {
    title: 'Events & Potluck',
    tab: 'potluck',
    emoji: '🎉',
    lines: [
      'Create a named event (Friday BBQ, Potluck…) and share its unique invite code with friends.',
      'Add your dietary restrictions and RSVP directly from the event card.',
      'Anyone with the code can join and claim items — the readiness progress bar fills in real-time.',
    ],
  },
  {
    title: 'Community Recipes',
    tab: 'community',
    emoji: '🌍',
    lines: [
      'Browse recipes by category — Trending, Healthy, Comfort Food, Breakfast, Seafood, and more.',
      'Search any recipe by name to pull up full ingredients and steps from a global database.',
      'Apply dietary substitutions (Vegetarian, Vegan, Gluten-Free) to any community recipe.',
    ],
  },
  {
    title: 'Friends & Profiles',
    tab: 'friends',
    emoji: '👥',
    lines: [
      'Add friends by sharing your 8-character Friend Code or searching by name.',
      'View any friend\'s public Chef History feed and saved recipe favorites.',
      'Household members automatically show an Add Friend button — no code needed.',
    ],
  },
  {
    title: 'Analytics & History',
    tab: 'analytics',
    emoji: '📊',
    lines: [
      'The Taste Profile shows which world cuisines you\'ve mastered and awards badges like 🏆 Master Chef.',
      'Set a macro goal in the AI Nutrition Coach and get custom ingredient and recipe suggestions.',
      'In Chef History, tap Remix Leftovers on any past meal — the AI invents a new recipe from what\'s left.',
    ],
  },
];

export default function TutorialOverlay({ onComplete, onSkip }) {
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleComplete = async () => {
    setFinishing(true);
    try {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, colors: ['#6BAEE0', '#1F6FB8', '#ffffff'] });
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

  return (
    <div className="fixed inset-0 z-200 flex items-end justify-center p-4 pb-8" style={{ background: 'rgba(15,30,60,0.55)', backdropFilter: 'blur(8px)' }}>
      {/* Tooltip card */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl border border-white/40 overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
        {/* Progress bar */}
        <div className="h-1 bg-blue-50">
          <div
            className="h-full bg-[#6BAEE0] transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-7">
          {/* Emoji + header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{current.emoji}</span>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{step + 1} of {STEPS.length}</p>
                <h2 className="logo-text text-2xl text-[#1F6FB8]">{current.title}</h2>
              </div>
            </div>
            <button onClick={handleSkip} className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Intro hook on first step */}
          {step === 0 && (
            <p className="text-xs font-black text-[#6BAEE0] italic mb-3">Everyone skips tutorials, but you won't want to skip this one. You can do a lot with this app.</p>
          )}

          {/* Bullet lines */}
          <ul className="space-y-2.5 mb-6">
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
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={14} /> Back
            </button>

            {isLast ? (
              <button
                onClick={handleComplete}
                disabled={finishing}
                className="flex items-center gap-2 bg-[#6BAEE0] hover:bg-[#5da0cf] text-white font-black px-6 py-3 rounded-2xl text-sm shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-60"
              >
                <PartyPopper size={15} /> {finishing ? 'Done!' : "Let's Cook!"}
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-2 bg-[#6BAEE0] hover:bg-[#5da0cf] text-white font-black px-6 py-3 rounded-2xl text-sm shadow-lg shadow-blue-100 transition-all active:scale-95"
              >
                Next <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
