import React, { useState, useEffect, useCallback } from 'react';
import { PartyPopper, Plus, Trash2, Check, Share2, HandHeart, X, Loader2, Link, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';

export default function PotluckPage() {
  const { user } = useUser();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [newItem, setNewItem] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(null);

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Guest';

  // Check URL for ?potluck=CODE on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('potluck');
    if (code) {
      setJoinCode(code);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('potluck_events')
        .select('*, potluck_items(*)')
        .order('created_at', { ascending: false });
      setEvents(data || []);
      if (data?.length > 0 && !expandedId) setExpandedId(data[0].id);
    } catch {}
    setLoading(false);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Auto-join if joinCode is present
  useEffect(() => {
    if (joinCode && user) handleJoin(joinCode);
  }, [joinCode, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newEventName.trim() || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.from('potluck_events')
        .insert([{ name: newEventName.trim(), host_id: user.id }])
        .select('*, potluck_items(*)')
        .single();
      if (!error && data) {
        setEvents(prev => [data, ...prev]);
        setExpandedId(data.id);
        setNewEventName('');
      }
    } catch {}
    setCreating(false);
  };

  const handleJoin = async (code) => {
    if (!user) return;
    setJoining(true);
    try {
      const { data: ev } = await supabase.from('potluck_events')
        .select('*, potluck_items(*)')
        .eq('event_code', code.trim().toUpperCase())
        .single();
      if (ev) {
        setEvents(prev => prev.find(e => e.id === ev.id) ? prev : [ev, ...prev]);
        setExpandedId(ev.id);
        setJoinCode('');
      } else {
        alert('Event not found. Check the code and try again.');
      }
    } catch { alert('Could not join event.'); }
    setJoining(false);
  };

  const addItem = async (eventId) => {
    const name = newItem.trim();
    if (!name || !user) return;
    try {
      const { data, error } = await supabase.from('potluck_items')
        .insert([{ event_id: eventId, name }])
        .select()
        .single();
      if (!error && data) {
        setEvents(prev => prev.map(ev =>
          ev.id === eventId ? { ...ev, potluck_items: [...(ev.potluck_items || []), data] } : ev
        ));
        setNewItem('');
      }
    } catch {}
  };

  const claimItem = async (eventId, itemId, currentClaimId) => {
    const claiming = currentClaimId !== user?.id;
    const update = claiming
      ? { claimed_by_id: user.id, claimed_by_name: displayName }
      : { claimed_by_id: null, claimed_by_name: null };
    try {
      await supabase.from('potluck_items').update(update).eq('id', itemId);
      setEvents(prev => prev.map(ev =>
        ev.id === eventId
          ? { ...ev, potluck_items: ev.potluck_items.map(i => i.id === itemId ? { ...i, ...update } : i) }
          : ev
      ));
    } catch {}
  };

  const deleteItem = async (eventId, itemId) => {
    await supabase.from('potluck_items').delete().eq('id', itemId);
    setEvents(prev => prev.map(ev =>
      ev.id === eventId
        ? { ...ev, potluck_items: ev.potluck_items.filter(i => i.id !== itemId) }
        : ev
    ));
  };

  const deleteEvent = async (eventId) => {
    await supabase.from('potluck_events').delete().eq('id', eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  const shareEvent = async (ev) => {
    const link = `${import.meta.env.VITE_APP_URL || window.location.origin}?potluck=${ev.event_code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Join my Potluck: ${ev.name}`, url: link });
      } else {
        await navigator.clipboard.writeText(link);
        setCopied(ev.id);
        setTimeout(() => setCopied(null), 2500);
      }
    } catch {}
  };

  if (!user) {
    return (
      <div className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl text-center space-y-3">
        <PartyPopper size={32} className="text-slate-200 mx-auto" />
        <p className="text-sm font-black text-slate-400">Sign in to use Potluck</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-5">
          <PartyPopper size={18} className="text-violet-400" />
          <h2 className="text-[14px] font-bold text-slate-400">Potluck &amp; Events</h2>
        </div>

        {/* Create new event */}
        <form onSubmit={handleCreate} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newEventName}
            onChange={e => setNewEventName(e.target.value)}
            placeholder="New event name (e.g. Friday BBQ)"
            className="flex-1 bg-violet-50/60 border border-violet-100 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-violet-300 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating || !newEventName.trim()}
            className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-3 rounded-2xl text-xs font-black flex items-center gap-1.5 disabled:opacity-60 transition-all shadow-md shadow-violet-200"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create
          </button>
        </form>

        {/* Join via code */}
        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Have an invite code? Enter it here…"
            className="flex-1 bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-violet-300 focus:outline-none uppercase tracking-widest"
            maxLength={8}
          />
          <button
            onClick={() => handleJoin(joinCode)}
            disabled={joining || joinCode.length < 4}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 rounded-2xl text-xs font-black flex items-center gap-1.5 disabled:opacity-60 transition-all"
          >
            {joining ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
            Join
          </button>
        </div>
      </div>

      {/* Events list */}
      {loading ? (
        <div className="text-center py-10">
          <Loader2 size={24} className="animate-spin text-violet-400 mx-auto" />
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl text-center space-y-2">
          <PartyPopper size={28} className="text-slate-200 mx-auto" />
          <p className="text-sm font-black text-slate-400">No events yet</p>
          <p className="text-xs text-slate-300">Create one above or join with an invite code</p>
        </div>
      ) : (
        events.map(ev => {
          const items = ev.potluck_items || [];
          const claimed = items.filter(i => i.claimed_by_id).length;
          const pct = items.length > 0 ? Math.round((claimed / items.length) * 100) : 0;
          const isExpanded = expandedId === ev.id;
          const isHost = ev.host_id === user.id;

          return (
            <div key={ev.id} className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] border border-white/30 shadow-xl overflow-hidden">
              {/* Event header */}
              <div
                className="p-6 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : ev.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <h3 className="font-black text-slate-800 text-lg leading-tight">{ev.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black text-violet-500 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full tracking-widest uppercase">
                        Code: {ev.event_code}
                      </span>
                      {isHost && <span className="text-[9px] font-black text-[#6BAEE0] bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">Host</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); shareEvent(ev); }}
                      className="flex items-center gap-1 text-[10px] font-black text-violet-600 bg-violet-50 border border-violet-100 px-2.5 py-1.5 rounded-xl hover:bg-violet-100 transition-all"
                    >
                      {copied === ev.id ? <Check size={11} /> : <Share2 size={11} />}
                      {copied === ev.id ? 'Copied!' : 'Share'}
                    </button>
                    {isHost && (
                      <button
                        onClick={e => { e.stopPropagation(); deleteEvent(ev.id); }}
                        className="w-8 h-8 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-slate-300" /> : <ChevronDown size={16} className="text-slate-300" />}
                  </div>
                </div>

                {/* Progress bar */}
                {items.length > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Readiness</span>
                      <span className="text-[10px] font-black text-violet-500">{pct}% Covered</span>
                    </div>
                    <div className="h-2 bg-violet-50 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Expanded: item list + add */}
              {isExpanded && (
                <div className="px-6 pb-6 space-y-3">
                  {/* Add item */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItem}
                      onChange={e => setNewItem(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addItem(ev.id)}
                      placeholder="Add something needed (e.g. Buns, Ice, Salad)…"
                      className="flex-1 bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-2xl text-xs font-semibold text-slate-800 focus:border-violet-300 focus:outline-none"
                    />
                    <button
                      onClick={() => addItem(ev.id)}
                      disabled={!newItem.trim()}
                      className="bg-violet-400 text-white p-2.5 rounded-2xl disabled:opacity-50"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <p className="text-xs text-slate-300 italic text-center py-3">No items yet — add what you need for the event</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map(item => {
                        const mine = item.claimed_by_id === user.id;
                        const taken = !!item.claimed_by_id && !mine;
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${item.claimed_by_id ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}
                          >
                            <button
                              onClick={() => !taken && claimItem(ev.id, item.id, item.claimed_by_id)}
                              disabled={taken}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${item.claimed_by_id ? 'bg-emerald-400 border-emerald-400' : 'border-slate-300 hover:border-violet-400'} ${taken ? 'cursor-not-allowed' : ''}`}
                            >
                              {item.claimed_by_id && <Check size={11} className="text-white" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs font-bold ${item.claimed_by_id ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                {item.name}
                              </span>
                              {item.claimed_by_name && (
                                <p className="text-[9px] text-emerald-500 font-black flex items-center gap-1 mt-0.5">
                                  <HandHeart size={9} /> {mine ? 'You' : item.claimed_by_name} will bring this
                                </p>
                              )}
                            </div>
                            {(mine || isHost) && (
                              <button onClick={() => deleteItem(ev.id, item.id)} className="text-slate-200 hover:text-red-400 transition-colors shrink-0">
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
