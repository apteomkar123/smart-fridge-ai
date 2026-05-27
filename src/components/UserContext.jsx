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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfileAndHousehold(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfileAndHousehold(session.user.id);
      } else {
        setUser(null);
        setHousehold(null);
        setUserName('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfileAndHousehold = async (userId) => {
    const { data: profile } = await supabase.from('profiles')
      .select('household_id, name, full_name')
      .eq('id', userId)
      .single();
      
    if (profile) {
      setUserName(profile.name || profile.full_name || '');
      if (profile.household_id) {
        const { data: hh } = await supabase.from('households')
          .select('*')
          .eq('id', profile.household_id)
          .single();
        setHousehold(hh);
      }
    }
  };

  const handleUpdateProfileName = async (newName) => {
    if (!user || !newName.trim()) return;
    const { data, error } = await supabase.from('profiles')
      .update({ name: newName.trim() })
      .eq('id', user.id)
      .select()
      .single();
      
    if (!error && data) setUserName(data.name);
  };

  const handleJoinHousehold = async (code) => {
    const { data: hh, error } = await supabase.from('households')
      .select('*')
      .eq('invite_code', code)
      .single();
      
    if (error || !hh) return alert("Invalid invite code");
    await supabase.from('profiles').update({ household_id: hh.id }).eq('id', user.id);
    setHousehold(hh);
  };

  const handleCreateHousehold = async (name) => {
    const { data: hh } = await supabase.from('households').insert([{ name }]).select().single();
    if (hh) {
      await supabase.from('profiles').update({ household_id: hh.id }).eq('id', user.id);
      setHousehold(hh);
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
      handleSignOut,
      loading 
    }}>
      {children}
    </UserContext.Provider>
  );
};