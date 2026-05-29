import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Copy, ChefHat, Check, Loader2, Star, Globe, Lock, Search, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';

export default function FriendsPage() {
  const { user, userName } = useUser();
  const { setActiveModalRecipe, masterRecipes } = useRecipes();

  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const shareLink = user ? `${window.location.origin}?addFriend=${user.id}` : '';

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareLink); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadFriends = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('friendships')
        .select('friend_id, profiles:friend_id(display_name, id)')
        .eq('user_id', user.id);
      setFriends((data || []).map(f => f.profiles).filter(Boolean));
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  const searchUsers = async () => {
    if (!searchQuery.trim() || !user) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles').select('id, display_name')
        .ilike('display_name', `%${searchQuery.trim()}%`)
        .neq('id', user.id).limit(8);
      setSearchResults(data || []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const addFriend = async (friendId) => {
    if (!user) return;
    await supabase.from('friendships').upsert([{ user_id: user.id, friend_id: friendId }]);
    setSearchResults(prev => prev.filter(u => u.id !== friendId));
    loadFriends();
  };

  // Get a friend's public chef history (from their localStorage — in a real app this would be Supabase)
  const getFriendFeed = (friendId) => {
    try {
      return JSON.parse(localStorage.getItem(`hungry_chef_history_${friendId}`) || '[]').filter(e => !e.isPrivate);
    } catch { return []; }
  };

  const openRecipe = (entry) => {
    const match = masterRecipes?.find(r => String(r.id) === String(entry.recipeId));
    setActiveModalRecipe(match || {
      id: entry.recipeId, name: entry.recipeName, meal_type: entry.meal_type || '',
      ingredients: entry.ingredients || [], cleanedIngredients: [], steps: entry.steps || []
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Top bar: share button + search */}
      <div className="bg-gradient-to-br from-[#6BAEE0] to-[#4d96d1] p-6 rounded-[2.5rem] shadow-xl shadow-blue-200 text-white">
        <h2 className="text-xl font-black tracking-tighter mb-1">Friends</h2>
        <p className="text-blue-100 text-xs mb-4">See what friends are cooking</p>
        <button onClick={copyLink}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all ${copied ? 'bg-white text-emerald-500' : 'bg-white/20 hover:bg-white/30 text-white border border-white/30'}`}>
          {copied ? <><Check size={14} /> Link Copied!</> : <><UserPlus size={14} /> Invite a Friend</>}
        </button>
      </div>

      {/* Find friends */}
      <section className="bg-white/80 backdrop-blur-lg p-5 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchUsers()}
              placeholder="Find friends by name…"
              style={{ fontSize: '16px' }}
              className="w-full bg-blue-50/50 border border-blue-100 pl-8 pr-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none"
            />
          </div>
          <button onClick={searchUsers} disabled={searching}
            className="bg-[#6BAEE0] text-white px-4 py-3 rounded-2xl text-xs font-black shadow-md">
            {searching ? <Loader2 size={14} className="animate-spin" /> : 'Find'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map(u => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#6BAEE0] flex items-center justify-center text-white font-black text-sm">{(u.display_name || '?')[0].toUpperCase()}</div>
                  <span className="text-sm font-bold text-slate-700">{u.display_name || 'Anonymous Chef'}</span>
                </div>
                <button onClick={() => addFriend(u.id)}
                  className="flex items-center gap-1 text-[10px] font-black text-[#6BAEE0] bg-white border border-sky-200 px-3 py-1.5 rounded-xl hover:bg-sky-50 transition-all">
                  <UserPlus size={11} /> Add
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Friends list */}
      {friends.length > 0 && (
        <section className="bg-white/80 backdrop-blur-lg p-5 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
          <h3 className="text-[13px] font-bold text-slate-400 mb-3 flex items-center gap-2"><Users size={14} /> My Friends ({friends.length})</h3>
          <div className="space-y-2">
            {friends.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFriend(selectedFriend?.id === f.id ? null : f)}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-blue-50/50 border border-blue-100 rounded-2xl hover:border-sky-200 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6BAEE0] to-[#4d96d1] flex items-center justify-center text-white font-black text-sm shrink-0">{(f.display_name || '?')[0].toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-700">{f.display_name || 'Anonymous Chef'}</p>
                  <p className="text-[10px] text-slate-400">Tap to see what they're cooking</p>
                </div>
                <ChefHat size={14} className="text-slate-300 shrink-0" />
              </button>
            ))}
          </div>

          {/* Friend profile card */}
          {selectedFriend && (
            <div className="mt-4 bg-sky-50 border border-sky-100 rounded-[2rem] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6BAEE0] to-[#4d96d1] flex items-center justify-center text-white font-black text-lg">{(selectedFriend.display_name || '?')[0].toUpperCase()}</div>
                  <div>
                    <p className="font-black text-slate-800">{selectedFriend.display_name}</p>
                    <p className="text-[10px] text-slate-400">Chef Activity</p>
                  </div>
                </div>
                <button onClick={() => setSelectedFriend(null)} className="text-slate-300 hover:text-slate-600 p-1"><X size={16} /></button>
              </div>
              {(() => {
                const feed = getFriendFeed(selectedFriend.id);
                if (!feed.length) return <p className="text-xs text-slate-400 italic text-center py-4">No public cooking history yet</p>;
                return feed.map((entry, i) => (
                  <div key={i} className="border-b border-sky-100 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0">
                    <button onClick={() => openRecipe(entry)} className="text-sm font-bold text-[#6BAEE0] hover:underline text-left block">{entry.recipeName}</button>
                    <p className="text-[10px] text-slate-400">{new Date(entry.cookedAt).toLocaleDateString()}</p>
                    {entry.notes && <p className="text-xs text-slate-400 italic mt-0.5">"{entry.notes}"</p>}
                  </div>
                ));
              })()}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
