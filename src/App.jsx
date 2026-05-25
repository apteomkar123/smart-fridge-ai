import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import html2canvas from 'html2canvas';

export default function App() {
  // Session States
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Core Data States
  const [fridge, setFridge] = useState([]);
  const [masterRecipes, setMasterRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualItem, setManualItem] = useState('');
  
  // Advanced Matrix Tracking States
  const [aiGenerating, setAiGenerating] = useState(false);
  const [expirationMap, setExpirationMap] = useState({});
  const [nutritionMetrics, setNutritionMetrics] = useState({ protein: 0, carbs: 0, fat: 0 });

  // Navigation UI Layout States
  const [recipeSearch, setRecipeSearch] = useState('');
  const [shoppingAlerts, setShoppingAlerts] = useState([]);
  const [isStoreAlertOpen, setIsStoreAlertOpen] = useState(false);
  const [activeModalRecipe, setActiveModalRecipe] = useState(null);

  const snapshotCardRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchAppData = async () => {
    if (!user) return;
    try {
      let { data: inventory, error: invError } = await supabase
        .from('fridge_inventory')
        .select('item_name, created_at')
        .eq('user_id', user.id);
      
      if (invError) throw invError;
      const currentFridge = inventory ? inventory.map(i => i.item_name.toLowerCase().trim()) : [];
      setFridge(currentFridge);

      calculateMacroMetrics(currentFridge);
      if (inventory) generateExpirationTimelines(inventory);

      let { data: recipes, error: recError } = await supabase.from('recipes').select('*');
      if (recError) throw recError;

      const normalizedRecipes = (recipes || []).map(r => {
        let parsedIngredients = [];
        try {
          parsedIngredients = typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : r.ingredients;
        } catch (e) {
          parsedIngredients = [];
        }
        return { ...r, ingredients: parsedIngredients || [] };
      });
      setMasterRecipes(normalizedRecipes);
    } catch (err) {
      console.error(err.message);
    }
  };

  useEffect(() => {
    if (user) fetchAppData();
  }, [user]);

  // Premium High-Resolution Photo Capture Download Engine
  const handleDownloadRecipeImage = async () => {
    if (!snapshotCardRef.current) return;
    try {
      // Temporarily reveal snapshot card container container to virtual DOM compiler
      const canvas = await html2canvas(snapshotCardRef.current, {
        backgroundColor: '#0c1222',
        scale: 3, // Upscales graphics vectors to generate crisp, premium image outputs
        logging: false,
        useCORS: true
      });
      
      const imageUri = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = imageUri;
      downloadLink.download = `smartfridge-${(activeModalRecipe.name || activeModalRecipe.recipeName).replace(/\s+/g, '-').toLowerCase()}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error("Canvas export tracking failure:", err);
    }
  };

  const handleGenerateAiRecipe = async () => {
    if (fridge.length === 0) return alert("Pantry array empty.");
    setAiGenerating(true);
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: "", 
          customPrompt: `Review these exact user ingredients vectors: ${fridge.join(', ')}.` 
        })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveModalRecipe({
          name: data.recipeName,
          ingredients: data.ingredients, // Pure structural source of truth from Gemini
          meal_type: 'AI Generation Matrix',
          isAiGeneratedElement: true,
          steps: data.steps
        });
      }
    } catch (err) { 
      console.error(err); 
    }
    setAiGenerating(false);
  };

  // TRIP PLANNER CORRECTION: Loops through entire realistically seeded table seamlessly
  const triggerStoreTripPlanner = () => {
    const alerts = [];
    masterRecipes.forEach(recipe => {
      const total = recipe.ingredients ? recipe.ingredients.length : 0;
      const missing = recipe.ingredients ? recipe.ingredients.filter(ing => !fridge.includes(ing.toLowerCase().trim())) : [];
      
      // Dynamic Filter Index: captures matches where you own at least 1 item but are missing a manageable subset
      if (missing.length >= 1 && missing.length <= 3 && total > missing.length) {
        alerts.push({ recipe, missingItems: missing, mealType: recipe.meal_type || 'General' });
      }
    });
    setShoppingAlerts(alerts);
    setIsStoreAlertOpen(true);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isSignUp) {
        await supabase.auth.signUp({ email: authEmail, password: authPassword });
        alert("🚀 Profile created successfully!");
      } else {
        await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      }
    } catch (err) { alert(err.message); }
    setAuthLoading(false);
  };

  const handleRemoveItem = async (itemName) => {
    setFridge(prev => prev.filter(item => item !== itemName));
    await supabase.from('fridge_inventory').delete().eq('item_name', itemName).eq('user_id', user.id);
    await fetchAppData();
  };

  const handleAddManualItem = async (e) => {
    e.preventDefault();
    if (!manualItem.trim()) return;
    const input = manualItem.trim().toLowerCase();
    setFridge(prev => [...new Set([...prev, input])]);
    setManualItem('');
    await supabase.from('fridge_inventory').upsert([{ item_name: input, user_id: user.id }], { onConflict: 'user_id,item_name' });
    await fetchAppData();
  };

  const calculateMacroMetrics = (items) => {
    let p = 0, c = 0, f = 0;
    items.forEach(item => {
      if (item.includes('paneer') || item.includes('tofu')) { p += 18; c += 3; f += 20; }
      else if (item.includes('lentil') || item.includes('chickpea')) { p += 9; c += 22; f += 1; }
      else { p += 4; c += 12; f += 2; }
    });
    setNutritionMetrics({ protein: p, carbs: c, fat: f });
  };

  const generateExpirationTimelines = (rawInventory) => {
    const freshMap = {};
    rawInventory.forEach(row => {
      const name = row.item_name.toLowerCase().trim();
      freshMap[name] = { daysLeft: 6, statusLabel: 'STABLE' };
    });
    setExpirationMap(freshMap);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#070a13] text-slate-200 flex items-center justify-center p-6">
        <div className="bg-[#0c1222] border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
          <h2 className="text-xl font-black text-center bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">SmartFridge AI Login</h2>
          <form onSubmit={handleAuthSubmit} className="space-y-4 mt-6">
            <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-[#070a13] border border-slate-800 px-4 py-3 rounded-xl text-xs focus:outline-none" placeholder="Email Address" />
            <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-[#070a13] border border-slate-800 px-4 py-3 rounded-xl text-xs focus:outline-none" placeholder="Password" />
            <button type="submit" className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider">{authLoading ? "Loading..." : (isSignUp ? "Register" : "Sign In")}</button>
          </form>
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-center block w-full text-violet-400 mt-4 hover:underline">{isSignUp ? "Have an account? Login" : "Create multi-tenant profile"}</button>
        </div>
      </div>
    );
  }

  const processedRecipes = masterRecipes.map(recipe => {
    const total = recipe.ingredients ? recipe.ingredients.length : 0;
    const owned = recipe.ingredients ? recipe.ingredients.filter(ing => fridge.includes(ing.toLowerCase().trim())).length : 0;
    const matchPercentage = total > 0 ? Math.round((owned / total) * 100) : 0;
    return { ...recipe, matchPercentage, ownedCount: owned, totalCount: total };
  }).filter(recipe => !recipeSearch || recipe.name.toLowerCase().includes(recipeSearch.toLowerCase())).sort((a, b) => b.matchPercentage - a.matchPercentage);

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-200 pb-12">
      <header className="bg-[#0c1222]/90 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-xl px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-black bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">SmartFridge AI</h1>
          <p className="text-slate-500 text-[10px] font-mono mt-1">Tenant Profile: {user.email}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={handleGenerateAiRecipe} className="flex-1 sm:flex-none bg-[#16122c] border border-violet-800/60 text-violet-300 font-black text-[11px] px-4 py-3 rounded-xl uppercase tracking-wider">
            {aiGenerating ? "⚡ Processing..." : "🔮 AI Recipe"}
          </button>
          <button onClick={triggerStoreTripPlanner} className="flex-1 sm:flex-none bg-gradient-to-r from-violet-600 to-fuchsia-600 font-black text-[11px] px-5 py-3 rounded-xl uppercase tracking-wider shadow-lg">🛒 Trip Planner</button>
          <button onClick={handleSignOut} className="bg-slate-800 text-slate-400 font-bold text-[11px] px-3 py-3 rounded-xl uppercase tracking-wider">Sign Out</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6 lg:col-span-1">
          {/* Macros Card */}
          <div className="bg-[#0c1222] p-5 rounded-2xl border border-slate-800">
            <h2 className="text-[10px] font-black tracking-widest uppercase text-slate-500 mb-4">📊 Nutrition Monitor Matrix</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#070a13] border border-slate-800 p-2.5 rounded-xl"><p className="text-[10px] text-slate-500 font-bold uppercase">Pro</p><p className="text-base font-black text-violet-400 mt-1">{nutritionMetrics.protein}g</p></div>
              <div className="bg-[#070a13] border border-slate-800 p-2.5 rounded-xl"><p className="text-[10px] text-slate-500 font-bold uppercase">Carb</p><p className="text-base font-black text-fuchsia-400 mt-1">{nutritionMetrics.carbs}g</p></div>
              <div className="bg-[#070a13] border border-slate-800 p-2.5 rounded-xl"><p className="text-[10px] text-slate-500 font-bold uppercase">Fat</p><p className="text-base font-black text-cyan-400 mt-1">{nutritionMetrics.fat}g</p></div>
            </div>
          </div>

          {/* Intake Card */}
          <div className="bg-[#0c1222] p-6 rounded-2xl border border-slate-800 shadow-2xl">
            <h2 className="text-xs font-black uppercase text-slate-400 mb-4">📸 Intake Node</h2>
            <div className="relative border border-dashed border-slate-800 p-6 text-center bg-[#090d1a] rounded-xl cursor-pointer">
              <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              <p className="text-xs font-bold text-slate-400">Scan Receipt Data Target</p>
            </div>
            <form onSubmit={handleAddManualItem} className="flex gap-2 pt-4 mt-4 border-t border-slate-800/60">
              <input type="text" value={manualItem} onChange={(e) => setManualItem(e.target.value)} placeholder="Type manual item token..." className="flex-1 bg-[#070a13] border border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-300 focus:outline-none" />
              <button type="submit" className="bg-slate-800 text-slate-300 hover:bg-violet-600 text-xs font-bold px-4 rounded-xl transition-all">Inject</button>
            </form>
          </div>

          {/* Stock Room Card */}
          <div className="bg-[#0c1222] p-6 rounded-2xl border border-slate-800 shadow-2xl">
            <h2 className="text-xs font-black text-slate-400 uppercase flex justify-between"><span>🏡 Private Inventory Rows</span><span className="font-mono text-slate-500">{fridge.length}</span></h2>
            <div className="space-y-2 mt-4 max-h-64 overflow-y-auto pr-1">
              {fridge.map((item, idx) => (
                <div key={idx} className="bg-[#090d1a] border border-slate-800 p-2 rounded-xl flex justify-between items-center"><span className="text-xs font-bold capitalize text-slate-300">{item}</span><button onClick={() => handleRemoveItem(item)} className="text-slate-600 hover:text-red-400 font-mono text-xs px-2">×</button></div>
              ))}
            </div>
          </div>
        </div>

        {/* Recipes Grid Dashboard */}
        <div className="lg:col-span-2 bg-[#0c1222] p-6 rounded-2xl border border-slate-800 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xs font-black tracking-widest text-slate-400 uppercase">⚡ Vector Match Deck</h2>
            <input type="text" placeholder="Search catalog names..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="bg-[#070a13] border border-slate-800 px-4 py-2 rounded-xl text-xs focus:outline-none text-slate-300" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[580px] overflow-y-auto pr-2">
            {processedRecipes.slice(0, 30).map((recipe) => (
              <div key={recipe.id || recipe.name} onClick={() => setActiveModalRecipe(recipe)} className="p-4 bg-[#090d1a] border border-slate-800 rounded-xl cursor-pointer hover:border-violet-500 transition-all flex flex-col justify-between group">
                <div className="flex justify-between items-start gap-2"><h3 className="font-extrabold text-slate-300 group-hover:text-violet-400 text-xs line-clamp-2">{recipe.name}</h3><span className="text-[10px] font-mono text-slate-500">{recipe.matchPercentage}%</span></div>
                <span className="text-[8px] font-mono text-slate-600 border border-slate-800 px-1.5 py-0.5 rounded mt-2 inline-block w-max uppercase">{recipe.meal_type || 'General'}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* DYNAMIC RECIPE DISPLAY DIALOG FRAME */}
      {activeModalRecipe && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4進 z-50 overflow-y-auto">
          <div className="bg-[#0c1222] border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-6">
              <div>
                <span className="bg-violet-950 text-violet-400 font-mono text-[9px] px-2 py-0.5 rounded uppercase font-black">{activeModalRecipe.meal_type}</span>
                <h3 className="text-base font-black text-slate-100 tracking-tight mt-1">{activeModalRecipe.name || activeModalRecipe.recipeName}</h3>
              </div>
              <div className="flex gap-2">
                <button onClick={handleDownloadRecipeImage} className="bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all">
                  📸 Save Card Photo
                </button>
                <button onClick={() => setActiveModalRecipe(null)} className="bg-slate-800 text-slate-400 text-xs font-mono px-3 py-2 rounded-xl border border-slate-700">Close</button>
              </div>
            </div>

            {/* SNAPSHOT NODE MODULE TARGET PANEL */}
            <div ref={snapshotCardRef} className="bg-[#0c1222] border border-slate-800 p-6 rounded-xl space-y-6">
              <div className="border-b border-slate-800 pb-4 text-center">
                <h2 className="text-xl font-black text-slate-100 uppercase tracking-wide bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">{activeModalRecipe.name || activeModalRecipe.recipeName}</h2>
                <p className="text-[10px] text-slate-500 font-mono uppercase mt-1">SmartFridge AI Premium Recipe Specifications</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#070a13] border border-slate-800 p-4 rounded-xl">
                  <h4 className="text-[9px] font-black uppercase text-slate-500 font-mono border-b border-slate-800 pb-1 mb-2">📋 Component List</h4>
                  <ul className="space-y-2">
                    {activeModalRecipe.ingredients?.map((ing, idx) => (
                      <li key={idx} className="text-xs font-bold text-slate-300 capitalize flex flex-col"><span className="text-[8px] font-mono text-violet-500 font-black">1.5 Units Measure</span>{ing}</li>
                    ))}
                  </ul>
                </div>
                <div className="md:col-span-2 space-y-3">
                  <h4 className="text-[9px] font-black uppercase text-slate-500 font-mono border-b border-slate-800 pb-1">🔥 Culinary Execution Vector Steps</h4>
                  <ol className="space-y-2.5">
                    {(activeModalRecipe.isAiGeneratedElement ? activeModalRecipe.steps : getStaticRecipeSteps(activeModalRecipe)).map((step, idx) => (
                      <li key={idx} className="bg-[#090d1a] border border-slate-800 p-3 rounded-xl text-xs text-slate-300 flex gap-3 leading-relaxed">
                        <span className="font-mono font-black text-cyan-400 bg-slate-900 w-5 h-5 rounded flex items-center justify-center shrink-0 border border-slate-800">{idx + 1}</span>
                        <p className="font-medium text-slate-300">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Trip Planner Overlay View */}
      {isStoreAlertOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#0c1222] border border-slate-800 w-full max-w-xl rounded-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-xs font-black text-slate-200 uppercase tracking-widest">🔮 Market Procurement Vector</h3>
              <button onClick={() => setIsStoreAlertOpen(false)} className="bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-1 rounded">DISMISS</button>
            </div>
            <div className="space-y-2.5">
              {shoppingAlerts.slice(0, 15).map((alert, i) => (
                <div key={i} onClick={() => { setIsStoreAlertOpen(false); setActiveModalRecipe(alert.recipe); }} className="p-3.5 bg-[#090d1a] border border-slate-800 hover:border-violet-500 rounded-xl cursor-pointer transition-all">
                  <div className="flex justify-between items-center">
                    <h4 className="font-extrabold text-slate-300 text-xs">{alert.recipe.name}</h4>
                    <span className="text-[8px] font-mono text-violet-400 bg-violet-950/40 border border-violet-900/60 px-1.5 py-0.5 rounded uppercase">{alert.mealType}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-2">Missing Items to Buy: <span className="text-cyan-400 font-mono text-xs capitalize ml-1">{alert.missingItems.join(', ')}</span></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}