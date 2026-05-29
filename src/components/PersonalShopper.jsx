import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { X, ShoppingCart, Check, ChevronDown, MapPin, Store } from 'lucide-react';
import { categorizeItem } from './recipeUtils';

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

const CHECKED_KEY = 'hungry_shopper_checked';
const loadChecked = () => { try { return new Set(JSON.parse(localStorage.getItem(CHECKED_KEY) || '[]')); } catch { return new Set(); } };
const saveChecked = (set) => { try { localStorage.setItem(CHECKED_KEY, JSON.stringify([...set])); } catch {} };

export default function PersonalShopper({ shoppingList, onToggle, onClose }) {
  const [selectedStore, setSelectedStore] = useState(STORES[0]);
  const [listSource, setListSource] = useState('all');
  const [checked, setChecked] = useState(loadChecked);

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
      <div className="bg-gradient-to-r from-[#6BAEE0] to-[#4d96d1] px-5 pt-10 pb-5 text-white shrink-0">
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
          <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
            className="w-full bg-white/20 border border-white/30 pl-8 pr-8 py-2.5 rounded-xl text-sm font-bold text-white focus:outline-none appearance-none">
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

        <div className="text-center mt-3">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
            </div>
            <span className="text-white/80 text-[10px] font-black shrink-0">{done}/{total}</span>
          </div>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
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
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${isChecked ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isChecked ? 'bg-emerald-400 border-emerald-400' : 'border-slate-300'}`}>
                      {isChecked && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-sm font-semibold flex-1 ${isChecked ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {item.item_name}
                    </span>
                    {item.price > 0 && <span className="text-[11px] font-mono text-emerald-600 shrink-0">${Number(item.price).toFixed(2)}</span>}
                  </button>
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
      </div>
    </div>
  );
}
