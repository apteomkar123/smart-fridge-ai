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
  const [household, setHousehold] = useState(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchHousehold = async (householdId) => {
    if (!householdId) return;
    const { data: hh } = await supabase.from('households')
      .select('*')
      .eq('id', householdId)
      .single();
    setHousehold(hh || null);
  };

  const loadUserState = async (authUser) => {
    if (!authUser) {
      setUser(null);
      setHousehold(null);
      setUserName('');
      return;
    }
    setUser(authUser);
    const metadata = authUser.user_metadata || {};
    setUserName(metadata.name || '');
    if (metadata.household_id) {
      await fetchHousehold(metadata.household_id);
    } else {
      setHousehold(null);
    }
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
    const { data, error } = await supabase.auth.updateUser({
      data: { name: newName.trim() }
    });
    if (!error && data.user) {
      setUserName(data.user.user_metadata?.name || '');
    }
  };

  const handleJoinHousehold = async (code) => {
    const { data: hh, error } = await supabase.from('households')
      .select('*')
      .eq('invite_code', code.trim().toUpperCase())
      .single();

    if (error || !hh) return alert("Invalid invite code");

    const { error: metaError } = await supabase.auth.updateUser({
      data: { household_id: hh.id }
    });
    if (!metaError) setHousehold(hh);
  };

  const handleCreateHousehold = async (name) => {
    if (!name || !name.trim()) return alert("Please enter a name for your household.");

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: hh, error: hhError } = await supabase
      .from('households')
      .insert([{ name: name.trim(), invite_code: inviteCode }])
      .select()
      .single();
    if (hhError) return alert(hhError.message);

    if (hh && user) {
      const { error: metaError } = await supabase.auth.updateUser({
        data: { household_id: hh.id }
      });
      if (metaError) {
        alert(`Created household "${hh.name}", but failed to link your profile. Error: ${metaError.message}`);
        return;
      }
      setHousehold(hh);
    }
  };

  const handleUpdateBudgetLimit = async (newLimit) => {
    if (!household) return;
    const limitVal = parseFloat(newLimit) || 0;
    const { error } = await supabase.from('households')
      .update({ budget_limit: limitVal })
      .eq('id', household.id);

    if (!error) {
      setHousehold(prev => ({ ...prev, budget_limit: limitVal }));
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <UserContext.Provider value={{
      user,
      household,
      userName,
      handleUpdateProfileName,
      handleJoinHousehold,
      handleCreateHousehold,
      handleUpdateBudgetLimit,
      handleSignOut,
      loading
    }}>
      {children}
    </UserContext.Provider>
  );
};
