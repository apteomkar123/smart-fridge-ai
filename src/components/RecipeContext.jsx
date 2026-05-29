import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';
import {
  cleanIngredientLocally,
  normalizeIngredientTokens,
  fuzzyTokenMatch,
  getStaticRecipeSteps,
  matchesRecipeFilter,
  toTitleCase,
  stripIngredientNotes
} from './recipeUtils';
import { STATIC_RECIPES } from './staticRecipes';

const RecipeContext = createContext();

const MEALDB_CACHE_KEY = 'hungry_mealdb_v7'; // bumped: smarter comma-split with modifier detection

// Words that appear BEFORE a comma as adjective/modifier — don't split here
const _INGREDIENT_MODIFIERS = /^(boneless|skinless|fresh|dried|frozen|canned|large|small|medium|extra|lean|ground|minced|diced|chopped|sliced|shredded|peeled|halved|quartered|roughly|finely|coarsely|thinly|thickly|packed|heaping|level|softened|beaten|rinsed|drained|trimmed|deveined|pitted|seeded|lightly|plain|reduced|low|full|whole|room\s+temperature|fat-free|sugar-free|gluten-free)$/i;

// Split ingredients that accidentally contain multiple items in one string.
// Returns true if a split fragment looks like a cooking instruction, not a real ingredient
const _isCookingMethod = (s) =>
  /^(boiled?|mashed?|fried|baked|grilled?|steamed?|saut[eé]ed?|roasted?|cooked?|drained?|rinsed?|peeled?|sliced?|diced?|chopped?|minced?|grated?|shredded?|beaten?|softened?|melted?|toasted?)(\s+and\s+\w+)?$/i.test(s.trim());

const _normalizeIngredients = (ings) =>
  (ings || []).flatMap(ing => {
    const s = stripIngredientNotes(String(ing || '').trim());
    if (!s) return [];
    // 1. Newlines always separate items
    const lines = s.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) return lines.filter(l => !_isCookingMethod(l));
    // 2. Semicolons almost always separate list items
    if (/;\s*\w/.test(s)) return s.split(/;\s*/).map(p => p.trim()).filter(p => p && !_isCookingMethod(p));
    // 3. " + " always separates items
    if (/ \+ /.test(s)) return s.split(/ \+ /).map(p => p.trim()).filter(p => p && !_isCookingMethod(p));
    // 4. Comma splitting: split only when the word BEFORE the comma is NOT a modifier
    const commaParts = s.split(/,\s*/);
    if (commaParts.length > 1) {
      const safeToSplit = commaParts.every((part, i) => {
        if (i === 0) return true;
        const wordBeforeComma = commaParts[i - 1].trim().split(/\s+/).pop() || '';
        return !_INGREDIENT_MODIFIERS.test(wordBeforeComma);
      });
      if (safeToSplit) return commaParts.map(p => p.trim()).filter(p => p && !_isCookingMethod(p));
    }
    return [s];
  });
const MEALDB_CACHE_TTL = 24 * 60 * 60 * 1000;

export const useRecipes = () => {
  const context = useContext(RecipeContext);
  if (!context) throw new Error('useRecipes must be used within a RecipeProvider');
  return context;
};

