import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { cleanIngredientLocally, triggerHaptic } from './recipeUtils';
import { put, getAll, remove, OBJECT_STORES } from '../dbUtils';

export const useInventory = (user, household) => {
  const [fridge, setFridge] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [nutritionMetrics, setNutritionMetrics] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [loading, setLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState('');
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [storeName, setStoreName] = useState('General Grocery');
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

  // Offline Persistence: Hydrate state from LocalStorage on mount
  useEffect(() => {
    const cachedFridge = localStorage.getItem('hungry_pantry_v1');
    const cachedShopping = localStorage.getItem('hungry_shopping_v1');
    try {
      if (cachedFridge) setFridge(JSON.parse(cachedFridge));
      if (cachedShopping) setShoppingList(JSON.parse(cachedShopping));
    } catch (e) { console.error("Failed to parse cache", e); }
  }, []);

  // Sync to LocalStorage for Offline Access
  useEffect(() => {
    localStorage.setItem('hungry_pantry_v1', JSON.stringify(fridge));
  }, [fridge]);

  useEffect(() => {
    localStorage.setItem('hungry_shopping_v1', JSON.stringify(shoppingList));
  }, [shoppingList]);

  const performMutation = useCallback(async (table, action, data, id_value = null) => {
    if (navigator.onLine) {
      try {
        let error;
        if (action === 'INSERT') ({ error } = await supabase.from(table).insert([data]));
        else if (action === 'DELETE') ({ error } = await supabase.from(table).delete().eq('id', id_value));
        else if (action === 'UPDATE') ({ error } = await supabase.from(table).update(data).eq('id', id_value));
        
        if (!error) return true;
      } catch (e) {
        console.error("Supabase mutation failed, queuing...", e);
      }
    }

    await put(OBJECT_STORES.SYNC_QUEUE, { table, action, data, id_value, timestamp: Date.now() });
    return false;
  }, []);

  const syncOfflineChanges = useCallback(async () => {
    if (!navigator.onLine || !user) return;

    try {
      const queue = await getAll(OBJECT_STORES.SYNC_QUEUE);
      if (!queue || queue.length === 0) return;

      for (const task of queue) {
        let error;

        // Conflict Resolution Strategy: Last Intent Wins (Remote vs Local)
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
      let { data: inventory, error: invError } = await supabase.from('fridge_inventory').select('*').eq('user_id', user.id);
      if (invError) throw invError;

      const normalizedFridge = (inventory || []).map(row => ({
        id: row.id,
        raw_name: row.item_name,
        item_name: cleanIngredientLocally(row.item_name),
        expiry_date: row.expiry_date,
        price: row.price || 0
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

  const handleAddManualItem = useCallback(async (itemName) => {
    setLoading(true);
    const sanitized = await resolveSanitizedTokenOnline(itemName);
    if (!sanitized) return;

    const newItem = { 
      item_name: sanitized, 
      user_id: user.id,
      household_id: household?.id || null 
    };

    setFridge(prev => [...prev, { ...newItem, id: `temp-${Date.now()}`, raw_name: itemName }]);
    triggerHaptic(50);

    const success = await performMutation('fridge_inventory', 'INSERT', newItem);
    if (success) fetchAppData();
    setLoading(false);
  }, [user, household, resolveSanitizedTokenOnline, performMutation, fetchAppData]);

  const handleRemoveItem = useCallback(async (id) => {
    setFridge(prev => prev.filter(item => item.id !== id));
    const success = await performMutation('fridge_inventory', 'DELETE', null, id);
    if (success) fetchAppData();
  }, [performMutation, fetchAppData]);

  const handleAddShoppingItem = useCallback(async (itemName, price = 0) => {
    if (!itemName) return;
    const sanitized = cleanIngredientLocally(itemName);
    if (!sanitized) return;
    
    const alreadyLocal = shoppingList.some(i => i.item_name.toLowerCase() === sanitized.toLowerCase());
    if (alreadyLocal) return alert('Item already in list');

    const newItem = {
      user_id: user.id,
      household_id: household?.id || null,
      item_name: sanitized,
      is_completed: false,
      price
    };

    setShoppingList(prev => [...prev, { ...newItem, id: `temp-${Date.now()}` }]);

    const success = await performMutation('shopping_list', 'INSERT', newItem);
    if (success) fetchAppData();
  }, [user, household, performMutation, fetchAppData, shoppingList]);

  const handleToggleShoppingCompleted = useCallback(async (id, status) => {
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, is_completed: !status } : item));
    const success = await performMutation('shopping_list', 'UPDATE', { is_completed: !status }, id);
    if (success) fetchAppData();
  }, [performMutation, fetchAppData]);

  const handleClearShoppingItem = useCallback(async (id) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
    const success = await performMutation('shopping_list', 'DELETE', null, id);
    if (success) fetchAppData();
  }, [performMutation, fetchAppData]);

  const handleBarcodeLookup = useCallback(async (barcode) => {
    setBarcodeLoading(true);
    setBarcodeResult('');
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      if (data?.status === 1 && data.product) {
        const name = data.product.product_name || data.product.brands || '';
        await handleAddManualItem(name);
        setBarcodeResult(`Added ${name}`);
        try { await new Audio('/sounds/success.mp3').play(); } catch(e){}
        triggerHaptic(100);
        setBarcodeInput('');
        setIsScanningBarcode(false);
      } else { setBarcodeResult("Product not found"); }
    } catch (e) {
      setBarcodeResult("Lookup failed");
    } finally {
      setBarcodeLoading(false);
    }
  }, [handleAddManualItem, setIsScanningBarcode, setBarcodeInput]);

  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;
    setReceiptLoading(true);
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 600; 
      canvas.height = (img.height / img.width) * 600 || 800;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const base64Data = canvas.toDataURL('image/jpeg', 0.75);
      try {
        await put(OBJECT_STORES.RECEIPT_IMAGES, { id: `receipt-${Date.now()}`, imageData: base64Data, timestamp: Date.now() });
        const response = await fetch('/.netlify/functions/scan-receipt', {
          method: 'POST',
          body: JSON.stringify({ image: base64Data })
        });
        const data = await response.json();
        if (data.storeName) setStoreName(data.storeName);
        if (data.added) {
          for (const item of data.added) {
            await handleAddManualItem(item);
          }
        }
      } catch(e) { console.error(e); }
      finally { setReceiptLoading(false); }
    };
  }, [user, household, handleAddManualItem, setStoreName]);

  const handleUpdateInlineItem = useCallback(async (id, newName) => {
    const sanitized = cleanIngredientLocally(newName);
    setFridge(prev => prev.map(item => item.id === id ? { ...item, raw_name: newName, item_name: sanitized } : item));
    const success = await performMutation('fridge_inventory', 'UPDATE', { item_name: sanitized }, id);
    if (success) fetchAppData();
  }, [performMutation, fetchAppData]);

  return {
    fridge,
    shoppingList,
    nutritionMetrics,
    loading,
    receiptLoading,
    barcodeLoading,
    barcodeResult,
    isScanningBarcode,
      barcodeInput,
      setBarcodeInput,
    storeName,
    setIsScanningBarcode,
    handleAddManualItem,
    handleRemoveItem,
    handleAddShoppingItem,
    handleToggleShoppingCompleted,
    handleClearShoppingItem,
    handleBarcodeLookup,
    handleFileUpload,
    handleUpdateInlineItem
  };
};