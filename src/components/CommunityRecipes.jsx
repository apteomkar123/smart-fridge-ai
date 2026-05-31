import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2, X, Globe, ChevronLeft, ArrowRight } from 'lucide-react';
import { useRecipes } from './RecipeContext';
import { useUser } from './UserContext';
import { toTitleCase, locallyAdaptRecipe, matchesRecipeFilter } from './recipeUtils';

const MEALDB = 'https://www.themealdb.com/api/json/v1/1';

const CATEGORY_ROWS = [
  { key: 'trending',   label: '🔥 Trending Now',      endpoint: '/filter.php?c=Chicken',       dietType: 'meat'    },
  { key: 'healthy',    label: '🥗 Healthy & Light',    endpoint: '/filter.php?c=Vegetarian',    dietType: 'veg'     },
  { key: 'comfort',    label: '🍲 Comfort Food',       endpoint: '/filter.php?c=Pasta',         dietType: 'neutral' },
  { key: 'breakfast',  label: '☀️ Breakfast',           endpoint: '/filter.php?c=Breakfast',     dietType: 'neutral' },
  { key: 'seafood',    label: '🦞 Seafood',             endpoint: '/filter.php?c=Seafood',       dietType: 'fish'    },
  { key: 'dessert',    label: '🍰 Desserts',            endpoint: '/filter.php?c=Dessert',       dietType: 'neutral' },
  { key: 'beef',       label: '🥩 Beef & Steak',       endpoint: '/filter.php?c=Beef',          dietType: 'meat'    },
  { key: 'asian',      label: '🍜 Asian Flavors',      endpoint: '/filter.php?a=Chinese',       dietType: 'neutral' },
  { key: 'indian',     label: '🇮🇳 Indian Cuisine',    endpoint: '/filter.php?a=Indian',        dietType: 'neutral' },
  { key: 'mexican',    label: '🇲🇽 Mexican',            endpoint: '/filter.php?a=Mexican',       dietType: 'neutral' },
  { key: 'italian',    label: '🇮🇹 Italian',            endpoint: '/filter.php?a=Italian',       dietType: 'neutral' },
  { key: 'american',   label: '🇺🇸 American',           endpoint: '/filter.php?a=American',      dietType: 'neutral' },
  { key: 'highprot',   label: '💪 High Protein',       endpoint: '/filter.php?c=Chicken',       dietType: 'meat'    },
  { key: 'quick',      label: '⚡ Quick & Easy',        endpoint: '/filter.php?c=Miscellaneous', dietType: 'neutral' },
];

const CACHE_KEY = 'hungry_community_';
const SCROLL_LIMIT = 8;

function MealCard({ meal, onOpen }) {
  return (
    <button
      onClick={() => onOpen(meal.idMeal)}
      className="shrink-0 w-36 text-left group"
    >
      <div className="w-36 h-36 rounded-3xl overflow-hidden bg-slate-100 mb-2 shadow-md group-hover:shadow-lg transition-all">
        <img
          src={meal.strMealThumb}
          alt={meal.strMeal}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
      <p className="text-xs font-bold text-slate-700 line-clamp-2 leading-tight group-hover:text-[#6BAEE0] transition-colors">
        {toTitleCase(meal.strMeal)}
      </p>
    </button>
  );
}

