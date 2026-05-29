import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { cleanIngredientLocally, triggerHaptic, getEstimatedExpiry, toTitleCase } from './recipeUtils';
import { put, getAll, remove, OBJECT_STORES } from '../dbUtils';

export const useInventory = (user, household) => {
  const [fridge, setFridge] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const shoppingListRef = useRef([]);
  const [quantities, setQuantities] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hungry_quantities') || '{}'); } catch { return {}; }
  });
  const [nutritionMetrics, setNutritionMetrics] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [loading, setLoading] = useState(true);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState('');
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [storeName, setStoreName] = useState('General Grocery');
  const [receiptMessage, setReceiptMessage] = useState('');
  const [error, setError] = useState(null);

  const calculateMacroMetrics = useCallback((tokens) => {
    let p = 0, c = 0, f = 0;
    (tokens || []).forEach(item => {
      if (!item) return;
      if (item.includes('paneer') || item.includes('tofu')) { p += 18; c += 3; f += 20; }
      else if (item.includes('lentil') || item.includes('chickpea') || item.includes('bean')) { p += 9; c += 22; f += 1; }
      else { p += 4; c += 12; f += 2; }
    });
    setNutritionMetrics({ protein: p, carbs: c, fat: f });
  }, []);

  // Hydrate from LocalStorage on first mount for instant offline display
  useEffect(() => {
    const cachedFridge = localStorage.getItem('hungry_pantry_v1');
    const cachedShopping = localStorage.getItem('hungry_shopping_v1');
    try {
      if (cachedFridge) setFridge(JSON.parse(cachedFridge));
      if (cachedShopping) setShoppingList(JSON.parse(cachedShopping));
    } catch (e) { console.error("Failed to parse cache", e); }
  }, []);

  // Sync state to LocalStorage for offline access
  useEffect(() => {
    localStorage.setItem('hungry_pantry_v1', JSON.stringify(fridge));
  }, [fridge]);

  useEffect(() => {
    shoppingListRef.current = shoppingList;
    localStorage.setItem('hungry_shopping_v1', JSON.stringify(shoppingList));
  }, [shoppingList]);

  const performMutation = useCallback(async (table, action, data, id_value = null) => {
    if (navigator.onLine) {
      try {
        let result;
        if (action === 'INSERT') result = await supabase.from(table).insert([data]).select().single();
        else if (action === 'DELETE') result = await supabase.from(table).delete().eq('id', id_value);
        else if (action === 'UPDATE') result = await supabase.from(table).update(data).eq('id', id_value);

        if (!result.error) return result.data || true;
      } catch (e) {
        console.error("Supabase mutation failed, queuing...", e);
      }
    }

    await put(OBJECT_STORES.SYNC_QUEUE, { table, action, data, id_value, timestamp: Date.now() });
    return null;
  }, []);

  const syncOfflineChanges = useCallback(async () => {
    if (!navigator.onLine || !user) return;

    try {
      const queue = await getAll(OBJECT_STORES.SYNC_QUEUE);
      if (!queue || queue.length === 0) return;

      for (const task of queue) {
        let error;

        if (task.action === 'UPDATE' || task.action === 'DELETE') {
          const { data: remoteMetadata } = await supabase
            .from(task.table)
            .select('updated_at')
            .eq('id', task.id_value)
            .single();

          if (remoteMetadata && new Date(remoteMetadata.updated_at).getTime() > task.timestamp) {
            await remove(OBJECT_STORES.SYNC_QUEUE, task.id);
            continue;
          }
        }

        if (task.action === 'INSERT') ({ error } = await supabase.from(task.table).insert([task.data]));
        else if (task.action === 'DELETE') ({ error } = await supabase.from(task.table).delete().eq('id', task.id_value));
        else if (task.action === 'UPDATE') ({ error } = await supabase.from(task.table).update(task.data).eq('id', task.id_value));

        if (!error) await remove(OBJECT_STORES.SYNC_QUEUE, task.id);
      }
      fetchAppData();
    } catch (e) {
      console.error("Sync process failed", e);
    }
  }, [user]);

  useEffect(() => {
    window.addEventListener('online', syncOfflineChanges);
    syncOfflineChanges();
    return () => window.removeEventListener('online', syncOfflineChanges);
  }, [syncOfflineChanges]);

  const resolveSanitizedTokenOnline = useCallback(async (rawInputString) => {
    const localToken = cleanIngredientLocally(rawInputString);
    if (!rawInputString || !rawInputString.trim()) return localToken;
    try {
      const response = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolveItemToken: rawInputString, storeContext: storeName })
      });
      if (response.ok) {
        const data = await response.json();
        return cleanIngredientLocally(data.sanitized || '') || localToken;
      }
    } catch (e) { console.error('Resolve error:', e); }
    return localToken;
  }, [storeName]);

  const fetchAppData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Personal items (no household) + shared items from active household
      const { data: personal, error: pErr } = await supabase
        .from('fridge_inventory').select('*')
        .eq('user_id', user.id).is('household_id', null);
      if (pErr) throw pErr;

      let shared = [];
      if (household?.id) {
        const { data: sharedItems, error: sErr } = await supabase
          .from('fridge_inventory').select('*')
          .eq('household_id', household.id);
        if (!sErr) shared = sharedItems || [];
      }

      const inventory = [...(personal || []), ...shared];
      let storedQtys = {};
      try { storedQtys = JSON.parse(localStorage.getItem('hungry_quantities') || '{}'); } catch {}
      const normalizedFridge = inventory.map(row => ({
        id: row.id,
        raw_name: row.item_name,
        item_name: cleanIngredientLocally(row.item_name),
        quantity: storedQtys[row.id] || 1,
        expiry_date: row.expiry_date,
        price: row.price || 0,
        household_id: row.household_id || null,
        nutrition: null
      })).filter(item => item.raw_name);
      setFridge(normalizedFridge);
      calculateMacroMetrics(normalizedFridge.map(f => f.item_name));

      // Fetch ALL shopping items belonging to this user (any household_id) plus household items
      const { data: allMyShop } = await supabase
        .from('shopping_list').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      let shopItems = [...(allMyShop || [])];

      // Also fetch household items added by OTHER members
      if (household?.id) {
        const { data: hhShop } = await supabase
          .from('shopping_list').select('*')
          .eq('household_id', household.id)
          .neq('user_id', user.id)
          .order('created_at', { ascending: true });
        shopItems = [...shopItems, ...(hhShop || [])];
      }

      // Merge server data with any temp items not yet saved (avoids wiping optimistic adds)
      setShoppingList(prev => {
        const serverIds = new Set(shopItems.map(i => i.id));
        const tempItems = prev.filter(i => String(i.id).startsWith('temp-') && !serverIds.has(i.id));
        const merged = [...shopItems, ...tempItems];
        // Deduplicate by ID
        const seen = new Set();
        return merged.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
      });
    } catch (err) {
      console.error('Inventory sync error:', err);
      setError(err.message);
      // Keep whatever is in localStorage — don't blank the UI on a failed fetch
      try {
        const cached = localStorage.getItem('hungry_shopping_v1');
        if (cached) setShoppingList(JSON.parse(cached));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [user, household, calculateMacroMetrics]);

  useEffect(() => {
    fetchAppData();
  }, [fetchAppData]);

  const handleAddManualItem = useCallback(async (itemName, targetHouseholdId = null, extraData = {}) => {
    if (!itemName || !itemName.trim() || !user) return;

    const sanitized = await resolveSanitizedTokenOnline(itemName);
    if (!sanitized) return;

    const estimatedExpiry = extraData.expiry_date || getEstimatedExpiry(itemName);

    const tempId = `temp-${Date.now()}`;
    const qty = Math.max(1, parseInt(extraData.quantity) || 1);
    const displayName = toTitleCase(itemName);
    setFridge(prev => [...prev, {
      id: tempId,
      raw_name: displayName,
      item_name: sanitized,
      quantity: qty,
      household_id: targetHouseholdId,
      nutrition: extraData.nutrition || null,
      price: extraData.price || 0,
      expiry_date: estimatedExpiry
    }]);
    triggerHaptic(50);

    // Update reactive quantities state + localStorage immediately under tempId
    if (qty > 1) {
      setQuantities(prev => {
        const next = { ...prev, [tempId]: qty };
        try { localStorage.setItem('hungry_quantities', JSON.stringify(next)); } catch {}
        return next;
      });
    }

    const newItem = {
      item_name: sanitized,
      user_id: user.id,
      household_id: targetHouseholdId,
      price: extraData.price || 0,
      expiry_date: estimatedExpiry
    };

    const savedData = await performMutation('fridge_inventory', 'INSERT', newItem);
    if (savedData && savedData.id) {
      setFridge(prev => prev.map(item => item.id === tempId ? { ...item, id: savedData.id } : item));
      // Migrate tempId quantity to real DB id
      if (qty > 1) {
        setQuantities(prev => {
          const next = { ...prev, [savedData.id]: qty };
          delete next[tempId];
          try { localStorage.setItem('hungry_quantities', JSON.stringify(next)); } catch {}
          return next;
        });
      }
    }
  }, [user, resolveSanitizedTokenOnline, performMutation]);

  const handleToggleItemHousehold = useCallback(async (id, newHouseholdId) => {
    setFridge(prev => prev.map(item => item.id === id ? { ...item, household_id: newHouseholdId } : item));
    await performMutation('fridge_inventory', 'UPDATE', { household_id: newHouseholdId }, id);
  }, [performMutation]);

  const handleRemoveItem = useCallback(async (id) => {
    setFridge(prev => prev.filter(item => item.id !== id));
    await performMutation('fridge_inventory', 'DELETE', null, id);
  }, [performMutation]);

  const handleAddShoppingItem = useCallback(async (itemName, price = 0) => {
    if (!itemName || !user) return;
    const sanitized = cleanIngredientLocally(itemName);
    if (!sanitized) return;

    // Use ref so concurrent adds (from handleAddAllMissing) see the latest state
    const alreadyLocal = shoppingListRef.current.some(i => i.item_name?.toLowerCase() === sanitized.toLowerCase());
    if (alreadyLocal) return; // silent skip — batch adds shouldn't alert

    // Respect user's default destination preference
    const defaultDest = localStorage.getItem('hungry_default_shopping_dest') || 'personal';
    const householdId = defaultDest === 'personal' ? null : defaultDest;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const newItem = {
      user_id: user.id,
      household_id: householdId,
      item_name: sanitized,
      is_completed: false,
      price
    };

    // Update ref immediately so concurrent batch adds see this item and skip duplicates
    shoppingListRef.current = [...shoppingListRef.current, { ...newItem, id: tempId }];
    setShoppingList(prev => [...prev, { ...newItem, id: tempId }]);

    const savedData = await performMutation('shopping_list', 'INSERT', newItem);
    if (savedData && savedData.id) {
      setShoppingList(prev => prev.map(item => item.id === tempId ? { ...item, id: savedData.id } : item));
    }
  }, [user, performMutation, shoppingList]);

  const handleMoveShoppingItem = useCallback(async (id, newHouseholdId) => {
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, household_id: newHouseholdId } : item));
    await performMutation('shopping_list', 'UPDATE', { household_id: newHouseholdId }, id);
  }, [performMutation]);

  const handleToggleShoppingCompleted = useCallback(async (id, currentStatus) => {
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, is_completed: !currentStatus } : item));
    await performMutation('shopping_list', 'UPDATE', { is_completed: !currentStatus }, id);
  }, [performMutation]);

  const handleClearShoppingItem = useCallback(async (id) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
    await performMutation('shopping_list', 'DELETE', null, id);
  }, [performMutation]);

  const handleRenameShoppingItem = useCallback(async (id, newName) => {
    if (!newName.trim()) return;
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, item_name: newName.trim() } : item));
    await performMutation('shopping_list', 'UPDATE', { item_name: newName.trim() }, id);
  }, [performMutation]);

  const handleBarcodeLookup = useCallback(async (barcode) => {
    if (!barcode) return;
    setBarcodeLoading(true);
    setBarcodeResult('');
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      if (data?.status === 1 && data.product) {
        const name = data.product.product_name || data.product.brands || '';

        // Extract nutrition per 100g
        const nm = data.product.nutriments || {};
        const kcal = Math.round(nm['energy-kcal_100g'] || (nm['energy_100g'] || 0) / 4.184);
        const nutrition = kcal > 0 ? {
          kcal,
          protein: Math.round((nm['proteins_100g'] || 0) * 10) / 10,
          carbs: Math.round((nm['carbohydrates_100g'] || 0) * 10) / 10,
          fat: Math.round((nm['fat_100g'] || 0) * 10) / 10,
        } : null;

        // Try Open Prices API for price
        let price = 0;
        try {
          const priceRes = await fetch(`https://prices.openfoodfacts.org/api/v1/prices?product_code=${barcode}&order_by=-date&size=1`);
          if (priceRes.ok) {
            const priceData = await priceRes.json();
            if (priceData.items && priceData.items.length > 0) price = priceData.items[0].price || 0;
          }
        } catch (_) {}

        if (name) {
          await handleAddManualItem(name, null, { nutrition, price });
          const nutritionText = nutrition ? ` · ${nutrition.kcal} kcal/100g` : '';
          const priceText = price > 0 ? ` · $${Number(price).toFixed(2)}` : '';
          setBarcodeResult(`Added: ${name}${nutritionText}${priceText}`);
          setTimeout(() => setBarcodeResult(''), 8000);
          try { await new Audio('/sounds/success.mp3').play(); } catch (e) {}
          triggerHaptic(100);
          setBarcodeInput('');
        } else {
          setBarcodeResult('Product found but has no name');
          setTimeout(() => setBarcodeResult(''), 8000);
        }
      } else {
        setBarcodeResult('Product not found');
        setTimeout(() => setBarcodeResult(''), 8000);
      }
    } catch (e) {
      setBarcodeResult('Lookup failed');
      setTimeout(() => setBarcodeResult(''), 8000);
    } finally {
      setBarcodeLoading(false);
    }
  }, [handleAddManualItem]);

  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;
    setReceiptLoading(true);
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = (img.height / img.width) * 600 || 800;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64Data = canvas.toDataURL('image/jpeg', 0.75);

        // Cache the image for offline reference — fire and forget, never block the scan
        put(OBJECT_STORES.RECEIPT_IMAGES, { id: `receipt-${Date.now()}`, imageData: base64Data, timestamp: Date.now() }).catch(() => {});

        const response = await fetch('/.netlify/functions/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Data })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server error ${response.status}`);
        }
        const data = await response.json();
        if (data.storeName) setStoreName(data.storeName);
        if (Array.isArray(data.added) && data.added.length > 0) {
          for (const item of data.added) {
            await handleAddManualItem(item);
          }
          setReceiptMessage(`Added ${data.added.length} item${data.added.length !== 1 ? 's' : ''} from receipt`);
        } else {
          setReceiptMessage('Receipt scanned — no food items found. Try a clearer photo.');
        }
        setTimeout(() => setReceiptMessage(''), 6000);
      } catch (e) {
        console.error(e);
        setReceiptMessage(`Scan failed: ${e.message || 'Please try again.'}`);
        setTimeout(() => setReceiptMessage(''), 6000);
      } finally {
        setReceiptLoading(false);
      }
    };
    img.onerror = () => setReceiptLoading(false);
  }, [handleAddManualItem]);

  const handleUpdateInlineItem = useCallback(async (id, newName) => {
    const sanitized = cleanIngredientLocally(newName);
    setFridge(prev => prev.map(item => item.id === id ? { ...item, raw_name: newName, item_name: sanitized } : item));
    await performMutation('fridge_inventory', 'UPDATE', { item_name: sanitized }, id);
  }, [performMutation]);

  const handleUpdateItem = useCallback(async (id, updates) => {
    setFridge(prev => prev.map(item => {
      if (item.id !== id) return item;
      const next = { ...item };
      if (updates.raw_name !== undefined) {
        next.raw_name = updates.raw_name;
        next.item_name = cleanIngredientLocally(updates.raw_name);
      }
      if (updates.expiry_date !== undefined) next.expiry_date = updates.expiry_date;
      if (updates.household_id !== undefined) next.household_id = updates.household_id;
      if (updates.price !== undefined) next.price = updates.price;
      return next;
    }));
    const dbUpdates = {};
    if (updates.raw_name !== undefined) dbUpdates.item_name = cleanIngredientLocally(updates.raw_name);
    if (updates.expiry_date !== undefined) dbUpdates.expiry_date = updates.expiry_date;
    if (updates.household_id !== undefined) dbUpdates.household_id = updates.household_id;
    if (updates.price !== undefined) dbUpdates.price = updates.price;
    if (Object.keys(dbUpdates).length > 0) {
      await performMutation('fridge_inventory', 'UPDATE', dbUpdates, id);
    }
  }, [performMutation]);

  // Subtract pantry items when a recipe is marked as cooked.
  // Each recipe ingredient is matched against fridge items; quantity is decremented.
  // Items reaching 0 are removed from the pantry.
  const adjustQuantity = useCallback((id, delta) => {
    setQuantities(prev => {
      const current = prev[id] || 1;
      const next = { ...prev, [id]: Math.max(1, current + delta) };
      try { localStorage.setItem('hungry_quantities', JSON.stringify(next)); } catch {}
      return next;
    });
    setFridge(prev => prev.map(item => item.id === id
      ? { ...item, quantity: Math.max(1, (item.quantity || 1) + delta) }
      : item));
  }, []);

  const setQuantityForItem = useCallback((id, qty) => {
    const v = Math.max(1, qty);
    setQuantities(prev => {
      const next = { ...prev, [id]: v };
      try { localStorage.setItem('hungry_quantities', JSON.stringify(next)); } catch {}
      return next;
    });
    setFridge(prev => prev.map(item => item.id === id ? { ...item, quantity: v } : item));
  }, []);

  const handleMarkCooked = useCallback(async (recipe) => {
    if (!recipe) return;
    const toRemove = [];
    const toUpdate = [];

    // Build a map of cleaned ingredient name → required quantity from the recipe
    const _parseQty = (ingStr) => {
      const m = String(ingStr || '').match(/^([\d\/\.\s\-½⅓¼¾⅛]+)/);
      if (!m) return 1;
      let v = parseFloat(m[1]);
      if (isNaN(v)) {
        const s = m[1];
        if (s.includes('½')) v = 0.5;
        else if (s.includes('¼')) v = 0.25;
        else if (s.includes('¾')) v = 0.75;
        else v = 1;
      }
      return Math.max(1, Math.ceil(v));
    };

    // Map: cleanedIngredient → qty needed (from original ingredient strings for number parsing)
    const neededQty = {};
    (recipe.ingredients || []).forEach((ingStr, i) => {
      const cleaned = (recipe.cleanedIngredients || [])[i] || cleanIngredientLocally(ingStr);
      const qty = _parseQty(ingStr);
      neededQty[cleaned] = (neededQty[cleaned] || 0) + qty;
    });

    fridge.forEach(item => {
      const a = (item.item_name || '').toLowerCase();
      // Find the matched ingredient key
      const matchedKey = Object.keys(neededQty).find(b => a.includes(b) || b.includes(a));
      if (!matchedKey) return;
      const requiredQty = neededQty[matchedKey] || 1;
      const currentQty = quantities[item.id] || item.quantity || 1;
      const remaining = currentQty - requiredQty;
      if (remaining <= 0) {
        toRemove.push(item.id);
      } else {
        toUpdate.push({ id: item.id, qty: remaining });
      }
    });

    // Update reactive quantities state
    setQuantities(prev => {
      const next = { ...prev };
      toRemove.forEach(id => delete next[id]);
      toUpdate.forEach(({ id, qty }) => { next[id] = qty; });
      try { localStorage.setItem('hungry_quantities', JSON.stringify(next)); } catch {}
      return next;
    });

    // Remove fully depleted items
    for (const id of toRemove) await handleRemoveItem(id);

    // Update fridge state quantities
    setFridge(prev => prev.map(item => {
      const u = toUpdate.find(x => x.id === item.id);
      return u ? { ...item, quantity: u.qty } : item;
    }));

    // Log to Chef History in localStorage
    try {
      const history = JSON.parse(localStorage.getItem('hungry_chef_history') || '[]');
      history.unshift({
        id: `cooked-${Date.now()}`,
        recipeId: String(recipe.id),
        recipeName: recipe.name,
        meal_type: recipe.meal_type || '',
        description: recipe.description || recipe.summary || '',
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || [],
        cookedAt: new Date().toISOString(),
        notes: '',
        photos: []
      });
      localStorage.setItem('hungry_chef_history', JSON.stringify(history.slice(0, 100)));
    } catch {}
  }, [fridge, quantities, handleRemoveItem]);

  return {
    fridge,
    quantities,
    adjustQuantity,
    setQuantityForItem,
    shoppingList,
    nutritionMetrics,
    loading,
    error,
    receiptLoading,
    receiptMessage,
    barcodeLoading,
    barcodeResult,
    isScanningBarcode,
    barcodeInput,
    setBarcodeInput,
    storeName,
    setIsScanningBarcode,
    handleAddManualItem,
    handleRemoveItem,
    handleToggleItemHousehold,
    handleAddShoppingItem,
    handleToggleShoppingCompleted,
    handleClearShoppingItem,
    handleRenameShoppingItem,
    handleMoveShoppingItem,
    handleBarcodeLookup,
    handleFileUpload,
    handleUpdateInlineItem,
    handleUpdateItem,
    handleMarkCooked
  };
};
