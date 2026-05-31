import React, { useState, useEffect } from 'react';
import { UserRound, Lock, Globe, ChefHat, Clock, Star, BarChart3, Camera, MessageSquare, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUser } from './UserContext';
import { useRecipes } from './RecipeContext';

const FEATURE_ITEMS = [
  { key: 'chef_history',     label: 'Chef History',       icon: <Clock size={14} />,         desc: 'Your cooking log and leftover remixes' },
  { key: 'saved_recipes',    label: 'Saved Recipes',      icon: <Star size={14} />,          desc: 'Your bookmarked recipes' },
  { key: 'analytics',        label: 'Taste Analytics',    icon: <BarChart3 size={14} />,     desc: 'Cuisine heatmap and nutrition stats' },
  { key: 'photos',           label: 'Food Photos',        icon: <Camera size={14} />,        desc: 'Photos you attach to cooked dishes' },
  { key: 'comments',         label: 'Comments & Notes',   icon: <MessageSquare size={14} />, desc: 'Notes you leave on recipes' },
  { key: 'recipes_created',  label: 'Created Recipes',    icon: <ChefHat size={14} />,       desc: 'Custom recipes you have written' },
];

function PrivacyToggle({ isPublic, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${isPublic ? 'bg-[#6BAEE0] text-white border-[#6BAEE0]' : 'bg-white text-slate-400 border-slate-200 hover:border-sky-300'}`}
    >
      {isPublic ? <><Globe size={10} /> Public</> : <><Lock size={10} /> Private</>}
    </button>
  );
}

export default function UserProfilePage() {
  const { user, userName, userSettings } = useUser();
  const { savedRecipes } = useRecipes();
  const [privacy, setPrivacy] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hungry_profile_privacy') || '{}'); } catch { return {}; }
  });
  const [recipePrivacy, setRecipePrivacy] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hungry_recipe_privacy') || '{}'); } catch { return {}; }
  });
  const [saved, setSaved] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);

  const displayName = userName || user?.email?.split('@')[0] || 'Chef';
  const cookCount = parseInt(localStorage.getItem('hungry_cook_count') || '0', 10);

  const toggle = (key) => setPrivacy(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleRecipe = (recipeId) => setRecipePrivacy(prev => ({ ...prev, [recipeId]: !prev[recipeId] }));

  const savePrivacy = async () => {
    localStorage.setItem('hungry_profile_privacy', JSON.stringify(privacy));
    localStorage.setItem('hungry_recipe_privacy', JSON.stringify(recipePrivacy));
    if (user) {
      const settings = { ...(userSettings || {}), profile_privacy: privacy, recipe_privacy: recipePrivacy };
      await supabase.from('profiles').upsert({ id: user.id, hungry_settings: settings });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Personal saved recipes (not household ones)
  const personalRecipes = (savedRecipes || []).filter(r => !r.household_id && r.meal_type !== '__meal_plan__');

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
        {userSettings?.bio && (
          <p className="text-xs text-slate-500 leading-relaxed mt-1">{userSettings.bio}</p>
        )}
        {userSettings?.dietary_restrictions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {userSettings.dietary_restrictions.map(r => (
              <span key={r} className="text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">{r}</span>
            ))}
          </div>
        )}
      </div>

      {/* Feature-level privacy controls */}
      <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={15} className="text-slate-400" />
          <h3 className="text-[13px] font-bold text-slate-400">Section Visibility</h3>
        </div>
        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">Choose which sections of your profile are public. Private sections are only visible to you.</p>
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
                <PrivacyToggle isPublic={isPublic} onToggle={() => toggle(key)} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual recipe privacy */}
      {personalRecipes.length > 0 && (
        <div className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
          <button
            onClick={() => setShowRecipes(v => !v)}
            className="w-full flex items-center justify-between gap-2 mb-1"
          >
            <div className="flex items-center gap-2">
              <Star size={14} className="text-slate-400" />
              <h3 className="text-[13px] font-bold text-slate-400">Individual Recipe Visibility</h3>
              <span className="text-[9px] font-black bg-blue-50 text-[#6BAEE0] border border-sky-100 px-2 py-0.5 rounded-full">{personalRecipes.length}</span>
            </div>
            {showRecipes ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
          </button>
          {!showRecipes && <p className="text-[10px] text-slate-400">Tap to control which saved recipes are public</p>}
          {showRecipes && (
            <div className="space-y-2 mt-4">
              {personalRecipes.map(r => {
                const isPublic = !recipePrivacy[r.recipe_id];
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{r.recipe_name}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-widest">{r.meal_type}</p>
                    </div>
                    <PrivacyToggle isPublic={isPublic} onToggle={() => toggleRecipe(r.recipe_id)} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Chef History photo/comment privacy note */}
      <div className="bg-white/80 backdrop-blur-lg p-5 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-2">
          <Camera size={14} className="text-slate-400" />
          <h3 className="text-[13px] font-bold text-slate-400">Photos &amp; Comments</h3>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Individual photo and comment visibility is controlled per Chef History entry — use the public/private toggle on each history card to manage them.
        </p>
      </div>

      <button
        onClick={savePrivacy}
        className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-[#6BAEE0] text-white shadow-blue-100'}`}
      >
        <Save size={13} className="inline mr-1.5" />
        {saved ? 'Saved!' : 'Save Privacy Settings'}
      </button>
    </div>
  );
}
