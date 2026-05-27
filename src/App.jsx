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

// Components (To be created)
import Header from './components/Header';
import PantryManager from './components/PantryManager';
import RecipeExplorer from './components/RecipeExplorer';
import ShoppingListManager from './components/ShoppingListManager';
import RecipeModal from './components/RecipeModal';
import CookingMode from './components/CookingMode';
import HouseholdSettings from './components/HouseholdSettings';
import AnalyticsDashboard from './components/AnalyticsDashboard';

// --- Utilities moved outside component to prevent re-creation and improve clarity ---

const vegetarianBlocklist = [
  'chicken', 'beef', 'pork', 'fish', 'shrimp', 'salmon', 'ham', 'bacon', 'anchovy', 'turkey', 'lamb', 'duck', 'mutton', 'veal', 'crab', 'lobster', 'sausage', 'pepperoni'
];

const isVegetarianIngredient = (value) => {
  if (!value) return true;
  const normalized = String(value).toLowerCase();
  return !vegetarianBlocklist.some(token => normalized.includes(token));
};

const cleanIngredientLocally = (rawName) => {
  if (!rawName) return '';
  let name = String(rawName).toLowerCase().trim();
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  name = name.replace(/[\u2013\u2014•]/g, ' ');
  name = name.replace(/\d+/g, ' ');
  name = name.replace(/\b(?:organic|fresh|large|small|medium|extra|reduced fat|low fat|low-sodium|low sodium|unsalted|sliced|diced|chopped|shredded|minced|ground|boneless|skinless|prepared|peeled|packaged|package|pack|can|canned|jar|bottle|tube|stick|slice|pieces|piece|cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|grams|gram|g|kg|pounds|pound|lb|lbs|oz|ounces|fluid|fl oz|ml|ltr|liter|litre|pkg|ct|count)\b/g, ' ');
  name = name.replace(/[^a-z0-9\s]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  return name;
};

const normalizeIngredientTokens = (value) => {
  const clean = cleanIngredientLocally(value);
  return Array.from(new Set(clean.split(/\s+/).filter(Boolean)));
};

const formatIngredientMeasurement = (ingredientString, multiplier) => {
  const lower = String(ingredientString).toLowerCase();
  const nameOnly = ingredientString.replace(/^[0-9\/\.\s\-½⅓¼¾⅛]+/, '').trim();
  if (/\b(cup|cups|ml|l|liter|litre|milk|yogurt|broth|water)\b/.test(lower)) return `${1 * multiplier} cup ${nameOnly}`;
  if (/\b(tbsp|tablespoon|tablespoons|oil|sauce|vinegar|soy)\b/.test(lower)) return `${1 * multiplier} tbsp ${nameOnly}`;
  if (/\b(tsp|teaspoon|teaspoons|garlic|ginger|salt|pepper|spice|herb)\b/.test(lower)) return `${0.5 * multiplier} tsp ${nameOnly}`;
  if (/\b(flour|rice|lentil|sugar|pasta|beans)\b/.test(lower)) return `${1 * multiplier} cup ${nameOnly}`;
  if (/\b(onion|tomato|potato|carrot|apple)\b/.test(lower)) return `${1 * multiplier} medium ${nameOnly}`;
  if (/\b(paneer|tofu|cheese|yogurt)\b/.test(lower)) {
    const oz = Math.max(1, Math.round((100 * multiplier) / 28.35));
    return `${oz} oz ${nameOnly}`;
  }
  return `${1 * multiplier} each ${nameOnly}`;
};

const getStaticRecipeSteps = (recipe) => {
  if (!recipe) return ['Follow the ingredient list to create the dish.'];
  const rawSteps = recipe.steps || recipe.instructions || recipe.step || [];
  let steps = [];
  if (Array.isArray(rawSteps)) {
    steps = rawSteps.map(step => String(step || '').trim()).filter(Boolean);
  } else {
    const textSteps = String(rawSteps || '').trim();
    if (textSteps.includes('\n')) steps = textSteps.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    else if (textSteps) steps = [textSteps];
  }
  if (steps && steps.length) return steps;
  const ingList = (recipe.cleanedIngredients || []).slice(0, 8).map(i => i.replace(/^[0-9\/\.\s\-½⅓¼¾⅛]+/, '').trim());
  const firstFew = ingList.length ? ingList.join(', ') : 'your ingredients';
  return [
    `Prep: gather ${firstFew}.`,
    'Combine the ingredients in a suitable pan or bowl.',
    'Cook or bake until ingredients are tender and flavors meld (approx. 10–25 minutes).',
    'Taste and adjust seasoning, then serve warm.'
  ];
};

const parseRecipeIngredientMeasurements = (ingredientString, multiplier) => {
  if (!ingredientString) return '';
  const numericTokenMatch = ingredientString.match(/^([0-9\/\.\s\-½⅓¼¾⅛]+)/);
  if (numericTokenMatch) {
    const rawNumberString = numericTokenMatch[1].trim();
    let baseVal = parseFloat(rawNumberString);
    if (isNaN(baseVal)) {
      if (rawNumberString.includes('½')) baseVal = 0.5;
      else if (rawNumberString.includes('¼')) baseVal = 0.25;
      else if (rawNumberString.includes('¾')) baseVal = 0.75;
      else baseVal = 1.0; 
    }
    return `${baseVal * multiplier} ${ingredientString.substring(numericTokenMatch[0].length).trim()}`;
  }
  return formatIngredientMeasurement(ingredientString, multiplier);
};

// Subtle Haptic Feedback utility (Web Standard)
const triggerHaptic = (intensity = 10) => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(intensity);
  }
};

