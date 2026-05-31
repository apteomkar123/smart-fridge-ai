import React, { useState } from 'react';
import { LogOut, Sparkles, ShoppingBag, Loader2 } from 'lucide-react';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';

export default function Header({ scrollToTop, onOpenNav }) {
  const { user, userName, avatarUrl, hungryAvatarUrl, handleSignOut } = useUser();
  const { setIsAiPickerOpen, triggerStoreTripPlanner, aiGenerating } = useRecipes();
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  });
  const displayName = userName || user?.email?.split('@')[0] || 'Chef';
  const photo = hungryAvatarUrl || avatarUrl;

  return (
    <header className="bg-white border border-blue-100 rounded-[2.5rem] sticky top-4 mx-4 z-40 px-6 py-4 flex justify-between items-center w-[calc(100%-2rem)] max-w-6xl shadow-lg shadow-slate-200 backdrop-blur-xl">
      <button
        onClick={() => { scrollToTop?.(); onOpenNav?.(); }}
        className="flex items-center gap-3 text-left active:opacity-70 transition-opacity"
      >
        {photo
          ? <img src={photo} alt="" className="w-9 h-9 rounded-xl object-cover border border-blue-100 shrink-0" />
          : <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-sm font-black text-[#6BAEE0]">{displayName.slice(0,1).toUpperCase()}</div>
        }
        <div className="flex flex-col">
          <h1 className="logo-text leading-none" style={{ fontSize: '1.4rem' }}>Hungry</h1>
          <p className="text-slate-500 text-[11px] font-bold mt-1 leading-none">{greeting}, <span className="text-[#1F6FB8]">{displayName}</span>!</p>
        </div>
      </button>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsAiPickerOpen(true)}
          disabled={aiGenerating}
          title="Generate AI Recipe"
          className="bg-sky-50 text-[#6BAEE0] p-2.5 rounded-xl hover:bg-sky-100 transition-colors disabled:opacity-60"
        >
          {aiGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
        </button>
        <button onClick={triggerStoreTripPlanner} title="Shopping Suggestions" className="bg-sky-50 text-[#6BAEE0] p-2.5 rounded-xl hover:bg-sky-100 transition-colors">
          <ShoppingBag size={20} />
        </button>
        <button onClick={handleSignOut} className="text-red-400 p-2.5 rounded-xl hover:bg-red-50 transition-colors"><LogOut size={20} /></button>
      </div>
    </header>
  );
}