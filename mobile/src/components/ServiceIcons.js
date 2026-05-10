// mobile/src/components/ServiceIcons.js
// ── Custom SVG service icons — drop-in for HomeScreen service row ─────────────
import React from 'react';
import Svg, {
  Path, Circle, Rect, Line, Ellipse, G, Defs, LinearGradient, Stop,
} from 'react-native-svg';

const SIZE = 52;

// ─────────────────────────────────────────────────────────────────────────────
// 1. RIDES — redesigned clean dark-palette car
// ─────────────────────────────────────────────────────────────────────────────
export const RidesIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* ── Road ── */}
    <Rect x="8" y="84" width="104" height="16" rx="5" fill="#1A1A1A" />
    {/* Road centre dashes */}
    <Rect x="18" y="90" width="14" height="3" rx="1.5" fill="#3A3A3C" />
    <Rect x="42" y="90" width="14" height="3" rx="1.5" fill="#3A3A3C" />
    <Rect x="66" y="90" width="14" height="3" rx="1.5" fill="#3A3A3C" />
    <Rect x="90" y="90" width="12" height="3" rx="1.5" fill="#3A3A3C" />

    {/* ── Ground shadow ── */}
    <Ellipse cx="60" cy="85" rx="40" ry="4" fill="#000000" opacity="0.20" />

    {/* ── Car body ── */}
    <Rect x="14" y="60" width="92" height="26" rx="7" fill="#1C1C1E" />

    {/* ── Roof / cabin ── */}
    <Path
      d="M36 60 Q40 42 52 40 L68 40 Q80 42 84 60 Z"
      fill="#2C2C2E"
    />

    {/* ── Windshield (front) ── */}
    <Path
      d="M68 40 Q79 43 83 60 L70 60 Z"
      fill="#4A9FFF"
      opacity="0.50"
    />
    {/* ── Windshield (rear) ── */}
    <Path
      d="M52 40 Q41 43 37 60 L50 60 Z"
      fill="#4A9FFF"
      opacity="0.50"
    />
    {/* ── Windshield (centre top) ── */}
    <Path
      d="M52 40 L68 40 L70 60 L50 60 Z"
      fill="#4A9FFF"
      opacity="0.38"
    />

    {/* ── B-pillar dividers ── */}
    <Rect x="49" y="42" width="2.5" height="18" rx="1" fill="#111111" />
    <Rect x="68.5" y="42" width="2.5" height="18" rx="1" fill="#111111" />

    {/* ── Door seam ── */}
    <Line x1="60" y1="60" x2="60" y2="72" stroke="#111111" strokeWidth="1.5" />

    {/* ── Green ground-effect strip ── */}
    <Rect x="14" y="72" width="92" height="4" rx="1" fill="#34C759" opacity="0.80" />

    {/* ── Headlight (front / left in view) ── */}
    <Rect x="14" y="61" width="9" height="6" rx="3" fill="#FF3B30" />
    <Rect x="15" y="62" width="7" height="4" rx="2" fill="#FF7060" opacity="0.70" />

    {/* ── Tail-light ── */}
    <Rect x="97" y="61" width="9" height="6" rx="3" fill="#FFE066" />
    <Rect x="98" y="62" width="7" height="4" rx="2" fill="#FFFFFF" opacity="0.55" />

    {/* ── Rear wheel ── */}
    <Circle cx="82" cy="85" r="11" fill="#111111" />
    <Circle cx="82" cy="85" r="7"  fill="#2C2C2E" />
    <Circle cx="82" cy="85" r="3.5" fill="#444444" />
    <Circle cx="82" cy="85" r="1.5" fill="#666666" />
    {/* Wheel arch */}
    <Path d="M68 72 Q82 68 96 75" stroke="#111111" strokeWidth="3.5" fill="none" />

    {/* ── Front wheel ── */}
    <Circle cx="38" cy="85" r="11" fill="#111111" />
    <Circle cx="38" cy="85" r="7"  fill="#2C2C2E" />
    <Circle cx="38" cy="85" r="3.5" fill="#444444" />
    <Circle cx="38" cy="85" r="1.5" fill="#666666" />
    {/* Wheel arch */}
    <Path d="M24 75 Q38 68 52 72" stroke="#111111" strokeWidth="3.5" fill="none" />

    {/* ── Speed lines (left side) ── */}
    <Line x1="5"  y1="53" x2="22" y2="53" stroke="#34C759" strokeWidth="2"   strokeLinecap="round" opacity="0.75" />
    <Line x1="4"  y1="59" x2="16" y2="59" stroke="#34C759" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
    <Line x1="5"  y1="65" x2="15" y2="65" stroke="#34C759" strokeWidth="1"   strokeLinecap="round" opacity="0.25" />

    {/* ── Roof sparkle / star ── */}
    <Circle cx="104" cy="38" r="2.5" fill="#34C759" opacity="0.55" />
    <Circle cx="110" cy="48" r="1.5" fill="#34C759" opacity="0.30" />
    <Circle cx="106" cy="30" r="1.2" fill="#FFD166" opacity="0.50" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. SEND — isometric package box with location pin
