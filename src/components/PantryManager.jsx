import React, { useState, useEffect, useRef } from 'react';
import { Camera, Plus, AlertCircle, Trash2, Scan, Loader2, X, Users, User, ChevronDown } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const CATEGORIES = ['Proteins', 'Dairy & Eggs', 'Fruits', 'Vegetables', 'Beverages', 'Snacks', 'Frozen', 'General'];

const categorizeItem = (itemName) => {
  const n = (itemName || '').toLowerCase();
  if (/\b(chicken|beef|pork|lamb|turkey|fish|salmon|tuna|shrimp|crab|lobster|bacon|sausage|ham|mutton|duck|seafood|steak|mince|pepperoni|anchovy|venison|veal|salami|meat|prawn)\b/.test(n)) return 'Proteins';
  if (/\b(milk|cheese|butter|yogurt|cream|egg|paneer|ghee|curd|whey|kefir|mozzarella|cheddar|parmesan|brie|ricotta|cottage|sour cream|dairy)\b/.test(n)) return 'Dairy & Eggs';
  if (/\b(apple|banana|orange|mango|grape|strawberry|blueberry|raspberry|blackberry|lemon|lime|pear|peach|plum|cherry|watermelon|melon|pineapple|kiwi|avocado|fig|date|papaya|guava|coconut|pomegranate|passion fruit)\b/.test(n)) return 'Fruits';
  if (/\b(carrot|potato|tomato|onion|garlic|spinach|broccoli|cauliflower|lettuce|cabbage|cucumber|pepper|celery|kale|zucchini|eggplant|mushroom|corn|pea|bean|lentil|asparagus|beetroot|radish|leek|okra|squash|yam|ginger|turmeric|chili|capsicum|chard|arugula|herb|cilantro|parsley|basil|mint)\b/.test(n)) return 'Vegetables';
  if (/\b(water|juice|soda|tea|coffee|beer|wine|spirit|whiskey|vodka|rum|gin|drink|beverage|smoothie|shake|cola|lemonade|kombucha|sparkling)\b/.test(n)) return 'Beverages';
  if (/\b(chip|crisp|cracker|cookie|biscuit|candy|chocolate|popcorn|pretzel|almond|cashew|walnut|peanut|pistachio|trail mix|granola|protein bar|rice cake|snack|nut)\b/.test(n)) return 'Snacks';
  if (/\b(frozen|ice cream|gelato|popsicle|sorbet)\b/.test(n)) return 'Frozen';
  return 'General';
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

export default function PantryManager({
  fridge, activeHousehold, households = [],
  handleAddManualItem, handleUpdateInlineItem, handleRemoveItem, handleToggleItemHousehold,
  receiptLoading, receiptMessage, handleFileUpload,
  barcodeInput, setBarcodeInput, handleBarcodeLookup,
  barcodeLoading, barcodeResult, isScanningBarcode, setIsScanningBarcode
}) {
  const [manualItem, setManualItem] = useState('');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const hasScannedRef = useRef(false);

  const isExpiringSoon = (date) => {
    if (!date) return false;
    const diff = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff > 0;
  };

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: prev[cat] === false ? true : false }));
  };
  const isCategoryExpanded = (cat) => expandedCategories[cat] !== false;

  // Barcode camera scanner — stops immediately on first scan
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
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
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

  // Group fridge items by category
  const groupedFridge = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = fridge.filter(item => categorizeItem(item.item_name) === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Input Section */}
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
            {receiptLoading ? 'Scanning receipt...' : 'Scan Receipt'}
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

          {barcodeResult && (
            <p className="text-[12px] text-slate-500">{barcodeResult}</p>
          )}
        </div>
      </section>

      {/* Barcode camera overlay */}
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

      {/* Pantry Stock — organized by category */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex justify-between items-center mb-6 px-2">
          <h2 className="text-[14px] font-bold text-slate-400">Pantry Stock</h2>
          <span className="bg-blue-50 text-[#6BAEE0] border border-blue-100 px-3 py-1 rounded-full text-[10px] font-black">{fridge.length} items</span>
        </div>

        {fridge.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium italic text-center py-10">Your pantry is empty</p>
        ) : (
          <div className="space-y-3">
            {CATEGORIES.map(cat => {
              const items = groupedFridge[cat];
              if (items.length === 0) return null;
              const isOpen = isCategoryExpanded(cat);
              const colorCls = CATEGORY_COLORS[cat];

              return (
                <div key={cat} className="rounded-2xl border border-blue-50 overflow-hidden">
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/60 hover:bg-blue-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${colorCls}`}>{cat}</span>
                      <span className="text-[10px] font-bold text-slate-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <ChevronDown size={14} className={`text-slate-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-blue-50/60">
                      {items.map((item) => (
                        <div key={item.id} className="bg-white px-4 py-3 flex items-center justify-between gap-4 group hover:bg-blue-50/20 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="text"
                                defaultValue={item.raw_name}
                                onBlur={(e) => handleUpdateInlineItem(item.id, e.target.value)}
                                className="flex-1 bg-transparent text-xs font-bold text-slate-800 border-b border-transparent hover:border-blue-100 focus:border-sky-400 focus:outline-none pb-0.5 min-w-0"
                              />
                              {households.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => cycleItemHousehold(item)}
                                  className={`shrink-0 flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide border transition-all ${item.household_id ? 'text-[#6BAEE0] bg-sky-50 border-sky-100 hover:bg-sky-100' : 'text-slate-400 bg-slate-50 border-slate-100 hover:border-sky-200 hover:text-[#6BAEE0]'}`}
                                >
                                  {item.household_id ? <><Users size={9} /> {getHouseholdLabel(item.household_id)}</> : <><User size={9} /> Personal</>}
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              <span className="text-[9px] font-mono font-black text-slate-300 uppercase">
                                {item.item_name}
                                {item.expiry_date && <span className="ml-1">· Exp {new Date(item.expiry_date).toLocaleDateString()}</span>}
                              </span>
                              {isExpiringSoon(item.expiry_date) && <AlertCircle size={10} className="text-orange-400 animate-pulse" />}
                              {item.nutrition && item.nutrition.kcal > 0 && (
                                <span className="text-[9px] font-mono font-black text-sky-400 bg-sky-50 px-1.5 py-0.5 rounded-md">
                                  {item.nutrition.kcal} kcal · P {item.nutrition.protein}g · C {item.nutrition.carbs}g · F {item.nutrition.fat}g
                                </span>
                              )}
                              {item.price > 0 && (
                                <span className="text-[9px] font-mono font-black text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                  ${Number(item.price).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={() => handleRemoveItem(item.id)} className="text-slate-200 hover:text-red-400 transition-colors p-1 shrink-0"><Trash2 size={15} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
