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

  // Sync data streams from backend tables
  const fetchAppData = async () => {
    try {
      let { data: inventory, error: invError } = await supabase
        .from('fridge_inventory')
        .select('item_name');
      
      if (invError) throw invError;
      
      const currentFridge = inventory ? inventory.map(i => i.item_name.toLowerCase().trim()) : [];
      setFridge(currentFridge);

      let { data: recipes, error: recError } = await supabase
        .from('recipes')
        .select('*');
        
      if (recError) throw recError;
      
      setMasterRecipes(recipes || []);
    } catch (err) {
      console.error("Error reading database initialization data:", err.message);
    }
  };

  useEffect(() => {
    fetchAppData();
  }, []);

  // Dispatch payload to Netlify background container with payload deduplication
  const sendImageToBackend = async (base64Data) => {
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Lowercase and trim all returned text values to safely handle hidden formatting mismatches
        const cleanItems = data.added.map(item => item.trim().toLowerCase());
        
        // Remove duplicate entries locally before pushing to Postgres to prevent ON CONFLICT constraint loops
        const uniqueItems = [...new Set(cleanItems)];
        
        // Map unique array strings directly into table layout syntax structures
        const insertPayload = uniqueItems.map(item => ({ item_name: item }));
        
        const { error } = await supabase
          .from('fridge_inventory')
          .upsert(insertPayload, { onConflict: 'item_name' });

        if (error) {
          alert(`Supabase Receipt Save Error: ${error.message}\n\nTip: Make sure the 'item_name' column has a Unique constraint or Primary Key in Supabase.`);
        } else {
          await fetchAppData();
        }
      } else {
        const errorText = await response.text();
        alert(`Parsing verification failure (Status ${response.status}): ${errorText}`);
      }
    } catch (err) {
      alert(`Network/Client Error: ${err.message}`);
    }
    setLoading(false);
  };

  // Handler: Compress image client-side to protect Netlify's 6MB payload limit
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);

    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    img.onload = () => {
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1600;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert image data structure to a fast web data string
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);

      // Hand off to the networking engine
      sendImageToBackend(compressedBase64);
    };
  };

  // Handler: Manual ingestion engine with explicit database reporting
  const handleAddManualItem = async (e) => {
    e.preventDefault();
    if (!manualItem.trim()) return;

    const { error } = await supabase
      .from('fridge_inventory')
      .upsert([{ item_name: manualItem.trim().toLowerCase() }], { onConflict: 'item_name' });

    if (error) {
      alert(`Supabase Manual Add Error: ${error.message}\nDetails: ${error.details}`);
    } else {
      setManualItem('');
      await fetchAppData();
    }
  };

  // Optimization: Pre-Shopping Trip Planning logic
  const triggerStoreTripPlanner = () => {
    const alerts = [];
    masterRecipes.forEach(recipe => {
      const missing = recipe.ingredients ? recipe.ingredients.filter(ing => 
        !fridge.includes(ing.toLowerCase().trim())
      ) : [];
      
      // Filter recipes needing exactly 1 or 2 more target tracking items from market runs
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

  // Calculation: Ingredient coverage matrix processing
  const processedRecipes = masterRecipes.map(recipe => {
    const totalIngredients = recipe.ingredients ? recipe.ingredients.length : 0;
    const itemsWeHave = recipe.ingredients 
      ? recipe.ingredients.filter(ing => fridge.includes(ing.toLowerCase().trim())) 
      : [];
    
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
    const searchLower = recipeSearch.toLowerCase();
    return recipe.name.toLowerCase().includes(searchLower) ||
           (recipe.ingredients && recipe.ingredients.some(i => i.toLowerCase().includes(searchLower)));
  }).sort((a, b) => b.matchPercentage - a.matchPercentage);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-500 selection:text-white transition-all duration-300">
      
      {/* Modern High-Vibrancy Glass Navigation Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 backdrop-blur-md bg-white/95 shadow-sm transition-all">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent tracking-tight">
              SmartFridge AI
            </h1>
            <p className="text-slate-400 text-xs font-semibold mt-0.5 tracking-wide">
              Vision Extraction Pipeline & Recipe Inventory Matcher
            </p>
          </div>
          
          <button 
            onClick={triggerStoreTripPlanner}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md hover:shadow-indigo-500/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
          >
            🛒 I'm going to the grocery store
          </button>
        </div>
      </header>

      {/* Main Interactive Work Area */}
      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Control Column */}
        <div className="space-y-6">
          
          {/* File Upload / Document Intake Panel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/40 hover:shadow-indigo-500/5 transition-all duration-300">
            <h2 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              📸 Document Intake Panel
            </h2>
            
            <div className="mb-5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Scan Store Receipt
              </label>
              <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer group transition-all duration-200">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">
                    Upload receipt image file
                  </p>
                  <p className="text-xs text-slate-400">
                    Auto-scales inputs & decodes retail text maps
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddManualItem} className="flex gap-2 pt-4 border-t border-slate-100">
              <input 
                type="text" 
                value={manualItem} 
                onChange={(e) => setManualItem(e.target.value)}
                placeholder="Type item name..." 
                className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" 
              />
              <button 
                type="submit" 
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl active:scale-95 transition-all"
              >
                Add
              </button>
            </form>

            {loading && (
              <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100/80 text-center rounded-xl text-sm text-indigo-600 font-bold animate-pulse">
                ⚡ Initializing vision parsing logic blocks...
              </div>
            )}
          </div>

          {/* Current Stock Inventory Badges */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/40">
            <h2 className="text-base font-extrabold text-slate-900 mb-3">
              🏡 Pantry Stock ({fridge.length})
            </h2>
            <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto pr-1">
              {fridge.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No items inside the inventory. Upload a slip to begin.</p>
              ) : (
                fridge.map((item, idx) => (
                  <span 
                    key={idx} 
                    className="bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold rounded-xl text-slate-600 border border-slate-200/50 hover:scale-105 transition-all duration-150 animate-fade-in"
                  >
                    {item}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right System Results Component */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/40">
            
            {/* Header and Live Search Control */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                🥗 Recipe Matching Catalog
              </h2>
              <input 
                type="text"
                placeholder="🔍 Filter recipes or components..."
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                className="w-full sm:w-64 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* List Pipeline with Active Transition Animations */}
            <div className="space-y-4 max-h-[580px] overflow-y-auto pr-2">
              {processedRecipes.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-12">No database entries matched your search criteria.</p>
              ) : (
                processedRecipes.map((recipe) => (
                  <div 
                    key={recipe.id || recipe.name} 
                    className="p-5 bg-slate-50/60 hover:bg-white border border-slate-200/60 hover:border-indigo-200 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 group transform hover:-translate-y-0.5"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors duration-200 text-base">
                          {recipe.name}
                        </h3>
                        <span className="inline-block text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-wider mt-1">
                          {recipe.meal_type || 'Recipe'}
                        </span>
                      </div>
                      
                      {/* Percent Tag Badge */}
                      <div className="text-right">
                        <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black ${
                          recipe.matchPercentage === 100 ? 'bg-emerald-100 text-emerald-800' : 
                          recipe.matchPercentage >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {recipe.matchPercentage}% Match
                        </span>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 tracking-wide">
                          {recipe.ownedCount} of {recipe.totalCount} items owned
                        </p>
                      </div>
                    </div>

                    {/* Progress Indicator Track Bar */}
                    <div className="w-full bg-slate-200/70 h-2.5 rounded-full mt-4 overflow-hidden shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          recipe.matchPercentage === 100 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                        }`}
                        style={{ width: `${recipe.matchPercentage}%` }}
                      ></div>
                    </div>

                    <p className="text-xs text-slate-500 mt-3.5 leading-relaxed font-medium">
                      <strong className="text-slate-700 font-bold">Required items:</strong> {recipe.ingredients ? recipe.ingredients.join(', ') : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Portal Modal Window: Grocery Store Trip Planner */}
      {isStoreAlertOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-opacity duration-300">
          <div className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl border border-slate-100 max-h-[80vh] overflow-y-auto transform scale-100 transition-all duration-300 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  💡 Smart Shopping Optimization Check
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  You can unlock these dishes by buying just 1 or 2 more items:
                </p>
              </div>
              <button 
                onClick={() => setIsStoreAlertOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-3 py-2 rounded-xl transition-colors active:scale-95"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              {shoppingAlerts.length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-6">No close recipes found. Your inventory is either completely stocked or empty.</p>
              ) : (
                shoppingAlerts.map((alert, i) => (
                  <div key={i} className="p-4 bg-indigo-50/40 border border-indigo-100/70 rounded-2xl transform hover:scale-[1.01] transition-transform duration-200">
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-slate-900 text-sm">{alert.recipeName}</h4>
                      <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md uppercase tracking-wider">{alert.mealType}</span>
                    </div>
                    <p className="text-xs text-indigo-700 font-medium mt-2">
                      ✨ Pick up this item at the store: <span className="underline font-black text-indigo-900 bg-indigo-100/40 px-1.5 py-0.5 rounded">{alert.missingItems.join(' & ')}</span>
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