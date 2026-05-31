import React, { useState } from 'react';
import { X, Plus, Minus, Link, Loader2, Check, Globe, Lock, Users, User } from 'lucide-react';
import { useRecipes } from './RecipeContext';
import { useUser } from './UserContext';
import { cleanIngredientLocally, toTitleCase } from './recipeUtils';

export default function AddRecipeModal({ onClose }) {
  const { onSaveRecipe } = useRecipes();
  const { households } = useUser();
  const [mode, setMode] = useState('manual'); // 'manual' | 'url'
  const [url, setUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [saved, setSaved] = useState(false);

  // Visibility + destination
  const [isPublic, setIsPublic] = useState(true);
  const [destination, setDestination] = useState('personal'); // 'personal' | household id

  // Manual form state
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState('Main');
  const [cuisine, setCuisine] = useState('');
  const [ingredients, setIngredients] = useState(['', '', '']);
  const [steps, setSteps] = useState(['', '']);

  const addIngredientRow = () => setIngredients(p => [...p, '']);
  const removeIngredientRow = (i) => setIngredients(p => p.filter((_, idx) => idx !== i));
  const setIngredientAt = (i, v) => setIngredients(p => p.map((x, idx) => idx === i ? v : x));

  const addStepRow = () => setSteps(p => [...p, '']);
  const removeStepRow = (i) => setSteps(p => p.filter((_, idx) => idx !== i));
  const setStepAt = (i, v) => setSteps(p => p.map((x, idx) => idx === i ? v : x));

  const handleSaveManual = async () => {
    if (!name.trim()) return;
    const filteredIngs = ingredients.filter(i => i.trim());
    const filteredSteps = steps.filter(s => s.trim());
    const householdId = destination !== 'personal' ? destination : null;
    const recipe = {
      id: `manual-${Date.now()}`,
      name: toTitleCase(name.trim()),
      meal_type: mealType,
      cuisine,
      ingredients: filteredIngs.map(i => toTitleCase(i)),
      cleanedIngredients: filteredIngs.map(cleanIngredientLocally).filter(Boolean),
      steps: filteredSteps,
      _userCreated: true,
      _isPublic: isPublic,
      _householdId: householdId,
    };
    await onSaveRecipe(recipe, householdId);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  };

  const handleParseUrl = async () => {
    if (!url.trim()) return;
    setUrlLoading(true);
    setUrlError('');
    try {
      const prompt = `Parse the recipe from this URL: ${url.trim()}. Fetch the page and extract the recipe. Return ONLY valid JSON: {"recipeName":"string","meal_type":"string","cuisine":"string","ingredients":["string"],"steps":["string"]}. Extract 6-20 ingredients and 4-10 steps. If you cannot access the URL, return {"error":"cannot access"}.`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status} — try pasting the recipe manually.`);
      const text = await res.text();
      // Guard against HTML error pages
      if (text.trim().startsWith('<')) throw new Error('The AI could not fetch this URL. Try copying the recipe text and using the manual form instead.');
      let parsed;
      try { parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim()); }
      catch { throw new Error('Could not read the response. The URL may be behind a login wall.'); }
      if (parsed.error || !parsed.recipeName) throw new Error('Could not extract a recipe from this URL. Try adding it manually.');
      setName(parsed.recipeName || '');
      setMealType(parsed.meal_type || 'Main');
      setCuisine(parsed.cuisine || '');
      setIngredients(Array.isArray(parsed.ingredients) && parsed.ingredients.length ? parsed.ingredients : ['']);
      setSteps(Array.isArray(parsed.steps) && parsed.steps.length ? parsed.steps : ['']);
      setMode('manual'); // switch to form to let user review/edit
    } catch (e) {
      setUrlError(e.message || 'Could not parse recipe. Try another URL or add manually.');
    } finally {
      setUrlLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-center justify-center p-4 z-[80] overflow-y-auto">
      <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-[2.5rem] shadow-2xl border border-white/50 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-slate-800 tracking-tighter">Add Recipe</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 bg-blue-50/50 p-1 rounded-2xl border border-blue-100 mb-5">
          {['manual', 'url'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${mode === m ? 'bg-white text-[#6BAEE0] shadow-sm' : 'text-slate-400'}`}>
              {m === 'url' ? <Link size={12} /> : <Plus size={12} />}
              {m === 'manual' ? 'Type Manually' : 'Paste URL'}
            </button>
          ))}
        </div>

        {/* URL mode */}
        {mode === 'url' && (
          <div className="space-y-3">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.allrecipes.com/..."
              className="w-full bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
            />
            {urlError && <p className="text-xs text-red-400 px-1">{urlError}</p>}
            <button
              onClick={handleParseUrl}
              disabled={urlLoading || !url.trim()}
              className="w-full bg-[#6BAEE0] text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-100"
            >
              {urlLoading ? <><Loader2 size={16} className="animate-spin" /> Parsing…</> : 'Parse Recipe from URL'}
            </button>
          </div>
        )}

        {/* Manual form */}
        {mode === 'manual' && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipe Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chicken Tikka Masala"
                className="w-full mt-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meal Type</label>
                <select value={mealType} onChange={e => setMealType(e.target.value)}
                  className="w-full mt-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm text-slate-800 focus:border-sky-400 focus:outline-none">
                  {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Main', 'Side', 'Appetizer'].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cuisine</label>
                <input type="text" value={cuisine} onChange={e => setCuisine(e.target.value)} placeholder="e.g. Indian"
                  className="w-full mt-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm text-slate-800 focus:border-sky-400 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingredients</label>
              <div className="mt-1 space-y-2">
                {ingredients.map((ing, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" value={ing} onChange={e => setIngredientAt(i, e.target.value)}
                      placeholder={`Ingredient ${i + 1} (e.g. 2 cups flour)`}
                      className="flex-1 bg-blue-50/50 border border-blue-100 px-4 py-2.5 rounded-2xl text-sm text-slate-800 focus:border-sky-400 focus:outline-none" />
                    {ingredients.length > 1 && (
                      <button onClick={() => removeIngredientRow(i)} className="text-slate-300 hover:text-red-400 transition-colors p-1">
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addIngredientRow} className="flex items-center gap-1 text-[11px] font-black text-[#6BAEE0] hover:underline px-1">
                  <Plus size={12} /> Add ingredient
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Steps</label>
              <div className="mt-1 space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="w-5 h-5 mt-2 bg-blue-50 text-[#6BAEE0] rounded-lg flex items-center justify-center text-[9px] font-black shrink-0">{i + 1}</span>
                    <textarea value={step} onChange={e => setStepAt(i, e.target.value)} rows={2}
                      placeholder={`Step ${i + 1}…`}
                      className="flex-1 bg-blue-50/50 border border-blue-100 px-4 py-2.5 rounded-2xl text-sm text-slate-800 focus:border-sky-400 focus:outline-none resize-none" />
                    {steps.length > 1 && (
                      <button onClick={() => removeStepRow(i)} className="text-slate-300 hover:text-red-400 transition-colors p-1 mt-2">
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addStepRow} className="flex items-center gap-1 text-[11px] font-black text-[#6BAEE0] hover:underline px-1">
                  <Plus size={12} /> Add step
                </button>
              </div>
            </div>

            {/* Visibility */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setIsPublic(true)}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl border text-xs font-black transition-all ${isPublic ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-400 border-blue-100'}`}>
                <Globe size={13} /> Public
              </button>
              <button type="button" onClick={() => setIsPublic(false)}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl border text-xs font-black transition-all ${!isPublic ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white text-slate-400 border-blue-100'}`}>
                <Lock size={13} /> Private
              </button>
            </div>

            {/* Destination */}
            {households.length > 0 && (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Save To</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <button type="button" onClick={() => setDestination('personal')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border transition-all ${destination === 'personal' ? 'bg-sky-50 text-[#6BAEE0] border-sky-200' : 'bg-white text-slate-400 border-blue-100'}`}>
                    <User size={12} /> Personal
                  </button>
                  {households.map(h => (
                    <button key={h.id} type="button" onClick={() => setDestination(h.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border transition-all ${destination === h.id ? 'bg-sky-50 text-[#6BAEE0] border-sky-200' : 'bg-white text-slate-400 border-blue-100'}`}>
                      <Users size={12} /> {h.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleSaveManual}
              disabled={!name.trim() || saved}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-100 ${saved ? 'bg-emerald-500 text-white' : 'bg-[#6BAEE0] text-white hover:bg-[#5da0cf] disabled:opacity-40'}`}
            >
              {saved ? <><Check size={16} /> Saved!</> : 'Save Recipe'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
