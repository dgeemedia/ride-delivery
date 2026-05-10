// mobile/src/components/DriverIcons.js
// ── Custom SVG icons for Driver Dashboard quick actions ───────────────────────
import React from 'react';
import Svg, {
  Path, Circle, Rect, Line, Ellipse, Polygon, G, Text,  // ← Text added
} from 'react-native-svg';

const SIZE = 52;

// ─────────────────────────────────────────────────────────────────────────────
// 1. EARNINGS — wallet with coin stack & upward trend arrow
// ─────────────────────────────────────────────────────────────────────────────
export const EarningsIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Wallet body */}
    <Rect x="14" y="38" width="72" height="52" rx="12" fill="#1C1C1E" />
    <Rect x="14" y="38" width="72" height="18" rx="12" fill="#2C2C2E" />
    <Rect x="14" y="46" width="72" height="10" fill="#2C2C2E" />

    {/* Wallet clasp / pocket */}
    <Rect x="72" y="52" width="18" height="24" rx="9" fill="#2A2A2C" stroke="#3A3A3C" strokeWidth="1" />
    <Circle cx="81" cy="64" r="5" fill="#FFB800" opacity="0.9" />
    <Circle cx="81" cy="64" r="2.5" fill="#1C1C1E" />

    {/* Card slot lines */}
    <Rect x="22" y="62" width="40" height="2.5" rx="1.2" fill="#3A3A3C" />
    <Rect x="22" y="70" width="30" height="2.5" rx="1.2" fill="#3A3A3C" />

    {/* Naira symbol on wallet */}
    <Rect x="22" y="78" width="18" height="2" rx="1" fill="#5DAA72" opacity="0.6" />
    <Rect x="22" y="82" width="18" height="2" rx="1" fill="#5DAA72" opacity="0.4" />
    <Line x1="28" y1="74" x2="28" y2="88" stroke="#5DAA72" strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="35" y1="74" x2="35" y2="88" stroke="#5DAA72" strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M24 76 Q31.5 70 39 76" stroke="#5DAA72" strokeWidth="2" fill="none" strokeLinecap="round" />

    {/* Trend arrow — top right */}
    <Circle cx="94" cy="36" r="18" fill="#5DAA72" opacity="0.12" />
    <Circle cx="94" cy="36" r="13" fill="#1C1C1E" stroke="#5DAA72" strokeWidth="1.2" />
    <Path d="M87 41 L91 35 L94 38 L99 30" stroke="#5DAA72" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Polygon points="98,28 102,30 99,33" fill="#5DAA72" />

    {/* Coins stack bottom-left */}
    <Ellipse cx="32" cy="106" rx="12" ry="4" fill="#FFB800" opacity="0.7" />
    <Rect x="20" y="100" width="24" height="6" rx="1" fill="#FFB800" opacity="0.5" />
    <Ellipse cx="32" cy="100" rx="12" ry="4" fill="#FFB800" opacity="0.8" />
    <Ellipse cx="32" cy="96" rx="12" ry="4" fill="#FFD166" />

    {/* ✅ Text imported from react-native-svg — no longer crashes */}
    <Text fill="#1C1C1E" fontSize="6" fontWeight="bold" x="29" y="98.5">₦</Text>

    {/* Sparkle dots */}
    <Circle cx="104" cy="56" r="2" fill="#5DAA72" opacity="0.5" />
    <Circle cx="108" cy="48" r="1.2" fill="#5DAA72" opacity="0.3" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. RIDE HISTORY — car silhouette with clock overlay & trail
