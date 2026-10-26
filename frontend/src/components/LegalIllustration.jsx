import React from 'react';

/**
 * LegalIllustration Component
 * ---------------------------
 * A custom, subtle vector graphic illustration tailored for Legal CaseBook.
 * Features the scales of justice, advocate case ledger, and trust badge
 * using the exact navy blue (#172B4D) and muted gold (#B99A5B) palette.
 */
export default function LegalIllustration() {
  return (
    <div className="illustration-wrapper" aria-hidden="true">
      <svg
        viewBox="0 0 520 340"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="legal-svg-canvas"
      >
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4BA7E" />
            <stop offset="100%" stopColor="#B99A5B" />
          </linearGradient>
          <linearGradient id="navyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E3864" />
            <stop offset="100%" stopColor="#172B4D" />
          </linearGradient>
          <linearGradient id="softBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F9FAFC" />
            <stop offset="100%" stopColor="#F0F3F7" />
          </linearGradient>
          <filter id="subtleDrop" x="-10%" y="-10%" width="125%" height="125%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#172B4D" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Background Decorative Base Platform */}
        <ellipse cx="260" cy="305" rx="210" ry="22" fill="#E8EDF5" opacity="0.7" />

        {/* Back Legal Dossier / Case Folder */}
        <g filter="url(#subtleDrop)">
          <rect x="90" y="90" width="230" height="190" rx="10" fill="#FFFFFF" stroke="#D9DEE7" strokeWidth="2" />
          <path d="M90 100 C90 94 95 90 101 90 L180 90 L198 106 L310 106 C316 106 320 110 320 116 L320 270 C320 276 316 280 310 280 L100 280 C94 280 90 276 90 270 Z" fill="#F8FAFC" />
          <line x1="120" y1="136" x2="210" y2="136" stroke="#B99A5B" strokeWidth="3" strokeLinecap="round" />
          <line x1="120" y1="160" x2="280" y2="160" stroke="#E2E7F0" strokeWidth="2" strokeLinecap="round" />
          <line x1="120" y1="180" x2="260" y2="180" stroke="#E2E7F0" strokeWidth="2" strokeLinecap="round" />
          <line x1="120" y1="200" x2="270" y2="200" stroke="#E2E7F0" strokeWidth="2" strokeLinecap="round" />
          <line x1="120" y1="220" x2="220" y2="220" stroke="#E2E7F0" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Main Case Book / Law Volume */}
        <g filter="url(#subtleDrop)">
          <rect x="220" y="115" width="200" height="175" rx="8" fill="url(#navyGradient)" stroke="#0F1E36" strokeWidth="1.5" />
          {/* Gold spine decorative band */}
          <rect x="220" y="115" width="22" height="175" rx="4" fill="#0D1A30" />
          <line x1="231" y1="130" x2="231" y2="275" stroke="#B99A5B" strokeWidth="1.5" strokeDasharray="4 3" />
          
          {/* Gold Seal on Book Cover */}
          <circle cx="325" cy="185" r="28" fill="none" stroke="url(#goldGradient)" strokeWidth="2" />
          <circle cx="325" cy="185" r="23" fill="#172B4D" stroke="url(#goldGradient)" strokeWidth="1" strokeDasharray="3 2" />
          <path d="M325 172 L327 178 L333 178 L328 182 L330 188 L325 184 L320 188 L322 182 L317 178 L323 178 Z" fill="url(#goldGradient)" />

          {/* Book Embossed Rule Lines */}
          <line x1="265" y1="230" x2="385" y2="230" stroke="#B99A5B" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <line x1="285" y1="242" x2="365" y2="242" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        </g>

        {/* Front Foreground: Scales of Justice in Muted Gold */}
        <g filter="url(#subtleDrop)">
          {/* Scales Base & Column */}
          <path d="M165 290 L215 290 L205 282 L175 282 Z" fill="url(#goldGradient)" />
          <rect x="187" y="145" width="6" height="140" rx="3" fill="url(#goldGradient)" />
          
          {/* Central Finial & Pivot */}
          <circle cx="190" cy="142" r="7" fill="url(#goldGradient)" />
          <circle cx="190" cy="142" r="3.5" fill="#FFFFFF" />

          {/* Balance Crossbeam */}
          <path d="M130 152 Q190 144 250 152" stroke="url(#goldGradient)" strokeWidth="3" fill="none" strokeLinecap="round" />

          {/* Left Pan and Strings */}
          <line x1="135" y1="152" x2="115" y2="195" stroke="#B99A5B" strokeWidth="1.2" />
          <line x1="135" y1="152" x2="155" y2="195" stroke="#B99A5B" strokeWidth="1.2" />
          <path d="M110 195 Q135 210 160 195 Z" fill="url(#goldGradient)" stroke="#9E8146" strokeWidth="1" />

          {/* Right Pan and Strings (perfectly balanced) */}
          <line x1="245" y1="152" x2="225" y2="195" stroke="#B99A5B" strokeWidth="1.2" />
          <line x1="245" y1="152" x2="265" y2="195" stroke="#B99A5B" strokeWidth="1.2" />
          <path d="M220 195 Q245 210 270 195 Z" fill="url(#goldGradient)" stroke="#9E8146" strokeWidth="1" />
        </g>

        {/* Security Shield & Check floating badge */}
        <g filter="url(#subtleDrop)">
          <circle cx="410" cy="95" r="26" fill="#FFFFFF" stroke="#D9DEE7" strokeWidth="2" />
          <path d="M410 82 C415 82 423 85 423 89 C423 103 415 110 410 113 C405 110 397 103 397 89 C397 85 405 82 410 82 Z" fill="#172B4D" />
          <path d="M405 97 L409 101 L416 93" stroke="#B99A5B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}
