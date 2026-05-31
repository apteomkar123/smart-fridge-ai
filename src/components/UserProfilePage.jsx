import React, { useState, useEffect } from 'react';
import { UserRound, Lock, Globe, ChefHat, Clock, Star, BarChart3, Camera, MessageSquare, Save } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';

const FEATURE_ITEMS = [
  { key: 'chef_history',     label: 'Chef History',       icon: <Clock size={14} />,      desc: 'Your cooking log and leftover remixes' },
  { key: 'saved_recipes',    label: 'Saved Recipes',      icon: <Star size={14} />,       desc: 'Your bookmarked recipes' },
  { key: 'analytics',        label: 'Taste Analytics',    icon: <BarChart3 size={14} />,  desc: 'Cuisine heatmap and nutrition stats' },
  { key: 'photos',           label: 'Food Photos',        icon: <Camera size={14} />,     desc: 'Photos you attach to cooked dishes' },
  { key: 'comments',         label: 'Comments & Notes',   icon: <MessageSquare size={14} />, desc: 'Notes you leave on recipes' },
  { key: 'recipes_created',  label: 'Created Recipes',    icon: <ChefHat size={14} />,    desc: 'Custom recipes you have written' },
];

export default function UserProfilePage() {
  const { user, userName, userSettings } = useUser();
  const [privacy, setPrivacy] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hungry_profile_privacy') || '{}'); } catch { return {}; }
  });
  const [saved, setSaved] = useState(false);

  const displayName = userName || user?.email?.split('@')[0] || 'Chef';
  const cookCount = parseInt(localStorage.getItem('hungry_cook_count') || '0', 10);

  const toggle = (key) => setPrivacy(prev => ({ ...prev, [key]: !prev[key] }));

  const savePrivacy = async () => {
    localStorage.setItem('hungry_profile_privacy', JSON.stringify(privacy));
    if (user) {
      const settings = { ...(userSettings || {}), profile_privacy: privacy };
      await supabase.from('profiles').upsert({ id: user.id, hungry_settings: settings });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Profile card */}
      <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-[#6BAEE0]/20 flex items-center justify-center shrink-0">
            <UserRound size={32} className="text-[#6BAEE0]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">{displayName}</h2>
            <p className="text-[11px] text-slate-400 font-bold">{user?.email}</p>
            <p className="text-[10px] font-black text-[#6BAEE0] mt-1">{cookCount} dishes cooked</p>
          </div>
        </div>
        {userSettings?.dietary_restrictions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {userSettings.dietary_restrictions.map(r => (
              <span key={r} className="text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">{r}</span>
            ))}
          </div>
        )}
      </div>

      {/* Privacy controls */}
      <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={15} className="text-slate-400" />
          <h3 className="text-[13px] font-bold text-slate-400">Public Profile Visibility</h3>
        </div>
        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">Choose what friends can see on your public profile. Anything set to Private is only visible to you.</p>
        <div className="space-y-3">
          {FEATURE_ITEMS.map(({ key, label, icon, desc }) => {
            const isPublic = !privacy[key];
            return (
              <div key={key} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`shrink-0 ${isPublic ? 'text-[#6BAEE0]' : 'text-slate-300'}`}>{icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-700 truncate">{label}</p>
                    <p className="text-[9px] text-slate-400 truncate">{desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggle(key)}
                  className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${isPublic ? 'bg-[#6BAEE0] text-white border-[#6BAEE0]' : 'bg-white text-slate-400 border-slate-200 hover:border-sky-300'}`}
                >
                  {isPublic ? <><Globe size={10} /> Public</> : <><Lock size={10} /> Private</>}
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={savePrivacy}
          className={`mt-5 w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-[#6BAEE0] text-white shadow-blue-100'}`}
        >
          <Save size={13} className="inline mr-1.5" />
          {saved ? 'Saved!' : 'Save Privacy Settings'}
        </button>
      </div>
    </div>
  );
}
