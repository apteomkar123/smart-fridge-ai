import React, { useState, useEffect, useCallback } from 'react';
import { Users, Star, ShoppingCart, Plus, Trash2, Check, X, ChevronDown, DollarSign, Edit2, UserPlus, UserCheck, CreditCard, ExternalLink, MapPin, ChevronRight, Home, Copy } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';
import { cleanIngredientLocally } from './recipeUtils';
import UserProfileModal from './UserProfileModal';


export default function HouseholdTab({ onAddShoppingItem, onToggleHhItem, onDeleteHhItem }) {
  const { households, household: activeHousehold, handleUpdateBudgetLimit, user } = useUser();
  const { savedRecipes, setActiveModalRecipe, onSaveRecipe, onRemoveSavedRecipe, masterRecipes } = useRecipes();

  const [selectedHHId, setSelectedHHId] = useState(activeHousehold?.id || null);
  const [localShopItems, setLocalShopItems] = useState([]);

  // Re-fetch shopping list directly from Supabase when the selected household changes
  // so items shared from the grocery list appear regardless of which household is "active"
  useEffect(() => {
    if (!selectedHHId) return;
    supabase.from('shopping_list').select('*').eq('household_id', selectedHHId)
      .then(({ data }) => setLocalShopItems(data || []));
  }, [selectedHHId]);

  const [hhRecipes, setHhRecipes] = useState([]);
  const [newShopItem, setNewShopItem] = useState('');
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [members, setMembers] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [sentRequests, setSentRequests] = useState(new Set());
  const [memberPresence, setMemberPresence] = useState({}); // profileId → {status, custom_text}
  const [showAddHH, setShowAddHH] = useState(false);
  const [newHHName, setNewHHName] = useState('');
  const [joinHHCode, setJoinHHCode] = useState('');

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

  useEffect(() => {
    loadHouseholdRecipes();
  }, [loadHouseholdRecipes]);

  // Re-fetch when a recipe is saved from anywhere in the app (e.g. RecipeModal share)
  const savedRecipesLen = savedRecipes?.length ?? 0;
  useEffect(() => {
    if (selectedHHId) loadHouseholdRecipes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedRecipesLen]);

  useEffect(() => {
    if (!selectedHHId || !user) return;
    // Load members from the household_members junction table
    supabase
      .from('household_members')
      .select('profile_id, profiles:profile_id(id, display_name, hungry_settings, friend_code)')
      .eq('household_id', selectedHHId)
      .then(({ data }) => {
        const loaded = (data || []).map(m => m.profiles).filter(Boolean);
        setMembers(loaded);
        // Feature #7: load presence now that we have the member IDs
        if (loaded.length) {
          supabase.from('user_presence')
            .select('profile_id, status, custom_text')
            .in('profile_id', loaded.map(m => m.id))
            .then(({ data: pres }) => {
              const map = {};
              (pres || []).forEach(p => { map[p.profile_id] = p; });
              setMemberPresence(map);
            });
        }
      });
    // Load current user's accepted friends (unified friendships schema)
    supabase.from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted')
      .then(({ data }) => setFriends(
        (data || []).map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)
      ));

  }, [selectedHHId, user]);

  const sendFriendRequest = async (targetId) => {
    if (!user) return;
    setSentRequests(prev => new Set([...prev, targetId]));
    await supabase.from('friendships').insert([{ requester_id: user.id, addressee_id: targetId, status: 'pending' }]);
    setFriends(prev => [...prev, targetId]);
  };

  // Add directly with this household's id via the main hook so the item
  // appears immediately in localShopItems (which is derived from shoppingList).
  const addShoppingItem = async () => {
    const name = cleanIngredientLocally(newShopItem);
    if (!name || !selectedHHId || !user) return;
    setNewShopItem('');
    // Temporarily override localStorage preference for this one add
    const prev = localStorage.getItem('hungry_default_shopping_dest');
    localStorage.setItem('hungry_default_shopping_dest', selectedHHId);
    await onAddShoppingItem(name);
    // Restore original preference
    if (prev !== null) localStorage.setItem('hungry_default_shopping_dest', prev);
    else localStorage.removeItem('hungry_default_shopping_dest');
  };


  const toggleShopItemLocal = (id, current) => {
    setLocalShopItems(prev => prev.map(i => i.id === id ? { ...i, is_completed: !current } : i));
    supabase.from('shopping_list').update({ is_completed: !current }).eq('id', id).then(() => {});
    if (onToggleHhItem) onToggleHhItem(id, current);
  };

  const removeShopItem = (id) => {
    setLocalShopItems(prev => prev.filter(i => i.id !== id));
    supabase.from('shopping_list').delete().eq('id', id).then(() => {});
    if (onDeleteHhItem) onDeleteHhItem(id);
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

  const { handleCreateHousehold, handleJoinHousehold } = useUser();

  const handleCreateHH = () => {
    if (!newHHName.trim()) return;
    handleCreateHousehold(newHHName.trim());
    setNewHHName('');
    setShowAddHH(false);
  };

  const handleJoinHH = () => {
    if (!joinHHCode.trim()) return;
    handleJoinHousehold(joinHHCode.trim());
    setJoinHHCode('');
    setShowAddHH(false);
  };

  if (!households.length) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl text-center space-y-3">
          <Users size={32} className="text-slate-200 mx-auto" />
          <p className="text-sm font-black text-slate-400">No household yet</p>
          <p className="text-xs text-slate-300">Create one below to share lists and recipes with roommates</p>
        </div>
        <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-5">
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Plus size={11} /> Create New Household</p>
            <div className="flex gap-2">
              <input type="text" placeholder="Household name (e.g. My Flat)" value={newHHName} onChange={e => setNewHHName(e.target.value)}
                className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold focus:border-sky-400 focus:outline-none" />
              <button onClick={handleCreateHH} className="bg-[#6BAEE0] text-white p-4 rounded-2xl"><Plus size={20} /></button>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Users size={11} /> Join Existing</p>
            <div className="flex gap-2">
              <input type="text" placeholder="Enter invite code" value={joinHHCode} onChange={e => setJoinHHCode(e.target.value)}
                className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold uppercase focus:border-sky-400 focus:outline-none" />
              <button onClick={handleJoinHH} className="bg-[#6BAEE0] text-white p-4 rounded-2xl font-bold text-sm">Join</button>
            </div>
          </div>
        </section>
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

      {/* Feature #7: Who's Home? — At the Store banner */}
      {(() => {
        const atStore = members
          .filter(m => m.id !== user?.id)
          .map(m => ({ ...m, storeText: memberPresence[m.id]?.custom_text }))
          .filter(m => m.storeText?.startsWith('🛒'));
        if (!atStore.length) return null;
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
            <MapPin size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              {atStore.map(m => (
                <p key={m.id} className="text-xs font-bold text-amber-700">
                  {m.display_name || 'A roommate'} is {m.storeText.replace('🛒 ', '')} — anything to add to the shared list?
                </p>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Household Members */}
      {members.length > 0 && (
        <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
          <h2 className="text-[14px] font-bold text-slate-400 mb-4 flex items-center gap-2"><Users size={15} /> Members ({members.length})</h2>
          <div className="space-y-2">
            {members.map(m => {
              const isSelf = m.id === user?.id;
              const isFriend = friends.includes(m.id);
              const isPending = sentRequests.has(m.id);
              const restrictions = m.hungry_settings?.dietary_restrictions || [];
              const presence = memberPresence[m.id];
              return (
                <button
                  key={m.id}
                  onClick={() => !isSelf && setActiveProfile(m)}
                  className={`w-full flex items-center gap-3 px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-2xl text-left transition-all ${!isSelf ? 'hover:border-sky-300 hover:bg-sky-50/50 active:scale-[0.99]' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#6BAEE0] to-[#4d96d1] flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm">
                    {(m.display_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{m.display_name || 'Member'}{isSelf ? ' (You)' : ''}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {presence?.custom_text && (
                        <span className="text-[9px] font-bold text-amber-600">{presence.custom_text}</span>
                      )}
                      {restrictions.slice(0, 2).map(r => (
                        <span key={r} className="text-[8px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded-full">{r}</span>
                      ))}
                    </div>
                  </div>
                  {!isSelf && (
                    isFriend || isPending ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500 shrink-0">
                        <UserCheck size={12} /> {isFriend ? 'Friends' : 'Added'}
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); sendFriendRequest(m.id); }}
                        className="flex items-center gap-1 text-[10px] font-black text-[#6BAEE0] bg-white border border-sky-200 px-2.5 py-1.5 rounded-xl hover:bg-sky-50 transition-all shrink-0"
                      >
                        <UserPlus size={11} /> Add
                      </button>
                    )
                  )}
                  {!isSelf && <ChevronRight size={14} className="text-slate-300 shrink-0" />}
                </button>
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

        {localShopItems.length === 0 ? (
          <p className="text-xs text-slate-300 italic text-center py-4">No items yet</p>
        ) : (
          <div className="space-y-2">
            {localShopItems.map(item => (
              <div key={item.id} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${item.is_completed ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50/50 border-blue-100'}`}>
                <button onClick={() => toggleShopItemLocal(item.id, item.is_completed)}
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

      {/* Settle Up */}
      {members.length > 1 && localShopItems.length > 0 && (
        <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
          <h2 className="text-[14px] font-bold text-slate-400 mb-4 flex items-center gap-2"><CreditCard size={15} /> Settle Up</h2>
          {(() => {
            const totalSpend = localShopItems.reduce((s, i) => s + (i.price || 0), 0);
            const perPerson = members.length > 0 ? totalSpend / members.length : 0;
            const note = encodeURIComponent(`Hungry App: Grocery Split — ${selectedHH?.name || 'Household'}`);
            const amount = perPerson.toFixed(2);
            const venmoUrl = `https://venmo.com/?txn=charge&amount=${amount}&note=${note}`;
            const splitwiseUrl = `https://secure.splitwise.com/`;
            return (
              <div className="space-y-3">
                <div className="bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cost Breakdown</p>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500">Total list spend</span>
                    <span className="text-sm font-black text-slate-700">${totalSpend.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Per person ({members.length} members)</span>
                    <span className="text-sm font-black text-[#6BAEE0]">${perPerson.toFixed(2)}</span>
                  </div>
                </div>
                {members.filter(m => m.id !== user?.id).map(m => (
                  <div key={m.id} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6BAEE0] to-[#4d96d1] flex items-center justify-center text-white font-black text-sm shrink-0">
                      {(m.display_name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{m.display_name || 'Member'}</p>
                      <p className="text-[10px] text-slate-400">owes ${perPerson.toFixed(2)}</p>
                    </div>
                    <a href={venmoUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-black text-white bg-[#3D95CE] px-2.5 py-1.5 rounded-xl hover:opacity-90 transition-all shrink-0">
                      <ExternalLink size={11} /> Venmo
                    </a>
                  </div>
                ))}
                <a href={splitwiseUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full text-[11px] font-black text-slate-400 hover:text-[#6BAEE0] border border-slate-100 hover:border-sky-200 rounded-2xl py-2.5 transition-all">
                  <ExternalLink size={12} /> Open Splitwise
                </a>
              </div>
            );
          })()}
        </section>
      )}

      {/* Add another household */}
      {!showAddHH ? (
        <button
          onClick={() => setShowAddHH(true)}
          className="w-full bg-white/80 backdrop-blur-lg p-4 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 text-[13px] font-bold text-[#6BAEE0] flex items-center justify-center gap-2 hover:bg-sky-50 transition-all"
        >
          <Plus size={16} /> Add Another Household
        </button>
      ) : (
        <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-slate-400 flex items-center gap-2"><Home size={14} /> Add Household</h3>
            <button onClick={() => setShowAddHH(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Cancel</button>
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Plus size={11} /> Create New</p>
            <div className="flex gap-2">
              <input type="text" placeholder="Household name" value={newHHName} onChange={e => setNewHHName(e.target.value)}
                className="flex-1 bg-white border border-blue-100 px-4 py-3 rounded-2xl text-xs font-semibold focus:border-sky-400 focus:outline-none" />
              <button onClick={handleCreateHH} className="bg-[#6BAEE0] text-white p-3 rounded-2xl"><Plus size={18} /></button>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Users size={11} /> Join Existing</p>
            <div className="flex gap-2">
              <input type="text" placeholder="Enter invite code" value={joinHHCode} onChange={e => setJoinHHCode(e.target.value)}
                className="flex-1 bg-white border border-blue-100 px-4 py-3 rounded-2xl text-xs font-semibold uppercase focus:border-sky-400 focus:outline-none" />
              <button onClick={handleJoinHH} className="bg-[#6BAEE0] text-white p-3 rounded-2xl font-bold text-sm">Join</button>
            </div>
          </div>
        </section>
      )}

      {activeProfile && (
        <UserProfileModal user={activeProfile} onClose={() => setActiveProfile(null)} />
      )}
    </div>
  );
}
