import React from 'react';
import { LogOut, Sparkles, ShoppingBag } from 'lucide-react';
import { useUser } from './UserContext';

import { useRecipes } from './RecipeContext';

export default function Header() {
  const { user, userName, handleSignOut } = useUser();
  const { handleGenerateAiRecipe, triggerStoreTripPlanner } = useRecipes();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <header className="bg-white border border-blue-100 rounded-[2.5rem] sticky top-4 mx-4 z-40 px-6 py-5 flex justify-between items-center w-[calc(100%-2rem)] max-w-6xl shadow-lg shadow-slate-200 backdrop-blur-xl">
      <div>
        <h1 className="logo-text text-3xl font-black text-[#1F6FB8]">Hungry</h1>
        <p className="text-slate-500 text-[11px] font-bold mt-0.5">{greeting}, <span className="text-[#1F6FB8]">{userName || user.email.split('@')[0]}</span>!</p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleGenerateAiRecipe} className="bg-sky-50 text-[#6BAEE0] p-2.5 rounded-xl hover:bg-sky-100 transition-colors">
          <Sparkles size={20} />
        </button>
        <button onClick={triggerStoreTripPlanner} className="bg-sky-50 text-[#6BAEE0] p-2.5 rounded-xl hover:bg-sky-100 transition-colors">
          <ShoppingBag size={20} />
        </button>
        <button onClick={handleSignOut} className="text-red-400 p-2.5 rounded-xl hover:bg-red-50 transition-colors"><LogOut size={20} /></button>
      </div>
    </header>
  );
}