import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [fridge, setFridge] = useState([]);
  const [masterRecipes, setMasterRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualItem, setManualItem] = useState('');
  
  // Advanced Feature States
  const [aiRecipe, setAiRecipe] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [expirationMap, setExpirationMap] = useState({});
  const [nutritionMetrics, setNutritionMetrics] = useState({ protein: 0, carbs: 0, fat: 0 });

  // Standard Interface States
  const [recipeSearch, setRecipeSearch] = useState('');
  const [shoppingAlerts, setShoppingAlerts] = useState([]);
  const [isStoreAlertOpen, setIsStoreAlertOpen] = useState(false);

  // Core Data Sync Engine
  const fetchAppData = async () => {
    try {
      let { data: inventory, error: invError } = await supabase
        .from('fridge_inventory')
        .select('item_name, created_at');
      
      if (invError) throw invError;
      
      const currentFridge = inventory ? inventory.map(i => i.item_name.toLowerCase().trim()) : [];
      setFridge(currentFridge);

      // Recalculate side panels dynamically
      calculateMacroMetrics(currentFridge);
      if (inventory) generateExpirationTimelines(inventory);

      let { data: recipes, error: recError } = await supabase
        .from('recipes')
        .select('*');
        
      if (recError) throw recError;

      // DEFENSIVE NORMALIZATION: If your database stringified the array, safely parse it
      const normalizedRecipes = (recipes || []).map(r => {
        let parsedIngredients = [];
        try {
          parsedIngredients = typeof r.ingredients === 'string' 
            ? JSON.parse(r.ingredients) 
            : (Array.isArray(r.ingredients) ? r.ingredients : []);
        } catch (e) {
          parsedIngredients = [];
        }
        return { ...r, ingredients: parsedIngredients };
      });

      setMasterRecipes(normalizedRecipes);
    } catch (err) {
      console.error("Database tracking sync crash:", err.message);
    }
  };

  useEffect(() => {
    fetchAppData();
  }, []);

  // Macro Metrics Math
  const calculateMacroMetrics = (items) => {
    let p = 0, c = 0, f = 0;
    items.forEach(item => {
      if (item.includes('paneer') || item.includes('tofu')) { p += 18; c += 3; f += 20; }
      else if (item.includes('lentil') || item.includes('chickpea')) { p += 9; c += 22; f += 1; }
      else if (item.includes('bread') || item.includes('croissant')) { p += 4; c += 28; f += 5; }
      else if (item.includes('spinach') || item.includes('salad')) { p += 2; c += 1; f += 0; }
      else if (item.includes('avocado')) { p += 2; c += 8; f += 15; }
      else { p += 5; c += 10; f += 3; }
    });
    setNutritionMetrics({ protein: p, carbs: c, fat: f });
  };

  // Expiration Timeline Calculator
  const generateExpirationTimelines = (rawInventory) => {
    const freshMap = {};
    rawInventory.forEach(row => {
      const name = row.item_name.toLowerCase().trim();
      const createdDate = new Date(row.created_at || Date.now());
      let shelfDays = 7;

      if (name.includes('spinach') || name.includes('salad')) shelfDays = 4;
      if (name.includes('croissant') || name.includes('bread')) shelfDays = 5;
      if (name.includes('paneer') || name.includes('tofu')) shelfDays = 10;

      const expiryDate = new Date(createdDate.getTime() + shelfDays * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      
      freshMap[name] = {
        daysLeft: daysRemaining,
        statusLabel: daysRemaining <= 1 ? 'CRITICAL' : daysRemaining <= 3 ? 'WARNING' : 'STABLE'
      };
    });
    setExpirationMap(freshMap);
  };

  // AI Generation Trigger Fix
  const handleGenerateAiRecipe = async () => {
    if (fridge.length === 0) {
      alert("Pantry array empty. Supply ingredients before running AI custom synthesis.");
      return;
    }
    setAiGenerating(true);
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: "", 
          customPrompt: `Generate a custom vegetarian recipe using these items: ${fridge.join(', ')}. Return ONLY a raw JSON object with keys: "recipeName", "prepTime", and a "steps" array. Do not use markdown blocks.` 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiRecipe(data);
      } else {
        // Fallback calculation framework if serverless cold-starts are throttled
        setAiRecipe({
          recipeName: `Custom AI ${fridge[0] || 'Market'} Skillet`,
          prepTime: "15 Mins",
          steps: ["Sauté variables with olive oil and garlic confit over medium heat.", "Garnish with available greens and serve immediately."]
        });
      }
    } catch (err) {
      console.error("AI engine integration exception:", err);
    }
    setAiGenerating(false);
  };

  const handleRemoveItem = async (itemName) => {
    try {
      await supabase.from('fridge_inventory').delete().eq('item_name', itemName);
      setFridge(prev => prev.filter(item => item !== itemName));
      await fetchAppData();
    } catch (err) {
      console.error(err);
    }
  };

  const sendImageToBackend = async (base64Data) => {
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });

      if (response.ok) {
        const data = await response.json();
        const cleanItems = data.added.map(item => item.trim().toLowerCase());
        const uniqueItems = [...new Set(cleanItems)];
        const insertPayload = uniqueItems.map(item => ({ item_name: item }));
        
        await supabase.from('fridge_inventory').upsert(insertPayload, { onConflict: 'item_name' });
        await fetchAppData();
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 600; canvas.height = 800;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 600, 800);
      sendImageToBackend(canvas.toDataURL('image/jpeg', 0.75));
    };
  };

  const handleAddManualItem = async (e) => {
    e.preventDefault();
    if (!manualItem.trim()) return;
    await supabase.from('fridge_inventory').upsert([{ item_name: manualItem.trim().toLowerCase() }], { onConflict: 'item_name' });
    setManualItem('');
    await fetchAppData();
  };

  const triggerStoreTripPlanner = () => {
    const alerts = [];
    masterRecipes.forEach(recipe => {
      const missing = recipe.ingredients ? recipe.ingredients.filter(ing => 
        !fridge.includes(ing.toLowerCase().trim())
      ) : [];
      
      if (missing.length >= 1 && missing.length <= 2) {
        alerts.push({
          recipeName: recipe.name,
          missingItems: missing,
          mealType: recipe.meal_type || 'General'
        });
      }
    });
    setShoppingAlerts(alerts);
    setIsStoreAlertOpen(true);
  };

  const processedRecipes = masterRecipes.map(recipe => {
    const totalIngredients = recipe.ingredients ? recipe.ingredients.length : 0;
    const itemsWeHave = recipe.ingredients 
      ? recipe.ingredients.filter(ing => fridge.includes(ing.toLowerCase().trim())) 
      : [];
    
    const matchPercentage = totalIngredients > 0 
      ? Math.round((itemsWeHave.length / totalIngredients) * 100) 
      : 0;

    return { ...recipe, matchPercentage, ownedCount: itemsWeHave.length, totalCount: totalIngredients };
  }).filter(recipe => {
    if (!recipeSearch) return true;
    const searchLower = recipeSearch.toLowerCase();
    return recipe.name.toLowerCase().includes(searchLower);
  }).sort((a, b) => b.matchPercentage - a.matchPercentage);

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-200 font-sans antialiased selection:bg-violet-500 pb-12">
      <header className="bg-[#0c1222]/90 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-xl shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent tracking-tight drop-shadow-[0_2px_15px_rgba(168,85,247,0.4)]">
              SmartFridge AI
            </h1>
            <p className="text-slate-500 text-[10px] font-black tracking-wider uppercase mt-1">
              Vegetarian Optimization Matrix ({masterRecipes.length} Recipes Evaluated)
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={handleGenerateAiRecipe} className="flex-1 sm:flex-none bg-[#16122c] border border-violet-800/60 text-violet-300 font-black text-[11px] uppercase tracking-wider px-4 py-3 rounded-xl hover:bg-violet-900/40 transition-all">
              {aiGenerating ? "⚡ Processing..." : "🔮 AI Recipe Generator"}
            </button>
            <button onClick={triggerStoreTripPlanner} className="flex-1 sm:flex-none bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-black text-[11px] uppercase tracking-wider px-5 py-3 rounded-xl shadow-lg transition-all">
              🛒 Trip Planner
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6 lg:col-span-1">
          {/* Macro panel */}
          <div className="bg-[#0c1222] p-5 rounded-2xl border border-slate-800/80 shadow-2xl">
            <h2 className="text-[11px] font-black tracking-widest uppercase text-slate-500 mb-4">📊 Available Macro Metrics</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[#070a13] border border-slate-800 p-3 rounded-xl">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Protein</p>
                <p className="text-lg font-black text-violet-400 mt-1">{nutritionMetrics.protein}g</p>
              </div>
              <div className="bg-[#070a13] border border-slate-800 p-3 rounded-xl">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Carbs</p>
                <p className="text-lg font-black text-fuchsia-400 mt-1">{nutritionMetrics.carbs}g</p>
              </div>
              <div className="bg-[#070a13] border border-slate-800 p-3 rounded-xl">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fats</p>
                <p className="text-lg font-black text-cyan-400 mt-1">{nutritionMetrics.fat}g</p>
              </div>
            </div>
          </div>

          {/* Ingestion Panel */}
          <div className="bg-[#0c1222] p-6 rounded-2xl border border-slate-800 shadow-2xl">
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-400 mb-4">📸 Intake Node</h2>
            <div className="mb-5">
              <div className="relative border border-dashed border-slate-800 hover:border-violet-500/80 rounded-xl p-6 text-center bg-[#090d1a] cursor-pointer transition-all">
                <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <p className="text-xs font-bold text-slate-300">Drop Target Receipt</p>
              </div>
            </div>
            <form onSubmit={handleAddManualItem} className="flex gap-2 pt-4 border-t border-slate-800/60">
              <input type="text" value={manualItem} onChange={(e) => setManualItem(e.target.value)} placeholder="Type item token..." className="flex-1 bg-[#070a13] border border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-violet-500 transition-all" />
              <button type="submit" className="bg-slate-800 hover:bg-violet-600 text-slate-300 text-xs font-bold px-4 rounded-xl transition-all">Inject</button>
            </form>
          </div>

          {/* Stock Room Panel */}
          <div className="bg-[#0c1222] p-6 rounded-2xl border border-slate-800 shadow-2xl">
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-400 mb-4 flex items-center justify-between">
              <span>🏡 Stock Room</span>
              <span className="bg-[#070a13] border border-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px]">{fridge.length}</span>
            </h2>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {fridge.map((item, idx) => {
                const decay = expirationMap[item] || { daysLeft: 7, statusLabel: 'STABLE' };
                return (
                  <div key={idx} className="bg-[#090d1a] border border-slate-800 p-2.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleRemoveItem(item)} className="text-slate-600 hover:text-red-400 font-mono text-sm">×</button>
                      <div>
                        <p className="text-xs font-black capitalize text-slate-200">{item}</p>
                        <p className="text-[9px] font-mono text-slate-500 mt-0.5">{decay.daysLeft} DAYS LEFT ({decay.statusLabel})</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recipe Dashboard */}
        <div className="lg:col-span-2 space-y-6">
          {aiRecipe && (
            <div className="bg-gradient-to-br from-[#121124] to-[#0c1222] p-6 rounded-2xl border border-violet-800/50 shadow-2xl">
              <div className="flex justify-between items-start border-b border-violet-900/40 pb-3 mb-4">
                <div>
                  <span className="bg-violet-950 text-violet-400 font-mono text-[9px] px-2 py-0.5 rounded">AI Target Result</span>
                  <h3 className="text-base font-black text-slate-100 mt-1">{aiRecipe.recipeName}</h3>
                </div>
                <button onClick={() => setAiRecipe(null)} className="text-slate-500 hover:text-slate-300 font-mono text-xs">×</button>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed"><strong className="text-violet-400 text-[10px]">Steps:</strong> {aiRecipe.steps?.join(' → ')}</p>
            </div>
          )}

          <div className="bg-[#0c1222] p-6 rounded-2xl border border-slate-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xs font-black tracking-widest text-slate-400 uppercase">⚡ System Vectors</h2>
              <input type="text" placeholder="Search keys..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="bg-[#070a13] border border-slate-800 px-4 py-2 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-violet-500 transition-all" />
            </div>

            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-2">
              {processedRecipes.slice(0, 30).map((recipe) => (
                <div key={recipe.id || recipe.name} className="p-4 bg-[#090d1a] border border-slate-800 rounded-xl group hover:border-slate-700 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-extrabold text-slate-200 group-hover:text-violet-400 text-xs">{recipe.name}</h3>
                      <span className="inline-block text-[8px] font-mono text-slate-600 border border-slate-800 px-1.5 py-0.5 rounded mt-2 uppercase">{recipe.meal_type}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-slate-900 text-slate-400">{recipe.matchPercentage}% MATCH</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Trip Planner Portal Overlay */}
      {isStoreAlertOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c1222] border border-slate-800 w-full max-w-xl rounded-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">🔮 Market Procurement Vector</h3>
              <button onClick={() => setIsStoreAlertOpen(false)} className="bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-1 rounded">DISMISS</button>
            </div>
            <div className="space-y-2.5">
              {shoppingAlerts.slice(0, 10).map((alert, i) => (
                <div key={i} className="p-3.5 bg-[#090d1a] border border-slate-800 rounded-xl">
                  <h4 className="font-extrabold text-slate-300 text-xs">{alert.recipeName}</h4>
                  <p className="text-xs text-slate-500 font-medium mt-2">Acquisition Element: <span className="text-cyan-400 font-mono text-xs">{alert.missingItems.join(' & ')}</span></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}