import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Camera, Plus, AlertCircle, Trash2, Scan, Loader2, X, Users, User, GripVertical, ChevronRight, Mic, MicOff, UtensilsCrossed, Check } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { estimateNutrition, categorizeItem, CATEGORY_ICONS, toTitleCase } from './recipeUtils';

const CATEGORIES = ['Proteins', 'Dairy & Eggs', 'Fruits', 'Vegetables', 'Beverages', 'Snacks', 'Frozen', 'Sauces', 'Spices', 'General'];

const CATEGORY_COLORS = {
  'Proteins': 'bg-rose-50 text-rose-500 border-rose-100',
  'Dairy & Eggs': 'bg-amber-50 text-amber-500 border-amber-100',
  'Fruits': 'bg-pink-50 text-pink-500 border-pink-100',
  'Vegetables': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'Beverages': 'bg-cyan-50 text-cyan-500 border-cyan-100',
  'Snacks': 'bg-orange-50 text-orange-500 border-orange-100',
  'Frozen': 'bg-sky-50 text-sky-500 border-sky-100',
  'Sauces': 'bg-red-50 text-red-500 border-red-100',
  'Spices': 'bg-violet-50 text-violet-500 border-violet-100',
  'General': 'bg-slate-50 text-slate-400 border-slate-100',
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
  const [quantity, setQuantity] = useState(item.quantity > 0 ? item.quantity : 1);
  const [price, setPrice] = useState(item.price > 0 ? String(Number(item.price).toFixed(2)) : '');
  const [category, setCategory] = useState(item.categoryOverride || categorizeItem(item.raw_name || ''));
  const [splitCount, setSplitCount] = useState(2);

  // Actual nutrition (from barcode) takes priority; fall back to estimate
  const actualNutrition = item.nutrition?.kcal > 0 ? item.nutrition : null;
  const estimated = !actualNutrition ? estimateNutrition(name) : null;
  const displayNutrition = actualNutrition || estimated;
  const isEstimated = !actualNutrition && !!estimated;

  const handleSave = () => {
    const autoCategory = categorizeItem(name);
    onSave(item.id, {
      raw_name: name,
      expiry_date: expiry || null,
      quantity: Math.max(1, quantity),
      price: parseFloat(price) || 0,
      categoryOverride: category !== autoCategory ? category : null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-end justify-center z-[70]">
      <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-t-[3rem] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border-t border-white/50">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</label>
              <div className="flex items-center gap-2 mt-1">
                <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl text-lg font-bold text-slate-600 flex items-center justify-center hover:border-sky-300 transition-colors shrink-0">−</button>
                <input
                  type="number" min="1" value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-blue-50/50 border border-blue-100 px-3 py-2.5 rounded-2xl text-sm font-bold text-slate-800 text-center focus:border-sky-400 focus:outline-none"
                />
                <button type="button" onClick={() => setQuantity(q => q + 1)}
                  className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl text-lg font-bold text-slate-600 flex items-center justify-center hover:border-sky-300 transition-colors shrink-0">+</button>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price ($)</label>
              <input
                type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full mt-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm text-slate-800 focus:border-sky-400 focus:outline-none placeholder:text-slate-300"
              />
            </div>
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

          {displayNutrition && (
            <div className="bg-sky-50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nutrition per 100g</p>
                {isEstimated && <span className="text-[9px] font-bold text-sky-400 bg-sky-100 px-2 py-0.5 rounded-full">estimated</span>}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><p className="text-sm font-black text-[#6BAEE0]">{displayNutrition.kcal}</p><p className="text-[9px] text-slate-400">kcal</p></div>
                <div><p className="text-sm font-black text-emerald-500">{displayNutrition.protein}g</p><p className="text-[9px] text-slate-400">protein</p></div>
                <div><p className="text-sm font-black text-amber-500">{displayNutrition.carbs}g</p><p className="text-[9px] text-slate-400">carbs</p></div>
                <div><p className="text-sm font-black text-rose-500">{displayNutrition.fat}g</p><p className="text-[9px] text-slate-400">fat</p></div>
              </div>
            </div>
          )}

          {item.household_id && parseFloat(price) > 0 && (
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Split via Venmo</p>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs text-slate-500 flex-1">Split between</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSplitCount(c => Math.max(2, c - 1))}
                    className="w-7 h-7 bg-white border border-blue-100 rounded-xl text-sm font-bold text-slate-600 flex items-center justify-center hover:border-sky-300 transition-colors"
                  >−</button>
                  <span className="w-5 text-center text-sm font-black text-slate-700">{splitCount}</span>
                  <button
                    type="button"
                    onClick={() => setSplitCount(c => c + 1)}
                    className="w-7 h-7 bg-white border border-blue-100 rounded-xl text-sm font-bold text-slate-600 flex items-center justify-center hover:border-sky-300 transition-colors"
                  >+</button>
                </div>
                <span className="text-xs text-slate-500">people</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Per person</p>
                  <p className="text-xl font-black text-[#6BAEE0]">${(parseFloat(price) / splitCount).toFixed(2)}</p>
                </div>
                <a
                  href={`venmo://paycharge?txn=pay&amount=${(parseFloat(price) / splitCount).toFixed(2)}&note=${encodeURIComponent(`Grocery split: ${name}`)}`}
                  onClick={() => {
                    setTimeout(() => {
                      window.open(`https://account.venmo.com/payment-link?txn=pay&amount=${(parseFloat(price) / splitCount).toFixed(2)}&note=${encodeURIComponent(`Grocery split: ${name}`)}`, '_blank');
                    }, 600);
                  }}
                  className="bg-[#3D95CE] text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-md shadow-blue-200 active:scale-95 transition-all"
                >
                  Request via Venmo
                </a>
              </div>
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
function CategorySheet({ category, items, onClose, onItemTap, onRemove, households, getHouseholdLabel, cycleItemHousehold, pickItemHousehold, hhPickerItemId, setCategoryOverrides, onAdjustQty }) {
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
                    <span className="text-xs font-bold text-slate-700">{toTitleCase(item.raw_name || item.item_name || '')}</span>
                    {expiring && <AlertCircle size={10} className="text-orange-400 animate-pulse shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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

                {/* Inline quantity stepper */}
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onAdjustQty(item.id, -1); }}
                    className="w-6 h-6 bg-blue-50 border border-blue-100 rounded-lg text-sm font-bold text-slate-500 flex items-center justify-center hover:border-sky-300 transition-colors">−</button>
                  <span className="w-5 text-center text-[11px] font-black text-slate-700">{item.quantity || 1}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onAdjustQty(item.id, 1); }}
                    className="w-6 h-6 bg-blue-50 border border-blue-100 rounded-lg text-sm font-bold text-slate-500 flex items-center justify-center hover:border-sky-300 transition-colors">+</button>
                </div>

                {households.length > 0 && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => cycleItemHousehold(item)}
                      className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase border transition-all ${
                        item.household_id ? 'text-[#6BAEE0] bg-sky-50 border-sky-100' : 'text-slate-300 bg-slate-50 border-slate-100'
                      }`}
                    >
                      {item.household_id ? <Users size={9} /> : <User size={9} />}
                      {item.household_id && <span className="max-w-10 truncate">{getHouseholdLabel(item.household_id)}</span>}
                    </button>
                    {hhPickerItemId === item.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-blue-100 rounded-2xl shadow-xl z-30 min-w-[140px] p-2 space-y-1">
                        <button
                          onClick={() => pickItemHousehold(item, null)}
                          className="w-full text-left text-xs font-bold text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2"
                        >
                          <User size={11} /> Personal
                        </button>
                        {households.map(h => (
                          <button
                            key={h.id}
                            onClick={() => pickItemHousehold(item, h.id)}
                            className="w-full text-left text-xs font-bold text-slate-600 px-3 py-2 rounded-xl hover:bg-sky-50 hover:text-[#6BAEE0] flex items-center gap-2"
                          >
                            <Users size={11} /> {h.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
  barcodeLoading, barcodeResult, isScanningBarcode, setIsScanningBarcode,
  quantities = {}, adjustQuantity, setQuantityForItem,
}) {
  const [manualItem, setManualItem] = useState('');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(null);
  const [activeSheet, setActiveSheet] = useState(null);
  const [hhPickerItemId, setHhPickerItemId] = useState(null);
  const [activeIngredient, setActiveIngredient] = useState(null);
  const [categoryOverrides, setCategoryOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hungry_cat_overrides') || '{}'); } catch { return {}; }
  });
  const hasScannedRef = useRef(false);

  // Leftover Recon state
  const [leftoverLoading, setLeftoverLoading] = useState(false);
  const [leftoverPreview, setLeftoverPreview] = useState(null); // { meal }
  const [leftoverDate, setLeftoverDate] = useState('');

  // Voice Inventory state
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceItems, setVoiceItems] = useState(null); // [{name, amount}] | null
  const [voiceDismissing, setVoiceDismissing] = useState(false);
  const voiceRecognitionRef = useRef(null);

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

  // ── Leftover Recon ──────────────────────────────────────────────────────────
  const handleLeftoverScan = (file) => {
    if (!file) return;
    setLeftoverLoading(true);
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = (img.height / img.width) * 600 || 800;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64Data = canvas.toDataURL('image/jpeg', 0.75);
        const res = await fetch('/.netlify/functions/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Data, leftoverMode: true })
        });
        const data = await res.json();
        setLeftoverPreview({ meal: data.meal || 'Prepared Meal' });
        setLeftoverDate(new Date().toISOString().split('T')[0]);
      } catch {
        setLeftoverPreview({ meal: 'Prepared Meal' });
        setLeftoverDate(new Date().toISOString().split('T')[0]);
      } finally {
        setLeftoverLoading(false);
      }
    };
    img.onerror = () => setLeftoverLoading(false);
  };

  const confirmLeftover = () => {
    if (!leftoverPreview) return;
    handleAddManualItem(leftoverPreview.meal, null, { expiry_date: leftoverDate || null });
    setLeftoverPreview(null);
  };

  // ── Voice Inventory ─────────────────────────────────────────────────────────
  const startVoice = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) { alert('Voice input is not supported in this browser. Try Chrome or Safari.'); return; }

    if (voiceListening) {
      voiceRecognitionRef.current?.stop();
      setVoiceListening(false);
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = async (e) => {
      const transcript = e.results[0][0].transcript;
      // Stop mic immediately — user has stopped speaking, parsing is starting
      try { rec.stop(); } catch {}
      setVoiceListening(false);
      setVoiceLoading(true);
      try {
        const prompt = `Parse this spoken grocery list. Speech: "${transcript}". For each food item extract the name and numeric quantity (how many of that item). Return ONLY valid JSON with no markdown: {"items":[{"name":"string","quantity":number_or_1}]}. Examples: "2 bananas" → quantity 2, "a dozen eggs" → quantity 12, "some milk" → quantity 1. Include every food item mentioned.`;
        const res = await fetch('/.netlify/functions/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customPrompt: prompt, directMode: true })
        });
        const text = await res.text();
        const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        setVoiceItems(Array.isArray(parsed.items) ? parsed.items.filter(i => i.name).map(i => ({ ...i, quantity: parseInt(i.quantity) || 1 })) : []);
      } catch {
        setVoiceItems([]);
      } finally {
        setVoiceLoading(false);
      }
    };

    rec.onerror = () => setVoiceListening(false);
    rec.onend = () => setVoiceListening(false);

    voiceRecognitionRef.current = rec;
    rec.start();
    setVoiceListening(true);
  };

  const dismissVoicePanel = (callback) => {
    setVoiceDismissing(true);
    setTimeout(() => {
      setVoiceItems(null);
      setVoiceDismissing(false);
      if (callback) callback();
    }, 320);
  };

  const addAllVoiceItems = async () => {
    if (!voiceItems) return;
    const items = [...voiceItems];
    dismissVoicePanel(async () => {
      for (const item of items) {
        if (item.name) await handleAddManualItem(item.name, null, { quantity: item.quantity || 1 });
      }
    });
  };

  const cycleItemHousehold = (item) => {
    if (!handleToggleItemHousehold || households.length === 0) return;
    if (households.length === 1) {
      // Single household: simply toggle personal ↔ household
      const next = item.household_id ? null : households[0].id;
      handleToggleItemHousehold(item.id, next);
    } else {
      // Multiple households: open picker
      setHhPickerItemId(hhPickerItemId === item.id ? null : item.id);
    }
  };

  const pickItemHousehold = (item, hhId) => {
    handleToggleItemHousehold(item.id, hhId);
    setHhPickerItemId(null);
  };

  const getHouseholdLabel = (householdId) => {
    if (!householdId) return null;
    return households.find(h => h.id === householdId)?.name || 'Shared';
  };

  const getEffectiveCategory = (item) =>
    categoryOverrides[item.id] || categorizeItem(item.raw_name || item.item_name || '');

  const handleSaveIngredient = (id, updates) => {
    if ('categoryOverride' in updates) {
      const newOverrides = { ...categoryOverrides };
      if (updates.categoryOverride === null) delete newOverrides[id];
      else newOverrides[id] = updates.categoryOverride;
      localStorage.setItem('hungry_cat_overrides', JSON.stringify(newOverrides));
      setCategoryOverrides(newOverrides);
    }
    if (updates.quantity !== undefined && setQuantityForItem) {
      setQuantityForItem(id, updates.quantity);
    }
    const { categoryOverride, quantity: _qty, ...dbUpdates } = updates;
    if (Object.keys(dbUpdates).length > 0) {
      handleUpdateItem(id, dbUpdates);
    }
  };

  // Enrich fridge items with category overrides and quantities from inventory
  const enrichedFridge = useMemo(() => fridge.map(item => ({
    ...item,
    quantity: quantities[item.id] || item.quantity || 1,
    categoryOverride: categoryOverrides[item.id] || null,
  })), [fridge, quantities, categoryOverrides]);

  const groupedFridge = useMemo(() => CATEGORIES.reduce((acc, cat) => {
    acc[cat] = enrichedFridge.filter(item =>
      (categoryOverrides[item.id] || categorizeItem(item.raw_name || item.item_name || '')) === cat
    );
    return acc;
  }, {}), [enrichedFridge, categoryOverrides]);

  const sheetItems = activeSheet ? (groupedFridge[activeSheet] || []) : [];

  const totalValue = useMemo(() => fridge.reduce((sum, item) => sum + (Number(item.price) || 0), 0), [fridge]);

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

          <div className="flex gap-2">
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && barcodeInput) handleBarcodeLookup(barcodeInput); }}
              placeholder="Enter barcode / UPC"
              className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none transition-all shadow-sm"
            />
            <button type="button" onClick={() => handleBarcodeLookup(barcodeInput)} className="bg-[#6BAEE0] text-white p-4 rounded-2xl shadow-lg shadow-blue-100 active:scale-90 transition-all">
              {barcodeLoading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsScanningBarcode(true)}
            className="w-full bg-sky-50 text-[#1F6FB8] border border-sky-100 px-5 py-4 rounded-2xl text-xs font-bold hover:bg-sky-100 transition-all shadow-sm text-center flex items-center justify-center gap-2"
          >
            <Camera size={16} /> Scan with Camera
          </button>

          {/* AI Sensory Row: Leftover Recon + Voice Inventory */}
          <div className="grid grid-cols-2 gap-2">
            <label
              htmlFor="leftover-upload"
              className={`cursor-pointer flex items-center justify-center gap-1.5 bg-violet-50 text-violet-600 border border-violet-100 px-4 py-3.5 rounded-2xl text-xs font-bold hover:bg-violet-100 transition-all text-center ${leftoverLoading ? 'opacity-60 pointer-events-none' : ''}`}
            >
              {leftoverLoading ? <Loader2 size={15} className="animate-spin" /> : <UtensilsCrossed size={15} />}
              {leftoverLoading ? 'Scanning…' : 'Scan Leftover'}
            </label>
            <input id="leftover-upload" type="file" accept="image/*" capture="environment" onChange={(e) => { handleLeftoverScan(e.target.files[0]); e.target.value = ''; }} className="hidden" />

            <button
              type="button"
              onClick={startVoice}
              disabled={voiceLoading}
              className={`flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all border ${
                voiceListening
                  ? 'bg-red-500 text-white border-red-500 animate-pulse'
                  : voiceLoading
                  ? 'bg-slate-50 text-slate-400 border-slate-100 opacity-60'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
              }`}
            >
              {voiceLoading ? <Loader2 size={15} className="animate-spin" /> : voiceListening ? <MicOff size={15} /> : <Mic size={15} />}
              {voiceLoading ? 'Parsing…' : voiceListening ? 'Tap to stop' : 'Voice Add'}
            </button>
          </div>

          {/* Voice items preview */}
          {voiceItems !== null && (
            <div className={`bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-3 transition-all duration-300 ${voiceDismissing ? 'opacity-0 -translate-y-2 scale-95 pointer-events-none' : 'opacity-100 translate-y-0 scale-100'}`}>
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Heard these items:</p>
              {voiceItems.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nothing recognized — please try again.</p>
              ) : (
                <div className="space-y-1.5">
                  {voiceItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-slate-700">{item.name}</span>
                      {item.quantity > 1 && <span className="text-[10px] font-black text-[#6BAEE0] bg-sky-50 px-2 py-0.5 rounded-full">× {item.quantity}</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={addAllVoiceItems} disabled={voiceItems.length === 0} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-black disabled:opacity-50 transition-all">
                  <Check size={13} /> Add All
                </button>
                <button onClick={() => dismissVoicePanel()} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 bg-white border border-slate-100 hover:border-slate-300 transition-all">
                  Discard
                </button>
              </div>
            </div>
          )}

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
          <div>
            <h2 className="text-[14px] font-bold text-slate-400">Pantry Stock</h2>
            {totalValue > 0 && (
              <p className="text-[10px] font-black text-emerald-500 mt-0.5">
                Est. value: ${totalValue.toFixed(2)}
              </p>
            )}
          </div>
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
          pickItemHousehold={pickItemHousehold}
          hhPickerItemId={hhPickerItemId}
          setCategoryOverrides={setCategoryOverrides}
          onAdjustQty={adjustQuantity}
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

      {/* ── Leftover Confirm Modal ─────────────────────────────────────────── */}
      {leftoverPreview && (
        <div className="fixed inset-0 bg-blue-900/20 backdrop-blur-xl flex items-end justify-center z-[70]">
          <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-t-[3rem] w-full max-w-lg shadow-2xl border-t border-white/50 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><UtensilsCrossed size={16} className="text-violet-500" /> Leftover Identified</h3>
              <button onClick={() => setLeftoverPreview(null)} className="p-2 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meal Name</label>
              <input
                type="text"
                value={leftoverPreview.meal}
                onChange={(e) => setLeftoverPreview(p => ({ ...p, meal: e.target.value }))}
                className="w-full mt-1 bg-violet-50 border border-violet-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-800 focus:border-violet-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Made On</label>
              <input
                type="date"
                value={leftoverDate}
                onChange={(e) => setLeftoverDate(e.target.value)}
                className="w-full mt-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
              />
            </div>
            <button onClick={confirmLeftover} className="w-full bg-violet-500 text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-violet-100 hover:bg-violet-600 transition-all">
              Add to Pantry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
