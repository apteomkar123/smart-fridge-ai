import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { X, ShoppingCart, Check, ChevronDown, MapPin, Store, Sparkles, Loader2, Map, List } from 'lucide-react';
import { categorizeItem } from './recipeUtils';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';

const STORES = [
  "Trader Joe's", 'Whole Foods', 'Walmart', 'Target', 'Kroger',
  'Wegmans', 'Publix', 'Sprouts', 'HEB', 'Costco', 'Aldi',
  'Harris Teeter', 'Food Lion', "Sam's Club",
];

const STORE_AISLES = {
  default: {
    'Proteins':     'Meat & Seafood',
    'Dairy & Eggs': 'Dairy & Eggs — Back Wall',
    'Fruits':       'Produce — Entrance',
    'Vegetables':   'Produce — Entrance',
    'Beverages':    'Beverages — Aisle 6',
    'Snacks':       'Snacks — Aisle 4',
    'Bakery':       'Bakery — Aisle 5',
    'Frozen':       'Frozen — Back Wall',
    'Sauces':       'Condiments — Aisle 5',
    'Spices':       'Spices & Baking — Aisle 3',
    'General':      'Center Store — Aisle 2',
  },
  "Trader Joe's": {
    'Proteins':     'Meat & Fish — Right Wall',
    'Dairy & Eggs': 'Dairy — Back Right Corner',
    'Fruits':       'Produce — Front Left',
    'Vegetables':   'Produce — Front Left',
    'Beverages':    'Beverages — Left Wall',
    'Snacks':       'Snacks & Treats — Center',
    'Bakery':       'Bakery — Front',
    'Frozen':       'Frozen — Back Wall',
    'Sauces':       'Pantry Staples — Center',
    'Spices':       'Pantry Staples — Center',
    'General':      'Pantry Staples — Center',
  },
  'Whole Foods': {
    'Proteins':     'Meat & Seafood Counter — Center',
    'Dairy & Eggs': 'Dairy — Back Right',
    'Fruits':       'Produce — Store Front',
    'Vegetables':   'Produce — Store Front',
    'Beverages':    'Beverages & Bulk — Right Side',
    'Snacks':       'Snacks & Wellness — Aisle 3',
    'Bakery':       'Bakery — Front Right',
    'Frozen':       'Frozen — Back Left',
    'Sauces':       'Pantry — Aisle 2',
    'Spices':       'Spices & Bulk — Aisle 4',
    'General':      'Pantry Staples — Aisle 1',
  },
  'Walmart': {
    'Proteins':     'Meat & Seafood — Section D, Back Right',
    'Dairy & Eggs': 'Dairy — Back Section (Aisle 1)',
    'Fruits':       'Fresh Produce — Section A, Front Left',
    'Vegetables':   'Fresh Produce — Section A, Front Left',
    'Beverages':    'Beverages — Aisle 16-18',
    'Snacks':       'Snacks — Aisle 10-12',
    'Bakery':       'Bakery — Aisle 9, Near Deli',
    'Frozen':       'Frozen Foods — Aisle 1-4',
    'Sauces':       'Condiments & Sauces — Aisle 8',
    'Spices':       'Baking & Spices — Aisle 9',
    'General':      'Grocery — Aisle 5-7',
  },
  'Publix': {
    'Proteins':     'Meat & Seafood — Back Right',
    'Dairy & Eggs': 'Dairy — Back Wall',
    'Fruits':       'Produce — Front of Store',
    'Vegetables':   'Produce — Front of Store',
    'Beverages':    'Beverages — Aisle 8-10',
    'Snacks':       'Snacks & Cookies — Aisle 5',
    'Bakery':       'Bakery — Front Right',
    'Frozen':       'Frozen — Aisle 1-3',
    'Sauces':       'Condiments — Aisle 6',
    'Spices':       'Spices & Baking — Aisle 7',
    'General':      'Center Store — Aisle 4',
  },
  'Sprouts': {
    'Proteins':     'Meat & Seafood — Right Wall',
    'Dairy & Eggs': 'Dairy & Alternatives — Back Right',
    'Fruits':       'Produce — Center of Store',
    'Vegetables':   'Produce — Center of Store',
    'Beverages':    'Beverages & Bulk — Left Aisle',
    'Snacks':       'Natural Snacks — Aisle 4',
    'Bakery':       'Bakery — Front',
    'Frozen':       'Frozen — Back Left',
    'Sauces':       'Natural Foods — Aisle 3',
    'Spices':       'Bulk Spices & Herbs — Center',
    'General':      'Natural Pantry — Aisle 2',
  },
  'HEB': {
    'Proteins':     'Meat Market — Back Center',
    'Dairy & Eggs': 'Dairy & Eggs — Back Right',
    'Fruits':       'Produce — Front Right',
    'Vegetables':   'Produce — Front Right',
    'Beverages':    'Beverages — Aisle 12-14',
    'Snacks':       'Snacks — Aisle 8',
    'Bakery':       'HEB Bakery — Front Left',
    'Frozen':       'Frozen — Aisle 2-4',
    'Sauces':       'Condiments — Aisle 9',
    'Spices':       'Spices & Baking — Aisle 10',
    'General':      'Center Store — Aisle 5-7',
  },
  'Costco': {
    'Proteins':     'Meat & Seafood — Back Left',
    'Dairy & Eggs': 'Dairy — Back Right',
    'Fruits':       'Produce — Front Left',
    'Vegetables':   'Produce — Front Left',
    'Beverages':    'Beverages — Warehouse Aisle 4',
    'Snacks':       'Snacks & Nuts — Aisle 3',
    'Bakery':       'Bakery — Front Near Entrance',
    'Frozen':       'Frozen Foods — Back Perimeter',
    'Sauces':       'Condiments — Aisle 6',
    'Spices':       'Spices & Oils — Aisle 5',
    'General':      'Center Aisles — Aisle 7-10',
  },
};

