import React, { useState, useEffect, useCallback } from 'react';
import { Users, Star, ShoppingCart, Plus, Trash2, Check, X, ChevronDown, DollarSign, Edit2, UserPlus, UserCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';
import { cleanIngredientLocally } from './recipeUtils';

export default function HouseholdTab({ onAddShoppingItem, shoppingRefreshKey }) {
  const { households, household: activeHousehold, handleUpdateBudgetLimit, user } = useUser();
  const { savedRecipes, setActiveModalRecipe, onSaveRecipe, onRemoveSavedRecipe, masterRecipes } = useRecipes();

  const [selectedHHId, setSelectedHHId] = useState(activeHousehold?.id || null);
  const [hhRecipes, setHhRecipes] = useState([]);
  const [hhShopping, setHhShopping] = useState([]);
  const [newShopItem, setNewShopItem] = useState('');
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [loadingShopping, setLoadingShopping] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [sentRequests, setSentRequests] = useState(new Set());

  const selectedHH = households.find(h => h.id === selectedHHId) || activeHousehold;

  useEffect(() => {
    if (activeHousehold?.id) setSelectedHHId(activeHousehold.id);
  }, [activeHousehold?.id]);

  useEffect(() => {
    if (selectedHH) {
      setBudgetInput(selectedHH.budget_limit > 0 ? String(Number(selectedHH.budget_limit).toFixed(2)) : '');
    }
  }, [selectedHH?.id, selectedHH?.budget_limit]);

  const loadHouseholdRecipes = useCallback(async () => {
    if (!selectedHHId) return;
    setLoadingRecipes(true);
    try {
      const { data } = await supabase
        .from('saved_recipes')
        .select('*')
        .eq('household_id', selectedHHId);
      setHhRecipes(data || []);
    } catch {}
    setLoadingRecipes(false);
  }, [selectedHHId]);

  const loadHouseholdShopping = useCallback(async () => {
    if (!selectedHHId) return;
    setLoadingShopping(true);
    try {
      const { data } = await supabase
        .from('shopping_list')
        .select('*')
        .eq('household_id', selectedHHId)
        .order('created_at', { ascending: true });
      setHhShopping(data || []);
    } catch {}
    setLoadingShopping(false);
  }, [selectedHHId]);

  useEffect(() => {
    loadHouseholdRecipes();
    loadHouseholdShopping();
  }, [loadHouseholdRecipes, loadHouseholdShopping]);

  // Refresh shopping when an item is moved from the main list into this household
  useEffect(() => {
    if (shoppingRefreshKey > 0) loadHouseholdShopping();
  }, [shoppingRefreshKey, loadHouseholdShopping]);

  // Real-time subscription: refresh household shopping list on any shopping_list change.
  // No filter — catches rows being moved INTO this household (household_id updated from null).
  useEffect(() => {
    if (!selectedHHId) return;
    const channel = supabase
      .channel(`hh-shopping-${selectedHHId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list' },
        () => loadHouseholdShopping()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedHHId, loadHouseholdShopping]);

  useEffect(() => {
    if (!selectedHHId || !user) return;
    // Load household members from profiles table
    supabase.from('profiles').select('id, display_name')
      .eq('active_household_id', selectedHHId)
      .then(({ data }) => setMembers(data || []));
    // Load current user's friends
    supabase.from('friendships').select('friend_id')
      .eq('user_id', user.id)
      .then(({ data }) => setFriends((data || []).map(f => f.friend_id)));
  }, [selectedHHId, user]);

  const sendFriendRequest = async (targetId) => {
    if (!user) return;
    setSentRequests(prev => new Set([...prev, targetId]));
    await supabase.from('friendships').upsert([{ user_id: user.id, friend_id: targetId }]);
    setFriends(prev => [...prev, targetId]);
  };

  const addShoppingItem = async () => {
    const name = cleanIngredientLocally(newShopItem);
    if (!name || !selectedHHId || !user) return;
    const item = { item_name: name, user_id: user.id, household_id: selectedHHId, is_completed: false, price: 0 };
    const { data } = await supabase.from('shopping_list').insert([item]).select().single();
    if (data) setHhShopping(prev => [...prev, data]);
    setNewShopItem('');
  };

  const toggleShopItem = async (id, current) => {
    await supabase.from('shopping_list').update({ is_completed: !current }).eq('id', id);
    setHhShopping(prev => prev.map(i => i.id === id ? { ...i, is_completed: !current } : i));
  };

  const removeShopItem = async (id) => {
    await supabase.from('shopping_list').delete().eq('id', id);
    setHhShopping(prev => prev.filter(i => i.id !== id));
  };

  const removeHhRecipe = async (id) => {
    await supabase.from('saved_recipes').delete().eq('id', id);
    setHhRecipes(prev => prev.filter(r => r.id !== id));
  };

  const openRecipe = (r) => {
    const full = masterRecipes?.find(mr => String(mr.id) === String(r.recipe_id));
    setActiveModalRecipe(full || {
      id: r.recipe_id, name: r.recipe_name, meal_type: r.meal_type,
      ingredients: r.ingredients || [], cleanedIngredients: (r.ingredients || []).map(cleanIngredientLocally), steps: r.steps || []
    });
  };

  const saveBudget = () => {
    handleUpdateBudgetLimit(budgetInput, selectedHHId);
    setEditingBudget(false);
  };

  if (!households.length) {
    return (
      <div className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl text-center space-y-3">
        <Users size={32} className="text-slate-200 mx-auto" />
        <p className="text-sm font-black text-slate-400">No household yet</p>
        <p className="text-xs text-slate-300">Create or join one in Settings → Household Settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Household selector */}
      {households.length > 1 && (
        <div className="relative">
          <select
            value={selectedHHId || ''}
            onChange={e => setSelectedHHId(e.target.value)}
            className="w-full bg-white/80 backdrop-blur-lg border border-white/20 shadow-lg px-5 py-4 rounded-2xl text-sm font-bold text-slate-700 focus:border-sky-400 focus:outline-none appearance-none"
          >
            {households.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      )}

      {selectedHH && (
        <div className="bg-sky-50 border border-sky-100 rounded-2xl px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-[#1F6FB8]">{selectedHH.name}</p>
            <p className="text-[10px] text-slate-400 font-mono">Code: {selectedHH.invite_code}</p>
          </div>
          <div className="text-right">
            {editingBudget ? (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                  <input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
                    className="w-24 bg-white border border-sky-200 pl-6 pr-2 py-1.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none" placeholder="0.00" />
                </div>
                <button onClick={saveBudget} className="text-[10px] font-black text-white bg-[#6BAEE0] px-3 py-1.5 rounded-xl">Save</button>
              </div>
            ) : (
              <button onClick={() => setEditingBudget(true)} className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-[#6BAEE0] transition-colors">
                <DollarSign size={11} />
                {selectedHH.budget_limit > 0 ? `$${Number(selectedHH.budget_limit).toFixed(2)}/mo` : 'Set budget'}
                <Edit2 size={10} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Household Members */}
      {members.length > 0 && (
        <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
          <h2 className="text-[14px] font-bold text-slate-400 mb-4 flex items-center gap-2"><Users size={15} /> Members ({members.length})</h2>
          <div className="space-y-2">
            {members.map(m => {
              const isSelf = m.id === user?.id;
              const isFriend = friends.includes(m.id);
              const isPending = sentRequests.has(m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-2xl">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6BAEE0] to-[#4d96d1] flex items-center justify-center text-white font-black text-sm shrink-0">
                    {(m.display_name || '?')[0].toUpperCase()}
                  </div>
                  <p className="flex-1 text-sm font-bold text-slate-700 truncate">{m.display_name || 'Member'}{isSelf ? ' (You)' : ''}</p>
                  {!isSelf && (
                    isFriend || isPending ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500">
                        <UserCheck size={12} /> {isFriend ? 'Friends' : 'Added'}
                      </span>
                    ) : (
                      <button
                        onClick={() => sendFriendRequest(m.id)}
                        className="flex items-center gap-1 text-[10px] font-black text-[#6BAEE0] bg-white border border-sky-200 px-2.5 py-1.5 rounded-xl hover:bg-sky-50 transition-all"
                      >
                        <UserPlus size={11} /> Add Friend
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Shared Shopping List */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <h2 className="text-[14px] font-bold text-slate-400 mb-4 flex items-center gap-2"><ShoppingCart size={15} /> Shared Shopping List</h2>

        <form onSubmit={e => { e.preventDefault(); addShoppingItem(); }} className="flex gap-2 mb-4">
          <input
            type="text" value={newShopItem} onChange={e => setNewShopItem(e.target.value)}
            placeholder="Add to household list…"
            className="flex-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none"
          />
          <button type="submit" className="bg-[#6BAEE0] text-white p-3 rounded-2xl shadow-md"><Plus size={18} /></button>
        </form>

        {loadingShopping ? (
          <p className="text-xs text-slate-300 text-center py-4">Loading…</p>
        ) : hhShopping.length === 0 ? (
          <p className="text-xs text-slate-300 italic text-center py-4">No items yet</p>
        ) : (
          <div className="space-y-2">
            {hhShopping.map(item => (
              <div key={item.id} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${item.is_completed ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50/50 border-blue-100'}`}>
                <button onClick={() => toggleShopItem(item.id, item.is_completed)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${item.is_completed ? 'bg-emerald-400 border-emerald-400' : 'border-blue-200'}`}>
                  {item.is_completed && <Check size={10} className="text-white" />}
                </button>
                <span className={`flex-1 text-xs font-bold ${item.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.item_name}</span>
                <button onClick={() => removeShopItem(item.id)} className="text-slate-200 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Shared Recipes */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <h2 className="text-[14px] font-bold text-slate-400 mb-4 flex items-center gap-2"><Star size={15} /> Shared Recipes</h2>

        {loadingRecipes ? (
          <p className="text-xs text-slate-300 text-center py-4">Loading…</p>
        ) : hhRecipes.length === 0 ? (
          <p className="text-xs text-slate-300 italic text-center py-4">No shared recipes yet — star a recipe and choose to share with this household</p>
        ) : (
          <div className="space-y-3">
            {hhRecipes.map(r => (
              <div key={r.id} className="bg-white border border-blue-50 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 hover:border-sky-100 transition-all">
                <button className="flex-1 text-left" onClick={() => openRecipe(r)}>
                  <span className="text-[9px] font-mono font-black text-slate-400 uppercase bg-blue-50 px-2 py-0.5 rounded-md">{r.meal_type || 'Recipe'}</span>
                  <p className="font-bold text-slate-700 text-sm mt-0.5 hover:text-[#6BAEE0] transition-colors">{r.recipe_name}</p>
                </button>
                <button onClick={() => removeHhRecipe(r.id)} className="text-slate-200 hover:text-red-400 transition-colors p-1"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
