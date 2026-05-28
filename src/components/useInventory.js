import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { cleanIngredientLocally, triggerHaptic, getEstimatedExpiry } from './recipeUtils';
import { put, getAll, remove, OBJECT_STORES } from '../dbUtils';

export const useInventory = (user, household) => {
  const [fridge, setFridge] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
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
      const normalizedFridge = inventory.map(row => ({
        id: row.id,
        raw_name: row.item_name,
        item_name: cleanIngredientLocally(row.item_name),
        expiry_date: row.expiry_date,
        price: row.price || 0,
        household_id: row.household_id || null,
        nutrition: null
      })).filter(item => item.raw_name);
      setFridge(normalizedFridge);
      calculateMacroMetrics(normalizedFridge.map(f => f.item_name));

      const shopQuery = supabase.from('shopping_list').select('*').order('created_at', { ascending: true });
      if (household?.id) shopQuery.eq('household_id', household.id);
      else shopQuery.eq('user_id', user.id);

      let { data: shopItems, error: shopError } = await shopQuery;
      if (shopError) throw shopError;
      setShoppingList(shopItems || []);
    } catch (err) {
      console.error('Inventory sync error:', err);
      setError(err.message);
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
    setFridge(prev => [...prev, {
      id: tempId,
      raw_name: itemName,
      item_name: sanitized,
      household_id: targetHouseholdId,
      nutrition: extraData.nutrition || null,
      price: extraData.price || 0,
      expiry_date: estimatedExpiry
    }]);
    triggerHaptic(50);

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

    const alreadyLocal = shoppingList.some(i => i.item_name?.toLowerCase() === sanitized.toLowerCase());
    if (alreadyLocal) {
      alert('Already in your shopping list');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const newItem = {
      user_id: user.id,
      household_id: household?.id || null,
      item_name: sanitized,
      is_completed: false,
      price
    };

    setShoppingList(prev => [...prev, { ...newItem, id: tempId }]);

    const savedData = await performMutation('shopping_list', 'INSERT', newItem);
    if (savedData && savedData.id) {
      setShoppingList(prev => prev.map(item => item.id === tempId ? { ...item, id: savedData.id } : item));
    }
  }, [user, household, performMutation, shoppingList]);

  const handleToggleShoppingCompleted = useCallback(async (id, currentStatus) => {
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, is_completed: !currentStatus } : item));
    await performMutation('shopping_list', 'UPDATE', { is_completed: !currentStatus }, id);
  }, [performMutation]);

  const handleClearShoppingItem = useCallback(async (id) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
    await performMutation('shopping_list', 'DELETE', null, id);
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

  return {
    fridge,
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
    handleBarcodeLookup,
    handleFileUpload,
    handleUpdateInlineItem,
    handleUpdateItem
  };
};
