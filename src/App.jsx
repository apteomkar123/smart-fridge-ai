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

  // NEW INTERNET RESOLUTION PARSER CONNECT NODE
  const resolveSanitizedTokenOnline = async (rawInputString) => {
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolveItemToken: rawInputString, storeContext: storeName })
      });
      if (response.ok) {
        const data = await response.json();
        return data.sanitized || rawInputString.toLowerCase().trim();
      }
    } catch (e) {
      console.error("Online lookup fault, parsing with local backup engine.", e);
    }
    return rawInputString.toLowerCase().trim();
  };

  const fetchAppData = async () => {
    if (!user) return;
    try {
      // Fetch Storage Inventory
      let { data: inventory } = await supabase.from('fridge_inventory').select('*').eq('user_id', user.id);
      const normalizedFridge = (inventory || []).map(row => ({
        id: row.id,
        raw_name: row.item_name,
        // Calculate an immediate placeholder or keep string fallback arrays cleanly
        item_name: row.item_name.toLowerCase().replace(/\b(organic|fresh|large|small|pack|count|raised|pasture)\b/g, '').trim()
      }));
      setFridge(normalizedFridge);

      const plainTokensArray = normalizedFridge.map(f => f.item_name);
      calculateMacroMetrics(plainTokensArray);
      if (plainTokensArray.length > 0) generateExpirationTimelines(plainTokensArray);

      // Fetch Shopping List Array Vectors
      let { data: shopItems } = await supabase.from('shopping_list').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
      setShoppingList(shopItems || []);

      // Fetch Saved Recipe Layout Selections
      let { data: likedRecipes } = await supabase.from('saved_recipes').select('*').eq('user_id', user.id);
      setSavedRecipes(likedRecipes || []);

      // Fetch Global Recipes Matrix
      let { data: recipes } = await supabase.from('recipes').select('*');
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
        return { ...r, ingredients: Array.isArray(extracted) ? extracted.map(i => i.toLowerCase().trim()) : [] };
      });
      setMasterRecipes(normalizedRecipes);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) fetchAppData();
  }, [user]);

  // LIVE INLINE FRIDGE MODIFY ENGINE WRITER
  const handleUpdateInlineItem = async (id, updatedRawValue) => {
    setFridge(prev => prev.map(item => item.id === id ? { ...item, raw_name: updatedRawValue } : item));
    // Run an online lookup call to update the background matching data models
    const resolvedNounToken = await resolveSanitizedTokenOnline(updatedRawValue);
    setFridge(prev => prev.map(item => item.id === id ? { ...item, item_name: resolvedNounToken } : item));
    
    await supabase.from('fridge_inventory').update({ item_name: updatedRawValue }).eq('id', id);
  };

  // SHOPPING LIST METHODS SYSTEM
  const handleAddShoppingItem = async (e, textOverride = '') => {
    if (e) e.preventDefault();
    const targetText = textOverride || shoppingInput;
    if (!targetText.trim()) return;

    const resolvedTokenName = await resolveSanitizedTokenOnline(targetText);
    const { data, error } = await supabase.from('shopping_list').insert([{
      user_id: user.id,
      item_name: resolvedTokenName,
      is_completed: false
    }]).select();

    if (!error && data) setShoppingList(prev => [...prev, data[0]]);
    if (!textOverride) setShoppingInput('');
    await fetchAppData();
  };

  const handleToggleShoppingCompleted = async (id, status) => {
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, is_completed: !status } : item));
    await supabase.from('shopping_list').update({ is_completed: !status }).eq('id', id);
  };

  const handleClearShoppingItem = async (id) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
    await supabase.from('shopping_list').delete().eq('id', id);
  };

  // SAVED LIKED RECIPES ENGINE MODULES
  const handleSaveRecipeToProfile = async (recipe) => {
    // Avoid double saves
    if (savedRecipes.some(r => r.recipe_id === String(recipe.id))) return alert("Recipe card already liked!");
    
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
      alert("⭐ Recipe catalog entry pinned safely to user records!");
    }
  };

  const handleRemoveSavedRecipe = async (id) => {
    setSavedRecipes(prev => prev.filter(r => r.id !== id));
    await supabase.from('saved_recipes').delete().eq('id', id);
  };

  // Measurement Scalar Utility
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

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!authEmail.trim()) return alert("Enter email.");
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), { redirectTo: window.location.origin });
      if (error) throw error;
      alert("📧 Reset layout token dispatched!");
      setIsForgotPasswordView(false);
    } catch (err) { alert(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleResetPasswordConfirmation = async (e) => {
    e.preventDefault();
    if (newPasswordValue.trim().length < 6) return alert("Min 6 chars.");
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPasswordValue.trim() });
      if (error) throw error;
      alert("✅ Password altered!");
      setIsResettingPasswordMode(false);
    } catch (err) { alert(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleChangePasswordInternally = async (e) => {
    e.preventDefault();
    if (newPasswordValue.trim().length < 6) return alert("Min 6 chars.");
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPasswordValue.trim() });
      if (error) throw error;
      alert("⚙️ Settings saved!");
      setIsSettingsOpen(false);
    } catch (err) { alert(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword.trim() });
        if (error) throw error;
        alert("🚀 Profile registered! Log in with your credentials.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword.trim() });
        if (error) throw error;
      }
    } catch (err) { alert(err.message); }
    finally { setAuthLoading(false); }
  };

  // RE-ENGINEERED CANVAS DOWNLOAD EXECUTOR: Isolates graphics layers perfectly
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
      const testAnchor = document.createElement('a');
      testAnchor.href = dataUri;
      testAnchor.download = `recipe-formulation-card.png`;
      document.body.appendChild(testAnchor);
      testAnchor.click();
      document.body.removeChild(testAnchor);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateAiRecipe = async () => {
    const tokensList = fridge.map(f => f.item_name);
    if (tokensList.length === 0) return alert("Pantry empty.");
    setAiGenerating(true);
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: "", customPrompt: `Review these core ingredients: ${tokensList.join(', ')}.` })
      });
      if (response.ok) {
        const data = await response.json();
        setActiveModalRecipe({ 
          name: data.recipeName, 
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
    const tokensList = fridge.map(f => f.item_name);
    masterRecipes.forEach(recipe => {
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
      await fetchAppData();
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
            const parsedTokenOnline = await resolveSanitizedTokenOnline(rawItem.trim());
            await supabase.from('fridge_inventory').insert([{ item_name: parsedTokenOnline, user_id: user.id }]);
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
    
    const parsedOnlineToken = await resolveSanitizedTokenOnline(input);
    await supabase.from('fridge_inventory').insert([{ item_name: parsedOnlineToken, user_id: user.id }]);
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

  const getStaticRecipeSteps = (recipe) => {
    if (recipe && recipe.steps && recipe.steps.length > 0) return recipe.steps;
    return [
      `Carefully prepare your primary base ingredients.`,
      `Heat 2 tbsp of cooking oil in an artisan pan over medium heat channels.`,
      `Incorporate secondary structural elements cleanly, cooking for 8-10 minutes.`,
      `Garnish with fresh herbs, adjust seasoning lines, and serve immediate.`
    ];
  };

  // HIGH-PERFORMANCE STRING AFFINITY MATRIX FILTERING ENGINE
  const tokensList = fridge.map(f => f.item_name);
  const processedRecipes = masterRecipes.map(recipe => {
    const recipeIngredients = recipe.ingredients || [];
    const total = recipeIngredients.length;
    
    // Evaluate if any of your active pantry words cross-reference the ingredient strings anywhere
    const ownedCount = recipeIngredients.filter(ing => {
      const cleanIng = ing.toLowerCase().trim();
      return tokensList.some(token => cleanIng.includes(token) || token.includes(cleanIng));
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
      <div className="min-h-screen bg-[#f3f4f6] text-slate-800 font-sans antialiased flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 p-8 rounded-3xl w-full max-w-md shadow-xl relative">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          {isForgotPasswordView ? (
            <>
              <h2 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Recover Password</h2>
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 mt-6">
                <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-xs font-medium text-slate-700" placeholder="Type your email" />
                <button type="submit" className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-widest">Send Reset Link</button>
              </form>
              <button onClick={() => setIsForgotPasswordView(false)} className="text-xs text-center block w-full text-indigo-600 font-bold mt-5 hover:underline">Return to Login</button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">SmartFridge AI</h2>
              <form onSubmit={handleAuthSubmit} className="space-y-4 mt-6">
                <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-xs font-medium text-slate-700" placeholder="Email Address" />
                <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-xs font-medium text-slate-700" placeholder="Password" />
                <div className="text-right"><button type="button" onClick={() => setIsForgotPasswordView(true)} className="text-[11px] text-slate-400 hover:text-indigo-600/80">Forgot Password?</button></div>
                <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 font-bold py-3.5 rounded-2xl text-xs uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20">{authLoading ? "Verifying..." : (isSignUp ? "Register" : "Sign In")}</button>
              </form>
              <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-center block w-full text-indigo-600 font-bold mt-5 hover:underline">{isSignUp ? "Have an account? Login" : "Create Account"}</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased pb-12">
      
      {/* HEADER SECTION WRAPPING REPAIR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm w-full">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">SmartFridge AI</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">Account Profile: <span className="text-slate-600 normal-case font-semibold">{user.email}</span></p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-2 w-full md:w-auto">
          {/* Store Name Context Selection Dropdown */}
          <select value={storeName} onChange={(e) => setStoreName(e.target.value)} className="bg-slate-50 border border-slate-200 text-[11px] font-bold uppercase tracking-wide rounded-xl px-3 py-2 text-slate-600 focus:outline-none">
            <option value="Chipotle">Chipotle</option>
            <option value="Subway">Subway</option>
            <option value="Domino's">Domino's</option>
            <option value="Bharath Cafe">Bharath Cafe</option>
            <option value="Curry Corner">Curry Corner</option>
            <option value="Grocery Store">General Store</option>
          </select>
          <button onClick={handleGenerateAiRecipe} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-extrabold text-[11px] px-4 py-2.5 rounded-xl uppercase tracking-wider transition-all border border-indigo-100">🔮 AI Recipe</button>
          <button onClick={triggerStoreTripPlanner} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-[11px] px-4 py-2.5 rounded-xl uppercase tracking-wider shadow-sm">🛒 Trip Planner</button>
          <button onClick={() => setIsSettingsOpen(true)} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-100 text-slate-600 font-sans text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-2"><span>⚙️</span> Settings</button>
          <button onClick={handleSignOut} className="bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 font-bold text-[11px] px-4 py-2.5 rounded-xl uppercase tracking-wider border border-slate-200/40">Sign Out</button>
        </div>
      </header>

      {/* Workspace Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Control Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Scanner Node */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">📸 Receipt Intake Scanner</h2>
            <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 p-8 text-center bg-slate-50 rounded-2xl cursor-pointer transition-all group">
              <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <p className="text-xs font-bold text-slate-600">Upload Grocery Receipt</p>
            </div>
            <form onSubmit={handleAddManualItem} className="flex gap-2 pt-5 mt-5 border-t border-slate-100">
              <input type="text" value={manualItem} onChange={(e) => setManualItem(e.target.value)} placeholder="Add manual item details..." className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none" />
              <button type="submit" className="bg-slate-800 text-white text-xs font-bold px-4 rounded-xl">Add</button>
            </form>
          </div>

          {/* DYNAMIC PANTRY INLINE GRID PANEL NODE */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
            <h2 className="text-xs font-black text-slate-400 uppercase flex justify-between items-center mb-4"><span>🏡 Storage Pantry Stock</span><span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold">{fridge.length}</span></h2>
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {fridge.length === 0 ? <p className="text-xs text-slate-400 italic py-4">Pantry empty.</p> : fridge.map((item) => (
                <div key={item.id} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between gap-3 shadow-sm group">
                  <div className="flex-1 min-w-0">
                    <input 
                      type="text" 
                      value={item.raw_name} 
                      onChange={(e) => handleUpdateInlineItem(item.id, e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-slate-700 tracking-tight capitalize border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none pb-0.5 transition-all"
                    />
                    <div className="text-[9px] font-mono font-bold text-indigo-500/80 uppercase tracking-wider mt-0.5">Sanitized: <span className="text-slate-400 lowercase">{item.item_name || 'Empty'}</span></div>
                  </div>
                  <button onClick={() => handleRemoveItem(item.id)} className="text-slate-300 hover:text-red-500 font-mono text-sm px-2">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* NEW FEATURE: SHOPPING LIST MANAGER DRAWER */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">📝 Profile Shopping List</h2>
            <form onSubmit={(e) => handleAddShoppingItem(e, '')} className="flex gap-2 mb-4">
              <input type="text" value={shoppingInput} onChange={(e) => setShoppingInput(e.target.value)} placeholder="Add store purchase items..." className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none" />
              <button type="submit" className="bg-slate-800 text-white text-xs font-bold px-3 rounded-xl">+</button>
            </form>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {shoppingList.length === 0 ? <p className="text-xs text-slate-400 italic py-2">List empty.</p> : shoppingList.map((item) => (
                <div key={item.id} className="bg-slate-50 border border-slate-200/40 p-2.5 rounded-xl flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <input type="checkbox" checked={item.is_completed} onChange={() => handleToggleShoppingCompleted(item.id, item.is_completed)} className="accent-indigo-600 rounded cursor-pointer" />
                    <span className={`text-xs font-bold capitalize truncate text-slate-700 ${item.is_completed ? 'line-through text-slate-300' : ''}`}>{item.item_name}</span>
                  </div>
                  <button onClick={() => handleClearShoppingItem(item.id)} className="text-slate-300 hover:text-red-500 font-mono text-xs px-1">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Main Grid Deck Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* NEW FEATURE: SAVED RECIPES PANEL BLOCK */}
          {savedRecipes.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">⭐ Saved Liked Recipes ({savedRecipes.length})</h2>
              <div className="flex flex-wrap gap-2">
                {savedRecipes.map((recipe) => (
                  <div key={recipe.id} className="bg-slate-50 border border-slate-200/80 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-sm hover:border-indigo-400 transition-all">
                    <span onClick={() => { setServingMultiplier(1); setActiveModalRecipe(recipe); }} className="text-xs font-bold text-slate-700 cursor-pointer hover:text-indigo-600">{recipe.recipe_name}</span>
                    <button onClick={() => handleRemoveSavedRecipe(recipe.id)} className="text-slate-300 hover:text-red-500 font-mono text-sm font-black">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Primary Match Deck Arrays Grid */}
          <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/60 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xs font-black tracking-widest text-slate-400 uppercase">⚡ Personal Match Arrays</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Dynamically sorted against 6,000 unique entries</p>
              </div>
              <input type="text" placeholder="Search master recipe indexes..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="w-full sm:w-64 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs text-slate-700 focus:outline-none" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[580px] overflow-y-auto pr-2">
              {processedRecipes.slice(0, 40).map((recipe) => (
                <div 
                  key={recipe.id || recipe.name} 
                  className="p-4 bg-slate-50 hover:bg-white border border-slate-200/60 hover:border-indigo-400 hover:-translate-y-0.5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between shadow-sm group"
                >
                  <div onClick={() => { setServingMultiplier(1); setActiveModalRecipe(recipe); }}>
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-extrabold text-slate-700 group-hover:text-indigo-600 text-xs line-clamp-2 tracking-tight transition-colors">{recipe.name}</h3>
                      <span className={`text-[10px] font-mono font-black shrink-0 px-2 py-0.5 rounded ${recipe.matchPercentage > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>{recipe.matchPercentage}% MATCH</span>
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-md mt-2.5 inline-block uppercase font-bold tracking-wide">{recipe.meal_type || 'General'}</span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4 pt-2 border-t border-slate-200/40">
                    <div className="w-2/3 bg-slate-200 h-1 rounded-full overflow-hidden">
                      <div className={`h-full ${recipe.matchPercentage > 0 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${recipe.matchPercentage}%` }}></div>
                    </div>
                    {/* Like Action Toggle Badge */}
                    <button onClick={(e) => { e.stopPropagation(); handleSaveRecipeToProfile(recipe); }} className="text-xs hover:scale-110 transition-transform">⭐ Like</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* FULL UNTAINTED SCREENSHOT CAPTURE MODAL OVERLAY */}
      {activeModalRecipe && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-100 pb-4 mb-5">
              <div>
                <span className="bg-indigo-50 text-indigo-600 font-mono text-[9px] px-2 py-0.5 rounded-md uppercase font-black">{activeModalRecipe.meal_type}</span>
                <h3 className="text-xl font-black text-slate-800 tracking-tight mt-1">{activeModalRecipe.name || activeModalRecipe.recipeName}</h3>
              </div>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button onClick={handleDownloadRecipeImage} className="bg-slate-800 hover:bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all">📸 Save Card Photo</button>
                <button onClick={() => { setActiveModalRecipe(null); setServingMultiplier(1); }} className="bg-slate-100 text-slate-500 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200">Close</button>
              </div>
            </div>

            {/* Serving Count Multiplier State adjustment switcher bar */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl mb-6 flex items-center justify-between shadow-inner">
              <span className="text-xs font-extrabold text-slate-500 uppercase font-mono pl-1">👥 Increase Yield Servings:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(num => (
                  <button key={num} onClick={() => setServingMultiplier(num)} className={`w-9 h-9 rounded-xl font-mono text-xs font-black transition-all ${servingMultiplier === num ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{num}x</button>
                ))}
              </div>
            </div>

            {/* HIGH-FIDELITY PHOTO Blueprint SNAPSHOT CANVAS TARGET BOX CONTAINER */}
            <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div ref={snapshotCardRef} className="bg-white p-6 rounded-xl space-y-6">
                <div className="border-b border-slate-200 pb-4 text-center">
                  <h2 className="text-xl font-black text-indigo-600 uppercase tracking-wide">{activeModalRecipe.name || activeModalRecipe.recipeName}</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase font-mono mt-1">SmartFridge AI Formulation Document • Yield Index {servingMultiplier}x</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Ingredients Component specs with interactive missing items tracking nodes */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-inner">
                    <h4 className="text-[9px] font-black uppercase text-slate-400 font-mono border-b border-slate-200 pb-1 mb-3">📋 Component Specifications</h4>
                    <ul className="space-y-3">
                      {activeModalRecipe.ingredients?.map((ing, idx) => {
                        const cleanIng = ing.toLowerCase().trim();
                        const isOwned = tokensList.some(t => cleanIng.includes(t) || t.includes(cleanIng));
                        return (
                          <li key={idx} className="text-xs font-bold text-slate-700 capitalize flex flex-col border-b border-slate-200/40 pb-2">
                            <span className="text-[8px] font-mono text-purple-500 font-black tracking-wide uppercase">{getCleanMeasurement(ing, servingMultiplier)}</span>
                            <div className="flex justify-between items-center gap-1 mt-0.5">
                              <span className={isOwned ? 'text-slate-700' : 'text-slate-400 font-semibold'}>{ing}</span>
                              {/* NEW FEATURE ACTION BUTTON: Add ingredient directly to Shopping list instantly */}
                              {!isOwned && (
                                <button onClick={() => handleAddShoppingItem(null, ing)} className="text-[9px] bg-amber-50 hover:bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 transition-colors shrink-0 font-sans tracking-tight">
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
                    <h4 className="text-[9px] font-black uppercase text-slate-400 font-mono border-b border-slate-100 pb-1">🔥 Preparation Progression Matrix</h4>
                    <ol className="space-y-2.5">
                      {(activeModalRecipe.isAiGeneratedElement ? activeModalRecipe.steps : getStaticRecipeSteps(activeModalRecipe)).map((step, idx) => (
                        <li key={idx} className="bg-slate-50 border border-slate-200/40 p-3 rounded-xl text-xs text-slate-600 flex gap-3 leading-relaxed">
                          <span className="font-mono font-black text-indigo-600 bg-white border border-slate-200 w-5 h-5 rounded-md flex items-center justify-center shrink-0 shadow-sm">{idx + 1}</span>
                          <p className="font-semibold text-slate-600">{step}</p>
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">🔮 Market Procurement Matrix</h3>
              <button onClick={() => setIsStoreAlertOpen(false)} className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-200/60">Dismiss</button>
            </div>
            <div className="space-y-2.5">
              {shoppingAlerts.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">Add core matching parameters to pantry stocks to compute market gap solutions.</p>
              ) : (
                shoppingAlerts.slice(0, 15).map((alert, i) => (
                  <div key={i} onClick={() => { setIsStoreAlertOpen(false); setServingMultiplier(1); setActiveModalRecipe(alert.recipe); }} className="p-3.5 bg-slate-50 border border-slate-200/60 hover:border-indigo-400 rounded-2xl cursor-pointer transition-all shadow-sm group">
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-slate-700 text-xs group-hover:text-indigo-600 transition-colors">{alert.recipe.name}</h4>
                      <span className="text-[8px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase font-bold">{alert.mealType}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-semibold mt-2">Target Store Purchases: <span className="text-indigo-600 font-mono text-xs capitalize font-bold ml-0.5">{alert.missingItems.join(', ')}</span></p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Change Password panel drawer */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">🔒 Modify Profile Credentials</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-xs font-mono text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleChangePasswordInternally} className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono uppercase text-slate-400 mb-1">New System Password</label>
                <input type="password" required value={newPasswordValue} onChange={(e) => setNewPasswordValue(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 rounded-xl text-xs" placeholder="••••••••" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wide shadow-sm">Save New Password</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}