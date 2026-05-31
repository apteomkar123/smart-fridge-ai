import React, { useState, useEffect } from 'react';
import { Plus, Trash2, MapPin, UtensilsCrossed, ChevronDown, Star, Search, Clock, DollarSign, Users, Coffee } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';

const CUISINE_CATEGORIES = [
  { key: 'american', label: 'American', emoji: '🍔' },
  { key: 'italian', label: 'Italian', emoji: '🍝' },
  { key: 'mexican', label: 'Mexican', emoji: '🌮' },
  { key: 'chinese', label: 'Chinese', emoji: '🥡' },
  { key: 'japanese', label: 'Japanese', emoji: '🍱' },
  { key: 'indian', label: 'Indian', emoji: '🍛' },
  { key: 'thai', label: 'Thai', emoji: '🍜' },
  { key: 'mediterranean', label: 'Mediterranean', emoji: '🥙' },
  { key: 'korean', label: 'Korean', emoji: '🥘' },
  { key: 'other', label: 'Other', emoji: '🍽️' },
];

const VIBE_CATEGORIES = [
  { key: 'quick_eats', label: 'Quick Eats', emoji: '⚡' },
  { key: 'cheap_eats', label: 'Cheap Eats', emoji: '💸' },
  { key: 'date_night', label: 'Date Night', emoji: '🕯️' },
  { key: 'family', label: 'Family', emoji: '👨‍👩‍👧' },
  { key: 'healthy', label: 'Healthy', emoji: '🥗' },
];

const STORAGE_KEY = 'hungry_restaurant_dishes';

const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const save = (d) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };

