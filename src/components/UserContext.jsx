import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [activeHousehold, setActiveHousehold] = useState(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchHouseholds = async (ids, activeId) => {
    if (!ids || ids.length === 0) {
      setHouseholds([]);
      setActiveHousehold(null);
      return;
    }
    const { data: hhs } = await supabase.from('households').select('*').in('id', ids);
    const list = hhs || [];
    setHouseholds(list);
    setActiveHousehold(list.find(h => h.id === activeId) || list[0] || null);
  };

  const [userSettings, setUserSettings] = useState({
    dietary_restrictions: [],
    nutrition_goal: 'Balanced',
    age: '',
    weight_lbs: '',
    height_ft: '',
    height_in: '',
    personal_budget_limit: 0,
  });

  const loadUserState = async (authUser) => {
    if (!authUser) {
      setUser(null);
      setHouseholds([]);
      setActiveHousehold(null);
      setUserName('');
      setUserSettings({ dietary_restrictions: [], nutrition_goal: 'Balanced', age: '', weight_lbs: '', height_ft: '', height_in: '', personal_budget_limit: 0 });
      return;
    }
    setUser(authUser);
    const meta = authUser.user_metadata || {};
    setUserName(meta.name || '');
    setUserSettings({
      dietary_restrictions: meta.dietary_restrictions || [],
      nutrition_goal: meta.nutrition_goal || 'Balanced',
      age: meta.age || '',
      weight_lbs: meta.weight_lbs || '',
      height_ft: meta.height_ft || '',
      height_in: meta.height_in || '',
      personal_budget_limit: meta.personal_budget_limit || 0,
    });

    // Support both old single household_id and new household_ids array
    const ids = meta.household_ids || (meta.household_id ? [meta.household_id] : []);
    const activeId = meta.active_household_id || ids[0] || null;
    await fetchHouseholds(ids, activeId);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUserState(session?.user || null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      loadUserState(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUpdateProfileName = async (newName) => {
    if (!user || !newName.trim()) return;
    const { data, error } = await supabase.auth.updateUser({ data: { name: newName.trim() } });
    if (!error && data.user) setUserName(data.user.user_metadata?.name || '');
  };

  const handleCreateHousehold = async (name) => {
    if (!name || !name.trim()) return alert('Please enter a name for your household.');
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: hh, error: hhError } = await supabase
      .from('households')
      .insert([{ name: name.trim(), invite_code: inviteCode }])
      .select()
      .single();
    if (hhError) return alert(hhError.message);

    if (hh && user) {
      const meta = user.user_metadata || {};
      const currentIds = meta.household_ids || (meta.household_id ? [meta.household_id] : []);
      const { error: metaError } = await supabase.auth.updateUser({
        data: { household_ids: [...currentIds, hh.id], active_household_id: hh.id }
      });
      if (metaError) return alert(`Household created but not linked: ${metaError.message}`);
      // Also write to profiles table so HouseholdTab can query members
      await supabase.from('profiles').upsert([{ id: user.id, active_household_id: hh.id }]);
      setHouseholds(prev => [...prev, hh]);
      setActiveHousehold(hh);
    }
  };

  const handleJoinHousehold = async (code) => {
    const { data: hh, error } = await supabase.from('households')
      .select('*')
      .eq('invite_code', code.trim().toUpperCase())
      .single();
    if (error || !hh) return alert('Invalid invite code');

    const meta = user.user_metadata || {};
    const currentIds = meta.household_ids || (meta.household_id ? [meta.household_id] : []);
    if (currentIds.includes(hh.id)) return alert("You're already in this household");

    const { error: metaError } = await supabase.auth.updateUser({
      data: { household_ids: [...currentIds, hh.id], active_household_id: hh.id }
    });
    if (!metaError) {
      // Also write to profiles table so HouseholdTab can query members
      await supabase.from('profiles').upsert([{ id: user.id, active_household_id: hh.id }]);
      setHouseholds(prev => [...prev, hh]);
      setActiveHousehold(hh);
    }
  };

  const handleSetActiveHousehold = async (householdId) => {
    const { error } = await supabase.auth.updateUser({ data: { active_household_id: householdId } });
    if (!error) {
      await supabase.from('profiles').upsert([{ id: user.id, active_household_id: householdId }]);
      setActiveHousehold(households.find(h => h.id === householdId) || null);
    }
  };

  const handleUpdateBudgetLimit = async (newLimit, householdId) => {
    const targetId = householdId || activeHousehold?.id;
    if (!targetId) return;
    const limitVal = parseFloat(newLimit) || 0;
    const { error } = await supabase.from('households').update({ budget_limit: limitVal }).eq('id', targetId);
    if (!error) {
      const updated = { budget_limit: limitVal };
      setHouseholds(prev => prev.map(h => h.id === targetId ? { ...h, ...updated } : h));
      if (activeHousehold?.id === targetId) setActiveHousehold(prev => ({ ...prev, ...updated }));
    }
  };

  const handleDeleteHousehold = async (householdId) => {
    if (!user) return;
    if (!window.confirm('Delete this household? This cannot be undone.')) return;

    const { error: deleteError } = await supabase.from('households').delete().eq('id', householdId);
    if (deleteError) return alert(`Failed to delete: ${deleteError.message}`);

    const meta = user.user_metadata || {};
    const currentIds = meta.household_ids || (meta.household_id ? [meta.household_id] : []);
    const newIds = currentIds.filter(id => id !== householdId);
    const newActiveId = meta.active_household_id === householdId ? (newIds[0] || null) : meta.active_household_id;

    await supabase.auth.updateUser({ data: { household_ids: newIds, active_household_id: newActiveId } });

    setHouseholds(prev => prev.filter(h => h.id !== householdId));
    if (activeHousehold?.id === householdId) {
      setActiveHousehold(households.find(h => h.id !== householdId) || null);
    }
  };

  const handleUpdateSettings = async (settings) => {
    if (!user) return;
    const { data, error } = await supabase.auth.updateUser({ data: settings });
    if (!error && data.user) {
      const meta = data.user.user_metadata || {};
      setUserSettings({
        dietary_restrictions: meta.dietary_restrictions || [],
        nutrition_goal: meta.nutrition_goal || 'Balanced',
        age: meta.age || '',
        weight_lbs: meta.weight_lbs || '',
        height_ft: meta.height_ft || '',
        height_in: meta.height_in || '',
        personal_budget_limit: meta.personal_budget_limit || 0,
      });
    }
  };

  const handleUpdatePersonalBudget = async (newLimit) => {
    if (!user) return;
    const limitVal = parseFloat(newLimit) || 0;
    const { data, error } = await supabase.auth.updateUser({ data: { personal_budget_limit: limitVal } });
    if (!error && data.user) {
      setUserSettings(prev => ({ ...prev, personal_budget_limit: limitVal }));
    }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); };

  return (
    <UserContext.Provider value={{
      user,
      household: activeHousehold,
      households,
      activeHousehold,
      userName,
      userSettings,
      handleUpdateProfileName,
      handleUpdateSettings,
      handleJoinHousehold,
      handleCreateHousehold,
      handleSetActiveHousehold,
      handleDeleteHousehold,
      handleUpdateBudgetLimit,
      handleUpdatePersonalBudget,
      handleSignOut,
      loading
    }}>
      {children}
    </UserContext.Provider>
  );
};
