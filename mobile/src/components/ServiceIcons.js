// mobile/src/components/ServiceIcons.js
// ── Custom SVG service icons + Auth screen hero illustrations ─────────────────
import React from 'react';
import Svg, {
  Path, Circle, Rect, Line, Ellipse, G, Defs, ClipPath, Text as SvgText,
} from 'react-native-svg';

const SIZE = 52;

// ─────────────────────────────────────────────────────────────────────────────
// 1. RIDES — redesigned clean dark-palette car
// ─────────────────────────────────────────────────────────────────────────────
export const RidesIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* ── Road ── */}
    <Rect x="8" y="84" width="104" height="16" rx="5" fill="#1A1A1A" />
    <Rect x="18" y="90" width="14" height="3" rx="1.5" fill="#3A3A3C" />
    <Rect x="42" y="90" width="14" height="3" rx="1.5" fill="#3A3A3C" />
    <Rect x="66" y="90" width="14" height="3" rx="1.5" fill="#3A3A3C" />
    <Rect x="90" y="90" width="12" height="3" rx="1.5" fill="#3A3A3C" />

    <Ellipse cx="60" cy="85" rx="40" ry="4" fill="#000000" opacity="0.20" />

    {/* ── Car body ── */}
    <Rect x="14" y="60" width="92" height="26" rx="7" fill="#1C1C1E" />

    {/* ── Roof / cabin ── */}
    <Path d="M36 60 Q40 42 52 40 L68 40 Q80 42 84 60 Z" fill="#2C2C2E" />

    {/* ── Windshields ── */}
    <Path d="M68 40 Q79 43 83 60 L70 60 Z" fill="#4A9FFF" opacity="0.50" />
    <Path d="M52 40 Q41 43 37 60 L50 60 Z" fill="#4A9FFF" opacity="0.50" />
    <Path d="M52 40 L68 40 L70 60 L50 60 Z" fill="#4A9FFF" opacity="0.38" />

    <Rect x="49" y="42" width="2.5" height="18" rx="1" fill="#111111" />
    <Rect x="68.5" y="42" width="2.5" height="18" rx="1" fill="#111111" />
    <Line x1="60" y1="60" x2="60" y2="72" stroke="#111111" strokeWidth="1.5" />
    <Rect x="14" y="72" width="92" height="4" rx="1" fill="#34C759" opacity="0.80" />

    {/* ── Lights ── */}
    <Rect x="14" y="61" width="9" height="6" rx="3" fill="#FF3B30" />
    <Rect x="15" y="62" width="7" height="4" rx="2" fill="#FF7060" opacity="0.70" />
    <Rect x="97" y="61" width="9" height="6" rx="3" fill="#FFE066" />
    <Rect x="98" y="62" width="7" height="4" rx="2" fill="#FFFFFF" opacity="0.55" />

    {/* ── Rear wheel ── */}
    <Circle cx="82" cy="85" r="11" fill="#111111" />
    <Circle cx="82" cy="85" r="7"  fill="#2C2C2E" />
    <Circle cx="82" cy="85" r="3.5" fill="#444444" />
    <Circle cx="82" cy="85" r="1.5" fill="#666666" />
    <Path d="M68 72 Q82 68 96 75" stroke="#111111" strokeWidth="3.5" fill="none" />

    {/* ── Front wheel ── */}
    <Circle cx="38" cy="85" r="11" fill="#111111" />
    <Circle cx="38" cy="85" r="7"  fill="#2C2C2E" />
    <Circle cx="38" cy="85" r="3.5" fill="#444444" />
    <Circle cx="38" cy="85" r="1.5" fill="#666666" />
    <Path d="M24 75 Q38 68 52 72" stroke="#111111" strokeWidth="3.5" fill="none" />

    {/* ── Speed lines ── */}
    <Line x1="5"  y1="53" x2="22" y2="53" stroke="#34C759" strokeWidth="2"   strokeLinecap="round" opacity="0.75" />
    <Line x1="4"  y1="59" x2="16" y2="59" stroke="#34C759" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
    <Line x1="5"  y1="65" x2="15" y2="65" stroke="#34C759" strokeWidth="1"   strokeLinecap="round" opacity="0.25" />

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
    <Ellipse cx="60" cy="96" rx="32" ry="5" fill="#000000" opacity="0.15" />

    {/* Box faces */}
    <Path d="M22 72 L60 84 L98 72 L98 56 L60 68 L22 56 Z" fill="#B85C20" />
    <Path d="M22 56 L60 44 L98 56 L60 68 Z" fill="#E07030" />
    <Path d="M22 56 L22 72 L60 84 L60 68 Z" fill="#C46425" />

    {/* Tape */}
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
    <Path d="M60 62 L60 28 A34 34 0 0 1 89 45 Z" fill="#34C759" opacity="0.08" />

    <Circle cx="60" cy="62" r="8"   fill="#34C759" opacity="0.18" />
    <Circle cx="60" cy="62" r="4.5" fill="#34C759" />
    <Circle cx="60" cy="62" r="2"   fill="#FFFFFF" />

    {/* Avatar 1 */}
    <Circle cx="34" cy="42" r="7"  fill="#1C1C1E" stroke="#34C759" strokeWidth="1.5" />
    <Circle cx="34" cy="39" r="2.5" fill="#888888" />
    <Path d="M29 48 Q29 44 34 44 Q39 44 39 48" fill="#666666" />
    <Rect x="26" y="50" width="16" height="7" rx="2" fill="#2C2C2E" />
    <Rect x="28" y="47" width="12" height="5" rx="2" fill="#3A3A3C" />
    <Circle cx="29" cy="58" r="2" fill="#111111" />
    <Circle cx="39" cy="58" r="2" fill="#111111" />
    <Rect x="26" y="52" width="16" height="1.5" fill="#34C759" opacity="0.7" />

    {/* Avatar 2 */}
    <Circle cx="88" cy="38" r="7"  fill="#1C1C1E" stroke="#34C759" strokeWidth="1.5" />
    <Circle cx="88" cy="35" r="2.5" fill="#888888" />
    <Path d="M83 44 Q83 40 88 40 Q93 40 93 44" fill="#666666" />
    <Rect x="80" y="46" width="16" height="7" rx="2" fill="#2C2C2E" />
    <Rect x="82" y="43" width="12" height="5" rx="2" fill="#3A3A3C" />
    <Circle cx="83" cy="54" r="2" fill="#111111" />
    <Circle cx="93" cy="54" r="2" fill="#111111" />
    <Rect x="80" y="48" width="16" height="1.5" fill="#34C759" opacity="0.7" />

    {/* Avatar 3 */}
    <Circle cx="86" cy="82" r="6"  fill="#1C1C1E" stroke="#FFD166" strokeWidth="1.5" />
    <Circle cx="86" cy="79.5" r="2" fill="#888888" />
    <Path d="M82 87 Q82 83 86 83 Q90 83 90 87" fill="#666666" />
    <Rect x="79" y="88" width="14" height="6" rx="2" fill="#2C2C2E" />
    <Rect x="81" y="85" width="10" height="4" rx="2" fill="#3A3A3C" />
    <Circle cx="81" cy="95" r="1.8" fill="#111111" />
    <Circle cx="91" cy="95" r="1.8" fill="#111111" />
    <Rect x="79" y="90" width="14" height="1.5" fill="#FFD166" opacity="0.7" />

    <Line x1="40" y1="54" x2="55" y2="61" stroke="#34C759" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.4" />
    <Line x1="82" y1="50" x2="65" y2="61" stroke="#34C759" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.4" />
    <Line x1="81" y1="86" x2="65" y2="65" stroke="#FFD166" strokeWidth="0.8" strokeDasharray="3,2" opacity="0.35" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. COURIERS — bicycle courier with speed lines and location pulse
