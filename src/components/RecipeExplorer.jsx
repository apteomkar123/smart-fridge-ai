import React from 'react';
import { Search, Filter, Star } from 'lucide-react';
import { useRecipes } from './RecipeContext';

export default function RecipeExplorer() {
  const { 
    processedRecipes: recipes, 
    recipeSearch, 
    setRecipeSearch, 
    activeFilter, 
    setFilter, 
    setActiveModalRecipe: onOpenRecipe, 
    onSaveRecipe,
    onRemoveSavedRecipe,
    savedRecipes
  } = useRecipes();
  const filters = ['all', 'breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'vegetarian', 'vegan'];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Search & Filter Header */}
      <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search ingredients or recipes..." 
            value={recipeSearch}
            onChange={(e) => setRecipeSearch(e.target.value)}
            className="w-full bg-blue-50/50 border border-blue-100 pl-12 pr-6 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none transition-all"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeFilter === f ? 'bg-[#6BAEE0] text-white shadow-lg shadow-blue-100' : 'bg-white text-slate-400 border border-blue-50 hover:border-sky-200'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {recipes.length === 0 ? (
          <div className="col-span-full bg-white/80 border border-blue-100 p-8 rounded-[2rem] text-center text-slate-500">
            No recipe matches yet. Add pantry items to see suggestions based on what you have.
          </div>
        ) : recipes.slice(0, 24).map((recipe) => (
          <div key={recipe.id} className="bg-white/80 backdrop-blur-md border border-white/40 p-5 rounded-[2rem] shadow-lg shadow-blue-900/5 group hover:scale-[1.02] transition-all cursor-pointer" onClick={() => onOpenRecipe(recipe)}>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <span className="text-[8px] font-mono font-black text-slate-400 uppercase bg-blue-50/50 px-2 py-1 rounded-md">{recipe.meal_type}</span>
                <h3 className="text-sm font-bold text-slate-700 mt-2 line-clamp-2 leading-tight group-hover:text-[#6BAEE0] transition-colors">{recipe.name}</h3>
              </div>
              <div className="bg-sky-50 text-[#6BAEE0] px-3 py-1.5 rounded-full text-[10px] font-black font-mono shadow-sm">
                {recipe.matchPercentage}%
              </div>
            </div>
            <div className="mt-6 flex justify-between items-center">
              <div className="h-1.5 flex-1 bg-blue-50 rounded-full overflow-hidden mr-4">
                <div className="h-full bg-[#6BAEE0]/60 rounded-full transition-all duration-1000" style={{ width: `${recipe.matchPercentage}%` }} />
              </div>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const savedRecord = savedRecipes?.find(sr => sr.recipe_id === String(recipe.id));
                  if (savedRecord) {
                    onRemoveSavedRecipe(savedRecord.id);
                  } else {
                    onSaveRecipe(recipe);
                  }
                }} 
                className={`transition-colors ${savedRecipes?.some(sr => sr.recipe_id === String(recipe.id)) ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
              >
                <Star size={18} fill={savedRecipes?.some(sr => sr.recipe_id === String(recipe.id)) ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}