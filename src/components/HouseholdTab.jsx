import React, { useState, useEffect, useCallback } from 'react';
import { Users, Star, ShoppingCart, Plus, Trash2, Check, X, ChevronDown, DollarSign, Edit2, UserPlus, UserCheck, CreditCard, ExternalLink, PartyPopper, HandHeart, Sparkles, MapPin } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';
import { cleanIngredientLocally } from './recipeUtils';

// Common potluck item suggestions by dietary category
const POTLUCK_SUGGESTIONS = {
  base: ['Paper Plates', 'Napkins', 'Cups', 'Ice', 'Charcoal', 'Lighter Fluid'],
  meat: ['Burgers', 'Hot Dogs', 'Chicken Wings', 'Ribs', 'Steak'],
  vegetarian: ['Veggie Burgers', 'Grilled Corn', 'Caprese Salad', 'Hummus & Pita', 'Potato Salad'],
  vegan: ['Black Bean Burgers', 'Guacamole', 'Fruit Salad', 'Roasted Veggies', 'Vegan Pasta Salad'],
  dessert: ['Brownies', 'Cookies', 'Watermelon', 'Ice Cream', 'S\'mores Kit'],
  drinks: ['Lemonade', 'Iced Tea', 'Sparkling Water', 'Beer/Wine', 'Juice Boxes'],
};

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

  // ── Potluck / Event ─────────────────────────────────────────
  const EVENT_KEY = `hungry_event_${selectedHHId}`;
  const [eventName, setEventName] = useState('');
  const [eventItems, setEventItems] = useState([]);
  const [newEventItem, setNewEventItem] = useState('');
  const [showEventPanel, setShowEventPanel] = useState(false);

  useEffect(() => {
    try { setEventItems(JSON.parse(localStorage.getItem(EVENT_KEY) || '[]')); } catch { setEventItems([]); }
  }, [EVENT_KEY]);

  const persistEvent = (items) => {
    setEventItems(items);
    try { localStorage.setItem(EVENT_KEY, JSON.stringify(items)); } catch {}
  };

  const addEventItem = () => {
    const name = newEventItem.trim();
    if (!name) return;
    persistEvent([...eventItems, { id: Date.now(), name, claimedBy: null }]);
    setNewEventItem('');
  };

  const claimEventItem = (id) => {
    const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'You';
    persistEvent(eventItems.map(i => i.id === id ? { ...i, claimedBy: i.claimedBy ? null : displayName } : i));
  };

  const deleteEventItem = (id) => persistEvent(eventItems.filter(i => i.id !== id));

  const readyCount = eventItems.filter(i => i.claimedBy).length;
  const readyPct = eventItems.length > 0 ? Math.round((readyCount / eventItems.length) * 100) : 0;
  const [hhRecipes, setHhRecipes] = useState([]);
  const [newShopItem, setNewShopItem] = useState('');
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [sentRequests, setSentRequests] = useState(new Set());
  const [memberPresence, setMemberPresence] = useState({}); // profileId → {status, custom_text}
  const [eventSuggestions, setEventSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

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
      .select('profile_id, profiles:profile_id(id, display_name)')
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

  // Feature #4: Potluck Planner — fetch member dietary restrictions and generate smart item list
  const loadSmartSuggestions = useCallback(async () => {
    if (!selectedHHId || !members.length) return;
    setLoadingSuggestions(true);
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, hungry_settings')
        .in('id', members.map(m => m.id));

      const allRestrictions = new Set();
      (profiles || []).forEach(p => {
        const r = p.hungry_settings?.dietary_restrictions || [];
        r.forEach(d => allRestrictions.add(d.toLowerCase()));
      });

      const isVegan = allRestrictions.has('vegan');
      const isVegetarian = isVegan || allRestrictions.has('vegetarian');

      const suggestions = [
        ...POTLUCK_SUGGESTIONS.base,
        ...(isVegan ? POTLUCK_SUGGESTIONS.vegan : isVegetarian ? POTLUCK_SUGGESTIONS.vegetarian : POTLUCK_SUGGESTIONS.meat),
        ...POTLUCK_SUGGESTIONS.dessert,
        ...POTLUCK_SUGGESTIONS.drinks,
      ];
      setEventSuggestions(suggestions);

      // Write to cross_app_activity so Jukebox can queue a party playlist
      if (user?.id) {
        supabase.from('cross_app_activity').insert({
          user_id: user.id,
          app: 'hungry',
          activity_type: 'potluck_created',
          is_public: false,
          payload: { household_id: selectedHHId, event_name: eventName, genre_seed: 'party' },
        }).then(() => {});
      }
    } catch {}
    setLoadingSuggestions(false);
  }, [selectedHHId, members, user, eventName]);

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

      {/* ── Potluck / Event Panel ──────────────────────────────── */}
      {selectedHH && (
        <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
          <button
            onClick={() => setShowEventPanel(v => !v)}
            className="w-full flex items-center justify-between gap-2"
          >
            <h2 className="text-[14px] font-bold text-slate-400 flex items-center gap-2">
              <PartyPopper size={15} className="text-violet-400" /> Potluck / Event
            </h2>
            <ChevronDown size={14} className={`text-slate-300 transition-transform ${showEventPanel ? 'rotate-180' : ''}`} />
          </button>

          {showEventPanel && (
            <div className="mt-4 space-y-4">
              {/* Event name */}
              <input
                type="text"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                placeholder="Event name (e.g. Friday BBQ)"
                className="w-full bg-violet-50/50 border border-violet-100 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-violet-300 focus:outline-none"
              />

              {/* Progress bar */}
              {eventItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {eventName || 'Event'} Readiness
                    </span>
                    <span className="text-[10px] font-black text-violet-500">{readyPct}% Ready</span>
                  </div>
                  <div className="h-2 bg-violet-50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-400 rounded-full transition-all duration-500"
                      style={{ width: `${readyPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Feature #4: Smart Suggestions */}
              <button
                type="button"
                onClick={loadSmartSuggestions}
                disabled={loadingSuggestions}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[11px] font-black text-violet-500 bg-violet-50 border border-violet-100 hover:bg-violet-100 transition-all"
              >
                <Sparkles size={13} />
                {loadingSuggestions ? 'Generating…' : '✨ Smart Suggestions (filters by dietary needs)'}
              </button>
              {eventSuggestions.length > 0 && (
                <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3">
                  <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest mb-2">Tap to add:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {eventSuggestions.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setNewEventItem(s); }}
                        className="text-[10px] font-bold bg-white border border-violet-200 text-violet-600 px-2.5 py-1 rounded-full hover:bg-violet-100 transition-all"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add item */}
              <form onSubmit={e => { e.preventDefault(); addEventItem(); }} className="flex gap-2">
                <input
                  type="text"
                  value={newEventItem}
                  onChange={e => setNewEventItem(e.target.value)}
                  placeholder="Add item needed (e.g. Buns, Charcoal)…"
                  className="flex-1 bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-violet-300 focus:outline-none"
                />
                <button type="submit" className="bg-violet-400 text-white p-3 rounded-2xl shadow-md">
                  <Plus size={18} />
                </button>
              </form>

              {/* Item list */}
              {eventItems.length === 0 ? (
                <p className="text-xs text-slate-300 italic text-center py-2">No items yet — add what you need for the event</p>
              ) : (
                <div className="space-y-2">
                  {eventItems.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${item.claimedBy ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}
                    >
                      <button
                        onClick={() => claimEventItem(item.id)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${item.claimedBy ? 'bg-emerald-400 border-emerald-400' : 'border-slate-300 hover:border-violet-400'}`}
                      >
                        {item.claimedBy && <Check size={10} className="text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-bold ${item.claimedBy ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {item.name}
                        </span>
                        {item.claimedBy && (
                          <p className="text-[9px] text-emerald-500 font-black flex items-center gap-1 mt-0.5">
                            <HandHeart size={9} /> Claimed by {item.claimedBy}
                          </p>
                        )}
                      </div>
                      <button onClick={() => deleteEventItem(item.id)} className="text-slate-200 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
