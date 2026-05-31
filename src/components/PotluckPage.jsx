import React, { useState, useEffect, useCallback } from 'react';
import { PartyPopper, Plus, Trash2, Check, Share2, HandHeart, X, Loader2, Link, ChevronDown, ChevronUp, Calendar, Clock, MapPin, Users, UserCheck, ChevronRight, Sparkles, ChefHat } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';
import UserProfileModal from './UserProfileModal';

function genCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default function PotluckPage() {
  const { user, userSettings } = useUser();
  const { masterRecipes, setActiveModalRecipe } = useRecipes();
  const [events, setEvents] = useState([]);
  const [profileCache, setProfileCache] = useState({}); // id → {id, display_name, hungry_settings}
  const [activeProfile, setActiveProfile] = useState(null);
  const [smartSuggestionsState, setSmartSuggestionsState] = useState({}); // eventId → { loading, suggestions }
  const [itemRecipeMap, setItemRecipeMap] = useState({}); // itemName → recipe
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventVenue, setNewEventVenue] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [activeCardId, setActiveCardId] = useState(null);
  const [newItem, setNewItem] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(null);

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Guest';
  const myDietaryRestrictions = userSettings?.dietary_restrictions || [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('potluck');
    if (code) {
      setJoinCode(code);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const openClaimer = useCallback(async (claimerId, claimerName) => {
    if (!claimerId || claimerId === user?.id) return;
    if (profileCache[claimerId]) { setActiveProfile(profileCache[claimerId]); return; }
    const { data } = await supabase.from('profiles').select('id, display_name, hungry_settings, friend_code').eq('id', claimerId).single();
    const profile = data || { id: claimerId, display_name: claimerName };
    setProfileCache(prev => ({ ...prev, [claimerId]: profile }));
    setActiveProfile(profile);
  }, [profileCache, user?.id]);

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

  useEffect(() => {
    if (joinCode && user) handleJoin(joinCode);
  }, [joinCode, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSmartSuggestions = useCallback(async (ev) => {
    const evId = ev.id;
    setSmartSuggestionsState(prev => ({ ...prev, [evId]: { loading: true, suggestions: [] } }));
    try {
      // Gather dietary restrictions from all claimed participants
      const claimerIds = [...new Set((ev.potluck_items || []).filter(i => i.claimed_by_id).map(i => i.claimed_by_id))];
      let allRestrictions = [...(userSettings?.dietary_restrictions || [])];
      if (claimerIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('hungry_settings').in('id', claimerIds);
        (profiles || []).forEach(p => {
          allRestrictions = allRestrictions.concat(p.hungry_settings?.dietary_restrictions || []);
        });
      }
      const uniqueRestrictions = [...new Set(allRestrictions.map(r => r.toLowerCase()))];
      const restrictionNote = uniqueRestrictions.length
        ? `Dietary restrictions among attendees: ${uniqueRestrictions.join(', ')}. There can still be meat dishes if only one person is vegetarian — cater to the majority and include alternatives for restrictions.`
        : 'No specific dietary restrictions.';

      const prompt = `You are a party food planner. The event is called "${ev.name}". ${restrictionNote}
Suggest 10 food and drink items for this event. Be specific and practical. Return ONLY a JSON array of strings, e.g. ["Grilled Burgers", "Veggie Skewers", ...]. No extra text.`;
      const res = await fetch('/.netlify/functions/scan-receipt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: prompt, directMode: true }),
      });
      const text = await res.text();
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const suggestions = JSON.parse(cleaned);
      setSmartSuggestionsState(prev => ({ ...prev, [evId]: { loading: false, suggestions: Array.isArray(suggestions) ? suggestions : [] } }));
    } catch {
      setSmartSuggestionsState(prev => ({ ...prev, [evId]: { loading: false, suggestions: ['Burgers', 'Hot Dogs', 'Salad', 'Chips & Dip', 'Lemonade', 'Veggie Platter', 'Watermelon', 'Cookies', 'Corn on the Cob', 'Ice Cream'] } }));
    }
  }, [userSettings, masterRecipes]);

  const openItemRecipe = useCallback((itemName) => {
    if (!masterRecipes?.length) return;
    const lower = itemName.toLowerCase();
    const match = masterRecipes.find(r => r.name.toLowerCase().includes(lower) || lower.includes(r.name.toLowerCase().split(' ')[0]));
    if (match) setActiveModalRecipe(match);
  }, [masterRecipes, setActiveModalRecipe]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newEventName.trim() || !user) return;
    setCreating(true);
    setCreateError('');
    try {
      const eventCode = genCode();
      const payload = {
        name: newEventName.trim(),
        host_id: user.id,
        event_code: eventCode,
        event_date: newEventDate || null,
        event_time: newEventTime || null,
        venue: newEventVenue.trim() || null,
      };
      const { data, error } = await supabase.from('potluck_events')
        .insert([payload])
        .select('*, potluck_items(*)')
        .single();
      if (!error && data) {
        setEvents(prev => [data, ...prev]);
        setExpandedId(data.id);
        setNewEventName('');
        setNewEventDate('');
        setNewEventTime('');
        setNewEventVenue('');
      } else if (error) {
        // Fallback: retry without optional columns in case they don't exist yet
        const { data: d2, error: e2 } = await supabase.from('potluck_events')
          .insert([{ name: newEventName.trim(), host_id: user.id, event_code: eventCode }])
          .select('*, potluck_items(*)')
          .single();
        if (!e2 && d2) {
          setEvents(prev => [d2, ...prev]);
          setExpandedId(d2.id);
          setNewEventName('');
        } else {
          setCreateError(e2?.message || error?.message || 'Could not create event. Check your connection and try again.');
        }
      }
    } catch (err) {
      setCreateError(err?.message || 'Unexpected error creating event.');
    }
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
        await navigator.share({ title: `Join my Event: ${ev.name}`, url: link });
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
        <p className="text-sm font-black text-slate-400">Sign in to use Events</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-5">
          <PartyPopper size={18} className="text-violet-400" />
          <h2 className="text-[14px] font-bold text-slate-400">Events &amp; Potluck</h2>
        </div>

        {/* Create new event */}
        <form onSubmit={handleCreate} className="space-y-2 mb-4">
          <input
            type="text"
            value={newEventName}
            onChange={e => setNewEventName(e.target.value)}
            placeholder="Event name (e.g. Friday BBQ)"
            className="w-full bg-violet-50/60 border border-violet-100 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-800 focus:border-violet-300 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <input
                type="date"
                value={newEventDate}
                onChange={e => setNewEventDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 px-3 py-2.5 rounded-2xl text-xs font-semibold text-slate-700 focus:border-violet-300 focus:outline-none"
              />
              {!newEventDate && (
                <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-slate-400 pointer-events-none">Choose date</span>
              )}
            </div>
            <div className="relative">
              <input
                type="time"
                value={newEventTime}
                onChange={e => setNewEventTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 px-3 py-2.5 rounded-2xl text-xs font-semibold text-slate-700 focus:border-violet-300 focus:outline-none"
              />
              {!newEventTime && (
                <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-slate-400 pointer-events-none">Choose time</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newEventVenue}
              onChange={e => setNewEventVenue(e.target.value)}
              placeholder="Venue / location (optional)"
              className="flex-1 bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-2xl text-xs font-semibold text-slate-800 focus:border-violet-300 focus:outline-none"
            />
            <button
              type="submit"
              disabled={creating || !newEventName.trim()}
              className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 disabled:opacity-60 transition-all shadow-md shadow-violet-200"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create
            </button>
          </div>
          {createError && <p className="text-[11px] text-red-500 font-bold mt-1">{createError}</p>}
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
          const isCardOpen = activeCardId === ev.id;

          return (
            <div key={ev.id} className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] border border-white/30 shadow-xl overflow-hidden">
              {/* Event header */}
              <div
                className="p-6 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : ev.id)}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-800 text-lg leading-tight truncate">{ev.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[9px] font-black text-violet-500 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full tracking-widest uppercase">
                        Code: {ev.event_code}
                      </span>
                      {isHost && <span className="text-[9px] font-black text-[#6BAEE0] bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">Host</span>}
                    </div>
                    {/* Date / time / venue */}
                    <div className="flex flex-wrap gap-3 mt-2">
                      {ev.event_date && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <Calendar size={10} /> {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                      {ev.event_time && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <Clock size={10} /> {ev.event_time}
                        </span>
                      )}
                      {ev.venue && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <MapPin size={10} /> {ev.venue}
                        </span>
                      )}
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

                {/* View Details button */}
                <button
                  onClick={e => { e.stopPropagation(); setActiveCardId(isCardOpen ? null : ev.id); }}
                  className="mt-3 text-[10px] font-black text-violet-500 hover:text-violet-700 flex items-center gap-1 transition-colors"
                >
                  <Users size={10} /> {isCardOpen ? 'Hide Details' : 'View Full Details'}
                </button>
              </div>

              {/* Full Event Card */}
              {isCardOpen && (
                <div className="px-6 pb-5 border-t border-violet-50 pt-4 space-y-4 bg-violet-50/30">
                  <h4 className="text-[11px] font-black text-violet-600 uppercase tracking-widest">Event Details</h4>

                  {/* My RSVP & dietary restrictions */}
                  <div className="bg-white rounded-2xl border border-violet-100 px-4 py-3 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">My Info</p>
                    <div className="flex items-center gap-2">
                      <UserCheck size={13} className="text-emerald-500" />
                      <p className="text-xs font-bold text-slate-700">{displayName}</p>
                    </div>
                    {myDietaryRestrictions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {myDietaryRestrictions.map(r => (
                          <span key={r} className="text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">{r}</span>
                        ))}
                      </div>
                    )}
                    {myDietaryRestrictions.length === 0 && (
                      <p className="text-[10px] text-slate-400 italic">No dietary restrictions set — update in Settings</p>
                    )}
                  </div>

                  {/* Claimed items summary */}
                  {items.length > 0 && (
                    <div className="bg-white rounded-2xl border border-violet-100 px-4 py-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Who's Bringing What</p>
                      <div className="space-y-1.5">
                        {items.filter(i => i.claimed_by_id).map(i => (
                          <div key={i.id} className="flex items-center gap-2">
                            <Check size={10} className="text-emerald-500 shrink-0" />
                            <span className="text-xs text-slate-600 flex-1">{i.name}</span>
                            {i.claimed_by_id === user.id ? (
                              <span className="text-[9px] font-black text-emerald-500">You</span>
                            ) : (
                              <button onClick={() => openClaimer(i.claimed_by_id, i.claimed_by_name)} className="flex items-center gap-0.5 text-[9px] font-black text-[#6BAEE0] hover:underline">
                                {i.claimed_by_name} <ChevronRight size={9} />
                              </button>
                            )}
                          </div>
                        ))}
                        {items.filter(i => !i.claimed_by_id).map(i => (
                          <div key={i.id} className="flex items-center gap-2">
                            <X size={10} className="text-slate-300 shrink-0" />
                            <span className="text-xs text-slate-400">{i.name}</span>
                            <span className="text-[9px] text-slate-300">unclaimed</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Expanded: item list + add */}
              {isExpanded && (
                <div className="px-6 pb-6 space-y-3">
                  {/* Smart Suggestions */}
                  {(() => {
                    const ss = smartSuggestionsState[ev.id];
                    return (
                      <>
                        <button
                          onClick={() => loadSmartSuggestions(ev)}
                          disabled={ss?.loading}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[11px] font-black text-violet-500 bg-violet-50 border border-violet-100 hover:bg-violet-100 transition-all"
                        >
                          {ss?.loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                          {ss?.loading ? 'Generating suggestions…' : '✨ Smart Suggestions'}
                        </button>
                        {ss?.suggestions?.length > 0 && (
                          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3">
                            <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest mb-2">Tap to add to event:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {ss.suggestions.map(s => (
                                <button key={s} type="button"
                                  onClick={() => setNewItem(s)}
                                  className="text-[10px] font-bold bg-white border border-violet-200 text-violet-600 px-2.5 py-1 rounded-full hover:bg-violet-100 transition-all">
                                  + {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

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
                              <button
                                onClick={() => openItemRecipe(item.name)}
                                className="flex items-center gap-1 text-left hover:text-violet-600 transition-colors"
                              >
                                <span className={`text-xs font-bold ${item.claimed_by_id ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                  {item.name}
                                </span>
                                <ChefHat size={10} className="text-slate-300 shrink-0" />
                              </button>
                              {item.claimed_by_name && (
                                <p className="text-[9px] text-emerald-500 font-black flex items-center gap-1 mt-0.5">
                                  <HandHeart size={9} />
                                  {mine ? 'You' : (
                                    <button onClick={e => { e.stopPropagation(); openClaimer(item.claimed_by_id, item.claimed_by_name); }} className="underline hover:text-emerald-700">
                                      {item.claimed_by_name}
                                    </button>
                                  )} will bring this
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

      {activeProfile && (
        <UserProfileModal user={activeProfile} onClose={() => setActiveProfile(null)} />
      )}
    </div>
  );
}