function CategoryRow({ row, onOpen, onViewAll }) {
  const [meals, setMeals] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const cacheKey = CACHE_KEY + row.key;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached && Date.now() - cached.ts < 6 * 3600_000) { setMeals(cached.data); setLoaded(true); return; }
    } catch {}
    fetch(`${MEALDB}${row.endpoint}`)
      .then(r => r.json())
      .then(d => {
        const list = (d.meals || []).slice(0, 20);
        setMeals(list);
        setLoaded(true);
        try { localStorage.setItem(cacheKey, JSON.stringify({ data: list, ts: Date.now() })); } catch {}
      })
      .catch(() => setLoaded(true));
  }, [row.key, row.endpoint]);

  if (loaded && meals.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="text-sm font-black text-slate-700 px-1 mb-3">{row.label}</p>
      {!loaded ? (
        <div className="flex gap-3">
          {[0, 1, 2, 3].map(i => <div key={i} className="shrink-0 w-36 h-36 rounded-3xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {meals.slice(0, SCROLL_LIMIT).map(m => <MealCard key={m.idMeal} meal={m} onOpen={onOpen} />)}
          {meals.length > SCROLL_LIMIT && (
            <button
              onClick={() => onViewAll(row, meals)}
              className="shrink-0 w-28 h-36 rounded-3xl bg-violet-50 border border-violet-100 flex flex-col items-center justify-center gap-2 hover:bg-violet-100 transition-all group"
            >
              <ArrowRight size={20} className="text-violet-400 group-hover:translate-x-1 transition-transform" />
              <span className="text-[10px] font-black text-violet-500">View More</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryFullPage({ row, meals, onOpen, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] bg-blue-50/95 backdrop-blur-xl overflow-y-auto">
      <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-blue-100 px-5 py-4 flex items-center gap-3 z-10">
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-base font-black text-slate-800">{row.label}</h2>
      </div>
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {meals.map(m => (
          <button key={m.idMeal} onClick={() => { onOpen(m.idMeal); onClose(); }} className="text-left group">
            <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 mb-2">
              <img src={m.strMealThumb} alt={m.strMeal} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            </div>
            <p className="text-xs font-bold text-slate-700 line-clamp-2 group-hover:text-[#6BAEE0] transition-colors">{toTitleCase(m.strMeal)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CommunityRecipes() {
  const { setActiveModalRecipe } = useRecipes();
  const { userSettings } = useUser();
  const dietaryRestrictions = userSettings?.dietary_restrictions || [];
  const isVegan = dietaryRestrictions.some(r => r.toLowerCase() === 'vegan');
  const isVegetarian = isVegan || dietaryRestrictions.some(r => r.toLowerCase() === 'vegetarian');
  const noFish = isVegan || isVegetarian;

  const visibleRows = CATEGORY_ROWS.filter(row => {
    if (row.dietType === 'meat' && isVegetarian) return false;
    if (row.dietType === 'fish' && noFish) return false;
    return true;
  });

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);
  const [fullPageCategory, setFullPageCategory] = useState(null); // { row, meals }

  const openMeal = useCallback(async (idMeal) => {
    try {
      const res = await fetch(`${MEALDB}/lookup.php?i=${idMeal}`);
      const d = await res.json();
      const m = d.meals?.[0];
      if (!m) return;
      const ings = [];
      for (let i = 1; i <= 20; i++) {
        const ing = m[`strIngredient${i}`];
        const meas = m[`strMeasure${i}`];
        if (ing && ing.trim()) ings.push(`${meas?.trim() || ''} ${ing.trim()}`.trim());
      }
      const rawInstr = (m.strInstructions || '').replace(/\r\n?/g, '\n');
      let steps = rawInstr.split(/\n+/).map(s => s.trim().replace(/^(?:step\s*)?\d+[\.\:\)]\s*/i, '').trim()).filter(s => s.length > 8);
      // If only one long block, split by sentence boundaries
      if (steps.length <= 1 && rawInstr.length > 200) {
        const sentences = rawInstr.replace(/([.!?])\s+(?=[A-Z])/g, '$1\n').split(/\n+/).map(s => s.trim()).filter(s => s.length > 8);
        if (sentences.length > 1) steps = sentences;
      }
      let recipe = {
        id: `mealdb-${m.idMeal}`,
        name: toTitleCase(m.strMeal),
        meal_type: m.strCategory || 'General',
        cuisine: m.strArea || '',
        image: m.strMealThumb || '',
        ingredients: ings,
        cleanedIngredients: ings,
        steps,
      };
      // Apply dietary adaptations based on the user's restrictions
      for (const restriction of dietaryRestrictions) {
        const key = restriction.toLowerCase();
        if (!matchesRecipeFilter(recipe, key)) {
          recipe = locallyAdaptRecipe(recipe, key);
        }
      }
      setActiveModalRecipe(recipe);
    } catch {}
  }, [setActiveModalRecipe, dietaryRestrictions]);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await fetch(`${MEALDB}/search.php?s=${encodeURIComponent(q)}`);
      const d = await res.json();
      setSearchResults(d.meals || []);
    } catch { setSearchResults([]); }
    setSearching(false);
  }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search, doSearch]);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header + search */}
      <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={18} className="text-[#6BAEE0]" />
          <h2 className="text-[14px] font-bold text-slate-400">Community Recipes</h2>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search any recipe…"
            className="w-full bg-slate-50 border border-slate-100 pl-10 pr-10 py-3 rounded-2xl text-sm font-semibold text-slate-800 focus:border-sky-400 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {search ? (
        <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl">
          {searching ? (
            <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-[#6BAEE0]" /></div>
          ) : searchResults && searchResults.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">No recipes found for "{search}"</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {(searchResults || []).map(m => (
                <button key={m.idMeal} onClick={() => openMeal(m.idMeal)} className="text-left group">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 mb-2">
                    <img src={m.strMealThumb} alt={m.strMeal} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 line-clamp-2 group-hover:text-[#6BAEE0] transition-colors">{toTitleCase(m.strMeal)}</p>
                  {m.strCategory && <p className="text-[9px] text-slate-400 font-mono mt-0.5">{m.strCategory}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Category rows */
        <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl">
          {visibleRows.map(row => (
            <CategoryRow key={row.key} row={row} onOpen={openMeal} onViewAll={(r, meals) => setFullPageCategory({ row: r, meals })} />
          ))}
        </div>
      )}

      {fullPageCategory && (
        <CategoryFullPage
          row={fullPageCategory.row}
          meals={fullPageCategory.meals}
          onOpen={openMeal}
          onClose={() => setFullPageCategory(null)}
        />
      )}
    </div>
  );
}
