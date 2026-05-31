import React, { useState, useEffect, useRef } from 'react';
import { Settings, DollarSign, UserPlus, ShoppingCart, Star, BookOpen, Camera } from 'lucide-react';
import { useUser } from './UserContext';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Kosher', 'Dairy-Free', 'Nut-Free', 'Low-Carb', 'High-Protein'];
const NUTRITION_GOALS = ['Balanced', 'High Protein', 'Low Carb', 'Low Fat', 'Build Muscle', 'Lose Weight'];

export default function SettingsPage({ onNavigateFriends }) {
  const {
    userName: profileName,
    userSettings,
    households,
    avatarUrl,
    hungryAvatarUrl,
    handleUpdateAvatar,
    handleUpdateProfileName: onUpdateName,
    handleUpdateSettings,
    handleUpdatePersonalBudget,
    rerunTutorial,
  } = useUser();

  const [avatarUploading, setAvatarUploading] = useState({ global: false, hungry: false });
  const globalAvatarRef = useRef(null);
  const hungryAvatarRef = useRef(null);

  const uploadAvatar = async (file, type) => {
    setAvatarUploading(prev => ({ ...prev, [type]: true }));
    await handleUpdateAvatar(file, type);
    setAvatarUploading(prev => ({ ...prev, [type]: false }));
  };

  const [displayName, setDisplayName] = useState(profileName || '');
  const [dietary, setDietary] = useState(userSettings?.dietary_restrictions || []);
  const [goal, setGoal] = useState(userSettings?.nutrition_goal || 'Balanced');
  const [age, setAge] = useState(String(userSettings?.age || ''));
  const [weightLbs, setWeightLbs] = useState(String(userSettings?.weight_lbs || ''));
  const [heightFt, setHeightFt] = useState(String(userSettings?.height_ft || ''));
  const [heightIn, setHeightIn] = useState(String(userSettings?.height_in || ''));
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const personalBudget = userSettings?.personal_budget_limit || 0;
  const [defaultShoppingDest, setDefaultShoppingDest] = useState(() =>
    localStorage.getItem('hungry_default_shopping_dest') || 'personal'
  );
  const [defaultRecipeDest, setDefaultRecipeDest] = useState(() =>
    localStorage.getItem('hungry_default_recipe_dest') || 'personal'
  );

  const saveDefaultDests = (shopping, recipe) => {
    localStorage.setItem('hungry_default_shopping_dest', shopping);
    localStorage.setItem('hungry_default_recipe_dest', recipe);
  };

  useEffect(() => { setDisplayName(profileName || ''); }, [profileName]);

  useEffect(() => {
    if (userSettings) {
      setDietary(userSettings.dietary_restrictions || []);
      setGoal(userSettings.nutrition_goal || 'Balanced');
      setAge(String(userSettings.age || ''));
      setWeightLbs(String(userSettings.weight_lbs || ''));
      setHeightFt(String(userSettings.height_ft || ''));
      setHeightIn(String(userSettings.height_in || ''));
    }
  }, [userSettings]);

  const toggleDietary = (opt) => {
    setDietary(prev => prev.includes(opt) ? prev.filter(d => d !== opt) : [...prev, opt]);
  };

  const saveSettings = async () => {
    await handleUpdateSettings({
      name: displayName,
      dietary_restrictions: dietary,
      nutrition_goal: goal,
      age: age ? Number(age) : '',
      weight_lbs: weightLbs ? Number(weightLbs) : '',
      height_ft: heightFt ? Number(heightFt) : '',
      height_in: heightIn ? Number(heightIn) : '',
    });
    onUpdateName(displayName);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-2 px-2 mb-2">
        <Settings className="text-[#6BAEE0]" size={18} />
        <h2 className="text-[14px] font-bold text-slate-400">Settings</h2>
      </div>

      {true && <>
      {/* Profile Photos */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Profile Photos</label>
        <div className="flex gap-4">
          {/* Global AppWare avatar */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="relative">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border border-blue-100" />
                : <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center"><Camera size={20} className="text-slate-300" /></div>
              }
              <button
                onClick={() => globalAvatarRef.current?.click()}
                disabled={avatarUploading.global}
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#6BAEE0] flex items-center justify-center border border-white"
              >
                {avatarUploading.global
                  ? <div className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                  : <Camera size={10} className="text-white" />
                }
              </button>
              <input ref={globalAvatarRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0], 'global'); e.target.value = ''; }} />
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">AppWare<br/>Global</span>
          </div>

          {/* Hungry-specific avatar */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <div className="relative">
              {(hungryAvatarUrl || avatarUrl)
                ? <img src={hungryAvatarUrl || avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border border-blue-100" />
                : <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center"><Camera size={20} className="text-slate-300" /></div>
              }
              <button
                onClick={() => hungryAvatarRef.current?.click()}
                disabled={avatarUploading.hungry}
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1F6FB8] flex items-center justify-center border border-white"
              >
                {avatarUploading.hungry
                  ? <div className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                  : <Camera size={10} className="text-white" />
                }
              </button>
              <input ref={hungryAvatarRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0], 'hungry'); e.target.value = ''; }} />
            </div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">Hungry<br/>Photo</span>
          </div>

          <div className="flex-1 flex items-center">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              <span className="font-black text-slate-600">AppWare Global</span> syncs across all apps.<br/>
              <span className="font-black text-slate-600">Hungry Photo</span> overrides it just here.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-6">
        {/* Display Name */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Display Name</label>
          <input
            type="text"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full mt-1 bg-blue-50/50 border border-blue-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
          />
        </div>

        {/* Body Stats — American units */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Body Stats</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {/* Age */}
            <div className="relative">
              <input
                type="number" min="0" value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="—"
                className="w-full bg-blue-50/50 border border-blue-100 px-3 pt-5 pb-2 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
              />
              <span className="absolute top-1.5 left-3 text-[9px] font-black text-slate-400 uppercase tracking-wider">Age (yrs)</span>
            </div>
            {/* Weight in lbs */}
            <div className="relative">
              <input
                type="number" min="0" value={weightLbs}
                onChange={(e) => setWeightLbs(e.target.value)}
                placeholder="—"
                className="w-full bg-blue-50/50 border border-blue-100 px-3 pt-5 pb-2 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
              />
              <span className="absolute top-1.5 left-3 text-[9px] font-black text-slate-400 uppercase tracking-wider">Weight (lbs)</span>
            </div>
          </div>
          {/* Height in ft / in */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="relative">
              <input
                type="number" min="0" max="8" value={heightFt}
                onChange={(e) => setHeightFt(e.target.value)}
                placeholder="—"
                className="w-full bg-blue-50/50 border border-blue-100 px-3 pt-5 pb-2 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
              />
              <span className="absolute top-1.5 left-3 text-[9px] font-black text-slate-400 uppercase tracking-wider">Height (ft)</span>
            </div>
            <div className="relative">
              <input
                type="number" min="0" max="11" value={heightIn}
                onChange={(e) => setHeightIn(e.target.value)}
                placeholder="—"
                className="w-full bg-blue-50/50 border border-blue-100 px-3 pt-5 pb-2 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none"
              />
              <span className="absolute top-1.5 left-3 text-[9px] font-black text-slate-400 uppercase tracking-wider">Height (in)</span>
            </div>
          </div>
        </div>

        {/* Dietary Restrictions */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dietary Restrictions</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {DIETARY_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => toggleDietary(opt)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${dietary.includes(opt) ? 'bg-[#6BAEE0] text-white border-[#6BAEE0] shadow-md' : 'bg-white text-slate-400 border-blue-100 hover:border-sky-300'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Nutrition Goal */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nutrition Goal</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {NUTRITION_GOALS.map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGoal(g)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${goal === g ? 'bg-slate-700 text-white border-slate-700 shadow-md' : 'bg-white text-slate-400 border-blue-100 hover:border-slate-300'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={saveSettings}
          className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg ${settingsSaved ? 'bg-emerald-500 text-white' : 'bg-[#6BAEE0] text-white shadow-blue-100'}`}
        >
          {settingsSaved ? 'Saved!' : 'Save Settings'}
        </button>
      </section>

      {/* Personal Monthly Budget */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="text-[#6BAEE0]" size={16} />
          <h3 className="text-[13px] font-bold text-slate-400">Personal Monthly Budget</h3>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
            <input
              type="number" min="0" step="0.01"
              value={budgetInput || (personalBudget > 0 ? personalBudget.toFixed(2) : '')}
              onChange={e => setBudgetInput(e.target.value)}
              placeholder={personalBudget > 0 ? personalBudget.toFixed(2) : 'Not set'}
              style={{ fontSize: '16px' }}
              className="w-full bg-blue-50/50 border border-blue-100 pl-7 pr-4 py-3 rounded-2xl text-sm text-slate-800 focus:border-sky-400 focus:outline-none"
            />
          </div>
          <button onClick={() => { if (handleUpdatePersonalBudget) handleUpdatePersonalBudget(budgetInput); setBudgetInput(''); }}
            className="bg-[#6BAEE0] text-white px-5 py-3 rounded-2xl text-xs font-black shadow-md shadow-blue-100">
            Save
          </button>
        </div>
      </section>

      {/* Default Destinations — only shown when user has at least one household */}
      {households?.length > 0 && (
        <section className="bg-white/80 backdrop-blur-lg p-6 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-5">
          <h3 className="text-[13px] font-bold text-slate-400">Defaults</h3>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <ShoppingCart size={11} /> New Shopping List Items
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setDefaultShoppingDest('personal'); saveDefaultDests('personal', defaultRecipeDest); }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all ${defaultShoppingDest === 'personal' ? 'bg-[#6BAEE0] text-white border-[#6BAEE0]' : 'bg-white text-slate-400 border-blue-100 hover:border-sky-300'}`}
              >
                👤 Personal
              </button>
              {households.map(h => (
                <button
                  key={h.id}
                  onClick={() => { setDefaultShoppingDest(h.id); saveDefaultDests(h.id, defaultRecipeDest); }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all ${defaultShoppingDest === h.id ? 'bg-[#6BAEE0] text-white border-[#6BAEE0]' : 'bg-white text-slate-400 border-blue-100 hover:border-sky-300'}`}
                >
                  👥 {h.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              <Star size={11} /> Save Recipe To
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setDefaultRecipeDest('personal'); saveDefaultDests(defaultShoppingDest, 'personal'); }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all ${defaultRecipeDest === 'personal' ? 'bg-[#6BAEE0] text-white border-[#6BAEE0]' : 'bg-white text-slate-400 border-blue-100 hover:border-sky-300'}`}
              >
                👤 My Saved Recipes
              </button>
              {households.map(h => (
                <button
                  key={h.id}
                  onClick={() => { setDefaultRecipeDest(h.id); saveDefaultDests(defaultShoppingDest, h.id); }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all ${defaultRecipeDest === h.id ? 'bg-[#6BAEE0] text-white border-[#6BAEE0]' : 'bg-white text-slate-400 border-blue-100 hover:border-sky-300'}`}
                >
                  👥 {h.name}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Invite Friends */}
      <button
        onClick={async () => {
          const msg = { title: 'Join me on Hungry!', text: 'I use Hungry to track my pantry, discover recipes, and plan meals. Join me!', url: import.meta.env.VITE_APP_URL || window.location.origin };
          try {
            if (navigator.share) await navigator.share(msg);
            else { await navigator.clipboard.writeText(msg.url); alert('App link copied to clipboard!'); }
          } catch {}
        }}
        className="w-full flex items-center justify-center gap-2 bg-white/80 backdrop-blur-lg border border-white/20 shadow-xl shadow-blue-900/5 py-4 rounded-[2rem] text-sm font-black text-[#6BAEE0] hover:bg-sky-50 transition-all"
      >
        <UserPlus size={18} /> Invite Friends to Hungry
      </button>

      {/* Re-run Tutorial */}
      <button
        onClick={() => rerunTutorial?.()}
        className="w-full flex items-center justify-center gap-2 bg-white/80 backdrop-blur-lg border border-white/20 shadow-xl shadow-blue-900/5 py-4 rounded-[2rem] text-sm font-black text-violet-500 hover:bg-violet-50 transition-all"
      >
        <BookOpen size={18} /> Re-run App Tutorial
      </button>
      </>}

    </div>
  );
}
