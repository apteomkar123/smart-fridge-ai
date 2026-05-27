import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { cleanIngredientLocally, triggerHaptic } from '../utils/recipeUtils';
import { put, getAll, remove, OBJECT_STORES } from '../utils/dbUtils';
export const useInventory = (user, household) => {
  const [fridge, setFridge] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [nutritionMetrics, setNutritionMetrics] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [loading, setLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState('');
  const [barcodeInput, setBarcodeInput] = useState(''); // Moved from App.jsx
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
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

  const syncOfflineChanges = useCallback(async () => {
    if (!navigator.onLine || !user) return;

    try {
      const queue = await getAll(OBJECT_STORES.SYNC_QUEUE);
      if (!queue || queue.length === 0) return;

      console.log(`Syncing ${queue.length} offline changes...`);

      for (const task of queue) {
        let error;

        // Conflict Resolution Strategy: Last Intent Wins (Remote vs Local)
        // We check if the remote record has been updated by another user since our local offline intent.
        if (task.action === 'UPDATE' || task.action === 'DELETE') {
          const { data: remoteMetadata } = await supabase
            .from(task.table)
            .select('updated_at')
            .eq('id', task.id_value)
            .single();

          if (remoteMetadata) {
            const remoteTimestamp = new Date(remoteMetadata.updated_at).getTime();
            // If the server record is newer than the moment we performed the offline action, 
            // we discard our local change to prevent overwriting more recent collaborative data.
            if (remoteTimestamp > task.timestamp) {
              console.warn(`Conflict detected for ${task.table}:${task.id_value}. Remote change is newer. Skipping offline task.`);
              await remove(OBJECT_STORES.SYNC_QUEUE, task.id);
              continue;
            }
          } else if (task.action === 'UPDATE') {
            // Item was deleted remotely while we were offline; we cannot update a non-existent item.
            console.warn(`Conflict: Record ${task.id_value} no longer exists on server. Discarding update.`);
            await remove(OBJECT_STORES.SYNC_QUEUE, task.id);
            continue;
          }
        }

        if (task.action === 'INSERT') {
          ({ error } = await supabase.from(task.table).insert([task.data]));
        } else if (task.action === 'DELETE') {
          ({ error } = await supabase.from(task.table).delete().eq('id', task.id_value));
        } else if (task.action === 'UPDATE') {
          ({ error } = await supabase.from(task.table).update(task.data).eq('id', task.id_value));
        }

        if (!error) {
          await remove(OBJECT_STORES.SYNC_QUEUE, task.id);
        }
      }
      fetchAppData();
    } catch (e) {
      console.error("Sync process failed", e);
    }
  }, [user, fetchAppData]);

  useEffect(() => {
    window.addEventListener('online', syncOfflineChanges);
    syncOfflineChanges();
    return () => window.removeEventListener('online', syncOfflineChanges);
  }, [syncOfflineChanges]);

  const performMutation = async (table, action, data, id_value = null) => {
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
  };

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
        expiry_date: row.expiry_date
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

  const handleAddManualItem = async (itemName) => {
    const sanitized = cleanIngredientLocally(itemName);
    if (!sanitized) return;

    const newItem = { 
      item_name: sanitized, 
      user_id: user.id,
      household_id: household?.id || null 
    };

    // Optimistic local update
    setFridge(prev => [...prev, { ...newItem, id: `temp-${Date.now()}` }]);
    triggerHaptic(50);

    const success = await performMutation('fridge_inventory', 'INSERT', newItem);
    if (success) fetchAppData();
  };

  const handleRemoveItem = async (id) => {
    setFridge(prev => prev.filter(item => item.id !== id));
    const success = await performMutation('fridge_inventory', 'DELETE', null, id);
    if (success) fetchAppData();
  };

  const handleAddShoppingItem = async (itemName, price = 0) => {
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

    // Optimistic local update
    setShoppingList(prev => [...prev, { ...newItem, id: `temp-${Date.now()}` }]);

    const success = await performMutation('shopping_list', 'INSERT', newItem);
    if (success) fetchAppData();
  };

  const handleToggleShoppingCompleted = async (id, status) => {
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, is_completed: !status } : item));
    const success = await performMutation('shopping_list', 'UPDATE', { is_completed: !status }, id);
    if (success) fetchAppData();
  };

  const handleClearShoppingItem = async (id) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
    const success = await performMutation('shopping_list', 'DELETE', null, id);
    if (success) fetchAppData();
  };

  const handleBarcodeLookup = useCallback(async (barcode) => {
    setBarcodeLoading(true);
    setBarcodeResult('');
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (!response.ok) throw new Error('Product not found or API error');
      const data = await response.json();
      if (data?.status === 1) {
        const name = data.product.product_name || data.product.brands;
        if (name) {
          const sanitizedName = cleanIngredientLocally(name);
          if (sanitizedName) {
            await handleAddManualItem(sanitizedName);
            setBarcodeResult(`Added "${name}" to your pantry.`);
            triggerHaptic(100);
            setBarcodeInput(''); // Clear input after successful lookup
            setIsScanningBarcode(false); // Close scanner if open
          } else {
            setBarcodeResult(`Found product "${name}", but could not sanitize it for pantry entry.`);
          }
        } else {
          setBarcodeResult("Product name not found in API response.");
        }
      } else {
        setBarcodeResult("Product not found");
        triggerHaptic(50);
      }
    } catch (e) {
      console.error("Barcode lookup failed:", e);
      setBarcodeResult("Lookup failed");
      setError(e.message);
    } finally {
      setBarcodeLoading(false);
    }
  }, [handleAddManualItem]);

  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;
    setReceiptLoading(true);
    setError(null);

    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 600; // Fixed width for consistency
      canvas.height = (img.height / img.width) * 600 || 800; // Maintain aspect ratio or default
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src); // Clean up object URL

      const base64Data = canvas.toDataURL('image/jpeg', 0.75);

      try {
        // Cache the image in IndexedDB
        const imageId = `receipt-${Date.now()}`;
        await put(OBJECT_STORES.RECEIPT_IMAGES, { id: imageId, imageData: base64Data, timestamp: Date.now() });

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
      } catch (err) {
        console.error("Receipt scan or cache error:", err);
        setError(err.message);
      } finally {
        setReceiptLoading(false);
      }
    };
    img.onerror = (err) => {
      console.error("Image loading error:", err);
      setError("Failed to load image for scanning.");
      setReceiptLoading(false);
    };
  }, [user, household, handleAddManualItem]);

  const handleUpdateInlineItem = async (id, newName) => {
    const sanitized = cleanIngredientLocally(newName);
    // Optimistic Local Update
    setFridge(prev => prev.map(item => item.id === id ? { ...item, raw_name: newName, item_name: sanitized } : item));
    
    const success = await performMutation('fridge_inventory', 'UPDATE', { item_name: sanitized }, id);
    if (success) fetchAppData();
  };

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
    error,
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