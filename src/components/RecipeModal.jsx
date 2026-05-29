import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Share2, Play, RefreshCw, Plus, Star, Refrigerator, Check, Wand2, Loader2, RotateCcw, Dumbbell, ChefHat, ShoppingCart, Users, ChevronDown } from 'lucide-react';
import { useRecipes } from './RecipeContext';
import { useUser } from './UserContext';
import { parseRecipeIngredientMeasurements, cleanIngredientLocally, normalizeIngredientTokens, fuzzyTokenMatch, stripIngredientNotes, estimateNutrition, isRecipeMeat, isRecipeFish, isRecipeVegan, matchesRecipeFilter, locallyAdaptRecipe } from './recipeUtils';

// Returns true if pantryQty (count) satisfies the needed amount from a recipe ingredient string
const _pantryHasEnough = (ingredient, pantryQty) => {
  if (!ingredient) return false;
  const match = ingredient.match(/^([0-9\/\.\s\-½⅓¼¾⅛]+)/);
  if (!match) return pantryQty >= 1;
  let needed = parseFloat(match[1]);
  if (isNaN(needed)) {
    if (match[1].includes('½')) needed = 0.5;
    else if (match[1].includes('¼')) needed = 0.25;
    else if (match[1].includes('¾')) needed = 0.75;
    else needed = 1;
  }
  return pantryQty >= Math.ceil(needed);
};

