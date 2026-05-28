import React, { useState, useEffect, useRef } from 'react';
import { Camera, Plus, AlertCircle, Trash2, Scan, Loader2, X, Users, User, GripVertical, ChevronRight } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const CATEGORIES = ['Proteins', 'Dairy & Eggs', 'Fruits', 'Vegetables', 'Beverages', 'Snacks', 'Frozen', 'General'];

const CATEGORY_ICONS = {
  'Proteins': '🥩',
  'Dairy & Eggs': '🥛',
  'Fruits': '🍎',
  'Vegetables': '🥦',
  'Beverages': '☕',
  'Snacks': '🍿',
  'Frozen': '🧊',
  'General': '📦',
};

const CATEGORY_COLORS = {
  'Proteins': 'bg-rose-50 text-rose-500 border-rose-100',
  'Dairy & Eggs': 'bg-amber-50 text-amber-500 border-amber-100',
  'Fruits': 'bg-pink-50 text-pink-500 border-pink-100',
  'Vegetables': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'Beverages': 'bg-cyan-50 text-cyan-500 border-cyan-100',
  'Snacks': 'bg-orange-50 text-orange-500 border-orange-100',
  'Frozen': 'bg-sky-50 text-sky-500 border-sky-100',
  'General': 'bg-slate-50 text-slate-400 border-slate-100',
};

// NOTE: Snacks intentionally checked BEFORE Vegetables — "potato chips" must be Snacks not Vegetables
const categorizeItem = (itemName) => {
  const n = (itemName || '').toLowerCase();
  if (/\b(chicken|beef|pork|lamb|turkey|fish|salmon|tuna|shrimp|crab|lobster|bacon|sausage|ham|mutton|duck|seafood|steak|mince|pepperoni|anchovy|venison|veal|salami|meat|prawn)\b/.test(n)) return 'Proteins';
  if (/\b(milk|cheese|butter|yogurt|cream|egg|paneer|ghee|curd|whey|kefir|mozzarella|cheddar|parmesan|brie|ricotta|cottage|sour cream|dairy)\b/.test(n)) return 'Dairy & Eggs';
  if (/\b(apple|banana|orange|mango|grape|strawberry|blueberry|raspberry|blackberry|lemon|lime|pear|peach|plum|cherry|watermelon|melon|pineapple|kiwi|avocado|fig|date|papaya|guava|coconut|pomegranate|passion fruit)\b/.test(n)) return 'Fruits';
  if (/\b(water|juice|soda|tea|coffee|beer|wine|spirit|whiskey|vodka|rum|gin|drink|beverage|smoothie|shake|cola|lemonade|kombucha|sparkling)\b/.test(n)) return 'Beverages';
  if (/\b(chip|crisp|cracker|cookie|biscuit|candy|chocolate|popcorn|pretzel|almond|cashew|walnut|peanut|pistachio|trail mix|granola|protein bar|rice cake|snack|nut)\b/.test(n)) return 'Snacks';
  if (/\b(carrot|potato|tomato|onion|garlic|spinach|broccoli|cauliflower|lettuce|cabbage|cucumber|pepper|celery|kale|zucchini|eggplant|mushroom|corn|pea|bean|lentil|asparagus|beetroot|radish|leek|okra|squash|yam|ginger|turmeric|chili|capsicum|chard|arugula|herb|cilantro|parsley|basil|mint)\b/.test(n)) return 'Vegetables';
  if (/\b(frozen|ice cream|gelato|popsicle|sorbet)\b/.test(n)) return 'Frozen';
  return 'General';
};

const isExpiringSoon = (date) => {
  if (!date) return false;
  const diff = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24);
  return diff <= 7 && diff > 0;
};

