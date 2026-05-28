import React, { useState, useMemo } from 'react';
import { X, Share2, Play, RefreshCw, Plus } from 'lucide-react';
import { useRecipes } from './RecipeContext';
import { parseRecipeIngredientMeasurements, cleanIngredientLocally, estimateNutrition } from './recipeUtils';

export default function RecipeModal({ onStartCooking, addedItems, onAddIngredient }) {
  const {
    activeModalRecipe: recipe, 
    multiplier, 
    setMultiplier, 
    setActiveModalRecipe: setModal 
  } = useRecipes();

  const [substitutes, setSubstitutes] = useState({});
  const [loadingSub, setLoadingSub] = useState(null);

  // Estimate total nutrition for the recipe (per serving, ~4 servings assumed)
  const recipeNutrition = useMemo(() => {
    const ings = recipe.cleanedIngredients || [];
    if (ings.length === 0) return null;
    let totalKcal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, matched = 0;
    ings.forEach(ing => {
      const n = estimateNutrition(ing);
      if (n) {
        totalKcal += n.kcal;
        totalProtein += n.protein;
        totalCarbs += n.carbs;
        totalFat += n.fat;
        matched++;
      }
    });
    if (matched === 0) return null;
    const servings = 4 * multiplier;
    return {
      kcal: Math.round(totalKcal / servings),
      protein: Math.round((totalProtein / servings) * 10) / 10,
      carbs: Math.round((totalCarbs / servings) * 10) / 10,
      fat: Math.round((totalFat / servings) * 10) / 10,
      coverage: Math.round((matched / ings.length) * 100)
    };
  }, [recipe.cleanedIngredients, multiplier]);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}?recipe=${recipe.id}`;

    const shareData = {
      title: `Hungry: ${recipe.name}`,
      text: `I found this amazing ${recipe.name} recipe on Hungry!`,
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
          customPrompt: `Suggest a common vegetarian substitute for "${ingredient}" in a recipe.`
        })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${response.status}`);
      }
      const text = await response.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      let parsed = {};
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        parsed = {};
      }

      const subValue = (
        parsed.substitute ||
        parsed.substituteName ||
        parsed.recipeName ||
        parsed.replacement ||
        parsed.answer ||
        (typeof parsed === 'string' ? parsed : '') ||
        cleaned
      ).toString().trim();

      if (subValue) {
        setSubstitutes(prev => ({ ...prev, [ingredient]: subValue }));
      } else {
        alert('Could not find a substitute. Please try again.');
      }
    } catch (err) {
      console.error('Swap failed:', err);
      alert('Could not find a substitute. Please try again.');
    }
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
            <button onClick={() => setModal(null)} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="space-y-4">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ingredients</h4>
            <div className="space-y-3">
              {(recipe.ingredients || []).map((ing, idx) => (
                <div key={idx} className="flex flex-col border-b border-blue-50 pb-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700">{substitutes[ing] || parseRecipeIngredientMeasurements(ing, multiplier)}</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => getSubstitution(ing)}
                        className="text-[10px] text-sky-400 hover:text-[#6BAEE0]"
                        disabled={loadingSub === ing}
                      >
                        <RefreshCw size={12} className={loadingSub === ing ? 'animate-spin' : ''} />
                      </button>
                      {!addedItems?.has(cleanIngredientLocally(ing)) && (
                        <button onClick={() => onAddIngredient(cleanIngredientLocally(ing))} className="bg-sky-50 text-[#6BAEE0] p-1 rounded-md"><Plus size={12} /></button>
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
              {(recipe.steps || []).map((step, idx) => (
                <div key={idx} className="flex gap-3">
                  <span className="w-6 h-6 bg-blue-50 text-[#6BAEE0] rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {recipeNutrition && (
          <div className="mt-6 bg-sky-50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Nutrition per Serving</p>
              <span className="text-[9px] font-bold text-sky-400 bg-sky-100 px-2 py-0.5 rounded-full">~{recipeNutrition.coverage}% coverage</span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div><p className="text-base font-black text-[#6BAEE0]">{recipeNutrition.kcal}</p><p className="text-[9px] text-slate-400">kcal</p></div>
              <div><p className="text-base font-black text-emerald-500">{recipeNutrition.protein}g</p><p className="text-[9px] text-slate-400">protein</p></div>
              <div><p className="text-base font-black text-amber-500">{recipeNutrition.carbs}g</p><p className="text-[9px] text-slate-400">carbs</p></div>
              <div><p className="text-base font-black text-rose-500">{recipeNutrition.fat}g</p><p className="text-[9px] text-slate-400">fat</p></div>
            </div>
          </div>
        )}

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