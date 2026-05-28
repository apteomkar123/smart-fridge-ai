import React, { useState, useMemo, useEffect } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { useRecipes } from './RecipeContext';

export default function AiIngredientPickerModal() {
  const { isAiPickerOpen, setIsAiPickerOpen, fridge, handleGenerateAiRecipe, aiGenerating } = useRecipes();

  const sortedItems = useMemo(() => {
    if (!fridge) return [];
    return [...fridge].sort((a, b) => {
      if (a.expiry_date && b.expiry_date) return new Date(a.expiry_date) - new Date(b.expiry_date);
      if (a.expiry_date) return -1;
      if (b.expiry_date) return 1;
      return (a.raw_name || '').localeCompare(b.raw_name || '');
    });
  }, [fridge]);

  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (isAiPickerOpen) {
      setSelected(new Set(sortedItems.map(i => i.raw_name)));
    }
  }, [isAiPickerOpen, sortedItems]);

  const toggleItem = (name) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleGenerate = () => {
    const ingredients = sortedItems
      .filter(i => selected.has(i.raw_name))
      .map(i => i.raw_name);
    setIsAiPickerOpen(false);
    handleGenerateAiRecipe(ingredients);
  };

  if (!isAiPickerOpen) return null;

  return (
    <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-end justify-center z-50">
      <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-t-[3rem] w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl border-t border-white/50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tighter">Pick Your Ingredients</h3>
            <p className="text-[10px] text-slate-400 font-medium">Sorted soonest-expiring first</p>
          </div>
          <button onClick={() => setIsAiPickerOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-3 mb-3">
          <button
            onClick={() => setSelected(new Set(sortedItems.map(i => i.raw_name)))}
            className="text-[10px] font-bold text-sky-500 hover:text-sky-700 transition-colors"
          >
            Select All
          </button>
          <span className="text-slate-200 select-none">|</span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            Clear
          </button>
          <span className="ml-auto text-[10px] font-bold text-slate-400">{selected.size} selected</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {sortedItems.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-8">Add items to your pantry first.</p>
          ) : (
            sortedItems.map(item => {
              const isSelected = selected.has(item.raw_name);
              const daysLeft = item.expiry_date
                ? Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
                : null;
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.raw_name)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-all border ${
                    isSelected
                      ? 'bg-sky-50 border-sky-200'
                      : 'bg-slate-50 border-slate-100 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-700 truncate">{item.raw_name}</span>
                    {daysLeft !== null && (
                      <span className={`shrink-0 text-[9px] font-mono font-black px-1.5 py-0.5 rounded-md ${
                        daysLeft <= 0 ? 'bg-red-50 text-red-500' :
                        daysLeft <= 3 ? 'bg-orange-50 text-orange-500' :
                        daysLeft <= 7 ? 'bg-amber-50 text-amber-500' :
                        'bg-blue-50 text-blue-400'
                      }`}>
                        {daysLeft <= 0 ? 'Expired' : `${daysLeft}d`}
                      </span>
                    )}
                  </div>
                  <div className={`shrink-0 w-4 h-4 rounded-full border-2 transition-all ml-3 ${
                    isSelected ? 'bg-[#6BAEE0] border-[#6BAEE0]' : 'border-slate-300 bg-white'
                  }`} />
                </button>
              );
            })
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-blue-50">
          <button
            onClick={handleGenerate}
            disabled={selected.size === 0 || aiGenerating}
            className="w-full bg-[#6BAEE0] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50"
          >
            {aiGenerating
              ? <><Loader2 size={16} className="animate-spin" /> Generating...</>
              : <><Sparkles size={16} /> Generate Recipe ({selected.size} ingredients)</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