// ─────────────────────────────────────────────────────────────────────────────
export const RideHistoryIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Road strip */}
    <Rect x="10" y="80" width="100" height="16" rx="5" fill="#1A1A1A" />
    <Rect x="22" y="86" width="12" height="2.5" rx="1.2" fill="#3A3A3C" />
    <Rect x="44" y="86" width="12" height="2.5" rx="1.2" fill="#3A3A3C" />
    <Rect x="66" y="86" width="12" height="2.5" rx="1.2" fill="#3A3A3C" />

    {/* Car body */}
    <Rect x="18" y="60" width="84" height="20" rx="5" fill="#2C2C2E" />
    {/* Roof */}
    <Path d="M36 60 Q40 44 50 42 L70 42 Q80 44 84 60 Z" fill="#3A3A3C" />
    {/* Windshield */}
    <Path d="M50 42 L70 42 L72 60 L48 60 Z" fill="#4A9FFF" opacity="0.35" />
    {/* Green underline */}
    <Rect x="18" y="67" width="84" height="3.5" fill="#34C759" opacity="0.7" />
    {/* Headlight */}
    <Rect x="18" y="61" width="6" height="5" rx="2" fill="#FF3B30" />
    {/* Taillight */}
    <Rect x="96" y="61" width="6" height="5" rx="2" fill="#FFD166" />

    {/* Wheels */}
    <Circle cx="78" cy="81" r="9" fill="#111" />
    <Circle cx="78" cy="81" r="5.5" fill="#2C2C2E" />
    <Circle cx="78" cy="81" r="2.5" fill="#444" />
    <Circle cx="40" cy="81" r="9" fill="#111" />
    <Circle cx="40" cy="81" r="5.5" fill="#2C2C2E" />
    <Circle cx="40" cy="81" r="2.5" fill="#444" />

    {/* Speed / history trail lines (fading left) */}
    <Line x1="6" y1="54" x2="22" y2="54" stroke="#34C759" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    <Line x1="4" y1="60" x2="16" y2="60" stroke="#34C759" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
    <Line x1="6" y1="66" x2="16" y2="66" stroke="#34C759" strokeWidth="1" strokeLinecap="round" opacity="0.25" />

    {/* Clock badge — top right */}
    <Circle cx="92" cy="34" r="18" fill="#A78BFA" opacity="0.10" />
    <Circle cx="92" cy="34" r="13" fill="#1C1C1E" stroke="#A78BFA" strokeWidth="1.5" />
    {/* Clock tick marks */}
    <Line x1="92" y1="23" x2="92" y2="26" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="92" y1="42" x2="92" y2="45" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="81" y1="34" x2="84" y2="34" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="100" y1="34" x2="103" y2="34" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
    {/* Clock hands */}
    <Line x1="92" y1="34" x2="92" y2="26" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    <Line x1="92" y1="34" x2="98" y2="37" stroke="#A78BFA" strokeWidth="1.8" strokeLinecap="round" />
    <Circle cx="92" cy="34" r="2" fill="#A78BFA" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. FLOOR PRICE — bar chart rising + price tag badge
// ─────────────────────────────────────────────────────────────────────────────
export const FloorPriceIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Chart base line */}
    <Rect x="18" y="86" width="72" height="2.5" rx="1.2" fill="#3A3A3C" />

    {/* Rising bars */}
    <Rect x="22" y="74" width="12" height="12" rx="3" fill="#A78BFA" opacity="0.4" />
    <Rect x="40" y="62" width="12" height="24" rx="3" fill="#A78BFA" opacity="0.6" />
    <Rect x="58" y="50" width="12" height="36" rx="3" fill="#A78BFA" opacity="0.8" />
    <Rect x="76" y="38" width="12" height="48" rx="3" fill="#A78BFA" />

    {/* Trend line over bars */}
    <Path d="M28 76 L46 64 L64 52 L82 40" stroke="#FFD166" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,2" />
    <Circle cx="28" cy="76" r="2.5" fill="#FFD166" />
    <Circle cx="46" cy="64" r="2.5" fill="#FFD166" />
    <Circle cx="64" cy="52" r="2.5" fill="#FFD166" />
    <Circle cx="82" cy="40" r="2.5" fill="#FFD166" />

    {/* Arrow up — top right */}
    <Circle cx="100" cy="30" r="14" fill="#A78BFA" opacity="0.15" />
    <Path d="M100 38 L100 22" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M94 28 L100 22 L106 28" stroke="#A78BFA" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

    {/* Price tag badge — bottom left */}
    <Rect x="12" y="95" width="38" height="18" rx="6" fill="#1C1C1E" stroke="#FFD166" strokeWidth="1.2" />
    <Circle cx="20" cy="104" r="2.5" fill="#FFD166" />
    <Rect x="25" y="101" width="18" height="2.5" rx="1.2" fill="#FFD166" opacity="0.8" />
    <Rect x="25" y="106" width="12" height="2" rx="1" fill="#FFD166" opacity="0.4" />

    {/* Min label */}
    <Rect x="18" y="24" width="22" height="10" rx="4" fill="#1C1C1E" stroke="#A78BFA" strokeWidth="1" />
    <Rect x="21" y="27" width="16" height="4" rx="1.5" fill="#A78BFA" opacity="0.5" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. DOCUMENTS — driver's license card + shield tick