// ─────────────────────────────────────────────────────────────────────────────
export const SendIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Box shadow */}
    <Ellipse cx="60" cy="96" rx="32" ry="5" fill="#000000" opacity="0.15" />

    {/* Box — right face */}
    <Path d="M22 72 L60 84 L98 72 L98 56 L60 68 L22 56 Z" fill="#B85C20" />
    {/* Box — top face */}
    <Path d="M22 56 L60 44 L98 56 L60 68 Z" fill="#E07030" />
    {/* Box — left face */}
    <Path d="M22 56 L22 72 L60 84 L60 68 Z" fill="#C46425" />

    {/* Tape strips */}
    <Path d="M60 68 L60 84 L66 82 L66 66 Z" fill="#FF9A3C" opacity="0.6" />
    <Path d="M60 68 L60 84 L54 82 L54 66 Z" fill="#D4692A" opacity="0.5" />
    <Path d="M22 56 L60 44 L66 46 L28 58 Z" fill="#FF9A3C" opacity="0.55" />
    <Path d="M60 44 L98 56 L92 58 L54 46 Z" fill="#D4692A" opacity="0.4" />

    {/* Bow */}
    <Ellipse cx="60" cy="43" rx="5" ry="4" fill="#FF6B00" opacity="0.9" />
    <Path d="M55 43 Q48 36 52 32 Q56 38 55 43" fill="#FF8C30" opacity="0.85" />
    <Path d="M65 43 Q72 36 68 32 Q64 38 65 43" fill="#FF8C30" opacity="0.85" />
    <Circle cx="60" cy="43" r="3" fill="#FFB060" />

    {/* Location pin */}
    <Circle cx="96" cy="32" r="13" fill="#34C759" opacity="0.15" />
    <Path d="M96 18 C89 18 84 23 84 29 C84 36 96 46 96 46 C96 46 108 36 108 29 C108 23 103 18 96 18 Z" fill="#34C759" />
    <Circle cx="96" cy="29" r="4" fill="#FFFFFF" />

    {/* Sparks */}
    <Line x1="6"  y1="58" x2="18" y2="58" stroke="#E07030" strokeWidth="2"   strokeLinecap="round" opacity="0.6" />
    <Line x1="8"  y1="65" x2="17" y2="65" stroke="#E07030" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    <Line x1="10" y1="72" x2="18" y2="72" stroke="#E07030" strokeWidth="1"   strokeLinecap="round" opacity="0.25" />
    <Circle cx="16"  cy="30" r="1.5" fill="#FFD166" opacity="0.7" />
    <Circle cx="108" cy="56" r="1.5" fill="#FFD166" opacity="0.5" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. DRIVERS — radar rings with mini driver avatars
