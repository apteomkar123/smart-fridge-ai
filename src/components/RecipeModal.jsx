import React, { useState } from 'react';
import { X, Share2, Play, RefreshCw, Plus } from 'lucide-react';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';
import { formatIngredientMeasurement } from './recipeUtils';

export default function RecipeModal({ onStartCooking, addedItems, onAddIngredient }) {
  const { household } = useUser();
  const { 
    activeModalRecipe: recipe, 
    multiplier, 
    setMultiplier, 
    setActiveModalRecipe: onClose 
  } = useRecipes();

  const [substitutes, setSubstitutes] = useState({});
  const [loadingSub, setLoadingSub] = useState(null);

  const handleShare = async () => {
    const householdParam = household?.id ? `&hh=${household.id}` : '';
    const shareUrl = `${window.location.origin}?recipe=${recipe.id}${householdParam}`;

    const shareData = {
      title: `Hungry: ${recipe.name}`,
      text: household?.name 
        ? `Check out this ${recipe.name} recipe from our ${household.name} kitchen!` 
        : `I found this amazing ${recipe.name} recipe on Hungry!`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("Unique recipe link copied to clipboard!");
      }
    } catch (err) { console.error(err); }
  };

  const getSubstitution = async (ingredient) => {
    setLoadingSub(ingredient);
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customPrompt: `Suggest a common vegetarian substitute for "${ingredient}" in the context of a recipe. Return ONLY the name of the substitute.` 
        })
      });
      const data = await response.json();
      setSubstitutes(prev => ({ ...prev, [ingredient]: data.recipeName || "Try another swap" }));
    } catch (err) { console.error(err); }
    setLoadingSub(null);
  };

  return (
    <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white/90 backdrop-blur-2xl p-8 rounded-[3rem] shadow-2xl border border-white/50 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start border-b border-blue-50 pb-5 mb-6">
          <div>
            <span className="bg-sky-50 text-[#6BAEE0] font-mono text-[9px] px-3 py-1 rounded-full uppercase font-black tracking-widest border border-sky-100">{recipe.meal_type}</span>
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter mt-2">{recipe.name}</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={handleShare} className="p-3 bg-white border border-blue-100 rounded-2xl text-[#6BAEE0] hover:bg-sky-50 transition-colors"><Share2 size={20} /></button>
            <button onClick={onClose} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="space-y-4">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ingredients</h4>
            <div className="space-y-3">
              {recipe.ingredients.map((ing, idx) => (
                <div key={idx} className="flex flex-col border-b border-blue-50 pb-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">{substitutes[ing] || ing}</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => getSubstitution(ing)}
                        className="text-[10px] text-sky-400 hover:text-[#6BAEE0]"
                        disabled={loadingSub === ing}
                      >
                        <RefreshCw size={12} className={loadingSub === ing ? 'animate-spin' : ''} />
                      </button>
                      {!addedItems.has(ing) && (
                        <button onClick={() => onAddIngredient(ing)} className="bg-sky-50 text-[#6BAEE0] p-1 rounded-md"><Plus size={12} /></button>
                      )}
                    </div>
                  </div>
                  {substitutes[ing] && <span className="text-[10px] text-[#6BAEE0] italic">Swapped for {ing}</span>}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Procedure</h4>
            <div className="space-y-4">
              {recipe.steps.map((step, idx) => (
                <div key={idx} className="flex gap-3">
                  <span className="w-6 h-6 bg-blue-50 text-[#6BAEE0] rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-blue-50 flex justify-between items-center">
          <div className="flex gap-1 bg-blue-50/50 p-1 rounded-2xl border border-blue-100">
            {[1, 2, 4].map(n => (
              <button key={n} onClick={() => setMultiplier(n)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${multiplier === n ? 'bg-white text-[#6BAEE0] shadow-sm' : 'text-slate-400'}`}>{n}x</button>
            ))}
          </div>
          <button 
            onClick={onStartCooking}
            className="bg-[#6BAEE0] text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-all"
          >
            <Play size={18} fill="currentColor" /> Start Cooking
          </button>
        </div>
      </div>
    </div>
  );
}