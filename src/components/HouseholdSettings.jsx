import React, { useState, useEffect } from 'react';
import { Users, Copy, Plus, Home } from 'lucide-react';
import { useUser } from './UserContext';

export default function HouseholdSettings() {
  const { 
    household, 
    user, 
    userName: profileName, 
    handleUpdateProfileName: onUpdateName, 
    handleCreateHousehold: onCreate, 
    handleJoinHousehold: onJoin 
  } = useUser();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState(profileName || '');

  useEffect(() => {
    setDisplayName(profileName || '');
  }, [profileName]);

  return (
    <div className="max-w-md mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
        <p className="text-[12px] text-slate-500">Add your preferred name and it will appear throughout the app.</p>
      </section>
      {household ? (
        <section className="bg-white/80 backdrop-blur-lg p-10 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5 text-center">
          <div className="w-16 h-16 bg-blue-50 text-[#6BAEE0] rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Home size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-1">{household.name}</h2>
          <p className="text-xs font-bold text-slate-400 mb-8 uppercase tracking-widest">Shared Household</p>
          
          <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Invite Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-mono font-black text-[#6BAEE0] tracking-tighter">{household.invite_code}</span>
              <button onClick={() => { navigator.clipboard.writeText(household.invite_code); alert("Code copied!"); }} className="p-2 text-slate-400 hover:text-[#6BAEE0]"><Copy size={16} /></button>
            </div>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
            <h2 className="text-[14px] font-bold text-slate-400 mb-6 flex items-center gap-2"><Plus size={16} /> Create Household</h2>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Household Name (e.g. My Flat)" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold focus:border-sky-400 focus:outline-none"
              />
              <button onClick={() => onCreate(name)} className="bg-[#6BAEE0] text-white p-4 rounded-2xl"><Plus size={20} /></button>
            </div>
          </section>

          <section className="bg-white/80 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/20 shadow-xl shadow-blue-900/5">
            <h2 className="text-[14px] font-bold text-slate-400 mb-6 flex items-center gap-2"><Users size={16} /> Join Household</h2>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Enter Invite Code" 
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 bg-white border border-blue-100 px-5 py-4 rounded-2xl text-xs font-semibold focus:border-sky-400 focus:outline-none uppercase"
              />
              <button onClick={() => onJoin(code)} className="bg-[#6BAEE0] text-white p-4 rounded-2xl">Join</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}