import React, { useState, useEffect } from 'react';
import { Globe, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';

export default function AppWareTab({ fridge }) {
  const { user } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    try {
      const { data: events } = await supabase
        .from('cross_app_activity')
        .select('app, activity_type, payload, created_at')
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString());

      const history = (() => { try { return JSON.parse(localStorage.getItem('hungry_chef_history') || '[]'); } catch { return []; } })();
      const thisMonth = history.filter(e => new Date(e.cookedAt) >= monthStart);
      const choresDone = (events || []).filter(e => e.activity_type === 'chore_completed').length;
      const billsPaid  = (events || []).some(e => e.activity_type === 'all_bills_paid');
      const topCuisine = (() => {
        const counts = {};
        thisMonth.forEach(e => { if (e.cuisine) counts[e.cuisine] = (counts[e.cuisine] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      })();
      const { data: np } = await supabase
        .from('now_playing').select('track_title, artist').eq('user_id', user.id).single();

      setData({
        recipesCookedThisMonth: thisMonth.length,
        choresDoneThisMonth: choresDone,
        billsPaidThisMonth: billsPaid,
        topCuisineThisMonth: topCuisine,
        currentlyPlaying: np ? `${np.track_title} — ${np.artist}` : null,
        pantryWorth: (fridge || []).reduce((s, i) => s + (i.price || 0), 0),
      });
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-gradient-to-br from-violet-50 to-sky-50 border border-violet-100 p-6 rounded-[2.5rem] shadow-xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[14px] font-bold text-violet-500 flex items-center gap-2"><Globe size={15} /> AppWare Monthly Wrap</h3>
          <button onClick={load} disabled={loading} className="p-2 text-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mb-5">Your life across all three apps this month</p>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 size={24} className="animate-spin text-violet-400" /></div>
        ) : !data ? (
          <button onClick={load} className="w-full py-3 rounded-2xl bg-violet-100 text-violet-600 text-xs font-black hover:bg-violet-200 transition-all">Load My Wrap</button>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/80 rounded-2xl p-4 text-center border border-violet-100">
                <p className="text-3xl font-black text-[#6BAEE0]">{data.recipesCookedThisMonth}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">🍽️ Recipes Cooked</p>
              </div>
              <div className="bg-white/80 rounded-2xl p-4 text-center border border-violet-100">
                <p className="text-3xl font-black text-emerald-500">{data.choresDoneThisMonth}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">✅ Chores Done</p>
              </div>
              <div className="bg-white/80 rounded-2xl p-4 text-center border border-violet-100">
                <p className="text-2xl font-black text-amber-500">${data.pantryWorth.toFixed(0)}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">🥦 Pantry Value</p>
              </div>
              <div className="bg-white/80 rounded-2xl p-4 text-center border border-violet-100">
                <p className="text-2xl font-black text-violet-500">{data.billsPaidThisMonth ? '✓ Paid' : 'Pending'}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">💸 Bills</p>
              </div>
            </div>
            {data.topCuisineThisMonth && (
              <div className="bg-white/80 rounded-2xl px-4 py-3 border border-violet-100 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500">Top Cuisine This Month</p>
                <p className="text-sm font-black text-violet-500">{data.topCuisineThisMonth}</p>
              </div>
            )}
            {data.currentlyPlaying && (
              <div className="bg-white/80 rounded-2xl px-4 py-3 border border-violet-100 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-slate-500 shrink-0">🎵 Now on Jukebox</p>
                <p className="text-xs font-black text-violet-500 truncate">{data.currentlyPlaying}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
