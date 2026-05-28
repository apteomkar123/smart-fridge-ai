import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';
import {
  cleanIngredientLocally,
  normalizeIngredientTokens,
  fuzzyTokenMatch,
  getStaticRecipeSteps,
  matchesRecipeFilter
} from './recipeUtils';

const RecipeContext = createContext();

export const useRecipes = () => {
  const context = useContext(RecipeContext);
  if (!context) throw new Error('useRecipes must be used within a RecipeProvider');
  return context;
};

export const RecipeProvider = ({ children, fridge }) => {
  const { user } = useUser();
  const [masterRecipes, setMasterRecipes] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cuisineFilter, setCuisineFilter] = useState('all');
  const [savedSearch, setSavedSearch] = useState('');
  const [savedCategoryFilter, setSavedCategoryFilter] = useState('all');
  const [savedCuisineFilter, setSavedCuisineFilter] = useState('all');

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

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedRecipeSearch(recipeSearch), 300);
    return () => clearTimeout(handler);
  }, [recipeSearch]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSavedSearch(savedSearch), 300);
    return () => clearTimeout(handler);
  }, [savedSearch]);

  const fetchMealDbRecipes = async () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const results = await Promise.all(letters.map(async (l) => {
      try {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?f=${l}`);
        const data = await res.json();
        return data.meals || [];
      } catch (err) { return []; }
    }));

    const meals = results.flat();
    const unique = Array.from(new Map(meals.map(m => [m.idMeal, m])).values());
    return unique.map(m => {
      const ings = [];
      for (let i = 1; i <= 20; i++) {
        if (m[`strIngredient${i}`]) ings.push(`${m[`strMeasure${i}`] || ''} ${m[`strIngredient${i}`]}`.trim());
      }
      return {
        id: m.idMeal,
        name: m.strMeal,
        meal_type: m.strCategory || 'General',
        cuisine: m.strArea || '',
        ingredients: ings,
        steps: String(m.strInstructions || '').split(/\r?\n+/).filter(Boolean)
      };
    });
  };

  const fetchSpoonacularRecipes = async () => {
    try {
      const res = await fetch('/.netlify/functions/get-recipes');
      if (!res.ok) return [];
      const data = await res.json();
      return data.recipes || [];
    } catch (err) {
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
      const combined = [...mealDb, ...uniqueSpoonacular];

      const normalized = combined.map(r => ({
        ...r,
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

  // Deep Linking logic: auto-open recipe from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recipeId = params.get('recipe');
    if (recipeId && masterRecipes.length > 0) {
      const match = masterRecipes.find(r => String(r.id) === recipeId);
      if (match) setActiveModalRecipe(match);
    }
  }, [masterRecipes]);

  const handleGenerateAiRecipe = async (selectedIngredients) => {
    const pantry = (selectedIngredients || [])
      .map(i => cleanIngredientLocally(i))
      .filter(Boolean);
    if (pantry.length === 0) return alert("Add items to your pantry first so AI knows what you have.");

    setAiGenerating(true);
    try {
      const prompt = `Create a unique vegetarian recipe name, ingredient list, and steps using: ${pantry.slice(0, 10).join(', ')}. Return ONLY valid JSON with keys recipeName, ingredients, and steps.`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt })
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
        .filter(r => matchesRecipeFilter(r, categoryFilter))
        .filter(r => cuisineFilter === 'all' || matchesRecipeFilter(r, cuisineFilter))
        .sort((a, b) => b.matchPercentage - a.matchPercentage);
    }, [fridge, masterRecipes, debouncedRecipeSearch, categoryFilter, cuisineFilter]);

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

  const onSaveRecipe = async (recipe) => {
    if (!user) return;
    if (savedRecipes.some(r => r.recipe_id === String(recipe.id))) return;
    const { data, error: err } = await supabase.from('saved_recipes').insert([{
      user_id: user.id,
      recipe_id: String(recipe.id),
      recipe_name: recipe.name,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      meal_type: [recipe.meal_type, recipe.cuisine].filter(Boolean).join(' ').trim() || 'General'
    }]).select();
    if (!err && data) setSavedRecipes(prev => [...prev, data[0]]);
  };

  const onRemoveSavedRecipe = async (pkId) => {
    if (!user) return;
    const { error } = await supabase.from('saved_recipes').delete().eq('id', pkId);
    if (!error) {
      setSavedRecipes(prev => prev.filter(r => r.id !== pkId));
    }
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
        if (savedCategoryFilter === 'all') return true;
        const normalized = {
          meal_type: r.meal_type,
          name: r.recipe_name,
          cuisine: '',
          cleanedIngredients: r.ingredients ? r.ingredients.map(cleanIngredientLocally) : []
        };
        return matchesRecipeFilter(normalized, savedCategoryFilter);
      })
      .filter(r => {
        if (savedCuisineFilter === 'all') return true;
        const normalized = {
          meal_type: r.meal_type,
          name: r.recipe_name,
          cuisine: '',
          cleanedIngredients: r.ingredients ? r.ingredients.map(cleanIngredientLocally) : []
        };
        return matchesRecipeFilter(normalized, savedCuisineFilter);
      });
  }, [savedRecipes, debouncedSavedSearch, savedCategoryFilter, savedCuisineFilter]);

  return (
    <RecipeContext.Provider value={{
      processedRecipes,
      savedRecipes,
      filteredSavedRecipes,
      recipeSearch,
      setRecipeSearch,
      categoryFilter,
      setCategoryFilter,
      cuisineFilter,
      setCuisineFilter,
      savedSearch,
      setSavedSearch,
      savedCategoryFilter,
      setSavedCategoryFilter,
      savedCuisineFilter,
      setSavedCuisineFilter,
      aiGenerating,
      isAiPickerOpen,
      setIsAiPickerOpen,
      handleGenerateAiRecipe,
      onSaveRecipe,
      onRemoveSavedRecipe,
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
      fridge
    }}>
      {children}
    </RecipeContext.Provider>
  );
};