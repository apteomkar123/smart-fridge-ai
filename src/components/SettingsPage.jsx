import React, { useState, useEffect } from 'react';
import { Settings, Users } from 'lucide-react';
import { useUser } from './UserContext';
import HouseholdSettings from './HouseholdSettings';

const DIETARY_OPTIONS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Kosher', 'Dairy-Free', 'Nut-Free', 'Low-Carb', 'High-Protein'];
const NUTRITION_GOALS = ['Balanced', 'High Protein', 'Low Carb', 'Low Fat', 'Build Muscle', 'Lose Weight'];

export default function SettingsPage() {
  const {
    userName: profileName,
    userSettings,
    handleUpdateProfileName: onUpdateName,
    handleUpdateSettings,
  } = useUser();

  const [displayName, setDisplayName] = useState(profileName || '');
  const [dietary, setDietary] = useState(userSettings?.dietary_restrictions || []);
  const [goal, setGoal] = useState(userSettings?.nutrition_goal || 'Balanced');
  const [age, setAge] = useState(String(userSettings?.age || ''));
  const [weightLbs, setWeightLbs] = useState(String(userSettings?.weight_lbs || ''));
  const [heightFt, setHeightFt] = useState(String(userSettings?.height_ft || ''));
  const [heightIn, setHeightIn] = useState(String(userSettings?.height_in || ''));
  const [settingsSaved, setSettingsSaved] = useState(false);

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

      {/* ── Household Settings ── */}
      <div className="flex items-center gap-2 px-2 mt-4">
        <Users className="text-[#6BAEE0]" size={18} />
        <h2 className="text-[14px] font-bold text-slate-400">Household Settings</h2>
      </div>
      <HouseholdSettings />
    </div>
  );
}