// ─────────────────────────────────────────────────────────────────────────────
export const DocumentsIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Card shadow */}
    <Rect x="16" y="36" width="80" height="52" rx="10" fill="#111" opacity="0.3" />

    {/* Main card */}
    <Rect x="14" y="32" width="80" height="52" rx="10" fill="#1C1C1E" />
    {/* Card top stripe */}
    <Rect x="14" y="32" width="80" height="16" rx="10" fill="#2C2C2E" />
    <Rect x="14" y="40" width="80" height="8" fill="#2C2C2E" />

    {/* Mag stripe */}
    <Rect x="14" y="52" width="80" height="8" fill="#222" />
    <Rect x="16" y="53" width="76" height="6" fill="#1A1A1A" />

    {/* Photo placeholder */}
    <Rect x="20" y="64" width="22" height="16" rx="4" fill="#2C2C2E" />
    <Circle cx="31" cy="69" r="4" fill="#555" />
    <Path d="M23 80 Q23 75 31 75 Q39 75 39 80" fill="#444" />

    {/* Info lines */}
    <Rect x="48" y="64" width="38" height="3" rx="1.5" fill="#3A3A3C" />
    <Rect x="48" y="71" width="28" height="2.5" rx="1.2" fill="#2C2C2E" />
    <Rect x="48" y="77" width="22" height="2.5" rx="1.2" fill="#2C2C2E" />

    {/* Chip */}
    <Rect x="56" y="36" width="16" height="12" rx="3" fill="#4A9FFF" opacity="0.25" />
    <Rect x="58" y="38" width="12" height="8" rx="2" fill="#4A9FFF" opacity="0.4" />
    <Line x1="62" y1="38" x2="62" y2="46" stroke="#4A9FFF" strokeWidth="1" opacity="0.6" />
    <Line x1="66" y1="38" x2="66" y2="46" stroke="#4A9FFF" strokeWidth="1" opacity="0.6" />
    <Line x1="58" y1="42" x2="70" y2="42" stroke="#4A9FFF" strokeWidth="1" opacity="0.6" />

    {/* Shield badge — bottom right */}
    <Circle cx="88" cy="90" r="16" fill="#5DAA72" opacity="0.12" />
    <Path
      d="M88 76 C83 76 78 79 78 84 C78 90 88 98 88 98 C88 98 98 90 98 84 C98 79 93 76 88 76 Z"
      fill="#5DAA72"
    />
    {/* Tick in shield */}
    <Path d="M83 87 L86.5 91 L93 83" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

    {/* Corner dots decoration */}
    <Circle cx="16" cy="32" r="1.5" fill="#4E8DBD" opacity="0.5" />
    <Circle cx="94" cy="32" r="1.5" fill="#4E8DBD" opacity="0.5" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. SUPPORT — re-export from ServiceIcons for driver use
// ─────────────────────────────────────────────────────────────────────────────
export { SupportIcon } from './ServiceIcons';