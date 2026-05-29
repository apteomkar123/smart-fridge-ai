import React, { useState, useMemo } from 'react';
import { DollarSign, BarChart, ShoppingBag, TrendingDown, PieChart, Target, Sparkles, Loader2, RefreshCw, Star, Plus, Leaf, AlertTriangle, CalendarDays, Edit2 } from 'lucide-react';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';

const MACRO_GOALS = [
  { key: 'protein', label: 'Protein', emoji: '💪', color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200' },
  { key: 'carbs',   label: 'Carbs',   emoji: '🌾', color: 'text-amber-500',  bg: 'bg-amber-50 border-amber-200'  },
  { key: 'fat',     label: 'Fat',     emoji: '🥑', color: 'text-rose-400',   bg: 'bg-rose-50 border-rose-200'    },
  { key: 'all',     label: 'Balance', emoji: '✨', color: 'text-[#6BAEE0]',  bg: 'bg-sky-50 border-sky-200'      },
];

const ECO_RATINGS = [
  { label: 'Green Chef', emoji: '🌿', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', maxRisk: 0 },
  { label: 'Eco Keeper', emoji: '🍃', color: 'text-lime-600 bg-lime-50 border-lime-200',          maxRisk: 2 },
  { label: 'Getting There', emoji: '🌱', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', maxRisk: 4 },
  { label: 'Needs Work',    emoji: '⚠️', color: 'text-orange-500 bg-orange-50 border-orange-200', maxRisk: Infinity },
];

export default function AnalyticsDashboard({ metrics, fridge, shoppingList, onAddShoppingItem }) {
  const { household, userSettings, handleUpdatePersonalBudget, handleUpdateBudgetLimit } = useUser();
  const { onSaveRecipe, onRemoveSavedRecipe, processedRecipes, savedRecipes, setActiveModalRecipe, generateMealPlan, prepLoading, activeMealPlan, setActiveMealPlan, setIsMealPrepOpen, generateRecipeByName, findRecipeByName } = useRecipes();

  const [dashTab, setDashTab] = useState('nutrition');
  const [selectedMacro, setSelectedMacro] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [addedIngredients, setAddedIngredients] = useState(new Set());

  const [isEditingPersonalBudget, setIsEditingPersonalBudget] = useState(false);
  const [personalBudgetInput, setPersonalBudgetInput] = useState('');
  const [isEditingHouseholdBudget, setIsEditingHouseholdBudget] = useState(false);
  const [householdBudgetInput, setHouseholdBudgetInput] = useState('');
  const [starredRecipes, setStarredRecipes] = useState(new Set());
  const [openingRecipe, setOpeningRecipe] = useState(null); // name being generated/opened

  // ── Spending calcs ───────────────────────────────────────────────────────
  const { pantryValue, missingSpend, purchasedSpend, totalListCost, stockEfficiency, budgetLimit, budgetPercent, isOverBudget } = useMemo(() => {
    const pantryValue    = fridge.reduce((sum, item) => sum + (item.price || 0), 0);
    const missingSpend   = shoppingList.filter(i => !i.is_completed).reduce((sum, i) => sum + (i.price || 0), 0);
    const purchasedSpend = shoppingList.filter(i => i.is_completed).reduce((sum, i) => sum + (i.price || 0), 0);
    const totalListCost  = missingSpend + purchasedSpend;
    const totalBudget    = pantryValue + missingSpend;
    const stockEfficiency = totalBudget > 0 ? Math.round((pantryValue / totalBudget) * 100) : 0;
    const budgetLimit    = household?.budget_limit || 0;
    const budgetPercent  = budgetLimit > 0 ? Math.min(100, Math.round((totalListCost / budgetLimit) * 100)) : 0;
    const isOverBudget   = totalListCost > budgetLimit && budgetLimit > 0;
    return { pantryValue, missingSpend, purchasedSpend, totalListCost, stockEfficiency, budgetLimit, budgetPercent, isOverBudget };
  }, [fridge, shoppingList, household?.budget_limit]);

  const totalMacros = (metrics.protein + metrics.carbs + metrics.fat) || 1;
  const getPercent  = (val) => Math.round((val / totalMacros) * 100);

  // ── Eco-Score calcs ──────────────────────────────────────────────────────
  const { expiringItems, expiredItems, atRiskValue, ecoRating, uniqueStores } = useMemo(() => {
    const now = Date.now();
    const expiringItems = [];
    const expiredItems = [];
    fridge.forEach(item => {
      if (!item.expiry_date) return;
      const ts = new Date(item.expiry_date).getTime();
      const diffDays = (ts - now) / (1000 * 60 * 60 * 24);
      if (diffDays < 0) expiredItems.push(item);
      else if (diffDays <= 7) expiringItems.push(item);
    });
    const atRiskValue = expiringItems.reduce((s, i) => s + (i.price || 0), 0);
    const ecoRating = ECO_RATINGS.find(r => expiringItems.length <= r.maxRisk) || ECO_RATINGS[ECO_RATINGS.length - 1];
    const uniqueStores = [...new Set(fridge.map(item => item.storeName).filter(Boolean))];
    return { expiringItems, expiredItems, atRiskValue, ecoRating, uniqueStores };
  }, [fridge]);

  // ── AI Coach ────────────────────────────────────────────────────────────
  const askAiCoach = async (macroKey) => {
    setSelectedMacro(macroKey);
    setAiResult(null);
    setAiLoading(true);
    setAddedIngredients(new Set());
    setStarredRecipes(new Set());

    try {
      const focus = macroKey === 'all'
        ? 'overall nutritional balance'
        : `increasing ${macroKey} intake`;

      const pct = (v) => Math.round((v / totalMacros) * 100);
      // Large random seed + timestamp forces the AI to produce different results every call
      const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const restrictions = userSettings?.dietary_restrictions?.length
        ? `The user has these dietary restrictions: ${userSettings.dietary_restrictions.join(', ')}. ALL suggestions MUST comply strictly — no exceptions.`
        : '';
      const prompt = `[Session:${seed}] A user's current pantry macros: Protein ${metrics.protein || 0}g (${pct(metrics.protein)}%), Carbs ${metrics.carbs || 0}g (${pct(metrics.carbs)}%), Fat ${metrics.fat || 0}g (${pct(metrics.fat)}%). Goal: ${focus}. ${restrictions} Pick 3 FRESH, CREATIVE, UNEXPECTED ingredients AND 2 FRESH, CREATIVE recipes NOT commonly suggested. Avoid generic staples. Return ONLY valid JSON: {"ingredients":[{"name":"...","amount":"...","reason":"under 25 words"}],"recipes":[{"name":"...","reason":"under 25 words"}]}`;

      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true })
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const text = await res.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed.ingredients && !parsed.recipes) throw new Error('Unexpected response');
      setAiResult({
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
        recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
      });
    } catch {
      setAiResult({ ingredients: [], recipes: [], error: true });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddIngredient = (name) => {
    if (onAddShoppingItem) onAddShoppingItem(name);
    setAddedIngredients(prev => new Set([...prev, name]));
  };

  const handleOpenRecipe = async (recipeName) => {
    if (openingRecipe === recipeName) return;
    const match = findRecipeByName ? findRecipeByName(recipeName) : null;
    if (match) { setActiveModalRecipe(match); return; }
    setOpeningRecipe(recipeName);
    try {
      const generated = await generateRecipeByName(recipeName);
      if (generated) setActiveModalRecipe(generated);
    } catch (e) {
      console.error('Could not open recipe:', e);
    } finally {
      setOpeningRecipe(null);
    }
  };

  const handleToggleStar = async (recipeName) => {
    // Check if already saved by name in savedRecipes context
    const alreadySaved = (savedRecipes || []).find(
      sr => sr.recipe_name?.toLowerCase() === recipeName.toLowerCase()
    );
    if (alreadySaved) {
      // Unstar: remove from DB and local tracking
      onRemoveSavedRecipe(alreadySaved.id);
      setStarredRecipes(prev => { const s = new Set(prev); s.delete(recipeName); return s; });
      return;
    }
    // If locally tracked as starred but not yet in savedRecipes (DB hasn't refreshed)
    if (starredRecipes.has(recipeName)) {
      setStarredRecipes(prev => { const s = new Set(prev); s.delete(recipeName); return s; });
      return;
    }
    // Star: find or generate recipe then save
    const match = findRecipeByName ? findRecipeByName(recipeName) : null;
    if (match) {
      onSaveRecipe(match);
      setStarredRecipes(prev => new Set([...prev, recipeName]));
      return;
    }
    setStarredRecipes(prev => new Set([...prev, recipeName])); // optimistic
    try {
      const generated = await generateRecipeByName(recipeName);
      if (generated) onSaveRecipe(generated);
    } catch {
      setStarredRecipes(prev => { const s = new Set(prev); s.delete(recipeName); return s; }); // rollback
    }
  };

  const savePersonalBudget = () => {
    if (handleUpdatePersonalBudget) handleUpdatePersonalBudget(personalBudgetInput);
    setIsEditingPersonalBudget(false);
  };

  const personalBudget = userSettings?.personal_budget_limit || 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Sub-tab switcher ──────────────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-lg rounded-[2rem] border border-white/20 shadow-xl shadow-blue-900/5 p-1.5 flex gap-1">
        <button
          onClick={() => setDashTab('nutrition')}
          className={`flex-1 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${dashTab === 'nutrition' ? 'bg-[#6BAEE0] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <BarChart size={13} /> Nutrition
        </button>
        <button
          onClick={() => setDashTab('spending')}
          className={`flex-1 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${dashTab === 'spending' ? 'bg-[#6BAEE0] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <DollarSign size={13} /> Spending
        </button>
        <button
          onClick={() => setDashTab('taste')}
          className={`flex-1 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${dashTab === 'taste' ? 'bg-[#6BAEE0] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
        >
          🌍 Taste
        </button>
      </div>

      {dashTab === 'nutrition' && <>
      {/* ── Nutritional Overview ──────────────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-6 px-2">
          <BarChart className="text-[#6BAEE0]" size={18} />
          <h2 className="text-[14px] font-bold text-slate-400">Nutritional Overview</h2>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-xs text-slate-500">Protein</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{metrics.protein}g</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-xs text-slate-500">Carbs</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{metrics.carbs}g</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-xs text-slate-500">Fat</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{metrics.fat}g</p>
          </div>
        </div>

        <div className="mt-8 space-y-5 px-2">
          {[
            { label: 'Protein', val: metrics.protein, color: 'bg-[#6BAEE0]', pctColor: 'text-[#6BAEE0]' },
            { label: 'Carbs',   val: metrics.carbs,   color: 'bg-sky-300',   pctColor: 'text-sky-400' },
            { label: 'Fat',     val: metrics.fat,     color: 'bg-blue-200',  pctColor: 'text-blue-300' },
          ].map(({ label, val, color, pctColor }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>{label} Distribution</span>
                <span className={pctColor}>{getPercent(val)}%</span>
              </div>
              <div className="h-3 bg-blue-50/50 rounded-full overflow-hidden border border-blue-100/50">
                <div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${getPercent(val)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Nutrition Coach ────────────────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center justify-between mb-5 px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="text-[#6BAEE0]" size={18} />
            <h2 className="text-[14px] font-bold text-slate-400">AI Nutrition Coach</h2>
          </div>
          {aiResult && (
            <button onClick={() => { setAiResult(null); setSelectedMacro(null); }} className="text-slate-300 hover:text-[#6BAEE0] transition-colors">
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {!selectedMacro && !aiLoading && (
          <>
            <p className="text-xs text-slate-400 mb-4 px-1">What would you like to increase in your diet?</p>
            <div className="grid grid-cols-2 gap-2">
              {MACRO_GOALS.map(({ key, label, emoji, bg }) => (
                <button
                  key={key}
                  onClick={() => askAiCoach(key)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] ${bg}`}
                >
                  <span className="text-base">{emoji}</span> {label}
                </button>
              ))}
            </div>
          </>
        )}

        {aiLoading && (
          <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
            <Loader2 size={18} className="animate-spin text-[#6BAEE0]" />
            <span className="text-xs font-bold">Crafting your plan…</span>
          </div>
        )}

        {aiResult && !aiLoading && (
          <div className="space-y-5">
            {aiResult.error && (
              <p className="text-xs text-slate-400 italic text-center py-4">Could not load recommendations. Tap refresh to try again.</p>
            )}

            {aiResult.ingredients?.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Add to Shopping List</p>
                <div className="space-y-2">
                  {aiResult.ingredients.map((ing, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-700">{ing.name} <span className="font-normal text-slate-400">{ing.amount}</span></p>
                        <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{ing.reason}</p>
                      </div>
                      <button
                        onClick={() => handleAddIngredient(ing.name)}
                        disabled={addedIngredients.has(ing.name)}
                        className={`shrink-0 p-2 rounded-xl transition-all ${addedIngredients.has(ing.name) ? 'bg-emerald-100 text-emerald-500' : 'bg-white border border-blue-100 text-[#6BAEE0] hover:bg-sky-50'}`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiResult.recipes?.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recipe Suggestions</p>
                <div className="space-y-2">
                  {aiResult.recipes.map((rec, i) => {
                    const savedEntry = savedRecipes?.find(sr => sr.recipe_name?.toLowerCase() === rec.name?.toLowerCase());
                    const isSaved = !!savedEntry || starredRecipes.has(rec.name);
                    const isOpening = openingRecipe === rec.name;
                    return (
                      <div key={i} className="flex items-start justify-between gap-3 bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3">
                        <button
                          className="flex-1 min-w-0 text-left"
                          onClick={() => handleOpenRecipe(rec.name)}
                          disabled={isOpening}
                        >
                          <p className="text-xs font-black text-[#6BAEE0] hover:underline flex items-center gap-1.5">
                            {isOpening && <Loader2 size={10} className="animate-spin shrink-0" />}
                            {rec.name}
                          </p>
                          <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{rec.reason}</p>
                        </button>
                        <button
                          onClick={() => handleToggleStar(rec.name)}
                          className={`shrink-0 p-2 rounded-xl transition-all ${isSaved ? 'text-amber-400' : 'bg-white border border-sky-100 text-slate-300 hover:text-amber-400'}`}
                        >
                          <Star size={14} fill={isSaved ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Smart Meal Prep ───────────────────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center justify-between mb-5 px-1">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-[#6BAEE0]" size={18} />
            <h2 className="text-[14px] font-bold text-slate-400">Smart Meal Prep</h2>
          </div>
          {activeMealPlan && !prepLoading && (
            <button onClick={() => setActiveMealPlan(null)} className="text-slate-300 hover:text-[#6BAEE0] transition-colors">
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {!activeMealPlan && !prepLoading && (
          <div className="text-center space-y-4">
            <p className="text-xs text-slate-400 px-2">AI analyses your pantry and groups recipes into efficient weekly prep batches — cook less, eat better.</p>
            <button
              onClick={() => generateMealPlan(fridge.map(i => i.raw_name).filter(Boolean))}
              className="inline-flex items-center gap-2 bg-[#6BAEE0] text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-100 hover:bg-[#5da0cf] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles size={14} /> Generate Weekly Plan
            </button>
          </div>
        )}

        {prepLoading && (
          <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
            <Loader2 size={18} className="animate-spin text-[#6BAEE0]" />
            <span className="text-xs font-bold">Building your prep plan…</span>
          </div>
        )}

        {activeMealPlan && !prepLoading && (
          <div className="space-y-3">
            <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-[#6BAEE0]">{activeMealPlan.batches?.length || 0} Batch{activeMealPlan.batches?.length !== 1 ? 'es' : ''} Ready</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Your weekly prep plan is ready to view.</p>
              </div>
              <button
                onClick={() => setIsMealPrepOpen(true)}
                className="bg-[#6BAEE0] text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm hover:bg-[#5da0cf] transition-all"
              >
                View Plan
              </button>
            </div>
          </div>
        )}
      </section>
      </>}

      {dashTab === 'spending' && <>
      {/* ── Eco-Score & Waste Analytics ───────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-5 px-1">
          <Leaf className="text-emerald-500" size={18} />
          <h2 className="text-[14px] font-bold text-slate-400">Eco-Score & Waste</h2>
        </div>

        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Rating</p>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black ${ecoRating.color}`}>
              {ecoRating.emoji} {ecoRating.label}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">At Risk Value</p>
            <p className="text-xl font-black text-orange-400">${atRiskValue.toFixed(2)}</p>
          </div>
        </div>

        {expiringItems.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={10} className="text-orange-400" /> Expiring Within 7 Days</p>
            {expiringItems.map((item, i) => {
              const daysLeft = Math.ceil((new Date(item.expiry_date) - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <div key={i} className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-2xl px-4 py-2.5">
                  <span className="text-xs font-bold text-slate-700">{item.raw_name}</span>
                  <div className="flex items-center gap-2">
                    {item.price > 0 && <span className="text-[10px] text-emerald-500 font-bold">${Number(item.price).toFixed(2)}</span>}
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${daysLeft <= 1 ? 'bg-red-100 text-red-500' : 'bg-orange-100 text-orange-500'}`}>
                      {daysLeft === 0 ? 'Today!' : `${daysLeft}d`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
            <p className="text-xs font-bold text-emerald-600">Nothing expiring soon — great job!</p>
          </div>
        )}

        {expiredItems.length > 0 && (
          <div className="mt-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold text-red-500">{expiredItems.length} item{expiredItems.length !== 1 ? 's' : ''} already expired</span>
            <span className="text-xs font-black text-red-400">${expiredItems.reduce((s,i) => s+(i.price||0),0).toFixed(2)} lost</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="bg-blue-50 rounded-2xl p-3 border border-blue-100">
            <p className="text-base font-black text-[#6BAEE0]">{fridge.length}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Items</p>
          </div>
          <div className="bg-orange-50 rounded-2xl p-3 border border-orange-100">
            <p className="text-base font-black text-orange-400">{expiringItems.length}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Expiring Soon</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100">
            <p className="text-base font-black text-emerald-500">{fridge.length - expiringItems.length - expiredItems.length}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Freshness OK</p>
          </div>
        </div>
      </section>

      {/* ── Spending Breakdown ────────────────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-6 px-2">
          <PieChart className="text-[#6BAEE0]" size={18} />
          <h2 className="text-[14px] font-bold text-slate-400">Spending Breakdown</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg text-emerald-500 shadow-sm"><TrendingDown size={16} /></div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Inventory Value</p>
                  <p className="text-lg font-bold text-slate-700">${pantryValue.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">In Stock</p>
            </div>
            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg text-amber-500 shadow-sm"><ShoppingBag size={16} /></div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Projected Spend</p>
                  <p className="text-lg font-bold text-slate-700">${missingSpend.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">Missing</p>
            </div>
          </div>

          <div className="flex flex-col justify-center bg-sky-50/30 p-6 rounded-[2rem] border border-sky-100/50 text-center relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-sky-100 opacity-20"><DollarSign size={80} /></div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Stock Efficiency</p>
            <p className="text-4xl font-black text-[#6BAEE0]">{stockEfficiency}%</p>
            <p className="text-[11px] text-slate-500 mt-2 px-4 leading-tight">Percentage of your total grocery budget sitting in your pantry.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center mt-6">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
            <DollarSign size={24} className="text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">Total List Cost</p>
            <p className={`text-xl font-bold ${isOverBudget ? 'text-red-400' : 'text-[#6BAEE0]'}`}>${totalListCost.toFixed(2)}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center">
            <ShoppingBag size={24} className="text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">Stores Shopped</p>
            <p className="text-xl font-bold text-[#6BAEE0]">{uniqueStores.length}</p>
          </div>
        </div>

        {budgetLimit > 0 && (
          <div className="mt-8 px-2 space-y-3">
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-2">
                <Target size={14} className={isOverBudget ? 'text-red-400' : 'text-slate-400'} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Budget Progress</span>
              </div>
              <span className={`text-[10px] font-black ${isOverBudget ? 'text-red-400' : 'text-[#6BAEE0]'}`}>
                ${totalListCost.toFixed(2)} / ${budgetLimit.toFixed(2)}
              </span>
            </div>
            <div className="h-4 bg-blue-50/50 rounded-full overflow-hidden border border-blue-100/50">
              <div className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${isOverBudget ? 'bg-red-400' : 'bg-[#6BAEE0]'}`} style={{ width: `${budgetPercent}%` }} />
            </div>
            {isOverBudget && <p className="text-[9px] font-bold text-red-400 text-center animate-pulse italic">Warning: You have exceeded your budget limit!</p>}
          </div>
        )}

        {uniqueStores.length > 0 && (
          <p className="mt-4 text-center text-xs text-slate-400">Tracked stores: {uniqueStores.join(', ')}</p>
        )}
      </section>

      {/* ── Personal Monthly Budget ───────────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <Target className="text-[#6BAEE0]" size={18} />
            <h2 className="text-[14px] font-bold text-slate-400">Personal Monthly Budget</h2>
          </div>
          <button
            onClick={() => { setIsEditingPersonalBudget(v => !v); setPersonalBudgetInput(String(personalBudget)); }}
            className="p-2 bg-blue-50 text-[#6BAEE0] rounded-xl hover:bg-sky-100 transition-all"
          >
            <Edit2 size={15} />
          </button>
        </div>

        <div className="mb-4">
          <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">My Monthly Budget</p>
            {personalBudget > 0
              ? <p className="text-2xl font-black text-[#6BAEE0]">${personalBudget.toFixed(2)}<span className="text-sm font-bold text-slate-400">/mo</span></p>
              : <p className="text-sm font-bold text-slate-300 italic">Not set — tap edit to add</p>}
          </div>
        </div>

        {isEditingPersonalBudget && (
          <div className="flex gap-2 animate-in slide-in-from-top-2 duration-300 mb-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={personalBudgetInput}
                onChange={(e) => setPersonalBudgetInput(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-blue-100 pl-7 pr-4 py-3 rounded-2xl text-xs font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
              />
            </div>
            <button
              onClick={savePersonalBudget}
              className="bg-[#6BAEE0] text-white px-5 py-3 rounded-2xl text-xs font-black shadow-md shadow-blue-100 hover:bg-[#5da0cf] transition-all"
            >
              Save
            </button>
          </div>
        )}

        {false && (
          <div className="flex gap-2 animate-in slide-in-from-top-2 duration-300">
            {/* Household budget moved to Household tab */}
            <button
              onClick={() => { handleUpdateBudgetLimit(householdBudgetInput); setIsEditingHouseholdBudget(false); }}
              className="bg-[#6BAEE0] text-white px-5 py-3 rounded-2xl text-xs font-black shadow-md shadow-blue-100 hover:bg-[#5da0cf] transition-all"
            >
              Save
            </button>
          </div>
        )}
      </section>
      </>}

      {dashTab === 'taste' && (() => {
        // Build cuisine + meal-type stats from chef history
        const history = (() => { try { return JSON.parse(localStorage.getItem('hungry_chef_history') || '[]'); } catch { return []; } })();
        const cuisineCounts = {};
        const mealTypeCounts = {};
        history.forEach(e => {
          const c = (e.cuisine || '').trim();
          const m = (e.meal_type || '').trim();
          if (c) cuisineCounts[c] = (cuisineCounts[c] || 0) + 1;
          if (m) mealTypeCounts[m] = (mealTypeCounts[m] || 0) + 1;
        });
        const topCuisines = Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1]);
        const topMealTypes = Object.entries(mealTypeCounts).sort((a, b) => b[1] - a[1]);
        const maxCuisine = topCuisines[0]?.[1] || 1;
        const CUISINE_EMOJIS = { Indian: '🇮🇳', Chinese: '🇨🇳', Mexican: '🇲🇽', Japanese: '🇯🇵', Korean: '🇰🇷', Italian: '🇮🇹', French: '🇫🇷', American: '🇺🇸', Thai: '🇹🇭', Mediterranean: '🫒', African: '🌍', Caribbean: '🌴', Vietnamese: '🇻🇳', Greek: '🇬🇷', Spanish: '🇪🇸' };
        const masteryMsg = (count) => count >= 10 ? '🏆 Master Chef' : count >= 5 ? '⭐ Expert' : count >= 3 ? '👨‍🍳 Explorer' : '🌱 Beginner';
        return (
          <div className="space-y-5">
            <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
              <h3 className="text-[14px] font-bold text-slate-400 mb-5 flex items-center gap-2">🌍 Taste Profile</h3>
              {history.length === 0 ? (
                <p className="text-xs text-slate-300 italic text-center py-4">Cook some recipes to build your taste profile!</p>
              ) : (
                <div className="space-y-5">
                  {topCuisines.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cuisines Explored</p>
                      <div className="space-y-3">
                        {topCuisines.map(([cuisine, count]) => (
                          <div key={cuisine}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-slate-600">{CUISINE_EMOJIS[cuisine] || '🍽️'} {cuisine}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400">{masteryMsg(count)}</span>
                                <span className="text-[10px] font-black text-[#6BAEE0]">{count}x</span>
                              </div>
                            </div>
                            <div className="h-2 bg-blue-50 rounded-full overflow-hidden">
                              <div className="h-full bg-[#6BAEE0] rounded-full transition-all duration-700" style={{ width: `${Math.round((count / maxCuisine) * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {topMealTypes.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Meal Types</p>
                      <div className="flex flex-wrap gap-2">
                        {topMealTypes.map(([type, count]) => (
                          <span key={type} className="bg-sky-50 border border-sky-100 text-[#6BAEE0] px-3 py-1.5 rounded-full text-[10px] font-black">
                            {type} <span className="opacity-60">×{count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                    <p className="text-xs font-black text-amber-700">
                      {topCuisines.length === 0
                        ? '🌱 Start cooking to unlock your taste profile!'
                        : topCuisines.length >= 5
                          ? `🌍 World Traveler! You've explored ${topCuisines.length} cuisines. Keep going!`
                          : topCuisines[0][1] >= 5
                            ? `🏆 ${topCuisines[0][0]} master! Try a new cuisine to expand your palate.`
                            : `👨‍🍳 You've explored ${topCuisines.length} cuisine${topCuisines.length > 1 ? 's' : ''}. Cook more to unlock mastery badges!`}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-blue-50 rounded-2xl p-3">
                      <p className="text-xl font-black text-[#6BAEE0]">{history.length}</p>
                      <p className="text-[9px] text-slate-400 font-bold">Dishes Cooked</p>
                    </div>
                    <div className="bg-emerald-50 rounded-2xl p-3">
                      <p className="text-xl font-black text-emerald-500">{topCuisines.length}</p>
                      <p className="text-[9px] text-slate-400 font-bold">Cuisines</p>
                    </div>
                    <div className="bg-violet-50 rounded-2xl p-3">
                      <p className="text-xl font-black text-violet-500">{topMealTypes.length}</p>
                      <p className="text-[9px] text-slate-400 font-bold">Meal Types</p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        );
      })()}

    </div>
  );
}