// ─────────────────────────────────────────────────────────────────────────────
export const CouriersIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Ground shadow */}
    <Ellipse cx="60" cy="104" rx="38" ry="5" fill="#000000" opacity="0.12" />

    {/* ── Rear wheel ── */}
    <Circle cx="30" cy="88" r="20" fill="none" stroke="#2EBFA5" strokeWidth="4" />
    <Circle cx="30" cy="88" r="13" fill="none" stroke="#2EBFA5" strokeWidth="1.5" opacity="0.35" />
    <Circle cx="30" cy="88" r="4"  fill="#2EBFA5" opacity="0.7" />
    <Line x1="30" y1="68" x2="30" y2="88" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="30" y1="88" x2="30" y2="108" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="10" y1="88" x2="30" y2="88" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="30" y1="88" x2="50" y2="88" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="16" y1="74" x2="30" y2="88" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="30" y1="88" x2="44" y2="102" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="44" y1="74" x2="30" y2="88" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="30" y1="88" x2="16" y2="102" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />

    {/* ── Front wheel ── */}
    <Circle cx="90" cy="88" r="20" fill="none" stroke="#2EBFA5" strokeWidth="4" />
    <Circle cx="90" cy="88" r="13" fill="none" stroke="#2EBFA5" strokeWidth="1.5" opacity="0.35" />
    <Circle cx="90" cy="88" r="4"  fill="#2EBFA5" opacity="0.7" />
    <Line x1="90" y1="68" x2="90" y2="88" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="90" y1="88" x2="90" y2="108" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="70" y1="88" x2="90" y2="88" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="90" y1="88" x2="110" y2="88" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="76" y1="74" x2="90" y2="88" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="90" y1="88" x2="104" y2="102" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="104" y1="74" x2="90" y2="88" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />
    <Line x1="90" y1="88" x2="76" y2="102" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.5" />

    {/* ── Frame ── */}
    <Line x1="52" y1="64" x2="52" y2="88" stroke="#1C1C1E" strokeWidth="5" strokeLinecap="round" />
    <Rect x="44" y="62" width="16" height="5" rx="2.5" fill="#2C2C2E" />
    <Line x1="52" y1="68" x2="84" y2="68" stroke="#1C1C1E" strokeWidth="4.5" strokeLinecap="round" />
    <Line x1="84" y1="68" x2="52" y2="88" stroke="#1C1C1E" strokeWidth="4.5" strokeLinecap="round" />
    <Line x1="52" y1="88" x2="30" y2="88" stroke="#1C1C1E" strokeWidth="4" strokeLinecap="round" />
    <Line x1="30" y1="88" x2="52" y2="68" stroke="#1C1C1E" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    <Line x1="84" y1="68" x2="90" y2="88" stroke="#1C1C1E" strokeWidth="4.5" strokeLinecap="round" />
    <Line x1="84" y1="68" x2="84" y2="58" stroke="#1C1C1E" strokeWidth="4" strokeLinecap="round" />
    <Line x1="78" y1="58" x2="90" y2="58" stroke="#1C1C1E" strokeWidth="3.5" strokeLinecap="round" />

    {/* ── Rider body ── */}
    <Path d="M52 67 Q60 52 74 50" stroke="#2C2C2E" strokeWidth="8" strokeLinecap="round" fill="none" />
    <Line x1="74" y1="50" x2="83" y2="58" stroke="#2C2C2E" strokeWidth="5" strokeLinecap="round" />
    <Circle cx="68" cy="44" r="10" fill="#1C1C1E" />
    <Path d="M60 44 Q60 34 68 32 Q76 34 76 44" fill="#2EBFA5" opacity="0.85" />
    <Path d="M62 44 Q68 46 74 44" stroke="#FFFFFF" strokeWidth="1.5" fill="none" opacity="0.6" />

    {/* ── Delivery bag ── */}
    <Rect x="40" y="56" width="14" height="12" rx="3" fill="#2C2C2E" />
    <Rect x="42" y="58" width="10" height="8" rx="2" fill="#3A3A3C" />
    <Line x1="47" y1="56" x2="52" y2="67" stroke="#444444" strokeWidth="2" strokeLinecap="round" />
    <Circle cx="47" cy="62" r="2.5" fill="#2EBFA5" opacity="0.8" />

    {/* ── Pedals ── */}
    <Circle cx="52" cy="88" r="5" fill="#2C2C2E" stroke="#2EBFA5" strokeWidth="1.5" />
    <Line x1="45" y1="92" x2="52" y2="88" stroke="#3A3A3C" strokeWidth="3" strokeLinecap="round" />
    <Line x1="52" y1="88" x2="59" y2="84" stroke="#3A3A3C" strokeWidth="3" strokeLinecap="round" />

    {/* ── Speed lines ── */}
    <Line x1="5"  y1="60" x2="24" y2="60" stroke="#2EBFA5" strokeWidth="2.5" strokeLinecap="round" opacity="0.70" />
    <Line x1="4"  y1="68" x2="20" y2="68" stroke="#2EBFA5" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
    <Line x1="6"  y1="76" x2="19" y2="76" stroke="#2EBFA5" strokeWidth="1.2" strokeLinecap="round" opacity="0.25" />

    {/* ── Location pulse ── */}
    <Circle cx="102" cy="28" r="14" fill="none" stroke="#2EBFA5" strokeWidth="1" opacity="0.20" />
    <Circle cx="102" cy="28" r="9"  fill="none" stroke="#2EBFA5" strokeWidth="1.2" opacity="0.35" />
    <Circle cx="102" cy="28" r="4"  fill="#2EBFA5" opacity="0.80" />
    <Circle cx="102" cy="28" r="2"  fill="#FFFFFF" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. SUPPORT — headset with speech bubble & pulse rings
