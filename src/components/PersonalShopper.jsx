import React, { useState, useMemo } from 'react';
import { X, ShoppingCart, Check, ChevronDown, MapPin } from 'lucide-react';
import { categorizeItem } from './recipeUtils';

const STORES = [
  "Trader Joe's", 'Walmart', 'Target', 'Kroger', 'Wegmans',
  'Harris Teeter', 'Food Lion', 'Whole Foods', 'Costco', 'Aldi',
];

// Aisle names per category per store (approximate, based on typical store layouts)
const STORE_AISLES = {
  default: {
    'Proteins':     'Meat & Seafood (Aisle 1)',
    'Dairy & Eggs': 'Dairy & Eggs (Back Wall)',
    'Fruits':       'Produce (Entrance)',
    'Vegetables':   'Produce (Entrance)',
    'Beverages':    'Beverages (Aisle 6)',
    'Snacks':       'Snacks & Chips (Aisle 4)',
    'Frozen':       'Frozen Foods (Back Wall)',
    'Sauces':       'Condiments & Sauces (Aisle 5)',
    'Spices':       'Spices & Baking (Aisle 3)',
    'General':      'Center Store (Aisle 2)',
  },
  "Trader Joe's": {
    'Proteins':     'Meat & Fish (Right Wall)',
    'Dairy & Eggs': 'Dairy (Back Right)',
    'Fruits':       'Produce (Front Left)',
    'Vegetables':   'Produce (Front Left)',
    'Beverages':    'Beverages (Left Wall, Aisle 3)',
    'Snacks':       'Snacks (Center Aisle 2)',
    'Frozen':       'Frozen (Back Wall)',
    'Sauces':       'Pantry Staples (Center Aisle 1)',
    'Spices':       'Pantry Staples (Center Aisle 1)',
    'General':      'Pantry Staples (Center Aisle 1)',
  },
  'Walmart': {
    'Proteins':     'Meat & Seafood (Section D)',
    'Dairy & Eggs': 'Dairy (Back Section)',
    'Fruits':       'Fresh Produce (Section A)',
    'Vegetables':   'Fresh Produce (Section A)',
    'Beverages':    'Beverages (Aisle 16-18)',
    'Snacks':       'Snacks (Aisle 10-12)',
    'Frozen':       'Frozen Foods (Aisle 1-4)',
    'Sauces':       'Condiments (Aisle 8)',
    'Spices':       'Baking & Cooking (Aisle 9)',
    'General':      'Grocery (Aisle 5-7)',
  },
  'Whole Foods': {
    'Proteins':     'Meat & Seafood Counter (Center)',
    'Dairy & Eggs': 'Dairy & Eggs (Back Right)',
    'Fruits':       'Produce (Front)',
    'Vegetables':   'Produce (Front)',
    'Beverages':    'Beverages & Bulk (Right Side)',
    'Snacks':       'Snacks & Wellness (Aisle 3)',
    'Frozen':       'Frozen (Back Left)',
    'Sauces':       'Pantry (Aisle 2)',
    'Spices':       'Spices & Bulk (Aisle 4)',
    'General':      'Pantry Staples (Aisle 1)',
  },
};

const getAisle = (store, category) =>
  STORE_AISLES[store]?.[category] || STORE_AISLES.default[category] || 'Center Store';

export default function PersonalShopper({ shoppingList, householdList = [], onClose }) {
  const [selectedStore, setSelectedStore] = useState(STORES[0]);
  const [listSource, setListSource] = useState('personal'); // 'personal' | 'household' | 'all'
  const [checked, setChecked] = useState(new Set());

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
    // Sort categories by typical shopping order (produce → proteins → dairy → etc.)
    const ORDER = ['Fruits', 'Vegetables', 'Proteins', 'Dairy & Eggs', 'Frozen', 'Beverages', 'Snacks', 'Sauces', 'Spices', 'General'];
    return ORDER.filter(k => map[k]).map(k => ({ category: k, items: map[k], aisle: getAisle(selectedStore, k) }));
  }, [activeList, selectedStore]);

  const total = activeList.length;
  const done = checked.size;

  const toggle = (id) => setChecked(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  return (
    <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl z-[80] flex flex-col">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-2xl border-b border-white/50 px-5 pt-8 pb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-[#6BAEE0]" />
            <h2 className="text-lg font-black text-slate-800 tracking-tighter">Personal Shopper</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>

        {/* Store selector */}
        <div className="relative mb-3">
          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6BAEE0]" />
          <select
            value={selectedStore}
            onChange={e => setSelectedStore(e.target.value)}
            className="w-full bg-blue-50/50 border border-blue-100 pl-8 pr-8 py-2.5 rounded-2xl text-sm font-bold text-slate-700 focus:border-sky-400 focus:outline-none appearance-none"
          >
            {STORES.map(s => <option key={s}>{s}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* List source */}
        <div className="flex gap-1 bg-blue-50/50 p-1 rounded-2xl border border-blue-100">
          {[['personal', 'My List'], ['household', 'Household'], ['all', 'All']].map(([v, l]) => (
            <button key={v} onClick={() => setListSource(v)}
              className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${listSource === v ? 'bg-white text-[#6BAEE0] shadow-sm' : 'text-slate-400'}`}>
              {l}
            </button>
          ))}
        </div>

        <p className="text-[10px] text-slate-400 text-center mt-2 font-mono">{done}/{total} items checked off</p>
      </div>

      {/* Scrollable grouped list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {grouped.length === 0 && (
          <div className="text-center py-12 text-slate-300 text-sm font-bold">Your list is empty</div>
        )}
        {grouped.map(({ category, items, aisle }) => (
          <div key={category}>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[11px] font-black text-[#6BAEE0] uppercase tracking-widest">{category}</p>
              <p className="text-[10px] text-slate-400 font-mono">{aisle}</p>
            </div>
            <div className="space-y-2">
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${checked.has(item.id) ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-blue-50 hover:border-sky-100'}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${checked.has(item.id) ? 'bg-emerald-400 border-emerald-400' : 'border-blue-200'}`}>
                    {checked.has(item.id) && <Check size={10} className="text-white" />}
                  </div>
                  <span className={`text-sm font-bold flex-1 ${checked.has(item.id) ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {item.item_name}
                  </span>
                  {item.price > 0 && <span className="text-[10px] font-mono text-emerald-500">${Number(item.price).toFixed(2)}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {done === total && total > 0 && (
        <div className="bg-emerald-500 text-white text-center py-4 font-black text-sm">
          🎉 All done! Great shopping!
        </div>
      )}
    </div>
  );
}