export default function RecipeModal({ onStartCooking, addedItems, onAddIngredient, onAddToPantry, onMarkCooked }) {
  const {
    activeModalRecipe: recipe,
    multiplier,
    setMultiplier,
    setActiveModalRecipe: setModal,
    savedRecipes,
    onSaveRecipe,
    onRemoveSavedRecipe,
    adaptRecipe,
    proteinizeRecipe,
    fridge,
  } = useRecipes();

  const { userSettings, households } = useUser();
  const [showHouseholdMenu, setShowHouseholdMenu] = useState(false);
  const starBtnRef = useRef(null);

  // Reset all local state when a new recipe is opened
  const [pantryAdded, setPantryAdded] = useState(new Set());
  const [adaptedRecipe, setAdaptedRecipe] = useState(null);
  const [adapting, setAdapting] = useState(null); // null | 'vegetarian' | 'vegan' | 'meat' | restriction string
  const [substitutes, setSubstitutes] = useState({});
  const [loadingSub, setLoadingSub] = useState(null);
  const [proteinResult, setProteinResult] = useState(null); // {updatedRecipe, proteinIngredient, proteinAdded}
  const [proteinizing, setProteinizing] = useState(false);
  const [cooked, setCooked] = useState(false);
  const [pantryOverrides, setPantryOverrides] = useState({}); // {ingredientKey: true|false} user manual overrides
  useEffect(() => {
    setAdaptedRecipe(null);
    setAdapting(null);
    setPantryAdded(new Set());
    setSubstitutes({});
    setProteinResult(null);
    setCooked(false);
    setPantryOverrides({});
  }, [recipe?.id]);

  const violatedRestrictions = useMemo(() => {
    const restrictions = userSettings?.dietary_restrictions || [];
    return restrictions.filter(r => !matchesRecipeFilter(recipe, r.toLowerCase()));
  }, [recipe, userSettings]);

  // Auto-conversion: computed synchronously during render — no timing issues.
  // Uses session-storage cache keyed by recipe+restriction so it only runs once per combo.
  const autoAdaptedRecipe = useMemo(() => {
    if (!recipe?.id || violatedRestrictions.length === 0) return null;
    const restriction = violatedRestrictions[0].toLowerCase();
    const cacheKey = `_adapted_${recipe.id}_${restriction}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
    const adapted = locallyAdaptRecipe(recipe, restriction);
    try { sessionStorage.setItem(cacheKey, JSON.stringify(adapted)); } catch {}
    return adapted;
  }, [recipe, violatedRestrictions]);

  const displayRecipe = proteinResult?.updatedRecipe || adaptedRecipe || autoAdaptedRecipe || recipe;

  const hasMeat = useMemo(() => isRecipeMeat(recipe), [recipe]);
  const hasFish = useMemo(() => isRecipeFish(recipe), [recipe]);
  const isVeg = useMemo(() => !hasMeat && !hasFish, [hasMeat, hasFish]);

  const handleAdapt = async (targetDiet) => {
    setAdapting(targetDiet);
    try {
      const cacheKey = `_adapted_${recipe.id}_${targetDiet}`;
      // Apply local substitution immediately for instant feedback
      const localResult = locallyAdaptRecipe(recipe, targetDiet);
      setAdaptedRecipe(localResult);
      // Then try AI for a richer, more contextual adaptation in the background
      adaptRecipe(recipe, targetDiet).then(aiResult => {
        setAdaptedRecipe(aiResult);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(aiResult)); } catch {}
      }).catch(() => {
        // AI failed — keep the local result, save it
        try { sessionStorage.setItem(cacheKey, JSON.stringify(localResult)); } catch {}
      });
    } catch (e) {
      alert('Could not adapt recipe. Please try again.');
    } finally {
      setAdapting(null);
    }
  };

  const handleProteinize = async () => {
    setProteinizing(true);
    try {
      const result = await proteinizeRecipe(displayRecipe);
      setProteinResult(result);
    } catch (e) {
      alert('Could not proteinize recipe. Please try again.');
    } finally {
      setProteinizing(false);
    }
  };

  // Build both an exact set AND a token set for fuzzy matching
  const pantryItemsSet = useMemo(
    () => new Set((fridge || []).map(f => cleanIngredientLocally(f.raw_name || f.item_name || ''))),
    [fridge]
  );
  const pantryTokenSet = useMemo(
    () => new Set((fridge || []).flatMap(f => normalizeIngredientTokens(f.raw_name || f.item_name || ''))),
    [fridge]
  );
  // Require ALL significant tokens (len>2) to match pantry — prevents "garlic clove" matching "garlic powder"
  const _baseIsInPantry = (cleaned) => {
    if (!cleaned) return false;
    if (pantryItemsSet.has(cleaned)) return true;
    const tokens = normalizeIngredientTokens(cleaned).filter(t => t.length > 2);
    if (!tokens.length) return false;
    if (tokens.length === 1) return fuzzyTokenMatch(tokens[0], pantryTokenSet);
    return tokens.every(t => fuzzyTokenMatch(t, pantryTokenSet));
  };
  const isInPantry = (cleaned, overrideKey) => {
    if (pantryOverrides[overrideKey] !== undefined) return pantryOverrides[overrideKey];
    return _baseIsInPantry(cleaned);
  };

  const handleAddToPantry = (ing) => {
    const cleaned = cleanIngredientLocally(ing);
    onAddToPantry(cleaned);
    setPantryAdded(prev => { const s = new Set(prev); s.add(ing); return s; });
  };

  const savedEntry = useMemo(
    () => (savedRecipes || []).find(sr => sr.recipe_id === String(recipe?.id)),
    [savedRecipes, recipe?.id]
  );

  const handleToggleStar = (e) => {
    e.stopPropagation();
    if (savedEntry) {
      onRemoveSavedRecipe(savedEntry.id);
    } else if (households?.length > 0) {
      setShowHouseholdMenu(prev => !prev);
    } else {
      onSaveRecipe(recipe);
    }
  };

  const handleAddAllMissing = () => {
    const missing = (displayRecipe.ingredients || []).filter((ing, idx) => {
      const overrideKey = `${idx}:${ing}`;
      const cleaned = cleanIngredientLocally(stripIngredientNotes(ing));
      return !isInPantry(cleaned, overrideKey);
    });
    missing.forEach(ing => {
      const cleaned = cleanIngredientLocally(stripIngredientNotes(ing));
      if (cleaned && !addedItems?.has(cleaned)) onAddIngredient(cleaned);
    });
  };

  // Estimate total nutrition for the recipe (per serving, ~4 servings assumed)
  const recipeNutrition = useMemo(() => {
    const ings = displayRecipe.cleanedIngredients || [];
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
    const proteinDeltaPerServing = proteinResult ? Math.round((proteinResult.proteinAdded / (4 * multiplier)) * 10) / 10 : 0;
    return {
      kcal: Math.round(totalKcal / servings),
      protein: Math.round((totalProtein / servings + proteinDeltaPerServing) * 10) / 10,
      carbs: Math.round((totalCarbs / servings) * 10) / 10,
      fat: Math.round((totalFat / servings) * 10) / 10,
      coverage: Math.round((matched / ings.length) * 100),
      proteinDelta: proteinDeltaPerServing,
    };
  }, [displayRecipe.cleanedIngredients, multiplier, proteinResult]);

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
    <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-center justify-center p-4 z-[60] overflow-y-auto">
      <div className="bg-white/90 backdrop-blur-2xl p-8 rounded-[3rem] shadow-2xl border border-white/50 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Auto-adapting spinner */}
        {adapting?.startsWith('auto_') && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Loader2 size={14} className="animate-spin text-amber-500 shrink-0" />
            <p className="text-[11px] font-bold text-amber-700">
              Adapting recipe for your {adapting.replace('auto_', '')} preference…
            </p>
          </div>
        )}

        {/* Adapted recipe banner */}
        {(adaptedRecipe || autoAdaptedRecipe) && !adapting && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold text-emerald-700">
              {autoAdaptedRecipe && !adaptedRecipe
                ? `Auto-adapted for your ${autoAdaptedRecipe._adaptedFor} preference`
                : `Adapted for ${displayRecipe._adaptedFor}`}
            </p>
            {adaptedRecipe && (
              <button onClick={() => setAdaptedRecipe(null)} className="shrink-0 text-[10px] font-black text-emerald-600 flex items-center gap-1 hover:underline">
                <RotateCcw size={11} /> Revert to original
              </button>
            )}
          </div>
        )}

        {/* Proteinized banner */}
        {proteinResult && (
          <div className="mb-4 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold text-violet-700">
              💪 +{Math.round(proteinResult.proteinAdded / 4)}g protein/serving via {proteinResult.proteinIngredient}
            </p>
            <button onClick={() => setProteinResult(null)} className="shrink-0 text-[10px] font-black text-violet-600 flex items-center gap-1 hover:underline">
              <RotateCcw size={11} /> Revert
            </button>
          </div>
        )}

        <div className="flex justify-between items-start border-b border-blue-50 pb-5 mb-6">
          <div>
            <span className="bg-sky-50 text-[#6BAEE0] font-mono text-[9px] px-3 py-1 rounded-full uppercase font-black tracking-widest border border-sky-100">{displayRecipe.meal_type}</span>
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter mt-2">{displayRecipe.name}</h3>
          </div>
          <div className="flex gap-2 items-start">
            <div className="relative" ref={starBtnRef}>
              <button
                onClick={handleToggleStar}
                className={`p-3 border rounded-2xl transition-colors ${savedEntry ? 'bg-amber-50 border-amber-200 text-amber-400' : 'bg-white border-blue-100 text-slate-300 hover:text-amber-400 hover:border-amber-200'}`}
              >
                <Star size={20} fill={savedEntry ? 'currentColor' : 'none'} />
              </button>
              {showHouseholdMenu && !savedEntry && (
                <div className="absolute right-0 top-14 bg-white border border-blue-100 rounded-2xl shadow-xl z-20 min-w-[180px] p-2 space-y-1">
                  <button
                    onClick={() => { onSaveRecipe(recipe); setShowHouseholdMenu(false); }}
                    className="w-full text-left text-xs font-bold text-slate-600 px-3 py-2 rounded-xl hover:bg-sky-50 hover:text-[#6BAEE0] transition-all flex items-center gap-2"
                  >
                    <Star size={12} /> My Saved Recipes
                  </button>
                  {households.map(h => (
                    <button
                      key={h.id}
                      onClick={() => { onSaveRecipe(recipe, h.id); setShowHouseholdMenu(false); }}
                      className="w-full text-left text-xs font-bold text-slate-600 px-3 py-2 rounded-xl hover:bg-sky-50 hover:text-[#6BAEE0] transition-all flex items-center gap-2"
                    >
                      <Users size={12} /> {h.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleShare} className="p-3 bg-white border border-blue-100 rounded-2xl text-[#6BAEE0] hover:bg-sky-50 transition-colors"><Share2 size={20} /></button>
            <button onClick={() => setModal(null)} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
          </div>
        </div>

        {onAddIngredient && (
          <button
            onClick={handleAddAllMissing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-sky-50 text-[#6BAEE0] border border-sky-200 hover:bg-sky-100 active:scale-95 transition-all mb-6"
          >
            <ShoppingCart size={16} /> Add All Missing to Shopping List
          </button>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="space-y-4">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ingredients</h4>
            <div className="space-y-3">
              {(displayRecipe.ingredients || []).map((ing, idx) => {
                const overrideKey = `${idx}:${ing}`;
                const cleaned = cleanIngredientLocally(stripIngredientNotes(ing));
                const inPantry = isInPantry(cleaned, overrideKey);
                const fridgeItem = inPantry && pantryOverrides[overrideKey] !== false
                  ? (fridge || []).find(f => {
                      const fc = cleanIngredientLocally(f.raw_name || f.item_name || '');
                      return fc === cleaned || normalizeIngredientTokens(fc).some(t => fuzzyTokenMatch(t, new Set(normalizeIngredientTokens(cleaned))));
                    })
                  : null;
                const qty = fridgeItem?.quantity || (inPantry ? 1 : 0);
                const hasEnough = inPantry && _pantryHasEnough(ing, qty * multiplier);
                // Fix plus button: use cleaned+stripped name for addedItems check
                const cleanedForShop = cleanIngredientLocally(stripIngredientNotes(ing));
                return (
                  <div key={idx} className="flex flex-col border-b border-blue-50 pb-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Pantry check dot — clickable to toggle */}
                        <button
                          onClick={() => setPantryOverrides(prev => ({
                            ...prev,
                            [overrideKey]: prev[overrideKey] !== undefined ? undefined : !inPantry
                          }))}
                          className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-all ${inPantry ? (hasEnough ? 'bg-emerald-100 text-emerald-500' : 'bg-amber-100 text-amber-500') : 'bg-slate-100 text-slate-300'}`}
                          title={inPantry ? (pantryOverrides[overrideKey] !== undefined ? 'Click to reset' : 'Click to uncheck') : 'Not in pantry — click to mark as available'}
                        >
                          {inPantry && <Check size={9} />}
                        </button>
                        <span className="text-xs font-bold text-slate-700">{substitutes[ing] || parseRecipeIngredientMeasurements(ing, multiplier)}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => getSubstitution(ing)}
                          className="text-[10px] text-sky-400 hover:text-[#6BAEE0]"
                          disabled={loadingSub === ing}
                        >
                          <RefreshCw size={12} className={loadingSub === ing ? 'animate-spin' : ''} />
                        </button>
                        {!addedItems?.has(cleanedForShop) && !inPantry && (
                          <button onClick={() => onAddIngredient(cleanedForShop)} className="bg-sky-50 text-[#6BAEE0] p-1 rounded-md" title="Add to shopping list"><Plus size={12} /></button>
                        )}
                        {onAddToPantry && (
                          pantryAdded.has(ing) || inPantry ? (
                            <span className="bg-emerald-50 text-emerald-400 p-1 rounded-md"><Check size={12} /></span>
                          ) : (
                            <button onClick={() => handleAddToPantry(ing)} className="bg-emerald-50 text-emerald-500 p-1 rounded-md hover:bg-emerald-100 transition-colors" title="Add to pantry"><Refrigerator size={12} /></button>
                          )
                        )}
                      </div>
                    </div>
                    {substitutes[ing] && <span className="text-[10px] text-[#6BAEE0] italic">Swapped for {ing}</span>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Procedure</h4>
            <div className="space-y-4">
              {(displayRecipe.steps || []).map((step, idx) => (
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
              <div>
                <p className="text-base font-black text-emerald-500">{recipeNutrition.protein}g</p>
                {recipeNutrition.proteinDelta > 0 && <p className="text-[9px] font-bold text-violet-500">+{recipeNutrition.proteinDelta}g</p>}
                <p className="text-[9px] text-slate-400">protein</p>
              </div>
              <div><p className="text-base font-black text-amber-500">{recipeNutrition.carbs}g</p><p className="text-[9px] text-slate-400">carbs</p></div>
              <div><p className="text-base font-black text-rose-500">{recipeNutrition.fat}g</p><p className="text-[9px] text-slate-400">fat</p></div>
            </div>
          </div>
        )}

        {/* Convert + Proteinize buttons */}
        <div className="mt-6 flex flex-wrap gap-2">
          {(hasMeat || hasFish) && (
            <button onClick={() => handleAdapt('vegetarian')} disabled={adapting !== null}
              className="flex items-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50">
              {adapting === 'vegetarian' ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
              Make Vegetarian
            </button>
          )}
          {(hasMeat || hasFish) && !isRecipeVegan(recipe) && (
            <button onClick={() => handleAdapt('vegan')} disabled={adapting !== null}
              className="flex items-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50">
              {adapting === 'vegan' ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
              Make Vegan
            </button>
          )}
          {isVeg && (
            <button onClick={() => handleAdapt('meat')} disabled={adapting !== null}
              className="flex items-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl bg-rose-50 text-rose-500 border border-rose-200 hover:bg-rose-100 transition-colors disabled:opacity-50">
              {adapting === 'meat' ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
              Add Meat
            </button>
          )}
          {!proteinResult && (
            <button onClick={handleProteinize} disabled={proteinizing || adapting !== null}
              className="flex items-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 transition-colors disabled:opacity-50">
              {proteinizing ? <Loader2 size={11} className="animate-spin" /> : <Dumbbell size={11} />}
              Proteinize
            </button>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-blue-50 space-y-3">
          <div className="flex justify-between items-center">
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
          {onMarkCooked && (
            <button
              onClick={() => { if (!cooked) { onMarkCooked(displayRecipe); setCooked(true); } }}
              disabled={cooked}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all ${cooked ? 'bg-emerald-100 text-emerald-500 cursor-default' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 active:scale-95'}`}
            >
              <ChefHat size={17} /> {cooked ? '✓ Cooked! Pantry updated' : 'Cooked!'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}