export default function App() 
{
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
  const [recipeCount, setRecipeCount] = useState(0);
  const [shoppingList, setShoppingList] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Input Handling States
  const [manualItem, setManualItem] = useState('');
  const [shoppingInput, setShoppingInput] = useState('');
  const [storeName, setStoreName] = useState('General Grocery');
  
  // Advanced Matrix Tracking States
  const [aiGenerating, setAiGenerating] = useState(false);
  const [nutritionMetrics, setNutritionMetrics] = useState({ protein: 0, carbs: 0, fat: 0 });

  // Navigation UI Layout States
  const [recipeSearch, setRecipeSearch] = useState('');
  const [activeRecipeFilter, setActiveRecipeFilter] = useState('all');
  const [shoppingAlerts, setShoppingAlerts] = useState([]);
  const [isStoreAlertOpen, setIsStoreAlertOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeModalRecipe, setActiveModalRecipe] = useState(null);
  const [activeTab, setActiveTab] = useState('pantry');

  // New Feature States
  const [isCookingMode, setIsCookingMode] = useState(false);
  const [household, setHousehold] = useState(null);

  // Added items tracking for modal
  const [addedItems, setAddedItems] = useState(new Set());

  // Dynamic Servings Multiplier State
  const [servingMultiplier, setServingMultiplier] = useState(1);

  const snapshotCardRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchHousehold(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchHousehold(session.user.id);
      } else {
        setUser(null);
        setHousehold(null);
      }
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPasswordMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchHousehold = async (userId) => {
    const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', userId).single();
    if (profile?.household_id) {
      const { data: hh } = await supabase.from('households').select('*').eq('id', profile.household_id).single();
      setHousehold(hh);
      fetchAppData(profile.household_id); // Re-fetch data for the household
    }
  };

  const recipeCategoryMatches = (recipe, patterns) => {
    const text = `${recipe.meal_type || ''} ${recipe.name || ''} ${(recipe.cleanedIngredients || []).join(' ')}`.toLowerCase();
    return patterns.some((pattern) => text.includes(pattern));
  };

  const isRecipeVegan = (recipe) => {
    const nonVegan = ['egg', 'eggs', 'milk', 'butter', 'cheese', 'cream', 'yogurt', 'honey', 'gelatin', 'paneer', 'whey'];
    return !(recipe.cleanedIngredients || []).some((ing) => nonVegan.some((token) => ing.includes(token)));
  };

  const isRecipeMeat = (recipe) => {
    const meatTokens = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham', 'veal', 'duck', 'venison', 'mutton'];
    return (recipe.cleanedIngredients || []).some((ing) => meatTokens.some((token) => ing.includes(token)));
  };

  const isRecipeFish = (recipe) => {
    const fishTokens = ['fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'anchovy', 'trout', 'cod', 'seafood'];
    return (recipe.cleanedIngredients || []).some((ing) => fishTokens.some((token) => ing.includes(token)));
  };

  const isRecipeEgg = (recipe) => {
    return (recipe.cleanedIngredients || []).some((ing) => /(egg|eggs)/.test(ing));
  };

  const matchesRecipeFilter = (recipe, filter) => {
    switch (filter) {
      case 'vegetarian':
        return !isRecipeMeat(recipe) && !isRecipeFish(recipe);
      case 'vegan':
        return isRecipeVegan(recipe);
      case 'breakfast':
        return recipeCategoryMatches(recipe, ['breakfast', 'morning', 'brunch']);
      case 'lunch':
        return recipeCategoryMatches(recipe, ['lunch', 'sandwich', 'salad', 'bowl']);
      case 'dinner':
        return recipeCategoryMatches(recipe, ['dinner', 'supper', 'main', 'casserole', 'stew', 'pasta']);
      case 'dessert':
        return recipeCategoryMatches(recipe, ['dessert', 'cake', 'pie', 'pudding', 'sweet', 'custard', 'ice cream', 'brownie']);
      case 'snack':
        return recipeCategoryMatches(recipe, ['snack', 'finger', 'appetizer', 'dip', 'nibble', 'side']);
      case 'meat':
        return isRecipeMeat(recipe);
      case 'fish':
        return isRecipeFish(recipe);
      case 'egg':
        return isRecipeEgg(recipe);
      default:
        return true;
    }
  };

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
      let { data: inventory } = await supabase.from('fridge_inventory').select('*').eq('user_id', user.id);
      const normalizedFridge = (inventory || []).map(row => {
        const rawNameField = row.item_name || row.item || row.name || '';
        return {
          id: row.id,
          raw_name: rawNameField,
          item_name: cleanIngredientLocally(rawNameField)
        };
      }).filter(item => item.raw_name);
      setFridge(normalizedFridge);

      const plainTokensArray = normalizedFridge.map(f => f.item_name).filter(Boolean);
      calculateMacroMetrics(plainTokensArray);

      const shopQuery = supabase.from('shopping_list').select('*').order('created_at', { ascending: true });
      if (householdId || household?.id) shopQuery.eq('household_id', householdId || household.id);
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

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword.trim() });
        if (error) throw error;
        alert("PROFILE CREATED SUCCESSFULLY!");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword.trim() });
        if (error) throw error;
      }
    } catch (err) { alert(err.message); }
    finally { setAuthLoading(false); }
  };

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
      if (!textOverride) setShoppingInput('');
      return;
    }

    const { data, error } = await supabase.from('shopping_list').insert([{
      user_id: user.id,
      household_id: household?.id || null,
      item_name: resolvedTokenName,
      is_completed: false,
      price: price
    }]).select();

    if (!error && data) setShoppingList(prev => [...(prev || []), data[0]]);
    if (!textOverride) setShoppingInput('');
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

  const handleRemoveSavedRecipe = async (id) => {
    setSavedRecipes(prev => (prev || []).filter(r => r.id !== id));
    await supabase.from('saved_recipes').delete().eq('id', id);
  };

  const handleAddToShoppingFromRecipe = (ing) => {
    const cleaned = cleanIngredientLocally(ing);
    handleAddShoppingItem(null, cleaned);
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

  const handleGenerateAiRecipe = async () => {
    const pantryItems = (fridge || []).map(f => cleanIngredientLocally(f.item_name)).filter(Boolean);
    if (pantryItems.length === 0) return alert("Your pantry is empty. Add a few ingredients to get a recipe suggestion.");
    setAiGenerating(true);
    try {
      const aiRecipe = await fetchCreativeRecipeFromAi(pantryItems);
      // Fix: Prioritize showing the actual AI generated recipe
      setActiveModalRecipe(aiRecipe);
      setActiveTab('recipes');
      setServingMultiplier(1);
    } catch (err) {
      console.error(err);
      // Fix: Fallback to local creative generation instead of just a database recipe
      const local = generateLocalCreativeRecipe(pantryItems);
      setActiveModalRecipe(local);
      setActiveTab('recipes');
      setServingMultiplier(1);
    } finally {
      setAiGenerating(false);
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setFridge([]); setMasterRecipes([]); setActiveModalRecipe(null);
  };

  const handleRemoveItem = async (id) => {
    setFridge(prev => (prev || []).filter(item => item.id !== id));
    await supabase.from('fridge_inventory').delete().eq('id', id);
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

  const sendImageToBackend = async (base64Data) => {
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.storeName) setStoreName(data.storeName);
        const rawItems = Array.isArray(data.added) ? data.added.map(item => item.trim()) : [];
        for (let rawItem of rawItems) {
          if (!rawItem.trim()) continue;
          const sanitizedToken = await resolveSanitizedTokenOnline(rawItem.trim());
          const backgroundParsedToken = sanitizedToken || cleanIngredientLocally(rawItem.trim());
          if (backgroundParsedToken) {
            await supabase.from('fridge_inventory').insert([{ item_name: backgroundParsedToken, user_id: user.id }]);
          }
        }
        await fetchAppData();
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleAddManualItem = async (e) => {
    e.preventDefault();
    if (!manualItem.trim()) return;
    const backgroundParsedToken = cleanIngredientLocally(manualItem);
    await supabase.from('fridge_inventory').insert([{ 
      item_name: backgroundParsedToken, 
      user_id: user.id,
      household_id: household?.id || null 
    }]);
    setManualItem('');
    await fetchAppData();
  };

  const handleJoinHousehold = async (code) => {
    const { data: hh, error } = await supabase.from('households').select('*').eq('invite_code', code).single();
    if (error || !hh) return alert("Invalid invite code");
    await supabase.from('profiles').update({ household_id: hh.id }).eq('id', user.id);
    setHousehold(hh);
    fetchAppData(hh.id);
  };

  const handleCreateHousehold = async (name) => {
    const { data: hh } = await supabase.from('households').insert([{ name }]).select().single();
    if (hh) {
      await supabase.from('profiles').update({ household_id: hh.id }).eq('id', user.id);
      setHousehold(hh);
    }
  };

  const calculateMacroMetrics = (tokens) => {
    let p = 0, c = 0, f = 0;
    (tokens || []).forEach(item => {
      if (!item) return;
      if (item.includes('paneer') || item.includes('tofu')) { p += 18; c += 3; f += 20; }
      else if (item.includes('lentil') || item.includes('chickpea') || item.includes('bean')) { p += 9; c += 22; f += 1; }
      else { p += 4; c += 12; f += 2; }
    });
    setNutritionMetrics({ protein: p, carbs: c, fat: f });
  };

  // 🛡️ SAFELY MEMOIZED SORT MATRIX DECK
  const processedRecipes = useMemo(() => {
    const pantryStrings = (fridge || []).map(f => cleanIngredientLocally(f.item_name || '')).filter(Boolean);
    const pantryTokens = new Set(pantryStrings.flatMap(normalizeIngredientTokens));
    const pantryPhrases = new Set(pantryStrings);

    const stopwords = new Set(['salt','water','pepper','oil','sugar','butter','egg','eggs','flour','onion','garlic','milk','cream','vinegar','soy','wheat','corn','bread']);

    const scoreIngredientMatch = (ingClean) => {
      if (!ingClean) return 0;
      const ingTokens = normalizeIngredientTokens(ingClean).filter((t) => !stopwords.has(t));
      if (pantryPhrases.has(ingClean)) return 1;
      if (ingTokens.some((token) => pantryTokens.has(token) && pantryTokens.has(token))) return 0.95;

      let bestScore = 0;
      pantryStrings.forEach((pantry) => {
        const pantryClean = cleanIngredientLocally(pantry);
        if (!pantryClean) return;
        const pantryTokensFromPhrase = normalizeIngredientTokens(pantryClean).filter((t) => !stopwords.has(t));
        if (pantryClean === ingClean || pantryClean.includes(ingClean) || ingClean.includes(pantryClean)) {
          bestScore = 1;
          return;
        }
        const overlap = ingTokens.filter((token) => pantryTokensFromPhrase.includes(token)).length;
        if (overlap >= 2) bestScore = Math.max(bestScore, 0.9);
        else if (overlap === 1) bestScore = Math.max(bestScore, 0.65);
      });

      return bestScore;
    };

    const scored = (masterRecipes || []).map(recipe => {
      const cleanedIngredients = (recipe.cleanedIngredients || []).filter(Boolean);
      const totalIngredients = cleanedIngredients.length || 1;

      const ingredientMatches = cleanedIngredients.map((ing) => {
        const matchScore = scoreIngredientMatch(cleanIngredientLocally(ing));
        return {
          raw: ing,
          cleaned: cleanIngredientLocally(ing),
          score: matchScore,
          exact: matchScore >= 0.95
        };
      });

      const ownedCount = ingredientMatches.filter((match) => match.score > 0).length;
      const exactMatchCount = ingredientMatches.filter((match) => match.exact).length;
      const totalScore = ingredientMatches.reduce((sum, match) => sum + match.score, 0);
      const matchPercentage = Math.round((totalScore / totalIngredients) * 100);
      const missingCount = totalIngredients - ownedCount;
      const scoreVariance = totalScore * 100 - missingCount * 8;

      const steps = getStaticRecipeSteps({ ...recipe, cleanedIngredients });

      return {
        ...recipe,
        cleanedIngredients,
        matchPercentage,
        scoreVariance,
        ownedCount,
        exactMatchCount,
        totalCount: totalIngredients,
        missingCount,
        totalScore,
        steps
      };
    });

    const filteredBySearch = scored.filter((recipe) => {
      if (!recipeSearch) return true;
      const search = recipeSearch.toLowerCase();
      return (recipe.name && recipe.name.toLowerCase().includes(search)) || (recipe.cleanedIngredients || []).some((ing) => ing.toLowerCase().includes(search));
    });

    const filteredByCategory = filteredBySearch.filter((recipe) => matchesRecipeFilter(recipe, activeRecipeFilter));

    return filteredByCategory.sort((a, b) => {
      if (b.matchPercentage !== a.matchPercentage) return b.matchPercentage - a.matchPercentage;
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.exactMatchCount !== a.exactMatchCount) return b.exactMatchCount - a.exactMatchCount;
      if (b.ownedCount !== a.ownedCount) return b.ownedCount - a.ownedCount;
      return a.totalCount - b.totalCount;
    });
  }, [fridge, masterRecipes, recipeSearch, activeRecipeFilter]);

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-50 text-slate-900 font-sans font-black tracking-tight antialiased flex items-center justify-center p-6 select-none">
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-[#6BAEE0]"></div>
          <h2 className="logo-text text-5xl mb-6 bg-[#6BAEE0] bg-clip-text text-transparent text-center">Hungry</h2>
          
          {isForgotPasswordView ? (
            <form onSubmit={async (e) => { e.preventDefault(); try { await supabase.auth.resetPasswordForEmail(authEmail); alert('Password reset link sent to your email!'); setIsForgotPasswordView(false); setAuthEmail(''); } catch (err) { alert(err.message); } }} className="space-y-4 mt-6 font-sans">
              <p className="text-xs text-slate-400 mb-4">Enter your email to receive a password reset link.</p>
              <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" placeholder="Email Address" />
              <button type="submit" className="w-full bg-[#6BAEE0] hover:bg-[#5da0cf] text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-blue-100">{authLoading ? "Sending..." : "Send Reset Link"}</button>
              <button type="button" onClick={() => { setIsForgotPasswordView(false); setAuthEmail(''); }} className="w-full bg-white border border-blue-100 font-black py-3 rounded-xl text-xs uppercase tracking-widest text-slate-400 hover:text-sky-500 shadow-sm transition-all">Back to Sign In</button>
            </form>
          ) : isSignUp ? (
            <form onSubmit={handleAuthSubmit} className="space-y-4 mt-6 font-sans">
              <p className="text-xs text-slate-400 mb-2">Create a new account</p>
              <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" placeholder="Email Address" />
              <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" placeholder="Password" />
              <button type="submit" className="w-full bg-[#6BAEE0] hover:bg-[#5da0cf] text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-blue-100">{authLoading ? "Creating..." : "Create Account"}</button>
              <button type="button" onClick={() => { setIsSignUp(false); setAuthEmail(''); setAuthPassword(''); }} className="w-full bg-white border border-blue-100 font-black py-3 rounded-xl text-xs uppercase tracking-widest text-slate-400 hover:text-sky-500 shadow-sm transition-all">Back to Sign In</button>
            </form>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4 mt-6 font-sans">
              <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" placeholder="Email Address" />
              <input type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-white border border-blue-100 px-4 py-3 rounded-xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none" placeholder="Password" />
              <button type="submit" className="w-full bg-[#6BAEE0] hover:bg-[#5da0cf] text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-blue-100">{authLoading ? "Verifying..." : "Sign In"}</button>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setIsSignUp(true); setAuthEmail(''); setAuthPassword(''); }} className="flex-1 bg-white border border-blue-100 font-black py-3 rounded-xl text-xs uppercase tracking-widest text-slate-400 hover:text-sky-500 shadow-sm transition-all">Create Account</button>
                <button type="button" onClick={() => { setIsForgotPasswordView(true); setAuthPassword(''); }} className="flex-1 bg-white border border-blue-100 font-black py-3 rounded-xl text-xs uppercase tracking-widest text-slate-400 hover:text-sky-500 shadow-sm transition-all">Forgot Password</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50/50 text-slate-800 font-sans antialiased pb-24 selection:bg-[#6BAEE0] selection:text-white">
      <Header user={user} storeName={storeName} handleGenerateAiRecipe={handleGenerateAiRecipe} triggerStoreTripPlanner={triggerStoreTripPlanner} handleSignOut={handleSignOut} />

      <main className="w-full flex justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-5xl">
          {activeTab === 'pantry' && <PantryManager fridge={fridge} handleFileUpload={handleFileUpload} handleAddManualItem={handleAddManualItem} handleUpdateInlineItem={handleUpdateInlineItem} handleRemoveItem={handleRemoveItem} loading={loading} />}
          {activeTab === 'recipes' && <RecipeExplorer recipes={processedRecipes} recipeSearch={recipeSearch} setRecipeSearch={setRecipeSearch} activeFilter={activeRecipeFilter} setFilter={setActiveRecipeFilter} onOpenRecipe={setActiveModalRecipe} onSaveRecipe={handleSaveRecipeToProfile} />}
          {activeTab === 'shopping' && <ShoppingListManager list={shoppingList} onAdd={handleAddShoppingItem} onToggle={handleToggleShoppingCompleted} onClear={handleClearShoppingItem} />}
          {activeTab === 'analytics' && <AnalyticsDashboard metrics={nutritionMetrics} fridge={fridge} shoppingList={shoppingList} />}
          {activeTab === 'household' && <HouseholdSettings household={household} user={user} onCreate={handleCreateHousehold} onJoin={handleJoinHousehold} />}
          {activeTab === 'saved' && <div className="space-y-6">
             {savedRecipes.map(recipe => (
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
          multiplier={servingMultiplier} 
          setMultiplier={setServingMultiplier}
          onClose={() => setActiveModalRecipe(null)}
          onStartCooking={() => setIsCookingMode(true)}
          addedItems={addedItems}
          onAddIngredient={handleAddToShoppingFromRecipe}
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
           {/* Existing Helper UI logic moved to separate store-helper file later */}
        </div>
      )}
    </div>
  );
}
