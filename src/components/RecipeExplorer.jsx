import React, { useMemo, useState } from 'react';
import { Filter, Star, Users } from 'lucide-react';
import { useRecipes } from './RecipeContext';
import { useUser } from './UserContext';
import SearchWithHistory from './SearchWithHistory';

export default function RecipeExplorer() {
  const [shareMenuId, setShareMenuId] = useState(null);
  const { households } = useUser();
  const {
    processedRecipes: recipes,
    recipeSearch,
    setRecipeSearch,
    categoryFilters,
    setCategoryFilters,
    dietFilters: activeDietFilters,
    setDietFilters,
    cuisineFilters: activeCuisineFilters,
    setCuisineFilters,
    setActiveModalRecipe: onOpenRecipe,
    onSaveRecipe,
    onRemoveSavedRecipe,
    savedRecipes
  } = useRecipes();
  const mealTypeOptions = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'];
  const dietOptions = ['vegetarian', 'vegan', 'meat', 'fish'];
  const cuisineOptions = ['indian', 'chinese', 'mexican', 'japanese', 'korean', 'jamaican', 'latin', 'african', 'mediterranean'];

  const toggleFilter = (setter) => (f) =>
    setter(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  // If the search text exactly matches a known filter keyword, apply the filter
  // instead of passing it through as a text search
  const handleSearchChange = (value) => {
    const lower = value.toLowerCase().trim();
    // Apply filter chip AND keep the text visible in the search box
    if (mealTypeOptions.includes(lower)) {
      setCategoryFilters(prev => prev.includes(lower) ? prev : [...prev, lower]);
    } else if (dietOptions.includes(lower)) {
      setDietFilters(prev => prev.includes(lower) ? prev : [...prev, lower]);
    } else if (cuisineOptions.includes(lower)) {
      setCuisineFilters(prev => prev.includes(lower) ? prev : [...prev, lower]);
    }
    setRecipeSearch(value);
  };

  // Map<recipe_id_string → saved_record_pk_id> built once when savedRecipes changes
  const savedRecipesMap = useMemo(
    () => new Map((savedRecipes || []).map(sr => [sr.recipe_id, sr.id])),
    [savedRecipes]
  );

  const closeShareMenu = () => setShareMenuId(null);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Search & Filter Header */}
      <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="mb-6">
          <SearchWithHistory
            value={recipeSearch}
            onChange={handleSearchChange}
            placeholder="Search recipes, ingredients, or type a filter…"
            namespace="recipes"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setCategoryFilters([])} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${categoryFilters.length === 0 ? 'bg-[#6BAEE0] text-white shadow-lg shadow-blue-100' : 'bg-white text-slate-400 border border-blue-50 hover:border-sky-200'}`}>all</button>
          {mealTypeOptions.map((f) => (
            <button key={f} onClick={() => toggleFilter(setCategoryFilters)(f)} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${categoryFilters.includes(f) ? 'bg-[#6BAEE0] text-white shadow-lg shadow-blue-100' : 'bg-white text-slate-400 border border-blue-50 hover:border-sky-200'}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mt-2">
          {dietOptions.map((f) => (
            <button key={f} onClick={() => toggleFilter(setDietFilters)(f)} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeDietFilters.includes(f) ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-white text-slate-400 border border-blue-50 hover:border-emerald-200'}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mt-2">
          {cuisineOptions.map((f) => (
            <button key={f} onClick={() => toggleFilter(setCuisineFilters)(f)} className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeCuisineFilters.includes(f) ? 'bg-slate-700 text-white shadow-lg' : 'bg-white text-slate-400 border border-blue-50 hover:border-slate-300'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {recipes.length === 0 && (categoryFilters.length > 0 || activeDietFilters.length > 0 || activeCuisineFilters.length > 0) ? (
          <div className="col-span-full bg-white/80 border border-blue-100 p-8 rounded-[2rem] text-center text-slate-500">
            No recipes found for this filter.
          </div>
        ) : recipes.slice(0, 48).map((recipe) => (
          <div key={recipe.id} className="bg-white/80 backdrop-blur-md border border-white/40 p-5 rounded-[2rem] shadow-lg shadow-blue-900/5 group hover:scale-[1.02] transition-all cursor-pointer" onClick={() => onOpenRecipe(recipe)}>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex gap-1 flex-wrap">
                  <span className="text-[8px] font-mono font-black text-slate-400 uppercase bg-blue-50/50 px-2 py-1 rounded-md">{recipe.meal_type}</span>
                  {recipe.cuisine && <span className="text-[8px] font-mono font-black text-[#6BAEE0] uppercase bg-sky-50 px-2 py-1 rounded-md">{recipe.cuisine}</span>}
                </div>
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
              <div className="flex items-center gap-2">
                {/* Share to household — only shown when user has households */}
                {households?.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShareMenuId(shareMenuId === recipe.id ? null : recipe.id); }}
                      className="text-slate-300 hover:text-[#6BAEE0] transition-colors"
                      title="Share to household"
                    >
                      <Users size={15} />
                    </button>
                    {shareMenuId === recipe.id && (
                      <div className="absolute right-0 bottom-7 bg-white border border-blue-100 rounded-2xl shadow-xl z-20 min-w-[160px] p-2 space-y-1">
                        {households.map(h => (
                          <button
                            key={h.id}
                            onClick={(e) => { e.stopPropagation(); onSaveRecipe(recipe, h.id); setShareMenuId(null); }}
                            className="w-full text-left text-xs font-bold text-slate-600 px-3 py-2 rounded-xl hover:bg-sky-50 hover:text-[#6BAEE0] transition-all flex items-center gap-2"
                          >
                            <Users size={11} /> {h.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const pkId = savedRecipesMap.get(String(recipe.id));
                    if (pkId) onRemoveSavedRecipe(pkId);
                    else onSaveRecipe(recipe);
                  }}
                  className={`transition-colors ${savedRecipesMap.has(String(recipe.id)) ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
                >
                  <Star size={18} fill={savedRecipesMap.has(String(recipe.id)) ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}