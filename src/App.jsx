import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [fridge, setFridge] = useState([]);
  const [masterRecipes, setMasterRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualItem, setManualItem] = useState('');
  
  // Custom interactive tracking states
  const [recipeSearch, setRecipeSearch] = useState('');
  const [shoppingAlerts, setShoppingAlerts] = useState([]);
  const [isStoreAlertOpen, setIsStoreAlertOpen] = useState(false);

  const fetchAppData = async () => {
    let { data: inventory } = await supabase.from('fridge_inventory').select('item_name');
    const currentFridge = inventory ? inventory.map(i => i.item_name.toLowerCase().trim()) : [];
    setFridge(currentFridge);

    let { data: recipes } = await supabase.from('recipes').select('*');
    setMasterRecipes(recipes || []);
  };

  useEffect(() => {
    fetchAppData();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    
    reader.onloadend = async () => {
      try {
        const response = await fetch('/.netlify/functions/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: reader.result
        });

        if (response.ok) {
          const data = await response.json();
          const insertPayload = data.added.map(item => ({ item_name: item.trim() }));
          await supabase.from('fridge_inventory').upsert(insertPayload, { onConflict: 'item_name' });
          await fetchAppData();
        } else {
          alert("Parsing verification failure.");
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
  };

  const handleAddManualItem = async (e) => {
    e.preventDefault();
    if (!manualItem.trim()) return;

    await supabase.from('fridge_inventory').upsert([{ item_name: manualItem.trim() }], { onConflict: 'item_name' });
    setManualItem('');
    await fetchAppData();
  };

  // Feature: Calculate missing ingredient targets before shopping trips
  const triggerStoreTripPlanner = () => {
    const alerts = [];
    masterRecipes.forEach(recipe => {
      const missing = recipe.ingredients.filter(ing => 
        !fridge.includes(ing.toLowerCase().trim())
      );
      // Look for dishes requiring only 1 or 2 more target items from the store
      if (missing.length >= 1 && missing.length <= 2) {
        alerts.push({
          recipeName: recipe.name,
          missingItems: missing,
          mealType: recipe.meal_type
        });
      }
    });
    setShoppingAlerts(alerts);
    setIsStoreAlertOpen(true);
  };

  // Feature: Calculate continuous ingredient matching match ratios
  const processedRecipes = masterRecipes.map(recipe => {
    const totalIngredients = recipe.ingredients.length;
    const itemsWeHave = recipe.ingredients.filter(ing => 
      fridge.includes(ing.toLowerCase().trim())
    );
    const matchPercentage = totalIngredients > 0 
      ? Math.round((itemsWeHave.length / totalIngredients) * 100) 
      : 0;

    return {
      ...recipe,
      matchPercentage,
      ownedCount: itemsWeHave.length,
      totalCount: totalIngredients
    };
  }).filter(recipe => {
    if (!recipeSearch) return true;
    return recipe.name.toLowerCase().includes(recipeSearch.toLowerCase()) ||
           recipe.ingredients.some(i => i.toLowerCase().includes(recipeSearch.toLowerCase()));
  }).sort((a, b) => b.matchPercentage - a.matchPercentage); // Sort by match ratio

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-300">
      {/* Dynamic Navigation Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 backdrop-blur-md bg-white/95 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent tracking-tight">SmartFridge AI</h1>
            <p className="text-slate-400 text-xs font-medium mt-0.5">Real-time Web Grounding & Automated Inventory Matching</p>
          </div>
          
          <button 
            onClick={triggerStoreTripPlanner}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-md hover:shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2"
          >
            🛒 I'm going to the grocery store
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Dynamic Controls & State Lists */}
        <div className="space-y-6">
          {/* File Parsing Form Controls */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-indigo-500/5 transition-all duration-300">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">✨ Document Intake Panel</h2>
            
            <div className="mb-5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Scan Store Receipt</label>
              <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 text-center cursor-pointer group transition-colors duration-200">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600 transition-colors">Upload receipt image file</p>
                  <p className="text-xs text-slate-400">Processes layout brand mapping & matches items via Google Search</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddManualItem} className="flex gap-2 pt-4 border-t border-slate-100">
              <input 
                type="text" 
                value={manualItem} 
                onChange={(e) => setManualItem(e.target.value)}
                placeholder="Type item name..." 
                className="flex-1 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
              />
              <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all">Add</button>
            </form>

            {loading && (
              <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 text-center rounded-xl text-sm text-indigo-600 font-medium animate-pulse">
                🔍 Verifying store items via Google Search...
              </div>
            )}
          </div>

          {/* Current Ingredient Roster Visual Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50">
            <h2 className="text-base font-bold text-slate-900 mb-3">🏡 Pantry Stock ({fridge.length})</h2>
            <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto pr-1">
              {fridge.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No inventory tracked yet. Upload a receipt image above.</p>
              ) : (
                fridge.map((item, idx) => (
                  <span key={idx} className="bg-slate-100 px-3 py-1 text-xs font-semibold rounded-lg text-slate-600 border border-slate-200/40 animate-fade-in">{item}</span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Search and Ingredient Ratios Catalog */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-lg font-black text-slate-900">🍔 Personalized Recipe Pipeline</h2>
              <input 
                type="text"
                placeholder="🔍 Search recipes or ingredients..."
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                className="w-full sm:w-64 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Dynamic Ingredient Search & Match Ratios List */}
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {processedRecipes.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-8">No recipe search targets matches found.</p>
              ) : (
                processedRecipes.map((recipe) => (
                  <div key={recipe.id} className="p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/60 rounded-xl transition-all duration-200 group transform hover:-translate-x-0.5">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{recipe.name}</h3>
                        <p className="text-[11px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">{recipe.meal_type}</p>
                      </div>
                      
                      {/* Percent Match Indicator Pin */}
                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                          recipe.matchPercentage === 100 ? 'bg-emerald-100 text-emerald-700' : 
                          recipe.matchPercentage >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {recipe.matchPercentage}% Match
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">{recipe.ownedCount} of {recipe.totalCount} items</p>
                      </div>
                    </div>

                    {/* Component Dynamic Match Bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full mt-4 overflow-hidden shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          recipe.matchPercentage === 100 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                        }`}
                        style={{ width: `${recipe.matchPercentage}%` }}
                      ></div>
                    </div>

                    <p className="text-xs text-slate-500 mt-3 font-medium">
                      <strong className="text-slate-700 font-semibold">Ingredients required:</strong> {recipe.ingredients.join(', ')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Feature Modal Window: Smart Pre-Shopping Trip Planning Dashboard */}
      {isStoreAlertOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-slate-100 max-h-[80vh] overflow-y-auto transform scale-100 transition-all">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">💡 Smart Shopping Checklist</h3>
                <p className="text-xs text-slate-400 mt-0.5">Dishes you can make with only 1 or 2 extra ingredient purchases:</p>
              </div>
              <button 
                onClick={() => setIsStoreAlertOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              {shoppingAlerts.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-4">No close matches tracked. Your pantry is either empty or fully stocked!</p>
              ) : (
                shoppingAlerts.map((alert, i) => (
                  <div key={i} className="p-4 bg-indigo-50/50 border border-indigo-100/60 rounded-xl">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-slate-900 text-sm">{alert.recipeName}</h4>
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase">{alert.mealType}</span>
                    </div>
                    <p className="text-xs text-indigo-600/90 font-semibold mt-2">
                      ⭐ Buy this at the store: <span className="underline font-black">{alert.missingItems.join(' or ')}</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}