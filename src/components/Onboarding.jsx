import React, { useState, useRef } from 'react';
import { supabase } from '../supabaseClient';

const SCREENS = [
  {
    key: 'brand',
    render: () => (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 text-center">
        {/* Glass orb with H */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#6BAEE0]/30 to-[#6BAEE0]/10 backdrop-blur-xl border border-white/60 shadow-2xl shadow-blue-300/40" />
          <span className="relative text-6xl font-black text-[#6BAEE0]" style={{ fontFamily: "'Yellowtail', cursive" }}>H</span>
        </div>
        <div>
          <h1 className="text-3xl font-black text-[#6BAEE0] mb-3" style={{ fontFamily: "'Yellowtail', cursive" }}>Welcome, Chef!</h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs">Your kitchen just got a whole lot smarter. Let's turn those ingredients into masterpieces.</p>
        </div>
      </div>
    ),
    cta: 'Start Your Journey',
  },
  {
    key: 'scan',
    render: () => (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 text-center">
        {/* Scanner animation */}
        <div className="relative w-48 h-36 bg-white/40 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl overflow-hidden">
          <div className="absolute inset-x-0 h-0.5 bg-[#6BAEE0] opacity-80 animate-scanner-line" style={{ top: '50%' }} />
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <div className="space-y-1.5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-0.5">
                  {[...Array(8)].map((_, j) => (
                    <div key={j} className="w-3 h-1 rounded-sm" style={{ background: Math.random() > 0.5 ? '#1F6FB8' : 'white' }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-3 left-3 right-3 bg-emerald-400/90 text-white text-[10px] font-black rounded-xl px-3 py-1.5 text-center">
            Eggs added · Expires in 12 days
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 mb-3">Zero Typing Required.</h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs">Snap a photo of your receipt or scan a barcode. Our AI automatically categorizes your pantry and tracks expiry dates.</p>
        </div>
      </div>
    ),
    cta: 'Next',
  },
  {
    key: 'ai',
    render: () => (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 text-center">
        {/* Recipe card animation */}
        <div className="w-48 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl p-4 relative animate-float">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dinner</span>
            <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">95% Match</span>
          </div>
          <p className="text-sm font-black text-slate-800 text-left">Garlic Butter Pasta</p>
          <div className="flex gap-1.5 mt-3">
            <button className="flex-1 text-[9px] font-black bg-slate-100 text-slate-500 py-1.5 rounded-lg">🥩 Meat</button>
            <button className="flex-1 text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 py-1.5 rounded-lg">🌿 Veg</button>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 mb-3">Culinary Magic.</h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs">Tell us what you have, and we'll tell you what's for dinner. Dietary restrictions and nutrition goals included.</p>
        </div>
      </div>
    ),
    cta: 'Next',
  },
  {
    key: 'household',
    render: () => (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 text-center">
        {/* Overlapping profile circles */}
        <div className="flex -space-x-4">
          {['A', 'B', 'C'].map((l, i) => (
            <div key={l} className="w-16 h-16 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-xl font-black text-white"
              style={{ background: `hsl(${200 + i * 20}, 70%, ${50 + i * 8}%)`, zIndex: 3 - i }}>
              {l}
            </div>
          ))}
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 mb-3">One Kitchen, One List.</h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs">Share your pantry and shopping list with roommates or family in real-time. No more double-buying the milk.</p>
        </div>
      </div>
    ),
    cta: 'Next',
  },
  {
    key: 'voice',
    render: () => (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 text-center">
        {/* Mic with ripple */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#6BAEE0]/10 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-[#6BAEE0]/15 animate-ping" style={{ animationDelay: '0.3s' }} />
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#6BAEE0] to-[#4d96d1] flex items-center justify-center shadow-xl shadow-blue-300/50">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white fill-current">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" />
            </svg>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 mb-3">Look, No Hands.</h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs">Step-by-step voice guidance for when your hands are covered in flour. Just say "Hungry, next step".</p>
        </div>
      </div>
    ),
    cta: 'Almost Done',
  },
  {
    key: 'prefs',
    render: null, // rendered below separately
    cta: 'Enter Hungry',
  },
];

const RESTRICTIONS = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-Free'];
const GOALS = ['Increase Protein', 'Lower Carbs', 'Eco-Friendly'];

export default function Onboarding({ user, onComplete }) {
  const [screen, setScreen] = useState(0);
  const [chefName, setChefName] = useState('');
  const [restrictions, setRestrictions] = useState([]);
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);

  // Photo onboarding state
  const [existingGlobalUrl, setExistingGlobalUrl] = useState(null);
  const [localPhotoUrl, setLocalPhotoUrl] = useState(null); // preview URL
  const [photoDialog, setPhotoDialog] = useState(null); // 'import-or-new' | 'apply-all'
  const [pendingFile, setPendingFile] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);

  // Load existing global photo once the prefs screen is reached
  const loadExistingPhoto = async () => {
    if (!user?.id || existingGlobalUrl !== null) return;
    const { data } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single();
    setExistingGlobalUrl(data?.avatar_url ?? '');
    if (data?.avatar_url) setLocalPhotoUrl(data.avatar_url);
  };

  async function uploadOnboardingPhoto(file, type) {
    if (!user?.id || !file) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = type === 'global' ? `avatar.${ext}` : `hungry.${ext}`;
    const path = `${user.id}/${filename}`;
    const { error } = await supabase.storage.from('user-avatars').upload(path, file, { upsert: true });
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from('user-avatars').getPublicUrl(path);
    const col = type === 'global' ? 'avatar_url' : 'hungry_avatar_url';
    await supabase.from('profiles').update({ [col]: publicUrl }).eq('id', user.id);
    return publicUrl;
  }

  function handlePhotoButton() {
    if (existingGlobalUrl) {
      setPhotoDialog('import-or-new');
    } else {
      photoInputRef.current?.click();
    }
  }

  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setLocalPhotoUrl(URL.createObjectURL(file));
    if (!existingGlobalUrl) {
      setPendingFile(file);
      setPhotoDialog('apply-all');
    } else {
      // Chose a new Hungry-specific photo (declined import)
      setPhotoUploading(true);
      await uploadOnboardingPhoto(file, 'hungry');
      setPhotoUploading(false);
      setPhotoDialog(null);
    }
  }

  async function handleImportGlobal() {
    // Use global AppWare photo — nothing to upload; just show it
    setLocalPhotoUrl(existingGlobalUrl);
    setPhotoDialog(null);
  }

  async function handleApplyAll() {
    if (!pendingFile) return;
    setPhotoUploading(true);
    await uploadOnboardingPhoto(pendingFile, 'global');
    setPendingFile(null);
    setPhotoUploading(false);
    setPhotoDialog(null);
  }

  async function handleApplyHungryOnly() {
    if (!pendingFile) return;
    setPhotoUploading(true);
    await uploadOnboardingPhoto(pendingFile, 'hungry');
    setPendingFile(null);
    setPhotoUploading(false);
    setPhotoDialog(null);
  }

  const toggleRestriction = (r) =>
    setRestrictions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  const total = SCREENS.length;
  const isPrefs = screen === total - 1;

  // Load existing photo when reaching the prefs screen
  if (isPrefs && existingGlobalUrl === null) loadExistingPhoto();

  const handleNext = async () => {
    if (isPrefs) {
      setSaving(true);
      try {
        await supabase.auth.updateUser({
          data: {
            name: chefName.trim() || undefined,
            dietary_restrictions: restrictions,
            nutrition_goal: goal || 'Balanced',
            onboarding_completed: true,
          }
        });
        // Also write to profiles if it exists
        if (user?.id) {
          await supabase.from('profiles').upsert([{
            id: user.id,
            display_name: chefName.trim() || user.email?.split('@')[0] || 'Chef',
          }]).select();
        }
      } catch {}
      setSaving(false);
      onComplete();
    } else {
      setScreen(s => s + 1);
    }
  };

  const currentScreen = SCREENS[screen];

  return (
    <div className="h-screen w-full bg-gradient-to-b from-white to-blue-50 flex items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-sm bg-white/30 backdrop-blur-3xl border border-white/60 rounded-[3.5rem] shadow-2xl shadow-blue-200/40 flex flex-col overflow-hidden relative" style={{ minHeight: '600px' }}>

        {/* Skip button */}
        {!isPrefs && (
          <button
            onClick={onComplete}
            className="absolute top-5 right-6 text-[11px] font-bold text-slate-400/80 hover:text-slate-600 transition-colors z-10"
          >
            Skip
          </button>
        )}

        {/* Screen content */}
        {isPrefs ? (
          <div className="flex flex-col flex-1 px-6 py-8">
            <h2 className="text-2xl font-black text-slate-800 mb-1">Almost There!</h2>
            <p className="text-xs text-slate-400 mb-6">Tell us a bit about yourself so we can personalise your experience.</p>

            {/* Profile Photo */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative shrink-0">
                {localPhotoUrl
                  ? <img src={localPhotoUrl} alt="" className="w-14 h-14 rounded-2xl object-cover border border-blue-100" />
                  : <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-slate-300 text-xl">📷</div>
                }
                <button
                  type="button"
                  onClick={handlePhotoButton}
                  disabled={photoUploading}
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#6BAEE0] text-white flex items-center justify-center border border-white text-[10px]"
                >
                  {photoUploading ? '…' : '+'}
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChosen} />
              </div>
              {photoDialog === 'import-or-new' ? (
                <div className="flex-1 bg-sky-50 border border-sky-200 rounded-2xl p-3 space-y-2">
                  <p className="text-[11px] font-bold text-slate-700">Use your AppWare profile photo here?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleImportGlobal} className="flex-1 bg-[#6BAEE0] text-white text-[10px] font-black py-1.5 rounded-xl">Yes, Use It</button>
                    <button type="button" onClick={() => { setPhotoDialog(null); photoInputRef.current?.click(); }} className="flex-1 bg-white border border-blue-100 text-slate-500 text-[10px] font-black py-1.5 rounded-xl">Choose Different</button>
                  </div>
                </div>
              ) : photoDialog === 'apply-all' ? (
                <div className="flex-1 bg-sky-50 border border-sky-200 rounded-2xl p-3 space-y-2">
                  <p className="text-[11px] font-bold text-slate-700">Apply this photo to all AppWare apps?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleApplyAll} className="flex-1 bg-[#6BAEE0] text-white text-[10px] font-black py-1.5 rounded-xl">Yes, All Apps</button>
                    <button type="button" onClick={handleApplyHungryOnly} className="flex-1 bg-white border border-blue-100 text-slate-500 text-[10px] font-black py-1.5 rounded-xl">Just Hungry</button>
                  </div>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">Add a profile photo<br/><span className="font-bold text-slate-500">(optional)</span></span>
              )}
            </div>

            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 block">What should we call you, Chef?</label>
            <input
              type="text"
              value={chefName}
              onChange={e => setChefName(e.target.value)}
              placeholder="Your name…"
              style={{ fontSize: '16px' }}
              className="w-full bg-white border border-blue-100 px-4 py-3 rounded-2xl text-sm font-bold text-slate-800 focus:border-sky-400 focus:outline-none mb-6"
            />

            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Dietary Restrictions</label>
            <div className="flex flex-wrap gap-2 mb-6">
              {RESTRICTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => toggleRestriction(r)}
                  className={`px-4 py-2 rounded-full text-[11px] font-black transition-all ${restrictions.includes(r) ? 'bg-[#6BAEE0] text-white shadow-md' : 'bg-white border border-blue-100 text-slate-500 hover:border-sky-300'}`}
                >{r}</button>
              ))}
            </div>

            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Nutrition Goal</label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map(g => (
                <button
                  key={g}
                  onClick={() => setGoal(prev => prev === g ? '' : g)}
                  className={`px-4 py-2 rounded-full text-[11px] font-black transition-all ${goal === g ? 'bg-emerald-500 text-white shadow-md' : 'bg-white border border-blue-100 text-slate-500 hover:border-emerald-300'}`}
                >{g}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1">
            {currentScreen.render()}
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-2 py-4">
          {SCREENS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${i === screen ? 'w-6 h-2 bg-[#6BAEE0]' : 'w-2 h-2 bg-white/60 border border-[#6BAEE0]/30'}`}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-8">
          <button
            onClick={handleNext}
            disabled={saving}
            className="w-full bg-[#6BAEE0] text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-60"
          >
            {saving ? 'Saving…' : currentScreen.cta}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scanner {
          0% { transform: translateY(-50px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(80px); opacity: 0; }
        }
        .animate-scanner-line { animation: scanner 2s ease-in-out infinite; }
        @keyframes floatAnim {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .animate-float { animation: floatAnim 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
