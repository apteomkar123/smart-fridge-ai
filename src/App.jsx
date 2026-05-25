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

  // Handler: Compress image client-side to protect Netlify's 6MB limit
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

      // Convert to compressed web data stream
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);

      // Pass down to the networking wrapper
      sendImageToBackend(compressedBase64);
    };
  };

  // Dispatch payload to Netlify background container
  const sendImageToBackend = async (base64Data) => {
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });

      if (response.ok) {
        const data = await response.json();
        const insertPayload = data.added.map(item => ({ item_name: item.trim() }));
        
        // Save payload into Supabase database row structures
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

  // Handler: Manual ingestion engine with explicit database reporting
  const handleAddManualItem = async (e) => {
    e.preventDefault();
    if (!manualItem.trim()) return;

    const { error } = await supabase
      .from('fridge_inventory')
      .upsert([{ item_name: manualItem.trim() }], { onConflict: 'item_name' });

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
      const missing = recipe.ingredients.filter(ing => 
        !fridge.includes(ing.toLowerCase().trim())
      );
      // Flag recipes needing 1 or 2 extra elements from market runs
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

  // Calculation: Ingredient coverage index processing
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
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md hover:shadow-indigo-500/20