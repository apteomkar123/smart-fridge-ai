import React, { useState, useEffect, useRef } from 'react';
import { X, ChefHat, Camera, Star, Trash2, Check, Lock, Globe, ChevronDown, Clock, User, Wand2, Loader2 } from 'lucide-react';
import { useRecipes } from './RecipeContext';
import { useUser } from './UserContext';

function HistoryCard({ entry, displayName, onUpdateNotes, onAddPhoto, onDeletePhoto, onDelete, onOpenRecipe, onTogglePrivacy, onRemix }) {
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(entry.notes || '');
  const [remixing, setRemixing] = useState(false);
  const fileRef = useRef(null);

  const saveNotes = () => {
    onUpdateNotes(entry.id, notes);
    setEditingNotes(false);
  };

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onAddPhoto(entry.id, ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const cookedAt = new Date(entry.cookedAt);
  const cookedDate = cookedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const cookedTime = cookedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const hasPhotos = entry.photos && entry.photos.length > 0;
  const photoCount = entry.photos?.length || 0;

  if (!expanded) {
    return (
      <div
        className="bg-white/85 backdrop-blur-lg rounded-[2rem] border border-white/20 shadow-md p-5 cursor-pointer hover:shadow-lg active:scale-[0.99] transition-all"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center gap-4">
          {hasPhotos ? (
            <img src={entry.photos[0]} alt="" className="w-20 h-20 rounded-2xl object-cover border border-blue-50 shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-100 flex items-center justify-center shrink-0">
              <ChefHat size={28} className="text-[#6BAEE0]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[9px] font-black text-[#6BAEE0] uppercase bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full tracking-widest">{entry.meal_type || 'Recipe'}</span>
              <span className="text-[9px] text-slate-300 font-mono">{cookedDate}</span>
            </div>
            <h3 className="font-black text-slate-800 tracking-tight text-base leading-tight">{entry.recipeName}</h3>
            {entry.notes ? (
              <p className="text-xs text-amber-700/70 mt-1.5 line-clamp-1 italic">"{entry.notes}"</p>
            ) : (
              <p className="text-xs text-slate-300 mt-1.5 italic">Tap to expand</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {hasPhotos && (
              <span className="text-[10px] font-black text-[#6BAEE0] bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">
                {photoCount} photo{photoCount > 1 ? 's' : ''}
              </span>
            )}
            <ChevronDown size={16} className="text-slate-300" />
          </div>
        </div>
      </div>
    );
  }

  // Expanded card
  const gridCols = photoCount === 1 ? '1fr' : photoCount === 2 ? '1fr 1fr' : 'repeat(3, 1fr)';

  return (
    <div className="bg-white/92 backdrop-blur-xl rounded-[2.5rem] border border-white/30 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[9px] font-black text-[#6BAEE0] uppercase bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-full tracking-widest">{entry.meal_type || 'Recipe'}</span>
              {!entry.isPrivate && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">Public</span>}
            </div>
            <h2 className="font-black text-slate-800 text-2xl leading-tight tracking-tight mb-3">{entry.recipeName}</h2>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Clock size={11} className="text-[#6BAEE0]" />
                <span className="font-bold">{cookedDate}</span>
                <span className="text-slate-300">·</span>
                <span>{cookedTime}</span>
              </div>
              {displayName && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <User size={11} className="text-[#6BAEE0]" />
                  <span>Cooked by <span className="font-bold text-slate-600">{displayName}</span></span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => onDelete(entry.id)} className="w-9 h-9 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors">
              <Trash2 size={15} />
            </button>
            <button onClick={() => setExpanded(false)} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Description or ingredient pills */}
        {entry.description ? (
          <p className="text-sm text-slate-500 leading-relaxed">{entry.description}</p>
        ) : entry.ingredients?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {entry.ingredients.slice(0, 5).map((ing, i) => {
              const label = typeof ing === 'string'
                ? ing.replace(/^\d[\d./]*\s*(tbsp|tsp|cup|cups|g|kg|oz|lb|ml|l)?\s*/i, '').split(',')[0].trim()
                : ing;
              return (
                <span key={i} className="text-[10px] font-bold bg-slate-50 border border-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
                  {label}
                </span>
              );
            })}
            {entry.ingredients.length > 5 && (
              <span className="text-[10px] font-bold bg-blue-50 border border-blue-100 text-[#6BAEE0] px-2.5 py-1 rounded-full">
                +{entry.ingredients.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Photos */}
      {hasPhotos && (
        <div className="px-6 mb-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-2.5">
            {photoCount === 1 ? 'Photo' : `${photoCount} Photos`}
          </p>
          <div className="grid gap-2" style={{ gridTemplateColumns: gridCols }}>
            {entry.photos.map((photo, i) => (
              <div key={i} className="relative" style={{ aspectRatio: '1' }}>
                <img src={photo} alt="cooked" className="w-full h-full rounded-2xl object-cover border border-blue-50" />
                <button
                  onClick={() => onDeletePhoto(entry.id, i)}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-400 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-500 transition-colors"
                >
                  <X size={11} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Thoughts / Notes */}
      <div className="px-6 mb-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-2">My Thoughts</p>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it turn out? Any tweaks you'd make?"
              rows={3}
              autoFocus
              className="w-full bg-amber-50/60 border border-amber-100 px-4 py-3 rounded-2xl text-sm text-slate-800 focus:border-amber-300 focus:outline-none resize-none placeholder:text-slate-300"
            />
            <button onClick={saveNotes} className="flex items-center gap-1.5 bg-[#6BAEE0] text-white px-4 py-2 rounded-xl text-xs font-black">
              <Check size={11} /> Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingNotes(true)}
            className={`w-full text-left text-sm rounded-2xl px-4 py-4 border transition-all ${entry.notes ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-slate-50 border-dashed border-slate-200 text-slate-400 italic hover:border-sky-300 hover:bg-sky-50/30'}`}
          >
            {entry.notes || 'Tap to add your thoughts on this recipe…'}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 pb-6 space-y-3">
        <button
          onClick={() => onOpenRecipe(entry)}
          className="w-full bg-[#6BAEE0] hover:bg-[#5da0cf] active:scale-[0.98] text-white font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-100 transition-all"
        >
          <Star size={15} /> View Full Recipe
        </button>
        <button
          onClick={() => { setRemixing(true); onRemix(entry).finally(() => setRemixing(false)); }}
          disabled={remixing}
          className="w-full bg-violet-50 hover:bg-violet-100 border border-violet-200 active:scale-[0.98] text-violet-600 font-black py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
        >
          {remixing ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
          {remixing ? 'Generating remix…' : 'Remix Leftovers'}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-black py-3 bg-violet-50 text-violet-600 border border-violet-100 rounded-xl hover:bg-violet-100 transition-all"
          >
            <Camera size={13} /> Add Photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
          <button
            onClick={() => onTogglePrivacy(entry.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-black py-3 rounded-xl transition-all ${entry.isPrivate ? 'bg-slate-100 text-slate-500 border border-slate-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}
          >
            {entry.isPrivate ? <><Lock size={13} /> Private</> : <><Globe size={13} /> Public</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChefHistory() {
  const { setActiveModalRecipe, masterRecipes } = useRecipes();
  const { user, userName } = useUser();
  const [history, setHistory] = useState([]);

  const displayName = userName || user?.email?.split('@')[0] || 'Chef';

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem('hungry_chef_history') || '[]'));
    } catch {
      setHistory([]);
    }
  }, []);

  const persist = (next) => {
    setHistory(next);
    try { localStorage.setItem('hungry_chef_history', JSON.stringify(next)); } catch {}
  };

  const handleUpdateNotes = (id, notes) => persist(history.map(e => e.id === id ? { ...e, notes } : e));
  const handleAddPhoto = (id, dataUrl) => persist(history.map(e => e.id === id ? { ...e, photos: [...(e.photos || []), dataUrl] } : e));
  const handleDeletePhoto = (id, index) => persist(history.map(e => e.id === id ? { ...e, photos: (e.photos || []).filter((_, i) => i !== index) } : e));
  const handleDelete = (id) => persist(history.filter(e => e.id !== id));
  const handleTogglePrivacy = (id) => persist(history.map(e => e.id === id ? { ...e, isPrivate: !e.isPrivate } : e));

  const handleRemix = async (entry) => {
    const ings = (entry.ingredients || []).slice(0, 8).join(', ');
    try {
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customPrompt: `Create a creative new recipe that remixes leftover ingredients from a "${entry.recipeName}" dish. Leftover ingredients available: ${ings}. Make it a DIFFERENT dish that creatively repurposes these leftovers. Return ONLY valid JSON: {"name":"...","meal_type":"...","cuisine":"...","ingredients":["..."],"steps":["..."]}`,
          directMode: true,
        }),
      });
      const text = await res.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleaned);
      setActiveModalRecipe({
        id: `remix-${Date.now()}`,
        name: data.name || `${entry.recipeName} Remix`,
        meal_type: data.meal_type || entry.meal_type || 'Main',
        cuisine: data.cuisine || '',
        ingredients: data.ingredients || [],
        cleanedIngredients: data.ingredients || [],
        steps: data.steps || [],
      });
    } catch {
      alert('Could not generate a remix. Please try again.');
    }
  };

  const handleOpenRecipe = (entry) => {
    const found = masterRecipes.find(r => String(r.id) === String(entry.recipeId));
    setActiveModalRecipe(found || {
      id: entry.recipeId,
      name: entry.recipeName,
      meal_type: entry.meal_type,
      ingredients: entry.ingredients || [],
      cleanedIngredients: entry.ingredients || [],
      steps: entry.steps || []
    });
  };

  if (history.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl text-center space-y-3">
        <ChefHat size={32} className="text-slate-200 mx-auto" />
        <p className="text-sm font-black text-slate-400">No cooked recipes yet</p>
        <p className="text-xs text-slate-300">Mark a recipe as "Cooked" to start your Chef History</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <ChefHat size={18} className="text-[#6BAEE0]" />
        <h2 className="text-[14px] font-bold text-slate-400">Chef History</h2>
        <span className="bg-blue-50 text-[#6BAEE0] border border-blue-100 px-2.5 py-0.5 rounded-full text-[10px] font-black">{history.length}</span>
      </div>
      <div className="space-y-4">
        {history.map(entry => (
          <HistoryCard
            key={entry.id}
            entry={entry}
            displayName={displayName}
            onUpdateNotes={handleUpdateNotes}
            onAddPhoto={handleAddPhoto}
            onDeletePhoto={handleDeletePhoto}
            onDelete={handleDelete}
            onOpenRecipe={handleOpenRecipe}
            onTogglePrivacy={handleTogglePrivacy}
            onRemix={handleRemix}
          />
        ))}
      </div>
    </div>
  );
}