const getAisle = (store, category) =>
  STORE_AISLES[store]?.[category] || STORE_AISLES.default[category] || 'Center Store';

// Store floor plan — rows × columns grid layout with sections
// Each cell: { key: category key, label, emoji, col, row }
// Route order (1-based) reflects efficient perimeter-first path
const FLOOR_PLAN = [
  // Row 0 — entrance / front
  { key: 'Fruits',       label: 'Produce',      emoji: '🥦', col: 1, row: 0, route: 1 },
  { key: 'Vegetables',   label: 'Produce',      emoji: '🥦', col: 2, row: 0, route: 1, merged: true },
  { key: 'Bakery',       label: 'Bakery',       emoji: '🥐', col: 3, row: 0, route: 2 },
  // Row 1 — center-top aisles
  { key: 'Snacks',       label: 'Snacks',       emoji: '🍿', col: 1, row: 1, route: 7 },
  { key: 'Beverages',    label: 'Beverages',    emoji: '☕', col: 2, row: 1, route: 6 },
  { key: 'Sauces',       label: 'Condiments',   emoji: '🫙', col: 3, row: 1, route: 5 },
  // Row 2 — center-bottom aisles
  { key: 'Spices',       label: 'Spices',       emoji: '🌶️', col: 1, row: 2, route: 8 },
  { key: 'General',      label: 'Pantry',       emoji: '📦', col: 2, row: 2, route: 9 },
  { key: 'Frozen',       label: 'Frozen',       emoji: '🧊', col: 3, row: 2, route: 4 },
  // Row 3 — back wall
  { key: 'Proteins',     label: 'Meat',         emoji: '🥩', col: 1, row: 3, route: 10 },
  { key: 'Dairy & Eggs', label: 'Dairy & Eggs', emoji: '🥛', col: 2, row: 3, route: 3 },
  { key: '_checkout',    label: 'Checkout',     emoji: '🛒', col: 3, row: 3, route: 11 },
];

const CHECKED_KEY = 'hungry_shopper_checked';
const loadChecked = () => { try { return new Set(JSON.parse(localStorage.getItem(CHECKED_KEY) || '[]')); } catch { return new Set(); } };
const saveChecked = (set) => { try { localStorage.setItem(CHECKED_KEY, JSON.stringify([...set])); } catch {} };

