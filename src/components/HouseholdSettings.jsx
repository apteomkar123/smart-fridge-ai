import React, { useState, useEffect } from 'react';
import { Users, Copy, Plus, Home, Check } from 'lucide-react';
import { useUser } from './UserContext';

export default function HouseholdSettings() {
  const {
    households,
    activeHousehold,
    user,
    userName: profileName,
    handleUpdateProfileName: onUpdateName,
    handleCreateHousehold: onCreate,
    handleJoinHousehold: onJoin,
    handleSetActiveHousehold: onSetActive,
  } = useUser();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState(profileName || '');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => { setDisplayName(profileName || ''); }, [profileName]);

  const handleCreate = () => {
    onCreate(name);
    setName('');
    setShowAddForm(false);
  };

  const handleJoin = () => {
    onJoin(code);
    setCode('');
    setShowAddForm(false);
  };

  return (
    <div className="max-w-md mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Personal Name */}
      <section className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
        <h2 className="text-[14px] font-bold text-slate-400 mb-4">Personal Name</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none"
          />
          <button onClick={() => onUpdateName(displayName)} className="bg-[#6BAEE0] text-white p-4 rounded-2xl shadow-lg shadow-blue-100">Save</button>
        </div>
        <p className="text-[12px] text-slate-500">Your name appears in the greeting and throughout the app.</p>
      </section>

      {/* Households list */}
      {households.length > 0 && (
        <section className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-4">
          <h2 className="text-[14px] font-bold text-slate-400 flex items-center gap-2"><Home size={15} /> My Households</h2>
          {households.map(hh => {
            const isActive = hh.id === activeHousehold?.id;
            return (
              <div
                key={hh.id}
                className={`p-5 rounded-2xl border transition-all ${isActive ? 'bg-sky-50 border-sky-200' : 'bg-white border-blue-50'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isActive && <Check size={13} className="text-[#6BAEE0]" />}
                    <span className={`text-sm font-black ${isActive ? 'text-[#1F6FB8]' : 'text-slate-700'}`}>{hh.name}</span>
                    {isActive && <span className="text-[9px] font-black text-[#6BAEE0] bg-white border border-sky-200 px-2 py-0.5 rounded-full uppercase">Active</span>}
                  </div>
                  {!isActive && (
                    <button
                      onClick={() => onSetActive(hh.id)}
                      className="text-[10px] font-black text-[#6BAEE0] bg-sky-50 border border-sky-100 px-3 py-1.5 rounded-xl hover:bg-sky-100 transition-all"
                    >
                      Switch
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">Invite:</span>
                  <span className="text-sm font-mono font-black text-[#6BAEE0] tracking-widest">{hh.invite_code}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(hh.invite_code); alert('Code copied!'); }}
                    className="text-slate-400 hover:text-[#6BAEE0] transition-colors"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Add / Join another household */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full bg-white/80 backdrop-blur-lg p-5 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 text-[13px] font-bold text-[#6BAEE0] flex items-center justify-center gap-2 hover:bg-sky-50 transition-all"
        >
          <Plus size={16} /> {households.length === 0 ? 'Create or Join a Household' : 'Add Another Household'}
        </button>
      ) : (
        <section className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-slate-400">Add Household</h2>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Cancel</button>
          </div>

          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Plus size={11} /> Create New</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Household name (e.g. My Flat)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold focus:border-sky-400 focus:outline-none"
              />
              <button onClick={handleCreate} className="bg-[#6BAEE0] text-white p-4 rounded-2xl"><Plus size={20} /></button>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Users size={11} /> Join Existing</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter invite code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold uppercase focus:border-sky-400 focus:outline-none"
              />
              <button onClick={handleJoin} className="bg-[#6BAEE0] text-white p-4 rounded-2xl">Join</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
