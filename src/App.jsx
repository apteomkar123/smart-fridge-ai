import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import html2canvas from 'html2canvas';

export default function App() {
  // Session & Auth States
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  
  // Password Recovery States
  const [isForgotPasswordView, setIsForgotPasswordView] = useState(false);
  const [isResettingPasswordMode, setIsResettingPasswordMode] = useState(false);
  const [newPasswordValue, setNewPasswordValue] = useState('');

  // Core Data States
  const [fridge, setFridge] = useState([]); 
  const [masterRecipes, setMasterRecipes] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Input Handling States
  const [manualItem, setManualItem] = useState('');
  const [shoppingInput, setShoppingInput] = useState('');
  const [storeName, setStoreName] = useState('Grocery Store');
  
  // Advanced Matrix Tracking States
  const [aiGenerating, setAiGenerating] = useState(false);
  const [expirationMap, setExpirationMap] = useState({});
  const [nutritionMetrics, setNutritionMetrics] = useState({ protein: 0, carbs: 0, fat: 0 });

  // Navigation UI Layout States
  const [recipeSearch, setRecipeSearch] = useState('');
  const [shoppingAlerts, setShoppingAlerts] = useState([]);
  const [isStoreAlertOpen, setIsStoreAlertOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeModalRecipe, setActiveModalRecipe] = useState(null);

  // Dynamic Servings Multiplier State
  const [servingMultiplier, setServingMultiplier] = useState(1);

  const snapshotCardRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPasswordMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // LOCAL BACKUP PARSER: Instantly cleans strings before database handshake returns
  const cleanIngredientLocally = (rawName) => {
    if (!rawName) return '';
    let name = rawName.toLowerCase().trim();
    name = name.replace(/\d+\s*(pack|pk|ct|count|oz|lb|g|ml|pcs|bag|box|can|container|bottle|pieces|slice|fluid)\b/g, '');
    name = name.replace(/\b(organic|fresh|large|small|medium|brown|white|pasture|raised|premium|extra|natural|sweet|whole)\b/g, '');
    return name.replace(/[^a-zA-Z ]/g, '').trim();
  };

  // ONLINE SANITIZER LOOKUP: Extracts core matching nouns safely via background Netlify threads
  const resolveSanitizedTokenOnline = async (rawInputString) => {
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolveItemToken: rawInputString, storeContext: storeName })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.sanitized) return data.sanitized;
      }
    } catch (e) {
      console.error(e);
    }
    return cleanIngredientLocally(rawInputString);
  };

  const fetchAppData = async () => {
    if (!user) return;
    try {
      // 1. Fetch Pantry Stock Rows
      let { data: inventory, error: invErr } = await supabase.from('fridge_inventory').select('*').eq('user_id', user.id);
      if (invErr) throw invErr;

      const normalizedFridge = (inventory || []).map(row => ({
        id: row.id,
        raw_name: row.item_name,
        item_name: cleanIngredientLocally(row.item_name)
      }));
      setFridge(normalizedFridge);

      const plainTokensArray = normalizedFridge.map(f => f.item_name);
      calculateMacroMetrics(plainTokensArray);
      if (plainTokensArray.length > 0) generateExpirationTimelines(plainTokensArray);

      // 2. Fetch Profile Shopping Lists
      let { data: shopItems } = await supabase.from('shopping_list').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      setShoppingList(shopItems || []);

      // 3. Fetch Liked Recipes Catalog Matrices
      let { data: likedRecipes } = await supabase.from('saved_recipes').select('*').eq('user_id', user.id);
      setSavedRecipes(likedRecipes || []);

      // 4. Stream 6,000 Catalog Entries natively
      let { data: recipes, error: recErr } = await supabase.from('recipes').select('*');
      if (recErr) throw recErr;

      const normalizedRecipes = (recipes || []).map(r => {
        let extracted = [];
        if (r.ingredients) {
          if (Array.isArray(r.ingredients)) extracted = r.ingredients;
          else {
            try { extracted = JSON.parse(r.ingredients); } catch (e) {
              extracted = String(r.ingredients).match(/\b[a-zA-Z\- ]+\b/g) || [];
            }
          }
        }
        return { ...r, ingredients: Array.isArray(extracted) ? extracted.map(i => cleanIngredientLocally(i)) : [] };
      });
      setMasterRecipes(normalizedRecipes);
    } catch (err) {
      console.error("Hydration fault bypassed: ", err.message);
    }
  };

  useEffect(() => {
    if (user) fetchAppData();
  }, [user]);

  // PANTRY INLINE INTERACTIVE GRID MODIFIER
  const handleUpdateInlineItem = async (id, updatedRawValue) => {
    setFridge(prev => prev.map(item => item.id === id ? { ...item, raw_name: updatedRawValue, item_name: cleanIngredientLocally(updatedRawValue) } : item));
    await supabase.from('fridge_inventory').update({ item_name: updatedRawValue }).eq('id', id);
  };

  // SHOPPING LIST CONTROLLER SYSTEM
  const handleAddShoppingItem = async (e, textOverride = '') => {
    if (e) e.preventDefault();
    const targetText = textOverride || shoppingInput;
    if (!targetText.trim()) return;

    const resolvedTokenName = cleanIngredientLocally(targetText);
    const { data, error } = await supabase.from('shopping_list').insert([{
      user_id: user.id,
      item_name: resolvedTokenName,
      is_completed: false
    }]).select();

    if (!error && data) setShoppingList(prev => [...prev, data[0]]);
    if (!textOverride) setShoppingInput('');
  };

  const handleToggleShoppingCompleted = async (id, status) => {
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, is_completed: !status } : item));
    await supabase.from('shopping_list').update({ is_completed: !status }).eq('id', id);
  };

  const handleClearShoppingItem = async (id) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
    await supabase.from('shopping_list').delete().eq('id', id);
  };

  // PINNED PROFILE RECIPES HANDLERS
  const handleSaveRecipeToProfile = async (recipe) => {
    if (savedRecipes.some(r => r.recipe_id === String(recipe.id))) return alert("Recipe catalog card already liked!");
    
    const { data, error } = await supabase.from('saved_recipes').insert([{
      user_id: user.id,
      recipe_id: String(recipe.id),
      recipe_name: recipe.name,
      ingredients: recipe.ingredients,
      steps: recipe.steps || [],
      meal_type: recipe.meal_type
    }]).select();

    if (!error && data) {
      setSavedRecipes(prev => [...prev, data[0]]);
      alert("⭐ Entry added smoothly to liked recipe arrays!");
    }
  };

  const handleRemoveSavedRecipe = async (id) => {
    setSavedRecipes(prev => prev.filter(r => r.id !== id));
    await supabase.from('saved_recipes').delete().eq('id', id);
  };

  // HIGH FIDELITY MEMORY CAPTURE ENGINE: Bypasses view layer restrictions cleanly
  const handleDownloadRecipeImage = async () => {
    if (!snapshotCardRef.current) return;
    try {
      const canvas = await html2canvas(snapshotCardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, 
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: snapshotCardRef.current.offsetWidth,
        height: snapshotCardRef.current.offsetHeight
      });
      const dataUri = canvas.toDataURL('image/png');
      const hiddenAnchor = document.createElement('a');
      hiddenAnchor.href = dataUri;
      hiddenAnchor.download = `recipe-formulation-card-${Date.now()}.png`;
      document.body.appendChild(hiddenAnchor);
      hiddenAnchor.click();
      document.body.removeChild(hiddenAnchor);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateAiRecipe = async () => {
    const tokensList = (fridge || []).map(f => f.item_name);
    if (tokensList.length === 0) return alert("Pantry items vector empty.");
    setAiGenerating(true);
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: "", customPrompt: `Review these ingredients: ${tokensList.join(', ')}.` })
      });
      if (response.ok) {
        const data = await response.json();
        setActiveModalRecipe({ 
          name: data.recipeName || 'AI Custom Formulation Meal', 
          ingredients: (data.ingredients || []), 
          meal_type: 'AI Generation Result', 
          isAiGeneratedElement: true, 
          steps: data.steps || [] 
        });
        setServingMultiplier(1);
      }
    } catch (err) { console.error(err); }
    setAiGenerating(false);
  };

  const triggerStoreTripPlanner = () => {
    const alerts = [];
    const tokensList = (fridge || []).map(f => f.item_name);
    (masterRecipes || []).forEach(recipe => {
      const recipeIngredients = recipe.ingredients || [];
      const missing = recipeIngredients.filter(ing => !tokensList.some(token => ing.includes(token) || token.includes(ing)));
      if (missing.length >= 1 && missing.length <= 3 && recipeIngredients.length > missing.length) {
        alerts.push({ recipe, missingItems: missing, mealType: recipe.meal_type || 'General' });
      }
    });
    setShoppingAlerts(alerts);
    setIsStoreAlertOpen(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setFridge([]);
    setMasterRecipes([]);
    setActiveModalRecipe(null);
  };

  const handleRemoveItem = async (id) => {
    try {
      setFridge(prev => prev.filter(item => item.id !== id));
      await supabase.from('fridge_inventory').delete().eq('id', id);
    } catch (err) { console.error(err); }
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
        const rawItems = data.added ? data.added.map(item => item.trim()) : [];
        
        for (let rawItem of rawItems) {
          if (rawItem.trim()) {
            await supabase.from('fridge_inventory').insert([{ item_name: rawItem.trim(), user_id: user.id }]);
          }
        }
        await fetchAppData();
      }
    } catch (err) { console.error(err); }
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
    const input = manualItem.trim();
    setManualItem('');
    
    await supabase.from('fridge_inventory').insert([{ item_name: input, user_id: user.id }]);
    await fetchAppData();
  };

  const calculateMacroMetrics = (tokens) => {
    let p = 0, c = 0, f = 0;
    tokens.forEach(item => {
      if (item.includes('paneer') || item.includes('tofu')) { p += 18; c += 3; f += 20; }
      else if (item.includes('lentil') || item.includes('chickpea') || item.includes('bean')) { p += 9; c += 22; f += 1; }
      else { p += 4; c += 12; f += 2; }
    });
    setNutritionMetrics({ protein: p, carbs: c, fat: f });
  };

  const getCleanMeasurement = (ingredientName, multiplier) => {
    const baseAmount = 1;
    const scaledAmount = baseAmount * multiplier;
    if (['pizza dough', 'naan', 'bun', 'tortilla', 'croissant', 'bread', 'tortillas'].some(x => ingredientName.toLowerCase().includes(x))) {
      return `${scaledAmount} Pcs`;
    }
    if (['cheese', 'mozzarella', 'sauce', 'pesto', 'cream', 'spread'].some(x => ingredientName.toLowerCase().includes(x))) {
      return `${scaledAmount * 75}g`;
    }
    if (['paneer', 'tofu', 'tempeh', 'mushroom', 'potato', 'lentil', 'chickpea', 'bean', 'egg', 'eggs'].some(x => ingredientName.toLowerCase().includes(x))) {
      return `${scaledAmount * 150}g`;
    }
    return `${scaledAmount * 0.5} Cups`;
  };

  // HIGH-PERFORMANCE FAILSORTER: Resolves async undefined variables cleanly via conditional short-circuit walls
  const tokensList = (fridge || []).map(f => f.item_name);
  const processedRecipes = (masterRecipes || []).map(recipe => {
    const recipeIngredients = recipe.ingredients || [];
    const total = recipeIngredients.length;
    
    const ownedCount = recipeIngredients.filter(ing => {
      const cleanIng = (ing || '').toLowerCase().trim();
      return (tokensList || []).some(token => token && (cleanIng.includes(token) || token.includes(cleanIng)));
    }).length;
    
    const matchPercentage = total > 0 ? Math.round((ownedCount / total) * 100) : 0;
    return { ...recipe, matchPercentage, ownedCount, totalCount: total };
  }).filter(recipe => {
    if (!recipeSearch) return true;
    return recipe.name && recipe.name.toLowerCase().includes(recipeSearch.toLowerCase());
  }).sort((a, b) => {
    if (b.matchPercentage !== a.matchPercentage) return b.matchPercentage - a.matchPercentage;
    return (a.name || '').localeCompare(b.name || '');
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans tracking-tight antialiased flex items-center justify-center p-6">
        <div className="bg-slate-900 border-4 border-slate-800 p-8 rounded-none w-full max-w-md shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-orange-600"></div>
          {isForgotPasswordView ? (
            <>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-100">Recover Account</h2>
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 mt-6">
                <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-slate-950 border-2 border-slate-800 px-4 py-3 rounded-none text-sm font-black text-slate-100 uppercase tracking-wider focus:border-amber-500 focus:outline-none" placeholder="Type your email" />
                <button type="submit" className="w-full bg-amber-500 text-slate-950 font-black py-4 text-xs uppercase tracking-widest hover:bg-amber-400">Send Reset Link</button>
              </form>
              <button onClick={() => setIsForgotPasswordView(false)} className="text-xs text-center block w-full text-amber-500 font-black mt-5 hover:underline uppercase tracking-widest">Return to Login</button>
            </>
          ) : (
            <>
              <h2 className="text-4xl font-black uppercase tracking-tighter bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">SmartFridge AI</h2>
              <form onSubmit={handleAuthSubmit} className="space-y-4 mt-6">
                <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-slate-950 border-2 border-slate-800 px-4 py-3 rounded-none text-sm font-black text-slate-100 focus:border-amber-500 focus:outline-none" placeholder="Email Address" />
                <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-slate-950 border-2 border-slate-800 px-4 py-3 rounded-none text-sm font-black text-slate-100 focus:border-amber-500 focus:outline-none" placeholder="Password" />
                <div className="text-right"><button type="button" onClick={() => setIsForgotPasswordView(true)} className="text-[10px] text-slate-500 hover:text-amber-500 uppercase font-black tracking-widest">Forgot Password?</button></div>
                <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-orange-600 font-black py-4 text-xs uppercase tracking-widest text-slate-950 shadow-lg hover:from-amber-400 hover:to-orange-500">{authLoading ? "Verifying..." : (isSignUp ? "Register" : "Sign In")}</button>
              </form>
              <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-center block w-full text-amber-500 font-black mt-5 hover:underline uppercase tracking-widest">{isSignUp ? "Have an account? Login" : "Create Account"}</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans tracking-tight antialiased pb-12 selection:bg-amber-500 selection:text-slate-950">
      
      {/* HIGH CONTRAST BOLD NAVIGATION TOPBAR HEADER BLOCK */}
      <header className="bg-slate-900 border-b-4 border-slate-800 sticky top-0 z-40 px-4 sm:px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 w-full shadow-xl">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-black uppercase tracking-tighter bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">SmartFridge AI</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-0.5">Profile Matrix: <span className="text-amber-500 font-bold normal-case">{user.email}</span></p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-2 w-full md:w-auto">
          {/* Metadata context dropdown block */}
          <select value={storeName} onChange={(e) => setStoreName(e.target.value)} className="bg-slate-950 border-2 border-slate-800 text-[11px] font-black uppercase tracking-widest px-3 py-2.5 text-slate-300 focus:border-amber-500 focus:outline-none rounded-none cursor-pointer">
            <option value="Chipotle">Chipotle Matrix</option>
            <option value="Subway">Subway Station</option>
            <option value="Domino's">Domino's Delivery</option>
            <option value="Bharath Cafe">Bharath Cafe</option>
            <option value="Curry Corner">Curry Corner</option>
            <option value="Grocery Store">General Grocery</option>
          </select>
          <button onClick={handleGenerateAiRecipe} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] px-5 py-2.5 uppercase tracking-widest rounded-none transition-colors">🔮 AI Recipe</button>
          <button onClick={triggerStoreTripPlanner} className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-black text-[11px] px-5 py-2.5 uppercase tracking-widest border-2 border-slate-700 rounded-none">🛒 Trip Planner</button>
          <button onClick={() => setIsSettingsOpen(true)} className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-sans text-[11px] font-black uppercase tracking-widest border-2 border-slate-700 rounded-none flex items-center gap-2"><span>⚙️</span> Settings</button>
          <button onClick={handleSignOut} className="bg-slate-950 hover:bg-red-950 border-2 border-slate-800 hover:border-red-800 text-slate-400 hover:text-red-400 font-black text-[11px] px-4 py-2.5 uppercase tracking-widest rounded-none transition-colors">Sign Out</button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side Panels */}
        <div className="space-y-6 lg:col-span-1">
          {/* Optical Receipt Intake Scanner */}
          <div className="bg-slate-900 p-6 rounded-none border-2 border-slate-800 shadow-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">📸 Receipt Intake Scanner</h2>
            <div className="relative border-4 border-dashed border-slate-800 hover:border-amber-500 p-8 text-center bg-slate-950 rounded-none cursor-pointer transition-colors group">
              <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-300 group-hover:text-amber-400">Upload Grocery Receipt</p>
            </div>
            <form onSubmit={handleAddManualItem} className="flex gap-2 pt-5 mt-5 border-t-2 border-slate-800">
              <input type="text" value={manualItem} onChange={(e) => setManualItem(e.target.value)} placeholder="Add manual kitchen items..." className="flex-1 bg-slate-950 border-2 border-slate-800 px-4 py-2.5 rounded-none text-xs font-black text-slate-100 uppercase tracking-wide focus:border-amber-500 focus:outline-none" />
              <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black px-4 uppercase tracking-wider rounded-none">Add</button>
            </form>
          </div>

          {/* DYNAMIC PANTRY INLINE INTERACTIVE WORKING GRID */}
          <div className="bg-slate-900 p-6 rounded-none border-2 border-slate-800 shadow-xl">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex justify-between items-center mb-4"><span>🏡 Storage Pantry Stock</span><span className="bg-slate-950 text-amber-500 border-2 border-slate-800 px-2.5 py-0.5 text-[10px] font-black font-mono">{fridge.length}</span></h2>
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {fridge.length === 0 ? <p className="text-xs text-slate-500 font-black uppercase tracking-wider italic py-4">Pantry matrix empty.</p> : fridge.map((item) => (
                <div key={item.id} className="bg-slate-950 border-2 border-slate-800 p-2.5 rounded-none flex items-center justify-between gap-3 shadow-inner">
                  <div className="flex-1 min-w-0">
                    <input 
                      type="text" 
                      value={item.raw_name} 
                      onChange={(e) => handleUpdateInlineItem(item.id, e.target.value)}
                      className="w-full bg-transparent text-xs font-black text-slate-100 uppercase tracking-tight border-b-2 border-transparent hover:border-slate-800 focus:border-amber-500 focus:outline-none pb-0.5 transition-colors"
                    />
                    <div className="text-[9px] font-mono font-black text-slate-500 uppercase tracking-widest mt-0.5">Sanitized Noun: <span className="text-amber-500 normal-case font-bold">{item.item_name || 'Empty'}</span></div>
                  </div>
                  <button onClick={() => handleRemoveItem(item.id)} className="text-slate-600 hover:text-red-500 font-mono text-base font-black px-2">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* PROFILE SHOPPING LIST UTILITY COMPONENT PANEL */}
          <div className="bg-slate-900 p-6 rounded-none border-2 border-slate-800 shadow-xl">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">学术 Profile Shopping List</h2>
            <form onSubmit={(e) => handleAddShoppingItem(e, '')} className="flex gap-2 mb-4">
              <input type="text" value={shoppingInput} onChange={(e) => setShoppingInput(e.target.value)} placeholder="Type target shopping items..." className="flex-1 bg-slate-950 border-2 border-slate-800 px-4 py-2.5 rounded-none text-xs font-black text-slate-100 uppercase focus:border-amber-500 focus:outline-none" />
              <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black px-4 rounded-none">+</button>
            </form>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {shoppingList.length === 0 ? <p className="text-xs text-slate-500 font-black uppercase tracking-wider italic py-2">List vector clean.</p> : shoppingList.map((item) => (
                <div key={item.id} className="bg-slate-950 border-2 border-slate-800 p-2.5 rounded-none flex justify-between items-center shadow-md">
                  <div className="flex items-center gap-2 min-w-0">
                    <input type="checkbox" checked={item.is_completed} onChange={() => handleToggleShoppingCompleted(item.id, item.is_completed)} className="accent-amber-500 h-4 w-4 rounded-none cursor-pointer" />
                    <span className={`text-xs font-black uppercase tracking-tight truncate text-slate-200 ${item.is_completed ? 'line-through text-slate-600' : ''}`}>{item.item_name}</span>
                  </div>
                  <button onClick={() => handleClearShoppingItem(item.id)} className="text-slate-600 hover:text-red-500 font-mono text-xs font-bold px-1">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Layout Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* PINNED UNIQUE RECIPE TRACKING COMPONENT */}
          {savedRecipes.length > 0 && (
            <div className="bg-slate-900 p-6 rounded-none border-2 border-slate-800 shadow-xl">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">⭐ Saved Liked Recipes ({savedRecipes.length})</h2>
              <div className="flex flex-wrap gap-2">
                {savedRecipes.map((recipe) => (
                  <div key={recipe.id} className="bg-slate-950 border-2 border-slate-800 px-4 py-2 rounded-none flex items-center gap-3 shadow-md hover:border-amber-500 transition-colors">
                    <span onClick={() => { setServingMultiplier(1); setActiveModalRecipe(recipe); }} className="text-xs font-black uppercase text-slate-200 cursor-pointer hover:text-amber-400 tracking-tight transition-colors">{recipe.recipe_name}</span>
                    <button onClick={() => handleRemoveSavedRecipe(recipe.id)} className="text-slate-600 hover:text-red-500 font-mono text-sm font-black">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Core Sorter Engine Results Grid Panel */}
          <div className="bg-slate-900 p-4 sm:p-6 rounded-none border-2 border-slate-800 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xs font-black tracking-widest text-slate-400 uppercase">⚡ Personal Match Arrays</h2>
                <p className="text-[11px] text-slate-500 font-black uppercase tracking-wider mt-0.5">Ranked by real word-affinity matrix intersections</p>
              </div>
              <input type="text" placeholder="Search catalog recipes..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="w-full sm:w-64 bg-slate-950 border-2 border-slate-800 px-4 py-2 rounded-none text-xs font-black text-slate-100 uppercase tracking-wide focus:border-amber-500 focus:outline-none" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[580px] overflow-y-auto pr-2">
              {processedRecipes.slice(0, 40).map((recipe) => (
                <div 
                  key={recipe.id || recipe.name} 
                  className="p-4 bg-slate-950 hover:bg-slate-900 border-2 border-slate-800 hover:border-amber-500 rounded-none cursor-pointer transition-all flex flex-col justify-between shadow-xl group"
                >
                  <div onClick={() => { setServingMultiplier(1); setActiveModalRecipe(recipe); }}>
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-black uppercase tracking-tight text-slate-100 group-hover:text-amber-400 text-xs line-clamp-2 transition-colors leading-tight">{recipe.name}</h3>
                      <span className={`text-[10px] font-mono font-black shrink-0 px-2 py-0.5 rounded-none ${recipe.matchPercentage > 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>{recipe.matchPercentage}% MATCH</span>
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 mt-2.5 inline-block uppercase font-black tracking-widest">{recipe.meal_type || 'General'}</span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4 pt-2 border-t border-slate-800">
                    <div className="w-2/3 bg-slate-900 h-1.5 rounded-none overflow-hidden border border-slate-800">
                      <div className={`h-full ${recipe.matchPercentage > 0 ? 'bg-amber-500' : 'bg-slate-700'}`} style={{ width: `${recipe.matchPercentage}%` }}></div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleSaveRecipeToProfile(recipe); }} className="text-[10px] uppercase font-black text-amber-500 hover:text-amber-400 tracking-wider">⭐ Like</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ISOLATED FLUID OVERLAY DISPLAY VIEW CONTAINER MODAL */}
      {activeModalRecipe && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border-4 border-slate-800 w-full max-w-2xl rounded-none p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b-2 border-slate-800 pb-4 mb-5">
              <div>
                <span className="bg-slate-950 border border-slate-800 text-amber-500 font-mono text-[9px] px-2 py-0.5 uppercase font-black tracking-widest">{activeModalRecipe.meal_type}</span>
                <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter mt-1">{activeModalRecipe.name || activeModalRecipe.recipeName}</h3>
              </div>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button onClick={handleDownloadRecipeImage} className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black px-4 py-2.5 uppercase tracking-widest rounded-none shadow-md transition-colors">📸 Save Card Photo</button>
                <button onClick={() => { setActiveModalRecipe(null); setServingMultiplier(1); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black px-4 py-2.5 uppercase tracking-widest border-2 border-slate-700 rounded-none">Close</button>
              </div>
            </div>

            {/* Scale recipe serving size yields */}
            <div className="bg-slate-950 border-2 border-slate-800 p-3 rounded-none mb-6 flex items-center justify-between shadow-inner">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">👥 Adjust Servings Yield Index:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(num => (
                  <button key={num} onClick={() => setServingMultiplier(num)} className={`w-9 h-9 font-mono text-xs font-black transition-all rounded-none ${servingMultiplier === num ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-900 border-2 border-slate-800 text-slate-400 hover:bg-slate-800'}`}>{num}x</button>
                ))}
              </div>
            </div>

            {/* GRAPHICS BLUEPRINT ZONE TARGET: High-fidelity borders ensure download rendering execution */}
            <div className="p-2 bg-white rounded-none border-2 border-slate-200">
              <div ref={snapshotCardRef} className="bg-white p-6 space-y-6">
                <div className="border-b-2 border-slate-200 pb-4 text-center">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{activeModalRecipe.name || activeModalRecipe.recipeName}</h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">SmartFridge AI Custom Formulation Document • Serving Index {servingMultiplier}x</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Ingredients porting specifications block container lists with target additions buttons */}
                  <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-none shadow-inner">
                    <h4 className="text-[9px] font-black uppercase text-slate-400 font-mono border-b-2 border-slate-200 pb-1 mb-3">📋 Component Specifications</h4>
                    <ul className="space-y-3">
                      {(activeModalRecipe.ingredients || []).map((ing, idx) => {
                        const cleanIng = (ing || '').toLowerCase().trim();
                        const isOwned = tokensList.some(token => token && (cleanIng.includes(token) || token.includes(cleanIng)));
                        return (
                          <li key={idx} className="text-xs font-black text-slate-900 capitalize flex flex-col border-b border-slate-200 pb-2">
                            <span className="text-[8px] font-mono text-indigo-600 font-black tracking-wide uppercase">{getCleanMeasurement(ing, servingMultiplier)}</span>
                            <div className="flex justify-between items-center gap-1 mt-0.5">
                              <span className={isOwned ? 'text-slate-900' : 'text-slate-400 font-semibold'}>{ing}</span>
                              {/* Inject missing parameters directly into shopping manager maps */}
                              {!isOwned && (
                                <button data-html2canvas-ignore="true" onClick={() => handleAddShoppingItem(null, ing)} className="text-[9px] bg-amber-50 hover:bg-amber-100 text-amber-800 px-1.5 py-0.5 font-sans font-black uppercase tracking-wider border border-amber-200 shrink-0">
                                  + Buy item
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <h4 className="text-[9px] font-black uppercase text-slate-400 font-mono border-b-2 border-slate-200 pb-1">🔥 Preparation Progression Matrix</h4>
                    <ol className="space-y-2.5">
                      {getStaticRecipeSteps(activeModalRecipe).map((step, idx) => (
                        <li key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-none text-xs text-slate-700 flex gap-3 leading-relaxed">
                          <span className="font-mono font-black text-slate-900 bg-white border-2 border-slate-300 w-5 h-5 rounded-none flex items-center justify-center shrink-0 shadow-sm">{idx + 1}</span>
                          <p className="font-bold text-slate-700">{step}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Shopping Trip Planner Modal Box */}
      {isStoreAlertOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border-4 border-slate-800 w-full max-w-xl rounded-none p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">🔮 Market Procurement Matrix</h3>
              <button onClick={() => setIsStoreAlertOpen(false)} className="bg-slate-800 text-slate-300 text-[10px] font-black px-3 py-1.5 uppercase tracking-widest border-2 border-slate-700 rounded-none">Dismiss</button>
            </div>
            <div className="space-y-2.5">
              {shoppingAlerts.length === 0 ? (
                <p className="text-xs text-slate-500 font-black uppercase tracking-wider italic py-6 text-center">Add stock room tokens to reveal cooking gap solutions.</p>
              ) : (
                shoppingAlerts.slice(0, 15).map((alert, i) => (
                  <div key={i} onClick={() => { setIsStoreAlertOpen(false); setServingMultiplier(1); setActiveModalRecipe(alert.recipe); }} className="p-3.5 bg-slate-950 border-2 border-slate-800 hover:border-amber-500 rounded-none cursor-pointer transition-colors shadow-md group">
                    <div className="flex justify-between items-center">
                      <h4 className="font-black text-slate-200 text-xs group-hover:text-amber-400 uppercase tracking-tight transition-colors">{alert.recipe.name}</h4>
                      <span className="text-[8px] font-mono text-amber-500 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-none uppercase font-black tracking-widest">{alert.mealType}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-black uppercase tracking-wide mt-2">Target Store Purchases: <span className="text-amber-500 font-mono text-xs capitalize font-bold ml-0.5">{alert.missingItems.join(', ')}</span></p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Change Password panel drawer */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-slate-200 p-6 rounded-none w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center border-b-2 border-slate-200 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">🔒 Modify Profile Credentials</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-xs font-mono text-slate-500 hover:text-slate-800 font-black">✕</button>
            </div>
            <form onSubmit={handleChangePasswordInternally} className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono uppercase text-slate-400 mb-1 font-black tracking-widest">New System Password</label>
                <input type="password" required value={newPasswordValue} onChange={(e) => setNewPasswordValue(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 px-3 py-2.5 text-slate-900 text-xs font-black rounded-none" placeholder="••••••••" />
              </div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-none text-xs uppercase tracking-widest shadow-md transition-colors">Save New Password</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}