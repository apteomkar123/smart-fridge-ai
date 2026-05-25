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

  // AGGRESSIVE STRUCTURAL TOKENIZER: Extracts base noun entities globally from inputs
  const cleanIngredientGlobally = (rawName) => {
    if (!rawName) return '';
    let name = rawName.toLowerCase().trim();

    // 1. Strip packaging sizes, metrics, counts and volumes (e.g., "3 pack", "12oz", "6ct")
    name = name.replace(/\d+\s*(pack|pk|ct|count|oz|lb|g|ml|pcs|bag|box|can|container|bottle|pieces|slice|slices|fluid)\b/g, '');
    name = name.replace(/\b\d+\s*-\s*(pack|pk|ct|count)\b/g, '');
    name = name.replace(/['"\[\]\\]/g, ''); 
    name = name.replace(/\b\d+\b/g, ''); 

    // 2. Global Noise Vector Filtration: Removes descriptive adjectives
    const adjectiveNoiseFilters = /\b(large|small|medium|brown|white|pasture|raised|organic|fresh|natural|sweet|whole|sliced|diced|shredded|premium|xtra|extra|package|frozen|salted|unsalted|raw|cooked|all\s+natural|pure|authentic|style|brand|local|imported|gourmet|finest|crushed|minced|chopped|powder|ground|chilled|hot|spicy|mild|low\s+fat|fat\s+free|skimmed|heavy|light|dark|creamy)\b/g;
    name = name.replace(adjectiveNoiseFilters, '');

    let tokens = name.split(/[\s,/\-\(\)]+/).filter(t => t.length > 1);
    if (tokens.length === 0) return rawName.toLowerCase().trim();

    // 3. Stem plurals back to uniform singular matching targets
    let rootNoun = tokens[0];
    if (rootNoun.endsWith('ies') && rootNoun.length > 3) rootNoun = rootNoun.slice(0, -3) + 'y';
    else if (rootNoun.endsWith('es') && !rootNoun.endsWith('cheese') && rootNoun.length > 2) rootNoun = rootNoun.slice(0, -2);
    else if (rootNoun.endsWith('s') && !rootNoun.endsWith('cheese') && !rootNoun.endsWith('couscous') && rootNoun.length > 1) rootNoun = rootNoun.slice(0, -1);

    return rootNoun.trim();
  };

  const fetchAppData = async () => {
    if (!user) return;
    try {
      let { data: inventory, error: invError } = await supabase
        .from('fridge_inventory')
        .select('id, item_name, created_at')
        .eq('user_id', user.id);
      
      if (invError) throw invError;
      
      const normalizedFridge = (inventory || []).map(row => ({
        id: row.id,
        raw_name: row.item_name,
        item_name: cleanIngredientGlobally(row.item_name)
      }));
      setFridge(normalizedFridge);

      const plainTokensArray = normalizedFridge.map(f => f.item_name);
      calculateMacroMetrics(plainTokensArray);
      if (inventory && inventory.length > 0) generateExpirationTimelines(plainTokensArray);

      let { data: recipes, error: recError } = await supabase.from('recipes').select('*');
      if (recError) throw recError;

      const normalizedRecipes = (recipes || []).map(r => {
        let extracted = [];
        if (r.ingredients) {
          if (Array.isArray(r.ingredients)) {
            extracted = r.ingredients;
          } else {
            try {
              const p = JSON.parse(r.ingredients.trim());
              extracted = typeof p === 'string' ? JSON.parse(p) : p;
            } catch (e) {
              const words = String(r.ingredients).match(/"([^"\\]*(\\.[^"\\]*)*)"|\b[a-zA-Z\- ]+\b/g) || [];
              extracted = words.map(w => w.replace(/["'\[\]\\]/g, '').trim());
            }
          }
        }
        return { 
          ...r, 
          ingredients: Array.isArray(extracted) ? extracted.map(i => cleanIngredientGlobally(i)) : [] 
        };
      });
      setMasterRecipes(normalizedRecipes);
    } catch (err) {
      console.error(err.message);
    }
  };

  useEffect(() => {
    if (user) fetchAppData();
  }, [user]);

  // INLINE LIVE STORAGE PATCH CONTROLLER: Updates inventory inputs live to Supabase
  const handleUpdateInlineItem = async (id, updatedRawValue) => {
    try {
      const cleanToken = cleanIngredientGlobally(updatedRawValue);
      setFridge(prev => prev.map(item => item.id === id ? { ...item, raw_name: updatedRawValue, item_name: cleanToken } : item));
      
      await supabase
        .from('fridge_inventory')
        .update({ item_name: updatedRawValue })
        .eq('id', id);
    } catch (err) {
      console.error(err);
    }
  };

  // Calibrated Portions assignment multiplier configuration [cite: 2]
  const getCleanMeasurement = (ingredientName, multiplier) => {
    const baseAmount = 1;
    const scaledAmount = baseAmount * multiplier;
    if (['pizza dough', 'naan', 'bun', 'tortilla', 'croissant', 'bread'].some(x => ingredientName.toLowerCase().includes(x))) {
      return `${scaledAmount} Pcs`;
    }
    if (['cheese', 'mozzarella', 'sauce', 'pesto', 'cream'].some(x => ingredientName.toLowerCase().includes(x))) {
      return `${scaledAmount * 75}g`;
    }
    if (['paneer', 'tofu', 'tempeh', 'mushroom', 'potato', 'lentil', 'chickpea', 'bean', 'egg'].some(x => ingredientName.toLowerCase().includes(x))) {
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
      alert("📧 Reset link dispatched!");
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
      alert("✅ Password changed!");
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
      alert("⚙️ Password saved!");
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
        alert("🚀 Account created! Enter credentials to login.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword.trim() });
        if (error) throw error;
      }
    } catch (err) { alert(err.message); }
    finally { setAuthLoading(false); }
  };

  // HIGH FIDELITY EXPORT DOWNLOAD MACHINE: Solid layouts override browser canvas taints
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
      const hiddenLink = document.createElement('a');
      hiddenLink.href = dataUri;
      hiddenLink.download = `recipe-card-${Date.now()}.png`;
      document.body.appendChild(hiddenLink);
      hiddenLink.click();
      document.body.removeChild(hiddenLink);
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
          ingredients: (data.ingredients || []).map(i => cleanIngredientGlobally(i)), 
          meal_type: 'AI Synthesis Result', 
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
      const missing = recipeIngredients.filter(ing => !tokensList.includes(ing));
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

  const generateExpirationTimelines = (tokens) => {
    const freshMap = {};
    tokens.forEach(name => {
      freshMap[name] = { daysLeft: 6, statusLabel: 'STABLE' };
    });
    setExpirationMap(freshMap);
  };

  const getStaticRecipeSteps = (recipe) => {
    if (recipe && recipe.steps && recipe.steps.length > 0) return recipe.steps;
    const itemsList = recipe && recipe.ingredients ? recipe.ingredients : ['ingredients'];
    return [
      `Prep your primary base component selection (${itemsList[0] || 'vegetables'}).`,
      `Heat 2 tbsp of olive oil or cooking fat in an artisan skillet layout over medium heat.`,
      `Incorporate secondary structural elements: ${itemsList.slice(1).join(', ')}.`,
      `Cook thoroughly for 8-10 minutes, adjust seasoning to taste, and serve.`
    ];
  };

  // DYNAMIC COMPOSITION SORTER LAYER: Computes fuzzy word cross intersections natively 
  const tokensList = fridge.map(f => f.item_name);
  const processedRecipes = masterRecipes.map(recipe => {
    const recipeIngredients = recipe.ingredients || [];
    const total = recipeIngredients.length;
    
    // Scan if cleaned tokens cross reference any structural components of database strings
    const ownedCount = recipeIngredients.filter(ing => {
      return tokensList.some(token => ing.includes(token) || token.includes(ing));
    }).length;
    
    const matchPercentage = total > 0 ? Math.round((ownedCount / total) * 100) : 0;
    return { ...recipe, matchPercentage, ownedCount, totalCount: total };
  }).filter(recipe => {
    if (!recipeSearch) return true;
    return recipe.name && recipe.name.toLowerCase().includes(recipeSearch.toLowerCase());
  }).sort((a, b) => {
    if (b.matchPercentage !== a.matchPercentage) {
      return b.matchPercentage - a.matchPercentage;
    }
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
      
      {/* MOBILE RESPONSIVE WRAPPING BAR: Bypasses border constraints seamlessly  */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm w-full">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">SmartFridge AI</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">Account Profile: <span className="text-slate-600 normal-case font-semibold">{user.email}</span></p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-2 w-full md:w-auto">
          <button onClick={handleGenerateAiRecipe} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-extrabold text-[11px] px-4 py-2.5 rounded-xl uppercase tracking-wider transition-all border border-indigo-100">
            {aiGenerating ? "⚡ Processing..." : "🔮 AI Recipe"}
          </button>
          <button onClick={triggerStoreTripPlanner} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-extrabold text-[11px] px-4 py-2.5 rounded-xl uppercase tracking-wider shadow-sm">🛒 Trip Planner</button>
          
          {/* COMPOSITE UNIFORM SAN-SERIF DESIGN KEY */}
          <button onClick={() => setIsSettingsOpen(true)} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-100 text-slate-600 font-sans text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-2">
            <span>⚙️</span> Settings
          </button>
          
          <button onClick={handleSignOut} className="bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 font-bold text-[11px] px-4 py-2.5 rounded-xl uppercase tracking-wider transition-all border border-slate-200/40">Sign Out</button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6 lg:col-span-1">
          {/* Macros Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm">
            <h2 className="text-[11px] font-black tracking-widest uppercase text-slate-400 mb-4">📊 Nutrient Allocation Monitor</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-indigo-50/40 border border-indigo-100/60 p-3 rounded-2xl"><p className="text-[10px] text-indigo-500 font-extrabold uppercase">Protein</p><p className="text-xl font-black text-indigo-600 mt-1">{nutritionMetrics.protein}g</p></div>
              <div className="bg-purple-50/40 border border-purple-100/60 p-3 rounded-2xl"><p className="text-[10px] text-purple-500 font-extrabold uppercase">Carbs</p><p className="text-xl font-black text-purple-600 mt-1">{nutritionMetrics.carbs}g</p></div>
              <div className="bg-pink-50/40 border border-pink-100/60 p-3 rounded-2xl"><p className="text-[10px] text-pink-500 font-extrabold uppercase">Fats</p><p className="text-xl font-black text-pink-600 mt-1">{nutritionMetrics.fat}g</p></div>
            </div>
          </div>

          {/* Optical Intake Scanner Node */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">📸 Receipt Intake Scanner</h2>
            <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 p-8 text-center bg-slate-50 rounded-2xl cursor-pointer transition-all group">
              <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <p className="text-xs font-bold text-slate-600">Upload Grocery Receipt</p>
            </div>
            <form onSubmit={handleAddManualItem} className="flex gap-2 pt-5 mt-5 border-t border-slate-100">
              <input type="text" value={manualItem} onChange={(e) => setManualItem(e.target.value)} placeholder="Add item (e.g. croissants 3 pack)..." className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-medium text-slate-700 focus:outline-none" />
              <button type="submit" className="bg-slate-800 text-white text-xs font-bold px-4 rounded-xl">Add</button>
            </form>
          </div>

          {/* DYNAMIC PANTRY INLINE GRID PANEL NODE */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
            <h2 className="text-xs font-black text-slate-400 uppercase flex justify-between items-center mb-4"><span>🏡 Interactive Storage Pantry</span><span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold">{fridge.length}</span></h2>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {fridge.length === 0 ? <p className="text-xs text-slate-400 italic py-4">No pantry tokens present.</p> : fridge.map((item) => (
                <div key={item.id} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between gap-3 shadow-sm group">
                  <div className="flex-1 min-w-0">
                    {/* EDITABLE DYNAMIC ENTRY FIELD */}
                    <input 
                      type="text" 
                      value={item.raw_name} 
                      onChange={(e) => handleUpdateInlineItem(item.id, e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-slate-700 tracking-tight capitalize border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none pb-0.5 transition-all"
                      title="Click inside text box to alter database strings dynamically"
                    />
                    <div className="text-[9px] font-mono font-bold text-indigo-500/80 uppercase tracking-wider mt-0.5">Sanitized: <span className="text-slate-400 lowercase">{item.item_name || 'Empty'}</span></div>
                  </div>
                  <button onClick={() => handleRemoveItem(item.id)} className="text-slate-300 hover:text-red-500 font-mono text-sm px-2 transition-colors">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Catalog Match Display list frame */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/60 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xs font-black tracking-widest text-slate-400 uppercase">⚡ Personal Match Arrays</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Ranked by top real-time ingredient composition match counts </p>
            </div>
            <input type="text" placeholder="Search master recipe names..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} className="w-full sm:w-64 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs text-slate-700 focus:outline-none" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[580px] overflow-y-auto pr-2">
            {processedRecipes.slice(0, 40).map((recipe) => (
              <div 
                key={recipe.id || recipe.name} 
                onClick={() => { setServingMultiplier(1); setActiveModalRecipe(recipe); }} 
                className="p-4 bg-slate-50 hover:bg-white border border-slate-200/60 hover:border-indigo-400 hover:-translate-y-0.5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between shadow-sm group animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-extrabold text-slate-700 group-hover:text-indigo-600 text-xs line-clamp-2 tracking-tight transition-colors">{recipe.name}</h3>
                    <span className={`text-[10px] font-mono font-black shrink-0 px-2 py-0.5 rounded ${
                      recipe.matchPercentage > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'
                    }`}>{recipe.matchPercentage}% MATCH</span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-md mt-2.5 inline-block uppercase font-bold tracking-wide">{recipe.meal_type || 'General'}</span>
                </div>
                <div className="w-full bg-slate-200 h-1 rounded-full mt-4 overflow-hidden">
                  <div className={`h-full ${recipe.matchPercentage > 0 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${recipe.matchPercentage}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* DETAILED CARD MODAL EXTENSION PANELS */}
      {activeModalRecipe && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-100 pb-4 mb-5">
              <div>
                <span className="bg-indigo-50 text-indigo-600 font-mono text-[9px] px-2 py-0.5 rounded-md uppercase font-black">{activeModalRecipe.meal_type}</span>
                <h3 className="text-xl font-black text-slate-800 tracking-tight mt-1">{activeModalRecipe.name || activeModalRecipe.recipeName}</h3>
              </div>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button onClick={handleDownloadRecipeImage} className="bg-slate-800 hover:bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95">
                  📸 Save Card Photo
                </button>
                <button onClick={() => { setActiveModalRecipe(null); setServingMultiplier(1); }} className="bg-slate-100 text-slate-500 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200">Close</button>
              </div>
            </div>

            {/* Scale active portions dynamically configuration state [cite: 2] */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl mb-6 flex items-center justify-between shadow-inner">
              <span className="text-xs font-extrabold text-slate-500 uppercase font-mono pl-1">👥 Scale Servings Multiplier:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(num => (
                  <button 
                    key={num} 
                    onClick={() => setServingMultiplier(num)} 
                    className={`w-9 h-9 rounded-xl font-mono text-xs font-black transition-all ${
                      servingMultiplier === num ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {num}x
                  </button>
                ))}
              </div>
            </div>

            {/* PRINT DOM TARGET LAYER CONTAINER: Text plain structures keep files compiling flawlessly */}
            <div className="p-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div ref={snapshotCardRef} className="bg-white p-6 rounded-xl space-y-6">
                <div className="border-b border-slate-200 pb-4 text-center">
                  <h2 className="text-xl font-black text-indigo-600 uppercase tracking-wide">{activeModalRecipe.name || activeModalRecipe.recipeName}</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase font-mono mt-1">SmartFridge AI Custom Blueprint Document • Serving Scaler {servingMultiplier}x [cite: 2]</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Ingredients portions specs column [cite: 2] */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-inner">
                    <h4 className="text-[9px] font-black uppercase text-slate-400 font-mono border-b border-slate-200 pb-1 mb-3">📋 Component Specifications</h4>
                    <ul className="space-y-2">
                      {activeModalRecipe.ingredients?.map((ing, idx) => (
                        <li key={idx} className="text-xs font-bold text-slate-700 capitalize flex flex-col border-b border-slate-200/40 pb-1.5">
                          <span className="text-[8px] font-mono text-purple-500 font-black tracking-wide uppercase">
                            {getCleanMeasurement(ing, servingMultiplier)}
                          </span>
                          <span className="text-slate-700 mt-0.5">{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Progressive culinary roadmap text directions column */}
                  <div className="md:col-span-2 space-y-3">
                    <h4 className="text-[9px] font-black uppercase text-slate-400 font-mono border-b border-slate-100 pb-1">🔥 Culinary Progression Matrix</h4>
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

      {/* Shopping Trip Planner Modal Box [cite: 3] */}
      {isStoreAlertOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">🔮 Market Procurement Matrix</h3>
              <button onClick={() => setIsStoreAlertOpen(false)} className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-200/60">Dismiss</button>
            </div>
            <div className="space-y-2.5">
              {shoppingAlerts.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">Add matching core items to your stock room to reveal grocery store gap layouts[cite: 3].</p>
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

      {/* Internal Settings Modal Drawer */}
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