export const RecipeProvider = ({ children, fridge }) => {
  const { user, userSettings } = useUser();
  const [masterRecipes, setMasterRecipes] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [categoryFilters, setCategoryFilters] = useState([]);
  const [dietFilters, setDietFilters] = useState([]);
  const [cuisineFilters, setCuisineFilters] = useState([]);
  const [savedSearch, setSavedSearch] = useState('');
  const [savedCategoryFilters, setSavedCategoryFilters] = useState([]);
  const [savedDietFilters, setSavedDietFilters] = useState([]);
  const [savedCuisineFilters, setSavedCuisineFilters] = useState([]);

  // Debounced search states to prevent heavy filtering on every keystroke
  const [debouncedRecipeSearch, setDebouncedRecipeSearch] = useState('');
  const [debouncedSavedSearch, setDebouncedSavedSearch] = useState('');

  const [aiGenerating, setAiGenerating] = useState(false);
  const [isAiPickerOpen, setIsAiPickerOpen] = useState(false);
  const [activeModalRecipe, setActiveModalRecipe] = useState(null);
  const [multiplier, setMultiplier] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shoppingAlerts, setShoppingAlerts] = useState([]);
  const [isStoreAlertOpen, setIsStoreAlertOpen] = useState(false);

  const [activeMealPlan, setActiveMealPlan] = useState(null);
  const [isMealPrepOpen, setIsMealPrepOpen] = useState(false);
  const [prepLoading, setPrepLoading] = useState(false);
  const [savedMealPlans, setSavedMealPlans] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hungry_meal_plans_v1')) || []; } catch { return []; }
  });

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedRecipeSearch(recipeSearch), 300);
    return () => clearTimeout(handler);
  }, [recipeSearch]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSavedSearch(savedSearch), 300);
    return () => clearTimeout(handler);
  }, [savedSearch]);

  const fetchMealDbRecipes = async () => {
    try {
      const cached = localStorage.getItem(MEALDB_CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < MEALDB_CACHE_TTL && Array.isArray(data) && data.length > 0) return data;
      }
    } catch {}

    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const results = await Promise.all(letters.map(async (l) => {
      try {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?f=${l}`);
        const data = await res.json();
        return data.meals || [];
      } catch { return []; }
    }));

    const meals = results.flat();
    const unique = Array.from(new Map(meals.map(m => [m.idMeal, m])).values());
    const processed = unique.map(m => {
      const ings = [];
      for (let i = 1; i <= 20; i++) {
        if (m[`strIngredient${i}`]) ings.push(`${m[`strMeasure${i}`] || ''} ${m[`strIngredient${i}`]}`.trim());
      }
      return {
        id: m.idMeal,
        name: toTitleCase(m.strMeal || ''),
        meal_type: m.strCategory || 'General',
        cuisine: m.strArea || '',
        ingredients: _normalizeIngredients(ings).map(i => toTitleCase(i)),
        steps: String(m.strInstructions || '')
          .replace(/\r\n?/g, '\n')
          .split(/\n+/)
          .map(s => s.trim().replace(/^(?:step\s*)?\d+[\.\:\)]\s*/i, '').trim())
          .filter(s => s.length >= 8 && !/^step\s*\d+[\.\:]?\s*$/i.test(s) && !/^[\d\s\.\:\-\(\)■•·]+$/.test(s))
      };
    });
    try { localStorage.setItem(MEALDB_CACHE_KEY, JSON.stringify({ data: processed, ts: Date.now() })); } catch {}
    return processed;
  };

  const fetchSpoonacularRecipes = async () => {
    try {
      const cacheKey = 'hungry_spoon_v3';
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
      const res = await fetch('/.netlify/functions/get-recipes');
      if (!res.ok) return [];
      const data = await res.json();
      const recipes = data.recipes || [];
      try { sessionStorage.setItem(cacheKey, JSON.stringify(recipes)); } catch {}
      return recipes;
    } catch {
      return [];
    }
  };

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const [mealDb, spoonacular] = await Promise.all([
        fetchMealDbRecipes(),
        fetchSpoonacularRecipes()
      ]);

      const mealDbIds = new Set(mealDb.map(r => String(r.id)));
      const uniqueSpoonacular = spoonacular.filter(r => !mealDbIds.has(String(r.id)));
      const apiIds = new Set([...mealDb, ...uniqueSpoonacular].map(r => String(r.id)));
      const staticProcessed = STATIC_RECIPES
        .filter(r => !apiIds.has(String(r.id)))
        .map(r => ({
          ...r,
          name: toTitleCase(r.name || ''),
          ingredients: _normalizeIngredients(r.ingredients).map(i => toTitleCase(i)),
          cleanedIngredients: _normalizeIngredients(r.ingredients).map(cleanIngredientLocally).filter(Boolean),
          steps: r.steps || []
        }));
      const combined = [...mealDb, ...uniqueSpoonacular, ...staticProcessed];

      const normalized = combined.map(r => ({
        ...r,
        name: toTitleCase(r.name || ''),
        ingredients: _normalizeIngredients(r.ingredients).map(i => toTitleCase(i)),
        cleanedIngredients: (r.ingredients || []).map(cleanIngredientLocally).filter(Boolean),
        steps: getStaticRecipeSteps(r)
      }));

      setMasterRecipes(normalized);

      if (user) {
        const { data } = await supabase.from('saved_recipes').select('*').eq('user_id', user.id);
        setSavedRecipes(data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  // Deep Linking logic: capture recipe ID at mount (before auth can modify the URL)
  const pendingDeepLinkId = useRef(
    new URLSearchParams(window.location.search).get('recipe') ||
    sessionStorage.getItem('_pendingRecipeId') ||
    null
  );

  useEffect(() => {
    if (!pendingDeepLinkId.current || masterRecipes.length === 0) return;
    const match = masterRecipes.find(r => String(r.id) === pendingDeepLinkId.current);
    if (match) {
      setActiveModalRecipe(match);
      pendingDeepLinkId.current = null;
      sessionStorage.removeItem('_pendingRecipeId');
    }
  }, [masterRecipes]);

  const handleGenerateAiRecipe = async (selectedIngredients) => {
    const pantry = (selectedIngredients || [])
      .map(i => cleanIngredientLocally(i))
      .filter(Boolean);
    if (pantry.length === 0) return alert("Add items to your pantry first so AI knows what you have.");

    setAiGenerating(true);
    try {
      const restrictions = (userSettings?.dietary_restrictions || []).join(', ');
      const goal = userSettings?.nutrition_goal || '';
      const dietContext = [restrictions, goal].filter(Boolean).join('; ');
      const prompt = `Create a unique recipe using: ${pantry.slice(0, 10).join(', ')}${dietContext ? `. Dietary context: ${dietContext}` : ''}. Return ONLY valid JSON with keys recipeName, ingredients, and steps.`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      const text = await res.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      let parsed = {};
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        parsed = {};
      }

      const recipeName = parsed.recipeName || parsed.name || parsed.title || '';
      if (!recipeName) {
        const match = cleaned.match(/"recipeName"\s*:\s*"([^"]+)"/i) || cleaned.match(/recipe name\s*[:\-]\s*([^\n"]+)/i);
        if (match) parsed.recipeName = match[1].trim();
      }

      const ingredients = Array.isArray(parsed.ingredients)
        ? parsed.ingredients
        : typeof parsed.ingredients === 'string'
          ? parsed.ingredients.split(/\r?\n|,|;/).map(i => i.trim()).filter(Boolean)
          : [];

      const steps = Array.isArray(parsed.steps)
        ? parsed.steps
        : typeof parsed.steps === 'string'
          ? parsed.steps.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
          : [];

      if (!parsed.recipeName) throw new Error('AI response was missing recipe name. Please try again.');

      setActiveModalRecipe({
        id: `ai-${Date.now()}`,
        name: parsed.recipeName,
        meal_type: 'Creative',
        ingredients,
        cleanedIngredients: ingredients.map(cleanIngredientLocally).filter(Boolean),
        steps: steps.length > 0 ? steps : ['Follow the ingredient list to prepare this dish.']
      });
      setMultiplier(1);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Could not generate recipe. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };

    const processedRecipes = useMemo(() => {
      const pantryTokens = new Set((fridge || []).flatMap(f => normalizeIngredientTokens(f.item_name)));
      const scored = masterRecipes.map(recipe => {
        const cleaned = recipe.cleanedIngredients || [];
        const matchCount = cleaned.filter(ing => normalizeIngredientTokens(ing).some(t => fuzzyTokenMatch(t, pantryTokens))).length;
        const matchPercentage = Math.round((matchCount / (cleaned.length || 1)) * 100);
        return { ...recipe, matchPercentage };
      });

      return scored
        .filter(r => {
          const s = debouncedRecipeSearch.toLowerCase();
          return !s || r.name.toLowerCase().includes(s) || r.cleanedIngredients.some(i => i.includes(s));
        })
        .filter(r => categoryFilters.length === 0 || categoryFilters.some(f => matchesRecipeFilter(r, f)))
        .filter(r => dietFilters.length === 0 || dietFilters.some(f => matchesRecipeFilter(r, f)))
        .filter(r => cuisineFilters.length === 0 || cuisineFilters.some(f => matchesRecipeFilter(r, f)))
        .filter(r => {
          const restrictions = userSettings?.dietary_restrictions || [];
          return restrictions.every(d => matchesRecipeFilter(r, d.toLowerCase()));
        })
        .sort((a, b) => b.matchPercentage - a.matchPercentage);
    }, [fridge, masterRecipes, debouncedRecipeSearch, categoryFilters, dietFilters, cuisineFilters, userSettings]);

  const triggerStoreTripPlanner = useCallback(() => {
    const pantryTokens = (fridge || []).map(f => f.item_name).filter(Boolean);
    const alerts = processedRecipes
      .filter(recipe => recipe.matchPercentage > 10 && recipe.matchPercentage < 100)
      .slice(0, 20)
      .map(recipe => {
        const missingItems = (recipe.ingredients || []).map(cleanIngredientLocally).filter(ing => {
          return !pantryTokens.some(token => token && (ing.includes(token) || token.includes(ing)));
        }).slice(0, 5);
        return { recipe, missingItems, mealType: recipe.meal_type || 'General' };
      })
      .filter(alert => alert.missingItems.length > 0);

    setShoppingAlerts(alerts);
    setIsStoreAlertOpen(true);
  }, [fridge, processedRecipes]);

  const onSaveRecipe = async (recipe, householdId = null) => {
    if (!user) return;
    const recipeIdStr = String(recipe.id);
    if (!householdId && savedRecipes.some(r => r.recipe_id === recipeIdStr)) return;
    const insertData = {
      user_id: user.id,
      recipe_id: recipeIdStr,
      recipe_name: recipe.name,
      ingredients: recipe.ingredients || [],
      steps: recipe.steps || [],
      meal_type: [recipe.meal_type, recipe.cuisine].filter(Boolean).join(' ').trim() || 'General',
    };
    // Only include household_id if provided (avoids error if column doesn't exist)
    if (householdId) insertData.household_id = householdId;
    const { data, error: err } = await supabase.from('saved_recipes').insert([insertData]).select();
    if (err) { console.error('Save recipe error:', err.message); return; }
    if (data) setSavedRecipes(prev => [...prev, data[0]]);
  };

  const onRemoveSavedRecipe = async (pkId) => {
    if (!user) return;
    const { error } = await supabase.from('saved_recipes').delete().eq('id', pkId);
    if (!error) {
      setSavedRecipes(prev => prev.filter(r => r.id !== pkId));
    }
  };

  const adaptRecipe = async (recipe, targetDiet) => {
    const substitutes = {
      vegetarian: 'tofu, paneer, tempeh, chickpeas, lentils, mushrooms, jackfruit, cauliflower, or black beans',
      vegan: 'tofu, tempeh, chickpeas, lentils, mushrooms, jackfruit, oat milk, coconut cream, or flaxseed eggs',
      meat: 'chicken breast, beef mince, lamb, or pork',
    };
    const dietLabels = {
      vegetarian: 'vegetarian (no meat or fish)',
      vegan: 'fully vegan (no meat, fish, dairy, or eggs)',
      meat: 'meat-based (add appropriate protein)',
      'gluten-free': 'gluten-free (replace wheat/flour/pasta with rice flour, cornstarch, or gluten-free pasta)',
      'dairy-free': 'dairy-free (replace dairy with oat milk, coconut cream, or vegan butter)',
      halal: 'halal (remove pork and non-halal meat, use halal substitutes)',
      kosher: 'kosher (no pork, no shellfish, no mixing of meat and dairy)',
    };
    const label = dietLabels[targetDiet] || targetDiet;
    const sub = substitutes[targetDiet] || '';
    const prompt = `Convert this recipe to be ${label}.${sub ? ` Use ${sub} where appropriate.` : ''} Keep the same flavor profile and cooking style as much as possible. Original recipe:\n\nName: ${recipe.name}\nIngredients: ${(recipe.ingredients || []).join(', ')}\nSteps: ${(recipe.steps || []).join(' ')}\n\nReturn ONLY valid JSON with exactly these keys: {"recipeName": string, "ingredients": string[], "steps": string[]}`;
    const res = await fetch('/.netlify/functions/scan-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPrompt: prompt, directMode: true }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const text = await res.text();
    const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    const newIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : recipe.ingredients;
    return {
      ...recipe,
      id: `adapted-${Date.now()}`,
      name: parsed.recipeName || `${recipe.name} (${targetDiet})`,
      ingredients: newIngredients,
      cleanedIngredients: newIngredients.map(cleanIngredientLocally).filter(Boolean),
      steps: Array.isArray(parsed.steps) ? parsed.steps : recipe.steps,
      _adapted: true,
      _adaptedFor: targetDiet,
    };
  };

  const generateMealPlan = async (ingredients) => {
    const ingredientList = (ingredients || (fridge || []).map(i => i.raw_name)).filter(Boolean).slice(0, 30);
    setActiveMealPlan(null);
    setPrepLoading(true);
    setIsMealPrepOpen(true);
    try {
      const prompt = `I have these pantry/fridge ingredients: ${ingredientList.join(', ') || 'general pantry staples'}. Create a smart weekly meal prep plan that batches cooking efficiently by grouping recipes that share ingredients or cooking methods. Return ONLY valid JSON (no markdown): {"batches":[{"title":"string","recipes":["recipe1","recipe2"],"sharedIngredients":["ingredient1","ingredient2"],"prepTime":"string","tip":"under 30 words"}]} — include 3 batches.`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true })
      });
      const text = await res.text();
      const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      setActiveMealPlan({ batches: Array.isArray(parsed.batches) ? parsed.batches : [], generatedAt: Date.now() });
    } catch {
      setActiveMealPlan({ batches: [], generatedAt: Date.now() });
    } finally {
      setPrepLoading(false);
    }
  };

  const saveMealPlan = (plan) => {
    const newPlan = { ...plan, id: `plan-${Date.now()}`, savedAt: Date.now() };
    setSavedMealPlans(prev => {
      const next = [newPlan, ...prev];
      try { localStorage.setItem('hungry_meal_plans_v1', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const removeMealPlan = (id) => {
    setSavedMealPlans(prev => {
      const next = prev.filter(p => p.id !== id);
      try { localStorage.setItem('hungry_meal_plans_v1', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const filteredSavedRecipes = useMemo(() => {
    if (!savedRecipes) return [];
    return savedRecipes
      .filter(r => {
        const s = debouncedSavedSearch.toLowerCase();
        const name = r.recipe_name || '';
        const ings = r.ingredients || [];
        return !s || name.toLowerCase().includes(s) || ings.some(i => i.toLowerCase().includes(s));
      })
      .filter(r => {
        if (savedCategoryFilters.length === 0) return true;
        const n = { meal_type: r.meal_type, name: r.recipe_name, cuisine: r.meal_type || '', cleanedIngredients: r.ingredients ? r.ingredients.map(cleanIngredientLocally) : [] };
        return savedCategoryFilters.some(f => matchesRecipeFilter(n, f));
      })
      .filter(r => {
        if (savedDietFilters.length === 0) return true;
        const n = { meal_type: r.meal_type, name: r.recipe_name, cuisine: r.meal_type || '', cleanedIngredients: r.ingredients ? r.ingredients.map(cleanIngredientLocally) : [] };
        return savedDietFilters.some(f => matchesRecipeFilter(n, f));
      })
      .filter(r => {
        if (savedCuisineFilters.length === 0) return true;
        const n = { meal_type: r.meal_type, name: r.recipe_name, cuisine: r.meal_type || '', cleanedIngredients: r.ingredients ? r.ingredients.map(cleanIngredientLocally) : [] };
        return savedCuisineFilters.some(f => matchesRecipeFilter(n, f));
      });
  }, [savedRecipes, debouncedSavedSearch, savedCategoryFilters, savedDietFilters, savedCuisineFilters]);

  const findRecipeByName = useCallback((name) => {
    const lower = name.toLowerCase();
    return masterRecipes.find(r => r.name.toLowerCase() === lower)
      || masterRecipes.find(r => r.name.toLowerCase().includes(lower))
      || masterRecipes.find(r => lower.includes(r.name.toLowerCase()));
  }, [masterRecipes]);

  const generateRecipeByName = useCallback(async (recipeName) => {
    const cacheKey = `_genrec_${recipeName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { try { return JSON.parse(cached); } catch {} }
    const prompt = `Create a complete, authentic, detailed recipe for "${recipeName}". Return ONLY valid JSON: {"recipeName": string, "meal_type": string, "cuisine": string, "ingredients": string[], "steps": string[]}. Include 8-15 real ingredients and 4-6 clear cooking steps.`;
    const res = await fetch('/.netlify/functions/scan-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPrompt: prompt, directMode: true }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const text = await res.text();
    const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    const generated = {
      id: `gen-${Date.now()}`,
      name: parsed.recipeName || recipeName,
      meal_type: parsed.meal_type || 'Main',
      cuisine: parsed.cuisine || '',
      ingredients,
      cleanedIngredients: ingredients.map(cleanIngredientLocally).filter(Boolean),
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    };
    try { sessionStorage.setItem(cacheKey, JSON.stringify(generated)); } catch {}
    return generated;
  }, []);

  const proteinizeRecipe = useCallback(async (recipe) => {
    const prompt = `This recipe is "${recipe.name}" with ingredients: ${(recipe.ingredients || []).join(', ')}.

Suggest ONE high-protein ingredient addition that complements this dish naturally (e.g. grilled chicken for pasta, paneer for curry, Greek yogurt for soup, lentils for stew). Choose something fitting the cuisine and flavour profile.

Return ONLY valid JSON: {"proteinIngredient": "name and quantity", "proteinAdded": number (total grams added to the whole dish), "ingredients": [full updated ingredient list], "steps": [full updated cooking steps incorporating the protein]}`;
    const res = await fetch('/.netlify/functions/scan-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPrompt: prompt, directMode: true }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const text = await res.text();
    const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : recipe.ingredients;
    return {
      updatedRecipe: {
        ...recipe,
        ingredients,
        cleanedIngredients: ingredients.map(cleanIngredientLocally).filter(Boolean),
        steps: Array.isArray(parsed.steps) ? parsed.steps : recipe.steps,
        _proteinized: true,
      },
      proteinIngredient: parsed.proteinIngredient || '',
      proteinAdded: typeof parsed.proteinAdded === 'number' ? parsed.proteinAdded : 0,
    };
  }, []);

  return (
    <RecipeContext.Provider value={{
      masterRecipes,
      processedRecipes,
      findRecipeByName,
      generateRecipeByName,
      proteinizeRecipe,
      savedRecipes,
      filteredSavedRecipes,
      recipeSearch,
      setRecipeSearch,
      categoryFilters,
      setCategoryFilters,
      dietFilters,
      setDietFilters,
      cuisineFilters,
      setCuisineFilters,
      savedSearch,
      setSavedSearch,
      savedCategoryFilters,
      setSavedCategoryFilters,
      savedDietFilters,
      setSavedDietFilters,
      savedCuisineFilters,
      setSavedCuisineFilters,
      aiGenerating,
      isAiPickerOpen,
      setIsAiPickerOpen,
      handleGenerateAiRecipe,
      onSaveRecipe,
      onRemoveSavedRecipe,
      adaptRecipe,
      activeModalRecipe,
      setActiveModalRecipe: (val) => setActiveModalRecipe(val || null),
      multiplier,
      setMultiplier,
      loading,
      error,
      shoppingAlerts,
      isStoreAlertOpen,
      setIsStoreAlertOpen,
      triggerStoreTripPlanner,
      activeMealPlan,
      setActiveMealPlan,
      isMealPrepOpen,
      setIsMealPrepOpen,
      prepLoading,
      generateMealPlan,
      savedMealPlans,
      saveMealPlan,
      removeMealPlan,
      fridge
    }}>
      {children}
    </RecipeContext.Provider>
  );
};