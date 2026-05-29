import React, { useState, useEffect } from 'react';

const FRAMES = [
  {
    label: 'Writing your recipe…',
    animation: (
      <svg viewBox="0 0 80 80" className="w-20 h-20" fill="none">
        {/* Book */}
        <rect x="10" y="20" width="28" height="40" rx="3" fill="#6BAEE0" opacity="0.3" />
        <rect x="42" y="20" width="28" height="40" rx="3" fill="#6BAEE0" opacity="0.3" />
        <rect x="36" y="18" width="8" height="44" rx="2" fill="#4d96d1" />
        {/* Animated pen lines */}
        <line x1="16" y1="32" x2="32" y2="32" stroke="#1F6FB8" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="x2" values="16;32;16" dur="1.2s" repeatCount="indefinite" />
        </line>
        <line x1="16" y1="39" x2="32" y2="39" stroke="#1F6FB8" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="x2" values="16;28;16" dur="1.2s" begin="0.3s" repeatCount="indefinite" />
        </line>
        <line x1="16" y1="46" x2="32" y2="46" stroke="#1F6FB8" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="x2" values="16;30;16" dur="1.2s" begin="0.6s" repeatCount="indefinite" />
        </line>
        {/* Pen */}
        <g>
          <animateTransform attributeName="transform" type="translate" values="0,0; 4,-2; 0,0" dur="0.6s" repeatCount="indefinite" />
          <rect x="28" y="24" width="5" height="14" rx="1" fill="#FFB347" transform="rotate(-30 30 30)" />
          <polygon points="28,38 33,38 30.5,44" fill="#FF7F50" transform="rotate(-30 30 30)" />
        </g>
      </svg>
    ),
  },
  {
    label: 'Chef is thinking…',
    animation: (
      <svg viewBox="0 0 80 80" className="w-20 h-20" fill="none">
        {/* Blue circle background */}
        <circle cx="40" cy="40" r="36" fill="#6BAEE0" />
        <circle cx="40" cy="40" r="36" fill="url(#hatGrad)" />
        <defs>
          <radialGradient id="hatGrad" cx="40%" cy="35%" r="65%" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7BBEE8" />
            <stop offset="100%" stopColor="#4d96d1" />
          </radialGradient>
        </defs>
        {/* Animated hat group — tilts left/right */}
        <g>
          <animateTransform attributeName="transform" type="rotate" values="-7,40,50; 7,40,50; -7,40,50" dur="1s" repeatCount="indefinite" />
          {/* Hat brim */}
          <rect x="22" y="52" width="36" height="7" rx="3.5" fill="white" opacity="0.95" />
          {/* Brim detail line */}
          <rect x="22" y="55" width="36" height="1.5" rx="0.75" fill="#e2eef7" opacity="0.6" />
          {/* Hat body (tall dome) */}
          <path d="M27 53 C27 53 25 38 28 30 C30 24 35 20 40 20 C45 20 50 24 52 30 C55 38 53 53 53 53 Z" fill="white" opacity="0.95" />
          {/* Dome highlight */}
          <path d="M32 28 C32 28 31 36 32 44" stroke="#e2eef7" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          {/* Chef cross on hat */}
          <line x1="40" y1="26" x2="40" y2="34" stroke="#6BAEE0" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
          <line x1="36" y1="30" x2="44" y2="30" stroke="#6BAEE0" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
        </g>
        {/* Floating thought dots */}
        <circle cx="56" cy="22" r="2.5" fill="white" opacity="0.7">
          <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="cy" values="22;18;22" dur="1.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="62" cy="16" r="2" fill="white" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.2s" begin="0.3s" repeatCount="indefinite" />
          <animate attributeName="cy" values="16;12;16" dur="1.2s" begin="0.3s" repeatCount="indefinite" />
        </circle>
        <circle cx="67" cy="11" r="1.5" fill="white" opacity="0.4">
          <animate attributeName="opacity" values="0.4;0.05;0.4" dur="1.2s" begin="0.6s" repeatCount="indefinite" />
          <animate attributeName="cy" values="11;7;11" dur="1.2s" begin="0.6s" repeatCount="indefinite" />
        </circle>
      </svg>
    ),
  },
  {
    label: 'Stirring up something good…',
    animation: (
      <svg viewBox="0 0 80 80" className="w-20 h-20" fill="none">
        {/* Pot */}
        <ellipse cx="40" cy="58" rx="24" ry="8" fill="#6BAEE0" opacity="0.3" />
        <path d="M16 42 Q16 68 40 68 Q64 68 64 42 Z" fill="#6BAEE0" />
        <rect x="14" y="38" width="52" height="8" rx="4" fill="#4d96d1" />
        {/* Handles */}
        <rect x="6" y="40" width="10" height="5" rx="2.5" fill="#4d96d1" />
        <rect x="64" y="40" width="10" height="5" rx="2.5" fill="#4d96d1" />
        {/* Bubbles */}
        <circle cx="30" cy="52" r="3" fill="white" opacity="0.4">
          <animate attributeName="cy" values="52;44;52" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="1s" repeatCount="indefinite" />
        </circle>
        <circle cx="50" cy="54" r="2.5" fill="white" opacity="0.4">
          <animate attributeName="cy" values="54;46;54" dur="1s" begin="0.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="1s" begin="0.4s" repeatCount="indefinite" />
        </circle>
        {/* Spoon */}
        <g>
          <animateTransform attributeName="transform" type="rotate" values="-20,40,45; 20,40,45; -20,40,45" dur="0.9s" repeatCount="indefinite" />
          <rect x="38" y="18" width="4" height="28" rx="2" fill="#FFB347" />
          <ellipse cx="40" cy="50" rx="5" ry="4" fill="#FFB347" />
        </g>
      </svg>
    ),
  },
];

export default function AiLoadingAnimation({ label }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % FRAMES.length), 2000);
    return () => clearInterval(id);
  }, []);

  const { animation, label: frameLabel } = FRAMES[frame];

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-5 animate-in fade-in duration-300">
      <div className="transition-all duration-500">
        {animation}
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-black text-slate-700">{label || frameLabel}</p>
        <div className="flex gap-1 justify-center">
          {FRAMES.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === frame ? 'bg-[#6BAEE0] w-4' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
