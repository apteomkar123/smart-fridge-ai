import React, { useState, useRef, useEffect } from 'react';
import { Search, Clock, X } from 'lucide-react';

const HISTORY_KEY = 'hungry_search_history';

const getHistory = (namespace) => {
  try { return JSON.parse(localStorage.getItem(`${HISTORY_KEY}_${namespace}`) || '[]'); } catch { return []; }
};
const saveHistory = (namespace, term, prev) => {
  const next = [term, ...prev.filter(t => t !== term)].slice(0, 4);
  try { localStorage.setItem(`${HISTORY_KEY}_${namespace}`, JSON.stringify(next)); } catch {}
  return next;
};

export default function SearchWithHistory({ value, onChange, onEnter, placeholder, namespace = 'global', className = '' }) {
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState(() => getHistory(namespace));
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setFocused(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const commit = (term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const updated = saveHistory(namespace, trimmed, history);
    setHistory(updated);
    setFocused(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { commit(value); onEnter?.(); }
  };

  const removeHistory = (term, e) => {
    e.stopPropagation();
    const next = history.filter(t => t !== term);
    try { localStorage.setItem(`${HISTORY_KEY}_${namespace}`, JSON.stringify(next)); } catch {}
    setHistory(next);
  };

  const showDropdown = focused && history.length > 0 && !value;

  return (
    <div ref={ref} className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={18} />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        style={{ fontSize: '16px' }}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        className={`w-full bg-blue-50/50 border border-blue-100 pl-12 pr-6 py-4 rounded-2xl text-xs font-semibold text-slate-800 focus:border-sky-400 focus:outline-none transition-all ${className}`}
      />
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-xl border border-blue-100 rounded-2xl shadow-xl z-30 overflow-hidden">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 pt-3 pb-1">Recent</p>
          {history.map(term => (
            <button
              key={term}
              onMouseDown={() => { onChange(term); commit(term); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-sky-50 transition-colors text-left"
            >
              <Clock size={12} className="text-slate-300 shrink-0" />
              <span className="text-xs font-semibold text-slate-600 flex-1 truncate">{term}</span>
              <button onMouseDown={e => removeHistory(term, e)} className="text-slate-200 hover:text-slate-400 transition-colors">
                <X size={11} />
              </button>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