// ─── Ingredient Card Modal ────────────────────────────────────────────────────
function IngredientCardModal({ item, onClose, onSave, onDelete, households }) {
  const [name, setName] = useState(item.raw_name || '');
  const [expiry, setExpiry] = useState(item.expiry_date ? item.expiry_date.split('T')[0] : '');
  const [amount, setAmount] = useState(item.amount || '');
  const [category, setCategory] = useState(item.categoryOverride || categorizeItem(item.raw_name || ''));

  const handleSave = () => {
    const autoCategory = categorizeItem(name);
    onSave(item.id, {
      raw_name: name,
      expiry_date: expiry || null,
      amount,
      categoryOverride: category !== autoCategory ? category : null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-end justify-center z-[70]">
      <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-t-[3rem] w-full max-w-lg shadow-2xl border-t border-white/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-slate-800 tracking-tighter">Ingredient Details</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</label>
            <input
              type="text" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 2 cups, 500g, 3 pieces…"
              className="w-full mt-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm text-slate-800 focus:border-sky-400 focus:outline-none placeholder:text-slate-300"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiry Date</label>
            <input
              type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)}
              className="w-full mt-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
            <select
              value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full mt-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
              ))}
            </select>
          </div>

          {item.nutrition?.kcal > 0 && (
            <div className="bg-sky-50 rounded-2xl p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nutrition per 100g</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><p className="text-sm font-black text-[#6BAEE0]">{item.nutrition.kcal}</p><p className="text-[9px] text-slate-400">kcal</p></div>
                <div><p className="text-sm font-black text-emerald-500">{item.nutrition.protein}g</p><p className="text-[9px] text-slate-400">protein</p></div>
                <div><p className="text-sm font-black text-amber-500">{item.nutrition.carbs}g</p><p className="text-[9px] text-slate-400">carbs</p></div>
                <div><p className="text-sm font-black text-rose-500">{item.nutrition.fat}g</p><p className="text-[9px] text-slate-400">fat</p></div>
              </div>
            </div>
          )}

          {item.price > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</span>
              <span className="text-sm font-black text-emerald-500">${Number(item.price).toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => { onDelete(item.id); onClose(); }}
            className="p-3 bg-red-50 text-red-400 rounded-2xl hover:bg-red-100 transition-colors"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-[#6BAEE0] text-white py-3 rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-blue-100"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category Bottom Sheet ────────────────────────────────────────────────────
function CategorySheet({ category, items, onClose, onItemTap, onRemove, households, getHouseholdLabel, cycleItemHousehold, setCategoryOverrides }) {
  const [dragOverCat, setDragOverCat] = useState(null);
  const colorCls = CATEGORY_COLORS[category];
  const otherCats = CATEGORIES.filter(c => c !== category);

  const handleDrop = (e, targetCat) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    if (!itemId) return;
    setCategoryOverrides(prev => {
      const next = { ...prev, [itemId]: targetCat };
      localStorage.setItem('hungry_cat_overrides', JSON.stringify(next));
      return next;
    });
    setDragOverCat(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-end justify-center z-[60]">
      <div className="bg-white/95 backdrop-blur-2xl rounded-t-[3rem] w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl border-t border-white/50">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-blue-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{CATEGORY_ICONS[category]}</span>
            <div>
              <h3 className="text-base font-black text-slate-800">{category}</h3>
              <p className="text-[10px] text-slate-400 font-medium">{items.length} item{items.length !== 1 ? 's' : ''} · drag to move between categories</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        {/* Drop targets for other categories */}
        <div className="px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
          {otherCats.map(c => (
            <div
              key={c}
              onDragOver={(e) => { e.preventDefault(); setDragOverCat(c); }}
              onDragLeave={() => setDragOverCat(null)}
              onDrop={(e) => handleDrop(e, c)}
              className={`shrink-0 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                dragOverCat === c ? CATEGORY_COLORS[c] + ' scale-110 shadow-md' : 'bg-slate-50 text-slate-300 border-slate-100'
              }`}
            >
              {CATEGORY_ICONS[c]} {c}
            </div>
          ))}
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-1.5 pt-1">
          {items.map(item => {
            const expiring = isExpiringSoon(item.expiry_date);
            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('itemId', item.id)}
                className="flex items-center gap-3 px-4 py-3 bg-white border border-blue-50 rounded-2xl hover:border-sky-100 transition-all cursor-grab active:cursor-grabbing"
              >
                <GripVertical size={14} className="text-slate-200 shrink-0" />

                <button className="flex-1 text-left min-w-0" onClick={() => onItemTap(item)}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-700">{item.raw_name}</span>
                    {expiring && <AlertCircle size={10} className="text-orange-400 animate-pulse shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {item.amount && <span className="text-[9px] font-mono text-slate-400">{item.amount}</span>}
                    {item.expiry_date && (
                      <span className={`text-[9px] font-mono font-black ${expiring ? 'text-orange-400' : 'text-slate-300'}`}>
                        Exp {new Date(item.expiry_date).toLocaleDateString()}
                      </span>
                    )}
                    {item.nutrition?.kcal > 0 && (
                      <span className="text-[9px] font-mono text-sky-400">{item.nutrition.kcal} kcal</span>
                    )}
                    {item.price > 0 && (
                      <span className="text-[9px] font-mono text-emerald-500">${Number(item.price).toFixed(2)}</span>
                    )}
                  </div>
                </button>

                {households.length > 0 && (
                  <button
                    type="button"
                    onClick={() => cycleItemHousehold(item)}
                    className={`shrink-0 flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase border transition-all ${
                      item.household_id ? 'text-[#6BAEE0] bg-sky-50 border-sky-100' : 'text-slate-300 bg-slate-50 border-slate-100'
                    }`}
                  >
                    {item.household_id ? <Users size={9} /> : <User size={9} />}
                  </button>
                )}

                <button onClick={() => onRemove(item.id)} className="text-slate-200 hover:text-red-400 transition-colors shrink-0 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PantryManager({
  fridge, activeHousehold, households = [],
  handleAddManualItem, handleUpdateItem, handleRemoveItem, handleToggleItemHousehold,
  receiptLoading, receiptMessage, handleFileUpload,
  barcodeInput, setBarcodeInput, handleBarcodeLookup,
  barcodeLoading, barcodeResult, isScanningBarcode, setIsScanningBarcode
}) {
  const [manualItem, setManualItem] = useState('');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(null);
  const [activeSheet, setActiveSheet] = useState(null);
  const [activeIngredient, setActiveIngredient] = useState(null);
  const [categoryOverrides, setCategoryOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hungry_cat_overrides') || '{}'); } catch { return {}; }
  });
  const [amounts, setAmounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hungry_amounts') || '{}'); } catch { return {}; }
  });
  const hasScannedRef = useRef(false);

  // Barcode camera scanner — ref-locked to prevent double-scan
  useEffect(() => {
    let scanner;
    if (isScanningBarcode) {
      hasScannedRef.current = false;
      scanner = new Html5Qrcode('barcode-scanner-region');
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          if (hasScannedRef.current) return;
          hasScannedRef.current = true;
          if (scanner.isScanning) scanner.stop().catch(() => {});
          setIsScanningBarcode(false);
          handleBarcodeLookup(decodedText);
        },
        () => {}
      ).catch((err) => {
        console.error('Scanner error:', err);
        setIsScanningBarcode(false);
      });
    }
    return () => {
      if (scanner && scanner.isScanning) scanner.stop().catch(() => {});
    };
  }, [isScanningBarcode, handleBarcodeLookup, setIsScanningBarcode]);

  const submitItem = (e) => {
    e.preventDefault();
    if (!manualItem.trim()) return;
    handleAddManualItem(manualItem, selectedHouseholdId);
    setManualItem('');
  };

  const cycleItemHousehold = (item) => {
    if (!handleToggleItemHousehold || households.length === 0) return;
    const currentIdx = households.findIndex(h => h.id === item.household_id);
    const next = currentIdx + 1 < households.length ? households[currentIdx + 1] : null;
    handleToggleItemHousehold(item.id, next?.id || null);
  };

  const getHouseholdLabel = (householdId) => {
    if (!householdId) return null;
    return households.find(h => h.id === householdId)?.name || 'Shared';
  };

  const getEffectiveCategory = (item) =>
    categoryOverrides[item.id] || categorizeItem(item.raw_name || item.item_name || '');

  const handleSaveIngredient = (id, updates) => {
    // Handle category override
    if ('categoryOverride' in updates) {
      const newOverrides = { ...categoryOverrides };
      if (updates.categoryOverride === null) delete newOverrides[id];
      else newOverrides[id] = updates.categoryOverride;
      localStorage.setItem('hungry_cat_overrides', JSON.stringify(newOverrides));
      setCategoryOverrides(newOverrides);
    }
    // Handle amount (local only)
    if (updates.amount !== undefined) {
      const newAmounts = { ...amounts, [id]: updates.amount };
      localStorage.setItem('hungry_amounts', JSON.stringify(newAmounts));
      setAmounts(newAmounts);
    }
    // Persist name / expiry / household to DB
    const { categoryOverride, amount, ...dbUpdates } = updates;
    if (Object.keys(dbUpdates).length > 0) {
      handleUpdateItem(id, dbUpdates);
    }
  };

  // Enrich fridge items with local-only fields
  const enrichedFridge = fridge.map(item => ({
    ...item,
    amount: amounts[item.id] || '',
    categoryOverride: categoryOverrides[item.id] || null,
  }));

  const groupedFridge = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = enrichedFridge.filter(item => getEffectiveCategory(item) === cat);
    return acc;
  }, {});

  const sheetItems = activeSheet ? (groupedFridge[activeSheet] || []) : [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── Input Section ─────────────────────────────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="space-y-4">
          <div>
            <h2 className="text-[14px] font-bold text-slate-400 mb-1 px-2">Pantry Input</h2>
            <p className="text-[12px] text-slate-500 px-2">Scan receipts, lookup barcodes, or add items manually.</p>
          </div>

          <form onSubmit={submitItem} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={manualItem}
                onChange={(e) => setManualItem(e.target.value)}
                placeholder="Add manually..."
                className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none transition-all shadow-sm"
              />
              <button type="submit" className="bg-[#6BAEE0] text-white p-4 rounded-2xl shadow-lg shadow-blue-100 active:scale-90 transition-all">
                <Plus size={20} />
              </button>
            </div>

            {households.length > 0 && (
              <div className="flex gap-2 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedHouseholdId(null)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-bold transition-all border ${!selectedHouseholdId ? 'bg-sky-50 text-[#6BAEE0] border-sky-200' : 'bg-white text-slate-400 border-blue-50 hover:border-sky-200'}`}
                >
                  <User size={13} /> Personal
                </button>
                {households.map(hh => (
                  <button
                    key={hh.id}
                    type="button"
                    onClick={() => setSelectedHouseholdId(hh.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-bold transition-all border ${selectedHouseholdId === hh.id ? 'bg-sky-50 text-[#6BAEE0] border-sky-200' : 'bg-white text-slate-400 border-blue-50 hover:border-sky-200'}`}
                  >
                    <Users size={13} /> {hh.name}
                  </button>
                ))}
              </div>
            )}
          </form>

          <label htmlFor="receipt-upload" className="cursor-pointer block bg-sky-50 text-[#1F6FB8] border border-sky-100 px-5 py-4 rounded-2xl text-xs font-bold hover:bg-sky-100 transition-all shadow-sm text-center">
            {receiptLoading ? 'Scanning receipt…' : 'Scan Receipt'}
          </label>
          <input id="receipt-upload" type="file" accept="image/*" capture="environment" onChange={(e) => { e.target.value = ''; handleFileUpload(e.target.files[0]); }} className="hidden" />
          {receiptMessage && <p className="text-[12px] text-slate-500">{receiptMessage}</p>}

          <div className="grid gap-3 sm:grid-cols-[2fr_auto]">
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && barcodeInput) handleBarcodeLookup(barcodeInput); }}
              placeholder="Enter barcode / UPC"
              className="bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none transition-all shadow-sm"
            />
            <button type="button" onClick={() => handleBarcodeLookup(barcodeInput)} className="bg-[#6BAEE0] text-white px-5 py-4 rounded-2xl text-xs font-bold shadow-lg shadow-blue-100 hover:bg-[#5da0cf] transition-all">
              {barcodeLoading ? <Loader2 className="animate-spin" size={20} /> : <Scan size={20} />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsScanningBarcode(true)}
            className="w-full bg-sky-50 text-[#1F6FB8] border border-sky-100 px-5 py-4 rounded-2xl text-xs font-bold hover:bg-sky-100 transition-all shadow-sm text-center flex items-center justify-center gap-2"
          >
            <Camera size={16} /> Scan with Camera
          </button>

          {barcodeResult && <p className="text-[12px] text-slate-500">{barcodeResult}</p>}
        </div>
      </section>

      {/* ── Barcode Camera Overlay ─────────────────────────────────────────── */}
      {isScanningBarcode && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-2xl rounded-[3rem] w-full max-w-md overflow-hidden relative shadow-2xl border border-white/20">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-sm font-bold text-white tracking-tight">Scan Barcode</h3>
              <button onClick={() => setIsScanningBarcode(false)} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="relative aspect-square bg-black overflow-hidden">
              <div id="barcode-scanner-region" className="w-full h-full"></div>
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-2/3 h-1/2 border-2 border-white/20 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.8)] animate-scanner-line"></div>
                </div>
              </div>
            </div>
            <div className="p-6 text-center bg-white/5">
              <p className="text-xs text-white/50 font-medium">Hold barcode steady in the frame — scans automatically</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Pantry Stock — Compact Category Grid ──────────────────────────── */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex justify-between items-center mb-5 px-1">
          <h2 className="text-[14px] font-bold text-slate-400">Pantry Stock</h2>
          <span className="bg-blue-50 text-[#6BAEE0] border border-blue-100 px-3 py-1 rounded-full text-[10px] font-black">
            {fridge.length} items
          </span>
        </div>

        {fridge.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium italic text-center py-8">Your pantry is empty — add items above</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CATEGORIES.map(cat => {
              const items = groupedFridge[cat];
              if (!items || items.length === 0) return null;
              const colorCls = CATEGORY_COLORS[cat];
              const expiringCount = items.filter(i => isExpiringSoon(i.expiry_date)).length;

              return (
                <button
                  key={cat}
                  onClick={() => setActiveSheet(cat)}
                  className={`relative p-4 rounded-2xl border text-left transition-all hover:scale-[1.03] active:scale-[0.97] ${colorCls}`}
                >
                  {expiringCount > 0 && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-orange-400 text-white rounded-full text-[8px] font-black flex items-center justify-center shadow">
                      {expiringCount}
                    </div>
                  )}
                  <div className="text-2xl mb-2 leading-none">{CATEGORY_ICONS[cat]}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest leading-tight mb-0.5">{cat}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold opacity-60">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    <ChevronRight size={12} className="opacity-40" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Category Bottom Sheet ──────────────────────────────────────────── */}
      {activeSheet && (
        <CategorySheet
          category={activeSheet}
          items={sheetItems}
          onClose={() => setActiveSheet(null)}
          onItemTap={(item) => setActiveIngredient(item)}
          onRemove={(id) => handleRemoveItem(id)}
          households={households}
          getHouseholdLabel={getHouseholdLabel}
          cycleItemHousehold={cycleItemHousehold}
          setCategoryOverrides={setCategoryOverrides}
        />
      )}

      {/* ── Ingredient Card Modal ──────────────────────────────────────────── */}
      {activeIngredient && (
        <IngredientCardModal
          item={activeIngredient}
          onClose={() => setActiveIngredient(null)}
          onSave={handleSaveIngredient}
          onDelete={(id) => { handleRemoveItem(id); setActiveIngredient(null); setActiveSheet(null); }}
          households={households}
        />
      )}
    </div>
  );
}
