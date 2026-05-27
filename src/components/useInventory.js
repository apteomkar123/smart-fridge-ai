import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { cleanIngredientLocally, triggerHaptic } from '../components/recipeUtils';

export const useInventory = (user, household) => {
  const [fridge, setFridge] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [nutritionMetrics, setNutritionMetrics] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [loading, setLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState('');
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
    await supabase.from('fridge_inventory').insert([{ 
      item_name: sanitized, 
      user_id: user.id,
      household_id: household?.id || null 
    }]);
    triggerHaptic(50);
    fetchAppData();
  };

  const handleRemoveItem = async (id) => {
    setFridge(prev => prev.filter(item => item.id !== id));
    await supabase.from('fridge_inventory').delete().eq('id', id);
  };

  const handleAddShoppingItem = async (itemName, price = 0) => {
    const sanitized = cleanIngredientLocally(itemName);
    if (!sanitized) return;
    
    const alreadyLocal = shoppingList.some(i => i.item_name.toLowerCase() === sanitized.toLowerCase());
    if (alreadyLocal) return alert('Item already in list');

    const { data, error } = await supabase.from('shopping_list').insert([{
      user_id: user.id,
      household_id: household?.id || null,
      item_name: sanitized,
      is_completed: false,
      price
    }]).select();

    if (!error && data) setShoppingList(prev => [...prev, data[0]]);
  };

  const handleToggleShoppingCompleted = async (id, status) => {
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, is_completed: !status } : item));
    await supabase.from('shopping_list').update({ is_completed: !status }).eq('id', id);
  };

  const handleClearShoppingItem = async (id) => {
    setShoppingList(prev => prev.filter(item => item.id !== id));
    await supabase.from('shopping_list').delete().eq('id', id);
  };

  const handleBarcodeLookup = async (barcode) => {
    setBarcodeLoading(true);
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      if (data?.status === 1) {
        const name = data.product.product_name || data.product.brands;
        await handleAddManualItem(name);
        setBarcodeResult(`Added ${name}`);
        setIsScanningBarcode(false);
      } else {
        setBarcodeResult("Product not found");
      }
    } catch (e) {
      setBarcodeResult("Lookup failed");
    } finally {
      setBarcodeLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setReceiptLoading(true);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const response = await fetch('/.netlify/functions/scan-receipt', {
          method: 'POST',
          body: JSON.stringify({ image: event.target.result })
        });
        const data = await response.json();
        if (data.storeName) setStoreName(data.storeName);
        if (data.added) {
          for (const item of data.added) {
            await handleAddManualItem(item);
          }
        }
      } finally {
        setReceiptLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateInlineItem = async (id, newName) => {
    const sanitized = cleanIngredientLocally(newName);
    setFridge(prev => prev.map(item => item.id === id ? { ...item, raw_name: newName, item_name: sanitized } : item));
    await supabase.from('fridge_inventory').update({ item_name: sanitized }).eq('id', id);
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