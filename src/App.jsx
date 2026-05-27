import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
import domtoimage from 'dom-to-image-more';
import { 
  ChefHat, 
  Refrigerator, 
  ShoppingCart, 
  User, 
  History, 
  BarChart3, 
  Users 
} from 'lucide-react';
import { 
  cleanIngredientLocally, 
  normalizeIngredientTokens, 
  getStaticRecipeSteps, 
  matchesRecipeFilter, 
  triggerHaptic,
  isVegetarianIngredient
} from './components/recipeUtils';

// Components (To be created)
import Header from './components/Header';
import PantryManager from './components/PantryManager';
import RecipeExplorer from './components/RecipeExplorer';
import ShoppingListManager from './components/ShoppingListManager';
import RecipeModal from './components/RecipeModal';
import CookingMode from './components/CookingMode';
import HouseholdSettings from './components/HouseholdSettings';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AuthManager from './components/AuthManager';
import { useUser } from './components/UserContext';
import { RecipeProvider, useRecipes } from './components/RecipeContext';
import { useInventory } from './components/useInventory';

function MainApp() {
  const { user, household, userName, handleSignOut, loading: authLoading } = useUser();
  
  const {
    fridge,
    shoppingList,
    nutritionMetrics,
    loading: inventoryLoading,
    receiptLoading,
    barcodeLoading,
    barcodeResult,
    isScanningBarcode,
    barcodeInput,
    setBarcodeInput,
    storeName,
    error: inventoryError,
    setIsScanningBarcode,
    handleAddManualItem,
    handleRemoveItem,
    handleAddShoppingItem,
    handleToggleShoppingCompleted,
    handleClearShoppingItem,
    handleBarcodeLookup,
    handleFileUpload,
    handleUpdateInlineItem
  } = useInventory(user, household);

  const {
    processedRecipes,
    handleGenerateAiRecipe,
    activeModalRecipe,
    setActiveModalRecipe,
    savedRecipes
  } = useRecipes();

  const [isResettingPasswordMode, setIsResettingPasswordMode] = useState(false);
  
  // Input Handling States
  const [manualItem, setManualItem] = useState('');
  
  // Advanced Matrix Tracking States
  const [aiGenerating, setAiGenerating] = useState(false);

  // Navigation UI Layout States
  const [recipeSearch, setRecipeSearch] = useState('');
  const [activeRecipeFilter, setActiveRecipeFilter] = useState('all');
  const [shoppingAlerts, setShoppingAlerts] = useState([]);
  const [isStoreAlertOpen, setIsStoreAlertOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pantry');

  // New Feature States
  const [isCookingMode, setIsCookingMode] = useState(false);
  const [urlRecipeId, setUrlRecipeId] = useState(null);
  const [urlHouseholdId, setUrlHouseholdId] = useState(null);

  // Added items tracking for modal
  const [addedItems, setAddedItems] = useState(new Set());

  // Dynamic Servings Multiplier State
  const [servingMultiplier, setServingMultiplier] = useState(1);

  const snapshotCardRef = useRef(null);

  useEffect(() => {
    // Parse URL parameters for shared recipes
    const params = new URLSearchParams(window.location.search);
    const recipeIdFromUrl = params.get('recipe');
    const householdIdFromUrl = params.get('hh');

    if (recipeIdFromUrl) setUrlRecipeId(recipeIdFromUrl);
    if (householdIdFromUrl) setUrlHouseholdId(householdIdFromUrl);
  }, []);

  // Effect to open recipe modal from URL
  useEffect(() => {
    if (urlRecipeId && processedRecipes.length > 0) {
      const recipeToOpen = processedRecipes.find(r => String(r.id) === urlRecipeId);
      if (recipeToOpen) {
        setActiveModalRecipe(recipeToOpen);
        setActiveTab('recipes');
      }
      setUrlRecipeId(null);
      setUrlHouseholdId(null);
    }
  }, [urlRecipeId, processedRecipes]);

  const buildCreativeRecipePrompt = (pantryItems) => {
    const ingredientList = pantryItems.slice(0, 10).join(', ');
    return `You are a creative vegetarian chef. Invent a new recipe idea using these ingredients: ${ingredientList}. Create one unique vegetarian dish with an original name, a concise ingredient list that uses the supplied pantry items, and 4-6 short preparation steps. Output only valid JSON with keys: recipeName, ingredients, steps.`;
  };

  const fetchCreativeRecipeFromAi = async (pantryItems) => {
    const prompt = buildCreativeRecipePrompt(pantryItems);
    const response = await fetch('/.netlify/functions/scan-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPrompt: prompt })
    });
    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_err) {
      const cleaned = text.replace(/```json|```/g, '').trim();
      try { parsed = JSON.parse(cleaned); } catch (err) { throw new Error('AI response parsing failed'); }
    }
    if (!parsed || !parsed.recipeName) {
      throw new Error('AI did not return a valid recipe');
    }
    return {
      id: `ai-${Date.now()}`,
      name: parsed.recipeName,
      meal_type: 'Creative',
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      cleanedIngredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.map(cleanIngredientLocally).filter(Boolean) : [],
      steps: Array.isArray(parsed.steps) ? parsed.steps : [String(parsed.steps || '').trim()].filter(Boolean)
    };
  };

  const generateLocalCreativeRecipe = (pantryItems) => {
    const unique = Array.from(new Set(pantryItems.map(p => cleanIngredientLocally(p)).filter(Boolean)));
    const take = unique.slice(0, 8);
    const name = `${take[0] ? take[0].split(' ')[0] : 'Pantry'} ${take[1] ? take[1].split(' ')[0] : 'Mix'} Bowl`;
    const ingredients = take.map(i => i);
    const steps = [
      `Prep the following: ${ingredients.join(', ')}.`,
      'Combine in a skillet with oil over medium heat.',
      'Simmer briefly until flavors meld and texture is pleasant.',
      'Adjust seasoning and serve warm.'
    ];
    return {
      id: `local-ai-${Date.now()}`,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      meal_type: 'Creative',
      ingredients,
      cleanedIngredients: ingredients.map(cleanIngredientLocally).filter(Boolean),
      steps
    };
  };

  const resolveSanitizedTokenOnline = async (rawInputString) => {
    const localToken = cleanIngredientLocally(rawInputString);
    if (!rawInputString || !rawInputString.trim()) return localToken;
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolveItemToken: rawInputString, storeContext: storeName })
      });
      if (response.ok) {
        const data = await response.json();
        const aiToken = cleanIngredientLocally(data.sanitized || '');
        if (!aiToken) return localToken;

        const localTokens = new Set(normalizeIngredientTokens(localToken));
        const aiTokens = new Set(normalizeIngredientTokens(aiToken));
        const overlap = [...localTokens].filter(token => aiTokens.has(token));

        if (overlap.length > 0) {
          return aiToken;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return localToken;
  };

  const parseMealDbRecipe = (meal) => {
    const ingredients = [];
    for (let i = 1; i <= 20; i += 1) {
      const ingredient = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (ingredient && ingredient.trim()) {
        const cleanedIngredient = `${measure ? measure.trim() : ''} ${ingredient.trim()}`.trim();
        ingredients.push(cleanedIngredient);
      }
    }
    const steps = String(meal.strInstructions || '')
      .split(/\r?\n+/)
      .map((step) => step.trim())
      .filter(Boolean);

    return {
      id: meal.idMeal,
      name: meal.strMeal || `Recipe ${meal.idMeal}`,
      meal_type: meal.strCategory || meal.strArea || 'General',
      ingredients,
      steps
    };
  };

  const fetchOnlineRecipes = async () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const results = await Promise.all(letters.map(async (letter) => {
      try {
        const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?f=${letter}`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.meals || [];
      } catch (err) {
        console.error('Online recipe fetch failed for', letter, err);
        return [];
      }
    }));
    const meals = results.flat();
    const uniqueMeals = Array.from(new Map(meals.map((meal) => [meal.idMeal, meal])).values());
    return uniqueMeals.map(parseMealDbRecipe);
  };

  const fetchAppData = async () => {
    if (!user) return;
    try {
      let { data: inventory } = await supabase.from('fridge_inventory').select('*, expiry_date').eq('user_id', user.id);
      const normalizedFridge = (inventory || []).map(row => {
        const rawNameField = row.item_name || row.item || row.name || '';
        return {
          id: row.id,
          raw_name: rawNameField,
          item_name: cleanIngredientLocally(rawNameField),
          expiry_date: row.expiry_date // Include expiry date
        };
      }).filter(item => item.raw_name);
      setFridge(normalizedFridge);

      const plainTokensArray = normalizedFridge.map(f => f.item_name).filter(Boolean);
      calculateMacroMetrics(plainTokensArray);

      const shopQuery = supabase.from('shopping_list').select('*').order('created_at', { ascending: true });
      if (household?.id) shopQuery.eq('household_id', household.id);
      else shopQuery.eq('user_id', user.id);
      
      let { data: shopItems } = await shopQuery;
      setShoppingList(shopItems || []);

      const likedQuery = supabase.from('saved_recipes').select('*');
      likedQuery.eq('user_id', user.id); // Liked recipes usually stay personal
      let { data: likedRecipes } = await likedQuery;
      setSavedRecipes(likedRecipes || []);

      let onlineRecipes = [];
      try {
        onlineRecipes = await fetchOnlineRecipes();
      } catch (err) {
        console.error('Failed to fetch online recipes', err);
      }

      if (onlineRecipes.length > 0) {
        const normalizedRecipes = onlineRecipes.map((recipe) => {
          const cleanedIngredients = (recipe.ingredients || []).map((i) => cleanIngredientLocally(i)).filter(Boolean);
          const steps = Array.isArray(recipe.steps)
            ? recipe.steps.map((step) => String(step || '').trim()).filter(Boolean)
            : String(recipe.steps || '').split(/\r?\n+/).map((step) => String(step || '').trim()).filter(Boolean);
          return {
            ...recipe,
            ingredients: recipe.ingredients || [],
            cleanedIngredients,
            steps
          };
        }).filter((recipe) => {
          const joinedIngredients = (Array.isArray(recipe.cleanedIngredients) ? recipe.cleanedIngredients : []).join(' ').toLowerCase();
          return isVegetarianIngredient(joinedIngredients);
        });
        setMasterRecipes(normalizedRecipes);
        setRecipeCount(normalizedRecipes.length);
      } else {
        let { data: recipes } = await supabase.from('recipes').select('*').limit(10000);
        const parseIngredientArray = (raw) => {
          if (!raw) return [];
          if (Array.isArray(raw)) return raw.map(i => String(i || '').trim()).filter(Boolean);
          const text = String(raw).trim();
          if (!text) return [];
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed.map(i => String(i || '').trim()).filter(Boolean);
            if (typeof parsed === 'string') return [parsed.trim()];
          } catch (e) {}
          const splitItems = text.split(/[\r\n,;•–—]+/).map(i => String(i || '').trim()).filter(Boolean);
          if (splitItems.length > 1) return splitItems;
          const quotedItems = [...String(text).matchAll(/"([^"']+)"|'([^"']+)'/g)].map(m => m[1] || m[2]).filter(Boolean);
          if (quotedItems.length) return quotedItems;
          if (text.includes(' and ')) return text.split(/ and /i).map(i => String(i || '').trim()).filter(Boolean);
          return [text];
        };
        const parseStepArray = (raw) => {
          if (!raw) return [];
          if (Array.isArray(raw)) return raw.map(i => String(i || '').trim()).filter(Boolean);
          let text = String(raw).trim();
          if (!text) return [];
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed.map(i => String(i || '').trim()).filter(Boolean);
            if (typeof parsed === 'string') text = parsed.trim();
          } catch (e) {}
          if (text.includes('\n')) return text.split(/\r?\n+/).map(i => String(i || '').trim()).filter(Boolean);
          const numbered = text.split(/\d+\.\s*/).map(i => String(i || '').trim()).filter(Boolean);
          if (numbered.length > 1) return numbered;
          const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/).map(i => String(i || '').trim()).filter(Boolean);
          return sentences.length > 1 ? sentences : [text];
        };
        const normalizedRecipes = (recipes || []).map(r => {
          const parsedIngredients = parseIngredientArray(r.ingredients || r.ingredient_list || r.items || '');
          const parsedSteps = parseStepArray(r.steps || r.instructions || r.method || '');
          const cleanedIngredients = parsedIngredients.map(i => cleanIngredientLocally(i)).filter(Boolean);
          return {
            ...r,
            name: r.name || r.recipe_name || r.title || 'Untitled Recipe Formulation',
            meal_type: r.meal_type || r.category || r.type || 'General',
            ingredients: parsedIngredients,
            cleanedIngredients,
            steps: parsedSteps
          };
        }).filter((recipe) => {
          const joinedIngredients = (Array.isArray(recipe.cleanedIngredients) ? recipe.cleanedIngredients : []).join(' ').toLowerCase();
          return isVegetarianIngredient(joinedIngredients);
        });
        setMasterRecipes(normalizedRecipes);
        setRecipeCount(normalizedRecipes.length);
      }
    } catch (err) {
      console.error(err.message);
    }
  };

  useEffect(() => {
    if (user) fetchAppData();
  }, [user]);

  const handleUpdateInlineItem = async (id, updatedRawValue) => {
    setFridge(prev => (prev || []).map(item => item.id === id ? { ...item, raw_name: updatedRawValue, item_name: cleanIngredientLocally(updatedRawValue) } : item));
    await supabase.from('fridge_inventory').update({ item_name: updatedRawValue }).eq('id', id); // Ensure DB column name matches
  };

  const handleAddShoppingItem = async (e, textOverride = '', price = 0) => {
    if (e) e.preventDefault();
    const targetText = textOverride || shoppingInput;
    if (!targetText || !targetText.trim()) return;

    const resolvedTokenName = cleanIngredientLocally(targetText);
    if (!resolvedTokenName) return;

    const alreadyLocal = (shoppingList || []).some(i => String(i.item_name || '').toLowerCase() === resolvedTokenName.toLowerCase());
    if (alreadyLocal) {
      alert('Item already in list');
      return;
    }

    const { data, error } = await supabase.from('shopping_list').insert([{
      user_id: user.id,
      household_id: household?.id || null,
      item_name: resolvedTokenName,
      is_completed: false,
      price: price // Include price
    }]).select();

    if (!error && data) setShoppingList(prev => [...(prev || []), data[0]]);
  };

  const handleToggleShoppingCompleted = async (id, status) => {
    setShoppingList(prev => (prev || []).map(item => item.id === id ? { ...item, is_completed: !status } : item));
    await supabase.from('shopping_list').update({ is_completed: !status }).eq('id', id);
  };

  const handleClearShoppingItem = async (id) => {
    setShoppingList(prev => (prev || []).filter(item => item.id !== id));
    await supabase.from('shopping_list').delete().eq('id', id);
  };

  const handleSaveRecipeToProfile = async (recipe) => {
    if ((savedRecipes || []).some(r => r.recipe_id === String(recipe.id))) return alert("Recipe already liked!");
    const { data, error } = await supabase.from('saved_recipes').insert([{
      user_id: user.id,
      recipe_id: String(recipe.id),
      recipe_name: recipe.name,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      meal_type: recipe.meal_type || 'General'
    }]).select();
    if (!error && data) setSavedRecipes(prev => [...(prev || []), data[0]]);
  };

  const handleUpdateProfileName = async (newName) => {
    if (!user || !newName.trim()) return;
    const trimmed = newName.trim();
    const { data, error } = await supabase.from('profiles').update({ name: trimmed }).eq('id', user.id).select().single();
    if (error || !data) {
      const { data: inserted, error: insertError } = await supabase.from('profiles').insert({ id: user.id, name: trimmed }).select().single();
      if (!insertError && inserted) {
        setUserName(inserted.name || trimmed);
        return;
      }
    } else {
      setUserName(data.name || trimmed);
    }
  };

  const handleRemoveSavedRecipe = async (id) => {
    setSavedRecipes(prev => (prev || []).filter(r => r.id !== id));
    await supabase.from('saved_recipes').delete().eq('id', id);
  };

  const handleAddToShoppingFromRecipe = (ing) => {
    const cleaned = cleanIngredientLocally(ing);
    handleAddShoppingItem(cleaned); // Pass cleaned ingredient directly
    setAddedItems(prev => new Set(prev).add(ing));
  };

  const handleDownloadRecipeImage = async () => {
    if (!snapshotCardRef.current) return;
    try {
      const original = snapshotCardRef.current;
      const clone = original.cloneNode(true);
      clone.style.backgroundColor = '#ffffff';
      clone.style.width = `${original.offsetWidth}px`;
      clone.style.minHeight = `${original.offsetHeight}px`;
      clone.style.display = 'block';
      clone.style.boxSizing = 'border-box';

      const wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.backgroundColor = '#ffffff';
      wrapper.style.overflow = 'visible';
      wrapper.style.pointerEvents = 'none';
      wrapper.style.zIndex = '9999';
      wrapper.appendChild(clone);

      document.body.appendChild(wrapper);
      const blob = await domtoimage.toBlob(clone, {
        bgcolor: '#ffffff',
        cacheBust: true,
        width: clone.scrollWidth || original.offsetWidth,
        height: clone.scrollHeight || original.offsetHeight,
        style: {
          overflow: 'visible',
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: `${clone.scrollWidth || original.offsetWidth}px`,
          height: `${clone.scrollHeight || original.offsetHeight}px`,
          backgroundColor: '#ffffff'
        },
        quality: 1
      });
      document.body.removeChild(wrapper);
      if (!blob) throw new Error('Unable to render recipe card image');
      const filename = `${(activeModalRecipe.name || activeModalRecipe.recipeName || 'recipe-card').toLowerCase().replace(/\s+/g, '-')}.png`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    } catch (err) {
      console.error(err);
      try {
        const dataUri = await domtoimage.toPng(snapshotCardRef.current, { bgcolor: '#ffffff', quality: 1, style: { backgroundColor: '#ffffff' } });
        const fallbackLink = document.createElement('a');
        fallbackLink.href = dataUri;
        fallbackLink.download = `${(activeModalRecipe.name || activeModalRecipe.recipeName || 'recipe-card').toLowerCase().replace(/\s+/g, '-')}.png`;
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        fallbackLink.remove();
      } catch (fallbackErr) {
        console.error('Fallback export also failed', fallbackErr);
      }
    }
  };

  const triggerStoreTripPlanner = () => {
    const pantryTokens = (fridge || []).map(f => f.item_name).filter(Boolean);
    const alerts = (processedRecipes || [])
      .filter(recipe => recipe.matchPercentage > 10 && recipe.matchPercentage < 100)
      .slice(0, 20)
      .map(recipe => {
        const missingItems = (recipe.cleanedIngredients || []).filter(ing => {
          return !pantryTokens.some(token => token && (ing.includes(token) || token.includes(ing)));
        }).slice(0, 5);
        return { recipe, missingItems, mealType: recipe.meal_type || 'General' };
      })
      .filter(alert => alert.missingItems.length > 0);

    setShoppingAlerts(alerts);
    setIsStoreAlertOpen(true);
  };

  // All recipe-related logic is now in RecipeContext/useRecipes
  // const processedRecipes = useMemo(() => { ... });

  // All household-related logic is now in UserContext
  // const handleJoinHousehold = async (code) => { ... };
  // const handleCreateHousehold = async (name) => { ... };

  // All profile name update logic is now in UserContext
  // const handleUpdateProfileName = async (newName) => { ... };

  // All sign out logic is now in UserContext
  // const handleSignOut = async () => { ... };

  // All item removal logic is now in useInventory
  // const handleRemoveItem = async (id) => { ... };

  // All manual item add logic is now in useInventory
  // const handleAddManualItem = async (e) => { ... };

  // All barcode lookup logic is now in useInventory
  // const handleBarcodeLookup = async (e, directValue = null) => { ... };

  // All file upload logic is now in useInventory
  // const handleFileUpload = async (e) => { ... };

  // All macro calculation logic is now in useInventory
  // const calculateMacroMetrics = (tokens) => { ... };

  // All expiring soon logic is now in useInventory or recipeUtils
  // const isExpiringSoon = (date) => { ... };

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-50 text-slate-900 font-sans font-black tracking-tight antialiased flex items-center justify-center p-6 select-none">
        <AuthManager />
      </div>
    );
  }

  if (authLoading || inventoryLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (inventoryError) return <div className="min-h-screen flex items-center justify-center text-red-500">Error: {inventoryError}</div>;

  return (
    <div className="min-h-screen bg-blue-50/50 text-slate-800 font-sans antialiased pb-24 selection:bg-[#6BAEE0] selection:text-white">
      <div className="w-full flex justify-center">
        <Header />
      </div>

      <main className="w-full flex justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-5xl">
          {activeTab === 'pantry' && (
            <PantryManager 
              fridge={fridge}
              handleAddManualItem={handleAddManualItem}
              manualItem={manualItem}
              setManualItem={setManualItem}
              handleUpdateInlineItem={handleUpdateInlineItem}
              handleRemoveItem={handleRemoveItem}
              receiptLoading={receiptLoading}
              handleFileUpload={handleFileUpload}
              barcodeInput={barcodeInput}
              setBarcodeInput={setBarcodeInput}
              handleBarcodeLookup={handleBarcodeLookup}
              barcodeLoading={barcodeLoading}
              barcodeResult={barcodeResult}
              isScanningBarcode={isScanningBarcode}
              setIsScanningBarcode={setIsScanningBarcode}
            />
          )}
          {activeTab === 'recipes' && <RecipeExplorer />}
          {activeTab === 'shopping' && <ShoppingListManager list={shoppingList} onAdd={(val) => handleAddShoppingItem(val)} onToggle={handleToggleShoppingCompleted} onClear={handleClearShoppingItem} />}
          {activeTab === 'analytics' && <AnalyticsDashboard metrics={nutritionMetrics} fridge={fridge} shoppingList={shoppingList} />}
          {activeTab === 'household' && <HouseholdSettings />}
          {activeTab === 'saved' && <div className="space-y-6">
             {savedRecipes && savedRecipes.map(recipe => (
                <div key={recipe.id} className="bg-white/80 p-6 rounded-3xl border border-blue-100 flex justify-between items-center shadow-sm">
                   <h3 onClick={() => setActiveModalRecipe(recipe)} className="font-bold cursor-pointer text-slate-700 hover:text-[#6BAEE0]">{recipe.recipe_name}</h3>
                   <button onClick={() => handleRemoveSavedRecipe(recipe.id)} className="text-red-400 font-black">×</button>
                </div>
             ))}
          </div>}
        </div>
      </main>

      {/* Bottom Mobile Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white/80 backdrop-blur-2xl border border-white/50 rounded-full h-16 shadow-2xl flex items-center justify-around px-6 z-40 transition-all hover:scale-[1.02]">
        <button onClick={() => { triggerHaptic(); setActiveTab('pantry'); }} className={`p-2 rounded-full transition-all ${activeTab === 'pantry' ? 'bg-sky-50 text-[#6BAEE0]' : 'text-slate-400'}`}><Refrigerator size={24} /></button>
        <button onClick={() => { triggerHaptic(); setActiveTab('recipes'); }} className={`p-2 rounded-full transition-all ${activeTab === 'recipes' ? 'bg-sky-50 text-[#6BAEE0]' : 'text-slate-400'}`}><ChefHat size={24} /></button>
        <button onClick={() => { triggerHaptic(); setActiveTab('shopping'); }} className={`p-2 rounded-full transition-all ${activeTab === 'shopping' ? 'bg-sky-50 text-[#6BAEE0]' : 'text-slate-400'}`}><ShoppingCart size={24} /></button>
        <button onClick={() => { triggerHaptic(); setActiveTab('analytics'); }} className={`p-2 rounded-full transition-all ${activeTab === 'analytics' ? 'bg-sky-50 text-[#6BAEE0]' : 'text-slate-400'}`}><BarChart3 size={24} /></button>
        <button onClick={() => { triggerHaptic(); setActiveTab('household'); }} className={`p-2 rounded-full transition-all ${activeTab === 'household' ? 'bg-sky-50 text-[#6BAEE0]' : 'text-slate-400'}`}><Users size={24} /></button>
      </nav>

      {activeModalRecipe && (
        <RecipeModal 
          recipe={activeModalRecipe} 
          // multiplier and setMultiplier are now managed by useRecipes
          // onStartCooking and addedItems are still passed as props
          onClose={() => setActiveModalRecipe(null)}
          onStartCooking={() => setIsCookingMode(true)}
          addedItems={addedItems}
          onAddIngredient={handleAddToShoppingFromRecipe} // Pass substitutions to RecipeModal if needed
          household={household}
        />
      )}

      {isCookingMode && activeModalRecipe && (
        <CookingMode 
          steps={getStaticRecipeSteps(activeModalRecipe)} 
          onClose={() => setIsCookingMode(false)} 
        />
      )}

      {isStoreAlertOpen && (
        <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-3xl bg-white rounded-[2.5rem] border border-blue-100 shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800">Shopping Suggestions</h3>
                <p className="text-sm text-slate-500">Recipes that almost match your pantry ingredients and missing items you can add to your list.</p>
              </div>
              <button onClick={() => setIsStoreAlertOpen(false)} className="text-slate-400 hover:text-slate-700 font-black text-2xl">×</button>
            </div>
            {shoppingAlerts.length === 0 ? (
              <div className="rounded-3xl bg-blue-50 p-6 text-center text-slate-600">
                No shopping suggestions found yet. Add pantry items and try again.
              </div>
            ) : (
              <div className="grid gap-4">
                {shoppingAlerts.map((alert, idx) => (
                  <div key={idx} className="bg-slate-50 border border-blue-50 rounded-3xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] uppercase tracking-widest font-black text-slate-400 bg-blue-50 px-3 py-1 rounded-full">{alert.mealType}</span>
                      <span className="text-xs font-bold text-slate-500">Missing {alert.missingItems.length}</span>
                    </div>
                    <h4 className="font-bold text-slate-800 mb-3">{alert.recipe.name}</h4>
                    <div className="flex flex-wrap gap-2">
                      {alert.missingItems.map((item, i) => (
                        <span key={i} className="text-[11px] text-slate-600 bg-white border border-blue-100 rounded-full px-3 py-1">{item}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 text-right">
              <button onClick={() => { setIsStoreAlertOpen(false); setActiveTab('shopping'); }} className="bg-[#6BAEE0] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-100">Go to Shopping List</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { user, household } = useUser();
  const { fridge } = useInventory(user, household);
  return (
    <RecipeProvider fridge={fridge}>
      <MainApp />
    </RecipeProvider>
  );
}
