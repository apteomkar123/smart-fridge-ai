import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [fridge, setFridge] = useState([]);
  const [readyRecipes, setReadyRecipes] = useState([]);
  const [closeRecipes, setCloseRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualItem, setManualItem] = useState('');

  const fetchAppData = async () => {
    let { data: inventory } = await supabase.from('fridge_inventory').select('item_name');
    const currentFridge = inventory ? inventory.map(i => i.item_name) : [];
    setFridge(currentFridge);

    let { data: masterRecipes } = await supabase.from('recipes').select('*');
    if (!masterRecipes) return;

    let readyToCook = [];
    let closeMatches = [];

    masterRecipes.forEach(recipe => {
      const missing = recipe.ingredients.filter(ing => 
        !currentFridge.some(f => f.toLowerCase().trim() === ing.toLowerCase().trim())
      );
      const have = recipe.ingredients.filter(ing => 
        currentFridge.some(f => f.toLowerCase().trim() === ing.toLowerCase().trim())
      );

      if (missing.length === 0) {
        readyToCook.push({ ...recipe, have });
      } else if (missing.length <= 3) {
        closeMatches.push({ recipe, have, missing });
      }
    });

    setReadyRecipes(readyToCook);
    setCloseRecipes(closeMatches);
  };

  useEffect(() => {
    fetchAppData();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    
    reader.onloadend = async () => {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: reader.result
      });

      if (response.ok) {
        const data = await response.json();
        const insertPayload = data.added.map(item => ({ item_name: item }));
        
        // Upsert uses unique constraints on 'item_name' to prevent processing duplications
        await supabase.from('fridge_inventory').upsert(insertPayload, { onConflict: 'item_name' });
        await fetchAppData();
      } else {
        alert("Parsing failure.");
      }
      setLoading(false);
    };
  };

  const handleAddManualItem = async (e) => {
    e.preventDefault();
    if (!manualItem.trim()) return;

    await supabase.from('fridge_inventory').upsert([{ item_name: manualItem.trim() }], { onConflict: 'item_name' });
    setManualItem('');
    await fetchAppData();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      <header className="max-w-5xl mx-auto mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-emerald-400">SmartFridge AI</h1>
        <p className="text-slate-400 text-sm mt-1">Continuous programmatic recipe recommendations based on automated receipt tracking.</p>
      </header>

      <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Input Panel & Fridge Inventory */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md">
            <h2 className="text-lg font-bold mb-4 text-slate-200">Add Ingredients</h2>
            
            {/* Camera / Receipt Input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Scan Receipt</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload} 
                className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20 file:cursor-pointer"
              />
            </div>

            {/* Manual Form Entry */}
            <form onSubmit={handleAddManualItem} className="flex gap-2 pt-2 border-t border-slate-700/50">
              <input 
                type="text" 
                value={manualItem} 
                onChange={(e) => setManualItem(e.target.value)}
                placeholder="Enter item manually..." 
                className="flex-1 bg-slate-950 border border-slate-700 p-2 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500" 
              />
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 transition px-4 rounded-lg text-sm font-semibold">Add</button>
            </form>

            {loading && (
              <div className="mt-4 p-3 bg-slate-950/50 border border-slate-800 text-center rounded-lg text-sm text-amber-400 animate-pulse">
                Gemini engine analyzing items...
              </div>
            )}
          </div>

          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md">
            <h2 className="text-lg font-bold mb-3 text-slate-200">My Fridge Stock</h2>
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
              {fridge.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No ingredients found. Scan a receipt to begin.</p>
              ) : (
                fridge.map((item, idx) => (
                  <span key={idx} className="bg-slate-950 px-3 py-1 text-xs font-medium border border-slate-800 rounded-full text-slate-300">{item}</span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Columns: Dynamic Recipe Match Engine Pipelines */}
        <div className="md:col-span-2 space-y-6">
          {/* Complete Instant Matching Layer */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
            <h2 className="text-xl font-bold mb-4 text-emerald-400 flex items-center gap-2">Ready to Cook <span className="text-xs font-normal bg-emerald-500/10 px-2 py-0.5 rounded text-emerald-300">{readyRecipes.length}</span></h2>
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
              {readyRecipes.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No exact matches available. Try adding more stock items.</p>
              ) : (
                readyRecipes.map((r, i) => (
                  <div key={i} className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-slate-200 text-base">{r.name}</h3>
                      <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">{r.meal_type}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2"><strong className="text-emerald-500/80">Ingredients:</strong> {r.have.join(', ')}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Close Missing Match Approximation Layer */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
            <h2 className="text-xl font-bold mb-4 text-amber-400 flex items-center gap-2">Missing a Few Ingredients <span className="text-xs font-normal bg-amber-500/10 px-2 py-0.5 rounded text-amber-300">{closeRecipes.length}</span></h2>
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
              {closeRecipes.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No close alternative recipe matches found.</p>
              ) : (
                closeRecipes.map((item, i) => (
                  <div key={i} className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-slate-200 text-base">{item.recipe.name}</h3>
                      <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">{item.recipe.meal_type}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2"><strong className="text-slate-400">In Stock:</strong> {item.have.join(', ')}</p>
                    <p className="text-xs text-amber-400/90 mt-1"><strong className="text-amber-500">Target Additions to Purchase:</strong> {item.missing.join(', ')}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}