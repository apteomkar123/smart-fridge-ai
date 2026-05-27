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

  const loadUserState = async (authUser) => {
    if (!authUser) {
      setUser(null);
      setHouseholds([]);
      setActiveHousehold(null);
      setUserName('');
      return;
    }
    setUser(authUser);
    const meta = authUser.user_metadata || {};
    setUserName(meta.name || '');

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
      setHouseholds(prev => [...prev, hh]);
      setActiveHousehold(hh);
    }
  };

  const handleSetActiveHousehold = async (householdId) => {
    const { error } = await supabase.auth.updateUser({ data: { active_household_id: householdId } });
    if (!error) setActiveHousehold(households.find(h => h.id === householdId) || null);
  };

  const handleUpdateBudgetLimit = async (newLimit) => {
    if (!activeHousehold) return;
    const limitVal = parseFloat(newLimit) || 0;
    const { error } = await supabase.from('households').update({ budget_limit: limitVal }).eq('id', activeHousehold.id);
    if (!error) {
      const updated = { ...activeHousehold, budget_limit: limitVal };
      setActiveHousehold(updated);
      setHouseholds(prev => prev.map(h => h.id === activeHousehold.id ? updated : h));
    }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); };

  return (
    <UserContext.Provider value={{
      user,
      household: activeHousehold,   // backward-compat alias used throughout the app
      households,
      activeHousehold,
      userName,
      handleUpdateProfileName,
      handleJoinHousehold,
      handleCreateHousehold,
      handleSetActiveHousehold,
      handleUpdateBudgetLimit,
      handleSignOut,
      loading
    }}>
      {children}
    </UserContext.Provider>
  );
};
