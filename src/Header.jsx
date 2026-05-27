import React from 'react';
import { LogOut, Sparkles, ShoppingBag } from 'lucide-react';

// Subtle Haptic Feedback utility
const triggerHaptic = (intensity = 10) => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(intensity);
  }
};

export default function Header({ user, handleGenerateAiRecipe, triggerStoreTripPlanner, handleSignOut }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-blue-100 sticky top-0 z-40 px-6 py-4 flex justify-between items-center w-full shadow-sm">
      <div className="flex items-center gap-3">
        {/* Logo Badge matching apple-touch-logo.png */}
        <div className="w-10 h-10 bg-[#6BAEE0] rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 shrink-0 fade-in-up">
          <span className="logo-text text-2xl text-white pt-1 select-none">H</span>
        </div>
        <div className="flex flex-col">
          <h1 className="logo-text text-2xl bg-[#6BAEE0] bg-clip-text text-transparent leading-none">Hungry</h1>
          <p className="text-slate-500 text-[10px] font-bold mt-0.5">{greeting}, <span className="text-[#6BAEE0]">{user.email.split('@')[0]}!</span></p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => { triggerHaptic(); handleGenerateAiRecipe(); }} className="bg-sky-50 text-[#6BAEE0] p-2.5 rounded-xl hover:bg-sky-100 transition-colors">
          <Sparkles size={20} />
        </button>
        <button onClick={() => { triggerHaptic(); triggerStoreTripPlanner(); }} className="bg-sky-50 text-[#6BAEE0] p-2.5 rounded-xl hover:bg-sky-100 transition-colors">
          <ShoppingBag size={20} />
        </button>
        <button onClick={() => { triggerHaptic(20); handleSignOut(); }} className="text-red-400 p-2.5 rounded-xl hover:bg-red-50 transition-colors"><LogOut size={20} /></button>
      </div>
    </header>
  );
}