// ─────────────────────────────────────────────────────────────────────────────
export const SupportIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
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

    <Circle cx="97"  cy="20" r="3"   fill="#34C759" opacity="0.60" />
    <Circle cx="106" cy="28" r="2"   fill="#34C759" opacity="0.35" />
    <Circle cx="103" cy="16" r="1.5" fill="#34C759" opacity="0.25" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. LOGIN HERO — city map with route path, car, and destination pin
//    Usage: <LoginHeroIllustration width={screenWidth - 64} />
// ─────────────────────────────────────────────────────────────────────────────
export const LoginHeroIllustration = ({ width = 280, height = 170 }) => {
  const vw  = 280;
  const vh  = 170;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${vw} ${vh}`}>
      <Defs>
        <ClipPath id="loginClip">
          <Rect x="0" y="0" width={vw} height={vh} rx="16" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#loginClip)">

        {/* ── Perspective road grid ── */}
        <Line x1="140" y1="170" x2="20"  y2="55"  stroke="#B4B2A9" strokeWidth="0.6" opacity="0.22" />
        <Line x1="140" y1="170" x2="80"  y2="55"  stroke="#B4B2A9" strokeWidth="0.6" opacity="0.22" />
        <Line x1="140" y1="170" x2="140" y2="55"  stroke="#B4B2A9" strokeWidth="0.6" opacity="0.22" />
        <Line x1="140" y1="170" x2="200" y2="55"  stroke="#B4B2A9" strokeWidth="0.6" opacity="0.22" />
        <Line x1="140" y1="170" x2="260" y2="55"  stroke="#B4B2A9" strokeWidth="0.6" opacity="0.22" />
        <Line x1="0"   y1="125" x2="280" y2="125" stroke="#B4B2A9" strokeWidth="0.6" opacity="0.18" />
        <Line x1="0"   y1="100" x2="280" y2="100" stroke="#B4B2A9" strokeWidth="0.6" opacity="0.13" />
        <Line x1="0"   y1="80"  x2="280" y2="80"  stroke="#B4B2A9" strokeWidth="0.6" opacity="0.08" />

        {/* ── City silhouette (left) ── */}
        <Rect x="8"  y="92"  width="18" height="33" rx="1" fill="#D3D1C7" opacity="0.40" />
        <Rect x="13" y="85"  width="8"  height="10" rx="1" fill="#D3D1C7" opacity="0.30" />
        <Rect x="30" y="82"  width="22" height="43" rx="1" fill="#D3D1C7" opacity="0.38" />
        <Rect x="36" y="75"  width="10" height="10" rx="1" fill="#D3D1C7" opacity="0.28" />
        <Rect x="56" y="95"  width="14" height="30" rx="1" fill="#D3D1C7" opacity="0.32" />

        {/* ── City silhouette (right) ── */}
        <Rect x="210" y="88"  width="22" height="37" rx="1" fill="#D3D1C7" opacity="0.38" />
        <Rect x="216" y="80"  width="10" height="12" rx="1" fill="#D3D1C7" opacity="0.28" />
        <Rect x="236" y="97"  width="18" height="28" rx="1" fill="#D3D1C7" opacity="0.33" />
        <Rect x="257" y="102" width="16" height="23" rx="1" fill="#D3D1C7" opacity="0.28" />

        {/* ── Dashed route path ── */}
        <Path
          d="M 58 152 Q 88 134 108 106 Q 124 84 140 68"
          stroke="#534AB7"
          strokeWidth="2.8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="6,4"
          opacity="0.75"
        />

        {/* ── Origin dot ── */}
        <Circle cx="58"  cy="152" r="9" fill="#534AB7" opacity="0.18" />
        <Circle cx="58"  cy="152" r="5" fill="#534AB7" opacity="0.90" />
        <Circle cx="58"  cy="152" r="2" fill="#FFFFFF" />

        {/* ── Destination pin ── */}
        <Path
          d="M140 40 C130 40 122 48 122 57 C122 69 140 80 140 80 C140 80 158 69 158 57 C158 48 150 40 140 40 Z"
          fill="#534AB7"
        />
        <Circle cx="140" cy="57" r="7" fill="#FFFFFF" />
        <Circle cx="140" cy="57" r="3.5" fill="#534AB7" />
        <Ellipse cx="140" cy="82" rx="9" ry="2.5" fill="#534AB7" opacity="0.18" />

        {/* ── Car (along the route) ── */}
        <G>
          {/* body */}
          <Rect x="90" y="107" width="32" height="12" rx="4" fill="#2C2C2A" />
          {/* cabin */}
          <Path d="M96 107 Q98 101 102 100 L110 100 Q114 101 116 107 Z" fill="#3C3489" />
          {/* windows */}
          <Rect x="97"  y="101" width="7"  height="4" rx="1" fill="#7F77DD" opacity="0.7" />
          <Rect x="112" y="101" width="4"  height="4" rx="1" fill="#7F77DD" opacity="0.7" />
          {/* wheels */}
          <Circle cx="97"  cy="119" r="4.5" fill="#1a1a18" />
          <Circle cx="97"  cy="119" r="2.5" fill="#444441" />
          <Circle cx="115" cy="119" r="4.5" fill="#1a1a18" />
          <Circle cx="115" cy="119" r="2.5" fill="#444441" />
          {/* tail light / headlight */}
          <Rect x="90" y="109" width="3" height="3" rx="1" fill="#F09595" opacity="0.9" />
          <Rect x="119" y="109" width="3" height="3" rx="1" fill="#FAC775" opacity="0.9" />
          {/* speed lines */}
          <Line x1="72" y1="108" x2="88" y2="108" stroke="#534AB7" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
          <Line x1="70" y1="112" x2="87" y2="112" stroke="#534AB7" strokeWidth="1.2" strokeLinecap="round" opacity="0.40" />
        </G>

        {/* ── Pulse rings (top-right) ── */}
        <Circle cx="232" cy="34" r="22" fill="none" stroke="#534AB7" strokeWidth="1" opacity="0.14" />
        <Circle cx="232" cy="34" r="14" fill="none" stroke="#534AB7" strokeWidth="1" opacity="0.24" />
        <Circle cx="232" cy="34" r="7"  fill="#534AB7" opacity="0.32" />
        <Circle cx="232" cy="34" r="3.5" fill="#534AB7" opacity="0.90" />
        <Circle cx="232" cy="34" r="1.5" fill="#FFFFFF" />

        {/* ── Accent dots ── */}
        <Circle cx="200" cy="52" r="2"   fill="#AFA9EC" opacity="0.55" />
        <Circle cx="214" cy="43" r="1.4" fill="#AFA9EC" opacity="0.38" />
        <Circle cx="55"  cy="65" r="1.8" fill="#FAC775" opacity="0.50" />
        <Circle cx="42"  cy="74" r="1.2" fill="#FAC775" opacity="0.32" />
        <Circle cx="268" cy="110" r="1.5" fill="#5DCAA5" opacity="0.40" />
      </G>
    </Svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. REGISTER HERO — three role cards side-by-side (Rider / Driver / Courier)
//    Usage: <RegisterHeroIllustration width={screenWidth - 64} />
// ─────────────────────────────────────────────────────────────────────────────
export const RegisterHeroIllustration = ({ width = 280, height = 160, selectedRole = 'DRIVER' }) => {
  const vw = 280;
  const vh = 160;

  const riderSel   = selectedRole === 'CUSTOMER';
  const driverSel  = selectedRole === 'DRIVER';
  const courierSel = selectedRole === 'DELIVERY_PARTNER';

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${vw} ${vh}`}>
      <Defs>
        <ClipPath id="regClip">
          <Rect x="0" y="0" width={vw} height={vh} rx="16" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#regClip)">

        {/* ── Background grid dots ── */}
        {[40, 80, 120, 160, 200, 240].map(x => (
          <Circle key={x} cx={x} cy="22" r="1.2" fill="#B4B2A9" opacity="0.35" />
        ))}
        <Circle cx="40"  cy="58" r="1.2" fill="#B4B2A9" opacity="0.25" />
        <Circle cx="240" cy="58" r="1.2" fill="#B4B2A9" opacity="0.25" />

        {/* ── Step indicator ── */}
        <Circle cx="126" cy="14" r="4"  fill="#D3D1C7" />
        <Rect   x="134" y="11"  width="12" height="7" rx="3.5" fill="#534AB7" />
        <Circle cx="154" cy="14" r="4"  fill="#D3D1C7" />

        {/* ── RIDER card ── */}
        <Rect x="12" y="34" width="74" height="104" rx="12"
          fill={riderSel ? '#EEEDFE' : '#F1EFE8'}
          stroke={riderSel ? '#7F77DD' : '#D3D1C7'}
          strokeWidth={riderSel ? '1.5' : '0.8'} />
        {riderSel && <Rect x="12" y="34" width="74" height="4" rx="2" fill="#7F77DD" opacity="0.6" />}
        {/* Person figure */}
        <Circle cx="49" cy="68" r="11" fill="#534AB7" opacity="0.13" />
        <Circle cx="49" cy="63" r="6"  fill="#534AB7" opacity="0.80" />
        <Path d="M37 82 Q37 73 49 73 Q61 73 61 82" fill="#534AB7" opacity="0.60" />
        {/* Text bars */}
        <Rect x="22" y="92"  width="52" height="4" rx="2" fill="#7F77DD" opacity="0.45" />
        <Rect x="28" y="100" width="40" height="3" rx="1.5" fill="#AFA9EC" opacity="0.45" />
        {/* Radio / check */}
        {riderSel ? (
          <G>
            <Circle cx="49" cy="120" r="7" fill="#534AB7" />
            <Path d="M44.5 120 L47.5 123 L54 116" stroke="#FFFFFF" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </G>
        ) : (
          <Circle cx="49" cy="120" r="5" fill="none" stroke="#AFA9EC" strokeWidth="1.5" />
        )}

        {/* ── DRIVER card (center, elevated) ── */}
        <Rect x="103" y="22" width="74" height="116" rx="12"
          fill={driverSel ? '#EAF3DE' : '#F1EFE8'}
          stroke={driverSel ? '#639922' : '#D3D1C7'}
          strokeWidth={driverSel ? '1.5' : '0.8'} />
        {driverSel && <Rect x="103" y="22" width="74" height="4" rx="2" fill="#639922" opacity="0.65" />}
        {/* Car icon */}
        <Circle cx="140" cy="64" r="13" fill="#3B6D11" opacity="0.11" />
        <Rect x="126" y="60" width="28" height="10" rx="3" fill="#3B6D11" opacity="0.80" />
        <Path d="M130 60 Q132 54 135 53 L145 53 Q148 54 150 60 Z" fill="#639922" opacity="0.80" />
        <Circle cx="131" cy="70" r="3.5" fill="#173404" />
        <Circle cx="131" cy="70" r="2"   fill="#444441" />
        <Circle cx="149" cy="70" r="3.5" fill="#173404" />
        <Circle cx="149" cy="70" r="2"   fill="#444441" />
        {/* Text bars */}
        <Rect x="117" y="82"  width="46" height="4" rx="2" fill="#639922" opacity="0.50" />
        <Rect x="123" y="90"  width="34" height="3" rx="1.5" fill="#97C459" opacity="0.50" />
        {/* Radio / check */}
        {driverSel ? (
          <G>
            <Circle cx="140" cy="112" r="7" fill="#3B6D11" />
            <Path d="M135.5 112 L138.5 115 L145 108" stroke="#FFFFFF" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </G>
        ) : (
          <Circle cx="140" cy="112" r="5" fill="none" stroke="#97C459" strokeWidth="1.5" />
        )}

        {/* ── COURIER card ── */}
        <Rect x="194" y="34" width="74" height="104" rx="12"
          fill={courierSel ? '#FAEEDA' : '#F1EFE8'}
          stroke={courierSel ? '#EF9F27' : '#D3D1C7'}
          strokeWidth={courierSel ? '1.5' : '0.8'} />
        {courierSel && <Rect x="194" y="34" width="74" height="4" rx="2" fill="#EF9F27" opacity="0.6" />}
        {/* Bicycle */}
        <Circle cx="220" cy="80" r="9"  fill="none" stroke="#BA7517" strokeWidth="2" opacity="0.75" />
        <Circle cx="244" cy="80" r="9"  fill="none" stroke="#BA7517" strokeWidth="2" opacity="0.75" />
        <Line x1="220" y1="80" x2="232" y2="69" stroke="#633806" strokeWidth="2" strokeLinecap="round" />
        <Line x1="232" y1="69" x2="244" y2="80" stroke="#633806" strokeWidth="2" strokeLinecap="round" />
        <Line x1="232" y1="69" x2="220" y2="80" stroke="#633806" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <Line x1="232" y1="69" x2="232" y2="62" stroke="#633806" strokeWidth="2" strokeLinecap="round" />
        <Line x1="228" y1="62" x2="236" y2="62" stroke="#633806" strokeWidth="2" strokeLinecap="round" />
        <Circle cx="232" cy="80" r="3" fill="#BA7517" opacity="0.7" />
        {/* Text bars */}
        <Rect x="204" y="97"  width="52" height="4" rx="2" fill="#EF9F27" opacity="0.45" />
        <Rect x="210" y="105" width="40" height="3" rx="1.5" fill="#FAC775" opacity="0.50" />
        {/* Radio / check */}
        {courierSel ? (
          <G>
            <Circle cx="231" cy="120" r="7" fill="#854F0B" />
            <Path d="M226.5 120 L229.5 123 L236 116" stroke="#FFFFFF" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </G>
        ) : (
          <Circle cx="231" cy="120" r="5" fill="none" stroke="#FAC775" strokeWidth="1.5" />
        )}

        {/* ── Connector lines between cards ── */}
        <Line x1="86"  y1="86" x2="103" y2="86" stroke="#B4B2A9" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.55" />
        <Line x1="177" y1="80" x2="194" y2="80" stroke="#B4B2A9" strokeWidth="0.8" strokeDasharray="3,3" opacity="0.55" />

        {/* ── Accent sparkles ── */}
        <Circle cx="264" cy="42"  r="2"   fill="#AFA9EC" opacity="0.50" />
        <Circle cx="274" cy="32"  r="1.4" fill="#97C459" opacity="0.38" />
        <Circle cx="16"  cy="150" r="1.8" fill="#FAC775" opacity="0.45" />
        <Circle cx="262" cy="148" r="1.4" fill="#5DCAA5" opacity="0.42" />
      </G>
    </Svg>
  );
};