// ─────────────────────────────────────────────────────────────────────────────
export const DriversIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Radar rings */}
    <Circle cx="60" cy="62" r="46" fill="none" stroke="#34C759" strokeWidth="0.8" opacity="0.15" />
    <Circle cx="60" cy="62" r="34" fill="none" stroke="#34C759" strokeWidth="0.8" opacity="0.22" />
    <Circle cx="60" cy="62" r="22" fill="none" stroke="#34C759" strokeWidth="1"   opacity="0.30" />

    {/* Radar sweep wedge */}
    <Path d="M60 62 L60 28 A34 34 0 0 1 89 45 Z" fill="#34C759" opacity="0.08" />

    {/* Centre dot */}
    <Circle cx="60" cy="62" r="8"   fill="#34C759" opacity="0.18" />
    <Circle cx="60" cy="62" r="4.5" fill="#34C759" />
    <Circle cx="60" cy="62" r="2"   fill="#FFFFFF" />

    {/* Avatar 1 — top-left */}
    <Circle cx="34" cy="42" r="11" fill="none" stroke="#34C759" strokeWidth="0.8" opacity="0.3" />
    <Circle cx="34" cy="42" r="7"  fill="#1C1C1E" stroke="#34C759" strokeWidth="1.5" />
    <Circle cx="34" cy="39" r="2.5" fill="#888888" />
    <Path d="M29 48 Q29 44 34 44 Q39 44 39 48" fill="#666666" />
    <Rect x="26" y="50" width="16" height="7" rx="2" fill="#2C2C2E" />
    <Rect x="28" y="47" width="12" height="5" rx="2" fill="#3A3A3C" />
    <Circle cx="29" cy="58" r="2" fill="#111111" />
    <Circle cx="39" cy="58" r="2" fill="#111111" />
    <Rect x="26" y="52" width="16" height="1.5" fill="#34C759" opacity="0.7" />

    {/* Avatar 2 — top-right */}
    <Circle cx="88" cy="38" r="11" fill="none" stroke="#34C759" strokeWidth="0.8" opacity="0.3" />
    <Circle cx="88" cy="38" r="7"  fill="#1C1C1E" stroke="#34C759" strokeWidth="1.5" />
    <Circle cx="88" cy="35" r="2.5" fill="#888888" />
    <Path d="M83 44 Q83 40 88 40 Q93 40 93 44" fill="#666666" />
    <Rect x="80" y="46" width="16" height="7" rx="2" fill="#2C2C2E" />
    <Rect x="82" y="43" width="12" height="5" rx="2" fill="#3A3A3C" />
    <Circle cx="83" cy="54" r="2" fill="#111111" />
    <Circle cx="93" cy="54" r="2" fill="#111111" />
    <Rect x="80" y="48" width="16" height="1.5" fill="#34C759" opacity="0.7" />

    {/* Avatar 3 — bottom-right */}
    <Circle cx="86" cy="82" r="6"  fill="#1C1C1E" stroke="#FFD166" strokeWidth="1.5" />
    <Circle cx="86" cy="79.5" r="2" fill="#888888" />
    <Path d="M82 87 Q82 83 86 83 Q90 83 90 87" fill="#666666" />
    <Rect x="79" y="88" width="14" height="6" rx="2" fill="#2C2C2E" />
    <Rect x="81" y="85" width="10" height="4" rx="2" fill="#3A3A3C" />
    <Circle cx="81" cy="95" r="1.8" fill="#111111" />
    <Circle cx="91" cy="95" r="1.8" fill="#111111" />
    <Rect x="79" y="90" width="14" height="1.5" fill="#FFD166" opacity="0.7" />

    {/* Connection lines */}
    <Line x1="40" y1="54" x2="55" y2="61" stroke="#34C759" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.4" />
    <Line x1="82" y1="50" x2="65" y2="61" stroke="#34C759" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.4" />
    <Line x1="81" y1="86" x2="65" y2="65" stroke="#FFD166" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.35" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. SUPPORT — headset with speech bubble & pulse rings
// ─────────────────────────────────────────────────────────────────────────────
export const SupportIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Outer pulse rings */}
    <Circle cx="60" cy="60" r="50" fill="none" stroke="#34C759" strokeWidth="0.8" opacity="0.10" />
    <Circle cx="60" cy="60" r="40" fill="none" stroke="#34C759" strokeWidth="0.8" opacity="0.15" />

    {/* Headset band */}
    <Path d="M28 60 C28 40 40 24 60 24 C80 24 92 40 92 60" stroke="#4A4A4E" strokeWidth="6" fill="none" strokeLinecap="round" />
    <Path d="M34 58 C34 42 44 30 60 30 C76 30 86 42 86 58" stroke="#636366" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />

    {/* Left ear cup */}
    <Rect x="18" y="54" width="18" height="26" rx="9" fill="#2C2C2E" />
    <Rect x="21" y="58" width="12" height="18" rx="6" fill="#34C759" opacity="0.85" />
    <Rect x="23" y="62" width="8"  height="10" rx="4" fill="#111111" opacity="0.6" />

    {/* Right ear cup */}
    <Rect x="84" y="54" width="18" height="26" rx="9" fill="#2C2C2E" />
    <Rect x="87" y="58" width="12" height="18" rx="6" fill="#34C759" opacity="0.85" />
    <Rect x="89" y="62" width="8"  height="10" rx="4" fill="#111111" opacity="0.6" />

    {/* Mic boom */}
    <Path d="M84 75 Q96 80 96 90" stroke="#4A4A4E" strokeWidth="4" fill="none" strokeLinecap="round" />
    <Circle cx="96" cy="92" r="5" fill="#2C2C2E" />
    <Circle cx="96" cy="92" r="3" fill="#34C759" opacity="0.8" />

    {/* Speech bubble */}
    <Rect x="40" y="70" width="36" height="24" rx="8" fill="#1C1C1E" stroke="#34C759" strokeWidth="1.2" />
    <Path d="M52 94 L48 102 L58 94 Z" fill="#1C1C1E" />
    <Path d="M51 94 L48 102 L57 94"  stroke="#34C759" strokeWidth="1.2" fill="none" />

    {/* Typing dots */}
    <Circle cx="50" cy="82" r="2.5" fill="#34C759" />
    <Circle cx="58" cy="82" r="2.5" fill="#34C759" opacity="0.6" />
    <Circle cx="66" cy="82" r="2.5" fill="#34C759" opacity="0.3" />

    {/* Signal dots */}
    <Circle cx="97"  cy="20" r="3"   fill="#34C759" opacity="0.60" />
    <Circle cx="106" cy="28" r="2"   fill="#34C759" opacity="0.35" />
    <Circle cx="103" cy="16" r="1.5" fill="#34C759" opacity="0.25" />
  </Svg>
);