import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Copy, ChefHat, Globe, Lock, Check, Loader2, Star } from 'lucide-react';
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
  const [friendFeed, setFriendFeed] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // "Add me on Hungry" link using current URL + user id
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

  const loadFriendFeed = useCallback(async () => {
    if (!friends.length) { setFriendFeed([]); return; }
    const friendIds = friends.map(f => f.id);
    try {
      // Read public chef history from localStorage (other users' would come from Supabase in a full app)
      // For now we surface the current user's own public entries as a demo
      const history = JSON.parse(localStorage.getItem('hungry_chef_history') || '[]');
      const publicEntries = history.filter(e => !e.isPrivate);
      setFriendFeed(publicEntries.slice(0, 20).map(e => ({ ...e, authorName: userName || 'You' })));
    } catch {}
  }, [friends, userName]);

  useEffect(() => { loadFriends(); }, [loadFriends]);
  useEffect(() => { loadFriendFeed(); }, [loadFriendFeed]);

  const searchUsers = async () => {
    if (!searchQuery.trim() || !user) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name')
        .ilike('display_name', `%${searchQuery.trim()}%`)
        .neq('id', user.id)
        .limit(10);
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const addFriend = async (friendId) => {
    if (!user) return;
    await supabase.from('friendships').upsert([{ user_id: user.id, friend_id: friendId }]);
    loadFriends();
    setSearchResults(prev => prev.filter(u => u.id !== friendId));
  };

  const openRecipeEntry = (entry) => {
    const match = masterRecipes?.find(r => String(r.id) === String(entry.recipeId));
    if (match) { setActiveModalRecipe(match); return; }
    setActiveModalRecipe({
      id: entry.recipeId, name: entry.recipeName, meal_type: entry.meal_type || '',
      ingredients: entry.ingredients || [], cleanedIngredients: [], steps: entry.steps || []
    });
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Share your link */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <h2 className="text-[14px] font-bold text-slate-400 mb-4 flex items-center gap-2"><Users size={15} /> Add Me on Hungry</h2>
        <p className="text-xs text-slate-500 mb-3">Share this link so friends can add you.</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-xs text-slate-600 font-mono truncate">
            {shareLink || 'Sign in to get your link'}
          </div>
          <button onClick={copyLink} disabled={!shareLink}
            className={`flex items-center gap-1.5 px-4 py-3 rounded-2xl text-xs font-black transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-[#6BAEE0] text-white'}`}>
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>
      </section>

      {/* Find friends */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <h2 className="text-[14px] font-bold text-slate-400 mb-4 flex items-center gap-2"><UserPlus size={15} /> Find Friends</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchUsers()}
            placeholder="Search by name…"
            className="flex-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none"
          />
          <button onClick={searchUsers} disabled={searching}
            className="bg-[#6BAEE0] text-white px-5 py-3 rounded-2xl text-xs font-black flex items-center gap-1.5">
            {searching ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
          </button>
        </div>
        {searchResults.map(u => (
          <div key={u.id} className="flex items-center justify-between px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-2xl mb-2">
            <span className="text-sm font-bold text-slate-700">{u.display_name || 'Anonymous Chef'}</span>
            <button onClick={() => addFriend(u.id)}
              className="flex items-center gap-1.5 text-[10px] font-black text-[#6BAEE0] bg-white border border-sky-200 px-3 py-1.5 rounded-xl hover:bg-sky-50 transition-all">
              <UserPlus size={11} /> Add
            </button>
          </div>
        ))}
      </section>

      {/* Friends list */}
      {friends.length > 0 && (
        <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
          <h2 className="text-[14px] font-bold text-slate-400 mb-3">My Friends ({friends.length})</h2>
          <div className="space-y-2">
            {friends.map(f => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-2xl">
                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-[#6BAEE0] font-black text-sm">{(f.display_name || '?')[0].toUpperCase()}</div>
                <span className="text-sm font-bold text-slate-700">{f.display_name || 'Anonymous Chef'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friend cooking feed */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <h2 className="text-[14px] font-bold text-slate-400 mb-4 flex items-center gap-2"><ChefHat size={15} /> What Friends Are Cooking</h2>
        {friendFeed.length === 0 ? (
          <p className="text-xs text-slate-300 italic text-center py-6">Add friends to see what they're cooking</p>
        ) : (
          <div className="space-y-4">
            {friendFeed.map((entry, i) => (
              <div key={i} className="border-b border-blue-50 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-[#6BAEE0] font-black text-[10px]">{(entry.authorName || '?')[0].toUpperCase()}</div>
                  <span className="text-[11px] font-black text-slate-500">{entry.authorName}</span>
                  <span className="text-[10px] text-slate-300">{new Date(entry.cookedAt).toLocaleDateString()}</span>
                </div>
                <button onClick={() => openRecipeEntry(entry)} className="text-sm font-bold text-[#6BAEE0] hover:underline text-left">{entry.recipeName}</button>
                {entry.notes && <p className="text-xs text-slate-400 mt-0.5 italic">"{entry.notes}"</p>}
                {entry.photos?.[0] && (
                  <img src={entry.photos[0]} alt="cooked" className="mt-2 w-20 h-20 rounded-2xl object-cover border border-blue-50" />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