export default function PersonalShopper({ shoppingList, onToggle, onClose }) {
  const { user, userSettings } = useUser();
  const [selectedStore, setSelectedStore] = useState(null);
  const [listSource, setListSource] = useState('all');
  const [checked, setChecked] = useState(loadChecked);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [subLoadingId, setSubLoadingId] = useState(null);
  const [subResults, setSubResults] = useState({}); // itemId → suggestion

  const fetchSubstitution = useCallback(async (item) => {
    if (subLoadingId || subResults[item.id]) return;
    setSubLoadingId(item.id);
    try {
      const dietaryRestrictions = userSettings?.dietary_restrictions || [];
      const storeName = selectedStore || 'your store';
      const dietContext = dietaryRestrictions.length > 0
        ? ` User dietary restrictions: ${dietaryRestrictions.join(', ')}. Ensure the substitution respects these.`
        : '';
      const storeContext = selectedStore ? `The user is shopping at ${selectedStore} and ` : 'The user ';
      const prompt = `${storeContext}cannot find "${item.item_name}".${dietContext} In one sentence, suggest the best available substitution at ${storeName}. Format exactly: "If they don't have ${item.item_name}, [substitution] works really well instead."`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true }),
      });
      const text = await res.text();
      setSubResults(prev => ({ ...prev, [item.id]: text.trim().replace(/^"|"$/g, '') }));
    } catch {
      setSubResults(prev => ({ ...prev, [item.id]: 'Could not fetch suggestion right now.' }));
    }
    setSubLoadingId(null);
  }, [subLoadingId, subResults, selectedStore, userSettings]);

  // Feature #11 + #7: Grocery Gig Status + Who's Home? Alerts
  // Sets Roomies presence to "At the Store" immediately, then refines with the
  // actual store name once geolocation resolves (~1-2 seconds).
  useEffect(() => {
    if (!user?.id) return;

    // Step 1: Immediately mark user as at the store (generic)
    supabase.from('user_presence').upsert({
      profile_id: user.id,
      status: 'Away',
      custom_text: '🛒 At the Store',
    }).then(() => {});

    // Step 2: Try to identify the actual store via geolocation + Google Places API
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async ({ coords: { latitude: lat, longitude: lng } }) => {
          try {
            const res = await fetch('/.netlify/functions/nearby-stores', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat, lng }),
            });
            const { stores, atGroceryStore, configured } = await res.json();

            if (!configured) return; // API key not set yet — generic text stays

            const storeName = stores[0]?.name ?? null;
            const customText = storeName ? `🛒 At ${storeName}` : '🛒 At the Store';

            // Update presence with the actual store name
            await supabase.from('user_presence').upsert({
              profile_id: user.id,
              status: 'Away',
              custom_text: customText,
            });

            // Write richer cross_app_activity event so HouseholdTab can show store details
            if (atGroceryStore) {
              supabase.from('cross_app_activity').insert({
                user_id: user.id,
                app: 'hungry',
                activity_type: 'at_grocery_store',
                is_public: false,
                payload: {
                  store_name: storeName,
                  vicinity: stores[0]?.vicinity ?? null,
                  place_id: stores[0]?.place_id ?? null,
                  lat,
                  lng,
                },
              }).then(() => {});
            }
          } catch {
            // Network error — generic presence text already set, no action needed
          }
        },
        () => {
          // Geolocation denied or unavailable — generic "At the Store" stays
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    }

    return () => {
      supabase.from('user_presence').upsert({
        profile_id: user.id,
        status: 'Available',
        custom_text: null,
      }).then(() => {});
    };
  }, [user?.id]);

  const activeList = useMemo(() => {
    const all = shoppingList || [];
    const personal = all.filter(i => !i.household_id);
    const hhItems = all.filter(i => !!i.household_id);
    if (listSource === 'personal') return personal;
    if (listSource === 'household') return hhItems;
    return all;
  }, [shoppingList, listSource]);

  const grouped = useMemo(() => {
    const map = {};
    activeList.forEach(item => {
      const cat = categorizeItem(item.item_name);
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    const ORDER = ['Fruits', 'Vegetables', 'Proteins', 'Dairy & Eggs', 'Frozen', 'Bakery', 'Snacks', 'Beverages', 'Sauces', 'Spices', 'General'];
    return ORDER.filter(k => map[k]).map(k => ({
      category: k,
      items: map[k].sort((a, b) => checked.has(a.id) - checked.has(b.id)), // unchecked first
      aisle: getAisle(selectedStore, k),
    }));
  }, [activeList, selectedStore, checked]);

  const toggle = useCallback((id) => {
    setChecked(prev => {
      const s = new Set(prev);
      if (s.has(id)) {
        s.delete(id);
        if (onToggle) onToggle(id, true); // mark uncompleted in shopping list
      } else {
        s.add(id);
        if (onToggle) onToggle(id, false); // mark completed in shopping list
      }
      saveChecked(s);
      return s;
    });
  }, [onToggle]);

  const total = activeList.length;
  const done = activeList.filter(i => checked.has(i.id)).length;

  return (
    <div className="fixed inset-0 bg-white z-[80] flex flex-col">
      {/* Header */}
      <div className="bg-linear-to-r from-[#6BAEE0] to-[#4d96d1] px-5 pt-10 pb-5 text-white shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} />
            <h2 className="text-lg font-black tracking-tighter">Go Shopping</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"><X size={18} /></button>
        </div>

        {/* Store selector */}
        <div className="relative mb-3">
          <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70" />
          <select value={selectedStore || ''} onChange={e => setSelectedStore(e.target.value || null)}
            className="w-full bg-white/20 border border-white/30 pl-8 pr-8 py-2.5 rounded-xl text-sm font-bold text-white focus:outline-none appearance-none">
            <option value="" className="text-slate-400 bg-white">Select a store…</option>
            {STORES.map(s => <option key={s} value={s} className="text-slate-800 bg-white">{s}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 pointer-events-none" />
        </div>

        {/* List source */}
        <div className="flex gap-1 bg-white/15 p-1 rounded-xl">
          {[['all', 'All'], ['personal', 'Personal'], ['household', 'Household']].map(([v, l]) => (
            <button key={v} onClick={() => setListSource(v)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${listSource === v ? 'bg-white text-[#6BAEE0]' : 'text-white/70'}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
            </div>
            <span className="text-white/80 text-[10px] font-black shrink-0">{done}/{total}</span>
          </div>
          {/* View mode toggle */}
          <div className="flex bg-white/20 p-0.5 rounded-xl gap-0.5 shrink-0">
            <button onClick={() => setViewMode('list')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all ${viewMode === 'list' ? 'bg-white text-[#6BAEE0]' : 'text-white/70'}`}>
              <List size={11} /> List
            </button>
            <button onClick={() => setViewMode('map')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all ${viewMode === 'map' ? 'bg-white text-[#6BAEE0]' : 'text-white/70'}`}>
              <Map size={11} /> Map
            </button>
          </div>
        </div>
      </div>

      {/* ── Map View ──────────────────────────────────────────────────────── */}
      {viewMode === 'map' && (() => {
        // Count unchecked items per category for the map
        const catCounts = {};
        const catDone = {};
        grouped.forEach(({ category, items }) => {
          catCounts[category] = items.filter(i => !checked.has(i.id)).length;
          catDone[category] = items.filter(i => checked.has(i.id)).length;
        });

        // Deduplicate: Fruits & Vegetables share the Produce cell
        const renderPlan = FLOOR_PLAN.filter(c => !c.merged);
        const produceCell = renderPlan.find(c => c.key === 'Fruits');
        if (produceCell) {
          produceCell._count = (catCounts['Fruits'] || 0) + (catCounts['Vegetables'] || 0);
          produceCell._done  = (catDone['Fruits'] || 0)  + (catDone['Vegetables'] || 0);
        }
        renderPlan.forEach(cell => {
          if (cell.key !== 'Fruits' && cell.key !== '_checkout') {
            cell._count = catCounts[cell.key] || 0;
            cell._done  = catDone[cell.key] || 0;
          }
          if (cell.key === '_checkout') { cell._count = 0; cell._done = 0; }
        });

        // Sort cells into a 4-row × 3-col grid
        const ROWS = 4; const COLS = 3;
        const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        renderPlan.forEach(c => { grid[c.row][c.col - 1] = c; });

        return (
          <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4">
            {/* Legend */}
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#6BAEE0] inline-block" /> Need to visit</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400 inline-block" /> Done</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200 inline-block" /> Skip</span>
            </div>

            {/* ↑ ENTRANCE label */}
            <div className="text-center text-[10px] font-black text-slate-400 tracking-widest uppercase">↑ Entrance</div>

            {/* Floor plan grid */}
            <div className="grid grid-cols-3 gap-2">
              {grid.map((row, ri) => row.map((cell, ci) => {
                if (!cell) return <div key={`${ri}-${ci}`} />;
                const needed = cell._count > 0;
                const allDone = needed === false && cell._done > 0;
                const isCheckout = cell.key === '_checkout';
                return (
                  <div
                    key={cell.key}
                    className={`rounded-2xl border p-3 flex flex-col items-center justify-center gap-1 min-h-18 relative transition-all ${
                      isCheckout ? 'bg-slate-50 border-slate-200' :
                      needed ? 'bg-[#6BAEE0]/15 border-[#6BAEE0]/30 shadow-sm' :
                      allDone ? 'bg-emerald-50 border-emerald-200' :
                      'bg-white border-slate-100'
                    }`}
                  >
                    {/* Route number badge */}
                    {!isCheckout && (
                      <span className={`absolute top-1.5 left-2 text-[8px] font-black ${needed ? 'text-[#6BAEE0]' : 'text-slate-300'}`}>
                        {cell.route}
                      </span>
                    )}
                    <span className="text-xl">{cell.emoji}</span>
                    <span className={`text-[9px] font-black text-center leading-tight ${needed ? 'text-[#1F6FB8]' : allDone ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {cell.label}
                    </span>
                    {needed && (
                      <span className="bg-[#6BAEE0] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                        {cell._count} item{cell._count !== 1 ? 's' : ''}
                      </span>
                    )}
                    {allDone && <span className="text-[9px] text-emerald-500 font-black">✓ Done</span>}
                  </div>
                );
              }))}
            </div>

            {/* ↓ EXIT label */}
            <div className="text-center text-[10px] font-black text-slate-400 tracking-widest uppercase">↓ Exit</div>

            {/* Efficient route list */}
            <div className="bg-white rounded-2xl border border-blue-50 p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">⚡ Most Efficient Route</p>
              <div className="space-y-1.5">
                {renderPlan
                  .filter(c => c.key !== '_checkout' && (c._count > 0 || c._done > 0))
                  .sort((a, b) => a.route - b.route)
                  .map((cell, i) => (
                    <div key={cell.key} className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${cell._count === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-[#6BAEE0]/20 text-[#6BAEE0]'}`}>
                        {i + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-600 flex-1">{cell.emoji} {cell.label}</span>
                      <span className={`text-[10px] font-black ${cell._count === 0 ? 'text-emerald-500' : 'text-[#6BAEE0]'}`}>
                        {cell._count === 0 ? '✓' : `${cell._count} left`}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Aisle guide */}
            <div className="bg-white rounded-2xl border border-blue-50 p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">📍 Aisle Guide — {selectedStore}</p>
              <div className="space-y-1.5">
                {grouped.map(({ category, aisle }) => (
                  <div key={category} className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-600">{category}</span>
                    <span className="text-slate-400 font-mono">{aisle}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-6" />
          </div>
        );
      })()}

      {/* Scrollable list */}
      {viewMode === 'list' && <div className="flex-1 overflow-y-auto bg-slate-50">
        {grouped.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm font-bold">List is empty</div>
        )}
        {grouped.map(({ category, items, aisle }) => (
          <div key={category} className="mb-2">
            <div className="sticky top-0 bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-100">
              <span className="text-[11px] font-black text-[#6BAEE0] uppercase tracking-widest">{category}</span>
              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                <Store size={10} /> {aisle}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map(item => {
                const isChecked = checked.has(item.id);
                return (
                  <div key={item.id}>
                    <div className={`flex items-center gap-4 px-5 py-4 transition-colors ${isChecked ? 'bg-emerald-50' : 'bg-white'}`}>
                      <button onClick={() => toggle(item.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isChecked ? 'bg-emerald-400 border-emerald-400' : 'border-slate-300'}`}>
                        {isChecked && <Check size={12} className="text-white" strokeWidth={3} />}
                      </button>
                      <span className={`text-sm font-semibold flex-1 ${isChecked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {item.item_name}
                      </span>
                      {item.price > 0 && <span className="text-[11px] font-mono text-emerald-600 shrink-0">${Number(item.price).toFixed(2)}</span>}
                      {!isChecked && (
                        <button
                          onClick={() => fetchSubstitution(item)}
                          className="flex items-center gap-1 text-[9px] font-black text-slate-400 hover:text-violet-500 transition-colors shrink-0 ml-1"
                          title="Can't find it? Get a substitution"
                        >
                          {subLoadingId === item.id ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                        </button>
                      )}
                    </div>
                    {subResults[item.id] && !isChecked && (
                      <div className="mx-5 mb-3 bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                        <Sparkles size={13} className="text-violet-400 shrink-0" />
                        <p className="text-[11px] text-violet-700 font-bold leading-relaxed flex-1 text-center">{subResults[item.id]}</p>
                        <button onClick={() => setSubResults(p => { const n={...p}; delete n[item.id]; return n; })} className="text-violet-300 hover:text-violet-500 shrink-0 text-sm leading-none">×</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {done === total && total > 0 && (
          <div className="bg-emerald-500 text-white text-center py-5 font-black text-base mt-2 mx-4 rounded-2xl">
            🎉 All done! Great shopping!
          </div>
        )}
        <div className="h-8" />
      </div>}
    </div>
  );
}
