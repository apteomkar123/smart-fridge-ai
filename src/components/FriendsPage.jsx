import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Copy, ChefHat, Check, Loader2, Star, Globe, Lock, Search, X, UserCheck, Bell } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';

export default function FriendsPage() {
  const { user, userName } = useUser();
  const { setActiveModalRecipe, masterRecipes } = useRecipes();

  const [friends, setFriends] = useState([]);
  const [pendingReceived, setPendingReceived] = useState([]); // requests sent TO me
  const [searchQuery, setSearchQuery] = useState('');
  const [friendCode, setFriendCode] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // The user's friend code is their profile ID (short display)
  const myFriendCode = user?.id?.slice(0, 8).toUpperCase() || '';

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(myFriendCode); } catch {}
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
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

  const loadPendingRequests = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('friend_requests')
        .select('id, sender_id, profiles:sender_id(display_name, id)')
        .eq('receiver_id', user.id)
        .eq('status', 'pending');
      setPendingReceived((data || []).map(r => ({ requestId: r.id, ...r.profiles })).filter(r => r.id));
    } catch {
      // friend_requests table may not exist yet — graceful no-op
      setPendingReceived([]);
    }
  }, [user]);

  useEffect(() => {
    loadFriends();
    loadPendingRequests();
  }, [loadFriends, loadPendingRequests]);

  const searchUsers = async () => {
    if (!searchQuery.trim() || !user) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles').select('id, display_name')
        .ilike('display_name', `%${searchQuery.trim()}%`)
        .neq('id', user.id).limit(8);
      const friendIds = new Set(friends.map(f => f.id));
      setSearchResults((data || []).map(u => ({ ...u, alreadyFriend: friendIds.has(u.id) })));
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const addFriendByCode = async () => {
    if (!friendCode.trim() || !user) return;
    // Find profile whose ID starts with the entered code
    const code = friendCode.trim().toUpperCase();
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name')
        .ilike('id', `${code.toLowerCase()}%`)
        .neq('id', user.id)
        .limit(1);
      if (!data?.length) { alert('No user found with that code.'); return; }
      await sendFriendRequest(data[0].id);
      setFriendCode('');
    } catch { alert('Could not find user. Try again.'); }
  };

  const sendFriendRequest = async (targetId) => {
    if (!user) return;
    try {
      // Try friend_requests table first for proper request flow
      const { error } = await supabase.from('friend_requests').insert([{
        sender_id: user.id,
        receiver_id: targetId,
        status: 'pending'
      }]);
      if (error) {
        // Fall back to direct friendship if table doesn't exist
        await supabase.from('friendships').upsert([{ user_id: user.id, friend_id: targetId }]);
        await loadFriends();
      } else {
        alert('Friend request sent!');
      }
    } catch {
      await supabase.from('friendships').upsert([{ user_id: user.id, friend_id: targetId }]);
      await loadFriends();
    }
    setSearchResults(prev => prev.map(u => u.id === targetId ? { ...u, alreadyFriend: true } : u));
  };

  const acceptRequest = async (request) => {
    try {
      await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', request.requestId);
      await supabase.from('friendships').upsert([
        { user_id: user.id, friend_id: request.id },
        { user_id: request.id, friend_id: user.id },
      ]);
      setPendingReceived(prev => prev.filter(r => r.requestId !== request.requestId));
      loadFriends();
    } catch {}
  };

  const declineRequest = async (request) => {
    try {
      await supabase.from('friend_requests').update({ status: 'declined' }).eq('id', request.requestId);
      setPendingReceived(prev => prev.filter(r => r.requestId !== request.requestId));
    } catch {}
  };

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

      {/* Header */}
      <div className="bg-gradient-to-br from-[#6BAEE0] to-[#4d96d1] p-6 rounded-[2.5rem] shadow-xl shadow-blue-200 text-white">
        <h2 className="text-xl font-black tracking-tighter mb-1">Friends</h2>
        <p className="text-blue-100 text-xs mb-4">See what friends are cooking</p>
        <div className="flex items-center gap-3 bg-white/20 rounded-2xl px-4 py-3">
          <div>
            <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">Your Friend Code</p>
            <p className="text-lg font-black tracking-widest">{myFriendCode}</p>
          </div>
          <button onClick={copyCode} className={`ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${codeCopied ? 'bg-white text-emerald-500' : 'bg-white/30 hover:bg-white/40 text-white'}`}>
            {codeCopied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
          </button>
        </div>
      </div>

      {/* Pending friend requests */}
      {pendingReceived.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 p-5 rounded-[2.5rem]">
          <h3 className="text-[13px] font-bold text-amber-700 mb-3 flex items-center gap-2"><Bell size={14} /> Friend Requests ({pendingReceived.length})</h3>
          <div className="space-y-2">
            {pendingReceived.map(req => (
              <div key={req.requestId} className="flex items-center gap-3 bg-white border border-amber-100 rounded-2xl px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-white font-black text-sm shrink-0">
                  {(req.display_name || '?')[0].toUpperCase()}
                </div>
                <p className="flex-1 text-sm font-bold text-slate-700 truncate">{req.display_name || 'Chef'}</p>
                <button onClick={() => acceptRequest(req)} className="flex items-center gap-1 text-[10px] font-black text-white bg-[#6BAEE0] px-2.5 py-1.5 rounded-xl">
                  <Check size={11} /> Accept
                </button>
                <button onClick={() => declineRequest(req)} className="flex items-center gap-1 text-[10px] font-black text-slate-400 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl">
                  <X size={11} /> Decline
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add friend by code */}
      <section className="bg-white/80 backdrop-blur-lg p-5 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <h3 className="text-[13px] font-bold text-slate-400 mb-3 flex items-center gap-2"><UserPlus size={14} /> Add Friend by Code</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={friendCode}
            onChange={e => setFriendCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addFriendByCode()}
            placeholder="Enter friend's code…"
            maxLength={8}
            style={{ fontSize: '16px' }}
            className="flex-1 min-w-0 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm font-black text-slate-800 focus:border-sky-400 focus:outline-none uppercase"
          />
          <button onClick={addFriendByCode} className="shrink-0 bg-[#6BAEE0] text-white px-4 py-3 rounded-2xl text-xs font-black shadow-md">Send</button>
        </div>
      </section>

      {/* Find friends by name */}
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
                {u.alreadyFriend ? (
                  <span className="flex items-center gap-1 text-[10px] font-black text-emerald-500"><UserCheck size={11} /> Friends</span>
                ) : (
                  <button onClick={() => sendFriendRequest(u.id)}
                    className="flex items-center gap-1 text-[10px] font-black text-[#6BAEE0] bg-white border border-sky-200 px-3 py-1.5 rounded-xl hover:bg-sky-50 transition-all">
                    <UserPlus size={11} /> Add
                  </button>
                )}
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

      {friends.length === 0 && !loading && (
        <div className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl text-center space-y-2">
          <Users size={28} className="text-slate-200 mx-auto" />
          <p className="text-sm font-black text-slate-400">No friends yet</p>
          <p className="text-xs text-slate-300">Share your friend code or search by name to connect</p>
        </div>
      )}
    </div>
  );
}