export default function RestaurantSaved({ onOpenRecipe }) {
  const { user } = useUser();
  const [dishes, setDishes] = useState(load);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ dishName: '', restaurantName: '', location: '', ingredients: '', cuisine: 'american', vibes: [], notes: '' });
  const [search, setSearch] = useState('');
  const [filterCuisine, setFilterCuisine] = useState('');
  const [filterVibe, setFilterVibe] = useState('');

  const toggleVibe = (v) => setForm(prev => ({
    ...prev,
    vibes: prev.vibes.includes(v) ? prev.vibes.filter(x => x !== v) : [...prev.vibes, v],
  }));

  const addDish = () => {
    if (!form.dishName.trim() || !form.restaurantName.trim()) return;
    const newDish = {
      id: Date.now().toString(),
      dishName: form.dishName.trim(),
      restaurantName: form.restaurantName.trim(),
      location: form.location.trim(),
      ingredients: form.ingredients.split(',').map(s => s.trim()).filter(Boolean),
      cuisine: form.cuisine,
      vibes: form.vibes,
      notes: form.notes.trim(),
      savedAt: Date.now(),
    };
    const updated = [newDish, ...dishes];
    setDishes(updated);
    save(updated);
    setForm({ dishName: '', restaurantName: '', location: '', ingredients: '', cuisine: 'american', vibes: [], notes: '' });
    setAdding(false);

    // Persist to Supabase if logged in
    if (user) {
      supabase.from('saved_recipes').insert([{
        user_id: user.id,
        recipe_id: `restaurant-${newDish.id}`,
        recipe_name: `${newDish.dishName} (${newDish.restaurantName})`,
        meal_type: 'Restaurant',
        cuisine: newDish.cuisine,
        ingredients: newDish.ingredients,
        steps: [`Order at ${newDish.restaurantName}${newDish.location ? `, ${newDish.location}` : ''}.`, ...(newDish.notes ? [newDish.notes] : [])],
      }]).then(() => {});
    }
  };

  const removeDish = (id) => {
    const updated = dishes.filter(d => d.id !== id);
    setDishes(updated);
    save(updated);
  };

  const filtered = dishes.filter(d => {
    const s = search.toLowerCase();
    const matchSearch = !s || d.dishName.toLowerCase().includes(s) || d.restaurantName.toLowerCase().includes(s);
    const matchCuisine = !filterCuisine || d.cuisine === filterCuisine;
    const matchVibe = !filterVibe || d.vibes?.includes(filterVibe);
    return matchSearch && matchCuisine && matchVibe;
  });

  const openAsRecipe = (dish) => {
    if (onOpenRecipe) {
      onOpenRecipe({
        id: `restaurant-${dish.id}`,
        name: `${dish.dishName} (${dish.restaurantName})`,
        meal_type: 'Restaurant',
        cuisine: dish.cuisine,
        ingredients: dish.ingredients,
        cleanedIngredients: dish.ingredients,
        steps: [`Order at ${dish.restaurantName}${dish.location ? `, ${dish.location}` : ''}.`, ...(dish.notes ? [dish.notes] : [])],
        image: null,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Add dish button */}
      <button
        onClick={() => setAdding(v => !v)}
        className="w-full flex items-center justify-center gap-2 bg-[#6BAEE0] text-white px-5 py-3 rounded-2xl text-xs font-black shadow-lg shadow-blue-100 active:scale-95 transition-all"
      >
        <Plus size={14} /> {adding ? 'Cancel' : 'Save a Restaurant Dish'}
      </button>

      {/* Add form */}
      {adding && (
        <div className="bg-white/90 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-4">
          <h3 className="text-[13px] font-bold text-slate-400 flex items-center gap-2"><UtensilsCrossed size={14} /> Add Restaurant Dish</h3>
          <input value={form.dishName} onChange={e => setForm(p => ({ ...p, dishName: e.target.value }))}
            placeholder="Dish name (e.g. Pad Thai, Burrito Bowl)"
            className="w-full bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.restaurantName} onChange={e => setForm(p => ({ ...p, restaurantName: e.target.value }))}
              placeholder="Restaurant name"
              className="bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none" />
            <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              placeholder="Location (optional)"
              className="bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none" />
          </div>
          <input value={form.ingredients} onChange={e => setForm(p => ({ ...p, ingredients: e.target.value }))}
            placeholder="Key ingredients, comma-separated (e.g. rice, chicken, salsa)"
            className="w-full bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none" />
          {/* Cuisine picker */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cuisine</p>
            <div className="flex flex-wrap gap-1.5">
              {CUISINE_CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setForm(p => ({ ...p, cuisine: c.key }))}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all ${form.cuisine === c.key ? 'bg-[#6BAEE0] text-white border-[#6BAEE0]' : 'bg-white text-slate-400 border-blue-100 hover:border-sky-300'}`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
          {/* Vibe picker */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vibe</p>
            <div className="flex flex-wrap gap-1.5">
              {VIBE_CATEGORIES.map(v => (
                <button key={v.key} onClick={() => toggleVibe(v.key)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all ${form.vibes.includes(v.key) ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-400 border-blue-100 hover:border-slate-300'}`}>
                  {v.emoji} {v.label}
                </button>
              ))}
            </div>
          </div>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Notes (what made it special, how to recreate at home…)"
            rows={2}
            className="w-full bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none resize-none" />
          <button onClick={addDish} disabled={!form.dishName.trim() || !form.restaurantName.trim()}
            className="w-full bg-[#6BAEE0] text-white py-3 rounded-2xl text-xs font-black shadow-lg shadow-blue-100 disabled:opacity-50 transition-all">
            Save Dish
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-lg p-5 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes or restaurants…"
            className="w-full bg-blue-50/50 border border-blue-100 pl-9 pr-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setFilterCuisine('')}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${!filterCuisine ? 'bg-[#6BAEE0] text-white border-[#6BAEE0]' : 'bg-white text-slate-400 border-blue-100'}`}>All Cuisines</button>
          {CUISINE_CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setFilterCuisine(filterCuisine === c.key ? '' : c.key)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${filterCuisine === c.key ? 'bg-[#6BAEE0] text-white border-[#6BAEE0]' : 'bg-white text-slate-400 border-blue-100'}`}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setFilterVibe('')}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${!filterVibe ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-400 border-blue-100'}`}>All Vibes</button>
          {VIBE_CATEGORIES.map(v => (
            <button key={v.key} onClick={() => setFilterVibe(filterVibe === v.key ? '' : v.key)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${filterVibe === v.key ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-400 border-blue-100'}`}>
              {v.emoji} {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dish list */}
      {filtered.length === 0 ? (
        <p className="text-xs text-slate-400 font-medium italic text-center py-10">
          {dishes.length === 0 ? 'No restaurant dishes saved yet — add one above!' : 'No dishes match your filters.'}
        </p>
      ) : (
        <div className="grid gap-3">
          {filtered.map(dish => {
            const cuisine = CUISINE_CATEGORIES.find(c => c.key === dish.cuisine);
            return (
              <div key={dish.id}
                className="bg-white/80 px-4 py-4 rounded-3xl border border-blue-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-2">
                  <button className="flex-1 text-left" onClick={() => openAsRecipe(dish)}>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-[8px] font-mono font-black text-slate-400 uppercase bg-blue-50/50 px-2 py-0.5 rounded-md">Restaurant</span>
                      {cuisine && <span className="text-[8px] font-mono font-black text-[#6BAEE0] bg-sky-50 px-2 py-0.5 rounded-md">{cuisine.emoji} {cuisine.label}</span>}
                      {dish.vibes?.map(v => {
                        const vc = VIBE_CATEGORIES.find(x => x.key === v);
                        return vc ? <span key={v} className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">{vc.emoji} {vc.label}</span> : null;
                      })}
                    </div>
                    <h3 className="font-bold text-slate-700 hover:text-[#6BAEE0] transition-colors">{dish.dishName}</h3>
                    <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5">
                      <MapPin size={9} /> {dish.restaurantName}{dish.location ? ` · ${dish.location}` : ''}
                    </p>
                    {dish.ingredients.length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{dish.ingredients.join(', ')}</p>
                    )}
                  </button>
                  <button onClick={() => removeDish(dish.id)} className="text-red-300 hover:text-red-500 transition-colors p-1.5 shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
