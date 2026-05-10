// mobile/src/components/PartnerIcons.js
// ── Custom SVG icons for Partner/Courier Dashboard quick actions ──────────────
// Mirrors the style and approach of DriverIcons.js but with courier-specific
// imagery and the teal (#34D399) accent palette.
import React from 'react';
import Svg, {
  Path, Circle, Rect, Line, Ellipse, Polygon, G, Text,
} from 'react-native-svg';

const SIZE = 52;

// ─────────────────────────────────────────────────────────────────────────────
// 1. EARNINGS — wallet with Naira coin + upward trend arrow (teal palette)
// ─────────────────────────────────────────────────────────────────────────────
export const EarningsIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Wallet body */}
    <Rect x="14" y="38" width="72" height="52" rx="12" fill="#1C1C1E" />
    <Rect x="14" y="38" width="72" height="18" rx="12" fill="#2C2C2E" />
    <Rect x="14" y="46" width="72" height="10" fill="#2C2C2E" />

    {/* Wallet pocket / clasp */}
    <Rect x="72" y="52" width="18" height="24" rx="9" fill="#2A2A2C" stroke="#3A3A3C" strokeWidth="1" />
    <Circle cx="81" cy="64" r="5" fill="#34D399" opacity="0.9" />
    <Circle cx="81" cy="64" r="2.5" fill="#1C1C1E" />

    {/* Card slot lines */}
    <Rect x="22" y="62" width="40" height="2.5" rx="1.2" fill="#3A3A3C" />
    <Rect x="22" y="70" width="30" height="2.5" rx="1.2" fill="#3A3A3C" />

    {/* Naira symbol */}
    <Rect x="22" y="78" width="18" height="2" rx="1" fill="#34D399" opacity="0.6" />
    <Rect x="22" y="82" width="18" height="2" rx="1" fill="#34D399" opacity="0.4" />
    <Line x1="28" y1="74" x2="28" y2="88" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="35" y1="74" x2="35" y2="88" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M24 76 Q31.5 70 39 76" stroke="#34D399" strokeWidth="2" fill="none" strokeLinecap="round" />

    {/* Trend arrow badge — top right */}
    <Circle cx="94" cy="36" r="18" fill="#34D399" opacity="0.10" />
    <Circle cx="94" cy="36" r="13" fill="#1C1C1E" stroke="#34D399" strokeWidth="1.2" />
    <Path d="M87 41 L91 35 L94 38 L99 30" stroke="#34D399" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Polygon points="98,28 102,30 99,33" fill="#34D399" />

    {/* Coin stack bottom-left */}
    <Ellipse cx="32" cy="106" rx="12" ry="4" fill="#34D399" opacity="0.5" />
    <Rect x="20" y="100" width="24" height="6" rx="1" fill="#34D399" opacity="0.35" />
    <Ellipse cx="32" cy="100" rx="12" ry="4" fill="#34D399" opacity="0.65" />
    <Ellipse cx="32" cy="96" rx="12" ry="4" fill="#34D399" opacity="0.9" />
    <Text fill="#1C1C1E" fontSize="6" fontWeight="bold" x="29" y="98.5">₦</Text>

    {/* Sparkle dots */}
    <Circle cx="104" cy="56" r="2" fill="#34D399" opacity="0.5" />
    <Circle cx="108" cy="48" r="1.2" fill="#34D399" opacity="0.3" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. DELIVERY HISTORY — package box with clock overlay & motion trail
// ─────────────────────────────────────────────────────────────────────────────
export const DeliveryHistoryIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Ground shadow */}
    <Ellipse cx="52" cy="96" rx="30" ry="4" fill="#000000" opacity="0.15" />

    {/* Box — right face */}
    <Path d="M22 72 L52 82 L82 72 L82 58 L52 68 L22 58 Z" fill="#B85C20" />
    {/* Box — top face */}
    <Path d="M22 58 L52 48 L82 58 L52 68 Z" fill="#E07030" />
    {/* Box — left face */}
    <Path d="M22 58 L22 72 L52 82 L52 68 Z" fill="#C46425" />

    {/* Tape cross */}
    <Path d="M52 68 L52 82 L55 81 L55 67 Z" fill="#FF9A3C" opacity="0.6" />
    <Path d="M52 68 L52 82 L49 81 L49 67 Z" fill="#D4692A" opacity="0.5" />
    <Path d="M22 58 L52 48 L55 49 L25 59 Z" fill="#FF9A3C" opacity="0.55" />
    <Path d="M52 48 L82 58 L79 59 L49 49 Z" fill="#D4692A" opacity="0.45" />

    {/* Bow / ribbon knot */}
    <Ellipse cx="52" cy="47" rx="4" ry="3.5" fill="#FF6B00" opacity="0.9" />
    <Path d="M48 47 Q42 40 46 36 Q50 42 48 47" fill="#FF8C30" opacity="0.85" />
    <Path d="M56 47 Q62 40 58 36 Q54 42 56 47" fill="#FF8C30" opacity="0.85" />
    <Circle cx="52" cy="47" r="2.5" fill="#FFB060" />

    {/* Motion trail — left side */}
    <Line x1="6"  y1="60" x2="18" y2="60" stroke="#34D399" strokeWidth="2"   strokeLinecap="round" opacity="0.70" />
    <Line x1="5"  y1="67" x2="15" y2="67" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
    <Line x1="6"  y1="74" x2="14" y2="74" stroke="#34D399" strokeWidth="1"   strokeLinecap="round" opacity="0.25" />

    {/* Clock badge — top right */}
    <Circle cx="94" cy="34" r="18" fill="#34D399" opacity="0.10" />
    <Circle cx="94" cy="34" r="13" fill="#1C1C1E" stroke="#34D399" strokeWidth="1.5" />
    {/* Tick marks */}
    <Line x1="94" y1="23" x2="94" y2="26" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="94" y1="42" x2="94" y2="45" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="83" y1="34" x2="86" y2="34" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="102" y1="34" x2="105" y2="34" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
    {/* Clock hands */}
    <Line x1="94" y1="34" x2="94" y2="26" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    <Line x1="94" y1="34" x2="100" y2="37" stroke="#34D399" strokeWidth="1.8" strokeLinecap="round" />
    <Circle cx="94" cy="34" r="2" fill="#34D399" />

    {/* Sparkle */}
    <Circle cx="108" cy="56" r="1.5" fill="#FFD166" opacity="0.5" />
    <Circle cx="14"  cy="30" r="1.5" fill="#FFD166" opacity="0.6" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. FLOOR PRICE — rising bar chart + price tag (teal / gold, courier style)
// ─────────────────────────────────────────────────────────────────────────────
export const FloorPriceIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Chart base line */}
    <Rect x="18" y="86" width="72" height="2.5" rx="1.2" fill="#3A3A3C" />

    {/* Rising bars — teal shades */}
    <Rect x="22" y="74" width="12" height="12" rx="3" fill="#34D399" opacity="0.3" />
    <Rect x="40" y="62" width="12" height="24" rx="3" fill="#34D399" opacity="0.5" />
    <Rect x="58" y="50" width="12" height="36" rx="3" fill="#34D399" opacity="0.75" />
    <Rect x="76" y="38" width="12" height="48" rx="3" fill="#34D399" />

    {/* Dashed trend line with gold dots */}
    <Path d="M28 76 L46 64 L64 52 L82 40" stroke="#FFD166" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,2" />
    <Circle cx="28" cy="76" r="2.5" fill="#FFD166" />
    <Circle cx="46" cy="64" r="2.5" fill="#FFD166" />
    <Circle cx="64" cy="52" r="2.5" fill="#FFD166" />
    <Circle cx="82" cy="40" r="2.5" fill="#FFD166" />

    {/* Arrow up badge — top right */}
    <Circle cx="100" cy="30" r="14" fill="#34D399" opacity="0.12" />
    <Path d="M100 38 L100 22" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" />
    <Path d="M94 28 L100 22 L106 28" stroke="#34D399" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

    {/* Price tag badge — bottom left */}
    <Rect x="12" y="95" width="38" height="18" rx="6" fill="#1C1C1E" stroke="#FFD166" strokeWidth="1.2" />
    <Circle cx="20" cy="104" r="2.5" fill="#FFD166" />
    <Rect x="25" y="101" width="18" height="2.5" rx="1.2" fill="#FFD166" opacity="0.8" />
    <Rect x="25" y="106" width="12" height="2" rx="1" fill="#FFD166" opacity="0.4" />

    {/* Min label chip */}
    <Rect x="18" y="24" width="22" height="10" rx="4" fill="#1C1C1E" stroke="#34D399" strokeWidth="1" />
    <Rect x="21" y="27" width="16" height="4" rx="1.5" fill="#34D399" opacity="0.5" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. DOCUMENTS — courier ID card + shield tick (teal palette)
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

    {/* Magnetic stripe */}
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

    {/* Chip — teal tinted */}
    <Rect x="56" y="36" width="16" height="12" rx="3" fill="#34D399" opacity="0.20" />
    <Rect x="58" y="38" width="12" height="8" rx="2" fill="#34D399" opacity="0.35" />
    <Line x1="62" y1="38" x2="62" y2="46" stroke="#34D399" strokeWidth="1" opacity="0.6" />
    <Line x1="66" y1="38" x2="66" y2="46" stroke="#34D399" strokeWidth="1" opacity="0.6" />
    <Line x1="58" y1="42" x2="70" y2="42" stroke="#34D399" strokeWidth="1" opacity="0.6" />

    {/* Shield badge — bottom right */}
    <Circle cx="88" cy="90" r="16" fill="#34D399" opacity="0.12" />
    <Path
      d="M88 76 C83 76 78 79 78 84 C78 90 88 98 88 98 C88 98 98 90 98 84 C98 79 93 76 88 76 Z"
      fill="#34D399"
    />
    <Path d="M83 87 L86.5 91 L93 83" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

    {/* Corner accent dots */}
    <Circle cx="16" cy="32" r="1.5" fill="#34D399" opacity="0.5" />
    <Circle cx="94" cy="32" r="1.5" fill="#34D399" opacity="0.5" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. RATING — five-star ring with gold stars + courier shield centre
// ─────────────────────────────────────────────────────────────────────────────
export const RatingIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Outer glow ring */}
    <Circle cx="60" cy="60" r="46" fill="none" stroke="#A78BFA" strokeWidth="0.8" opacity="0.18" />
    <Circle cx="60" cy="60" r="38" fill="none" stroke="#A78BFA" strokeWidth="0.8" opacity="0.12" />

    {/* Five stars arranged in an arc */}
    {/* Star 1 — far left */}
    <Path d="M22 54 L24.2 60.6 L31.2 60.6 L25.5 64.7 L27.7 71.3 L22 67.2 L16.3 71.3 L18.5 64.7 L12.8 60.6 L19.8 60.6 Z"
      fill="#A78BFA" opacity="0.45" />
    {/* Star 2 — left */}
    <Path d="M40 36 L42.5 43.8 L50.7 43.8 L44.1 48.5 L46.6 56.3 L40 51.6 L33.4 56.3 L35.9 48.5 L29.3 43.8 L37.5 43.8 Z"
      fill="#A78BFA" opacity="0.65" />
    {/* Star 3 — top centre (tallest / brightest) */}
    <Path d="M60 20 L63.1 29.6 L73.2 29.6 L65.1 35.5 L68.2 45.1 L60 39.2 L51.8 45.1 L54.9 35.5 L46.8 29.6 L56.9 29.6 Z"
      fill="#A78BFA" />
    {/* Star 4 — right */}
    <Path d="M80 36 L82.5 43.8 L90.7 43.8 L84.1 48.5 L86.6 56.3 L80 51.6 L73.4 56.3 L75.9 48.5 L69.3 43.8 L77.5 43.8 Z"
      fill="#A78BFA" opacity="0.65" />
    {/* Star 5 — far right */}
    <Path d="M98 54 L100.2 60.6 L107.2 60.6 L101.5 64.7 L103.7 71.3 L98 67.2 L92.3 71.3 L94.5 64.7 L88.8 60.6 L95.8 60.6 Z"
      fill="#A78BFA" opacity="0.45" />

    {/* Centre shield with score */}
    <Path
      d="M60 68 C54 68 48 72 48 78 C48 86 60 96 60 96 C60 96 72 86 72 78 C72 72 66 68 60 68 Z"
      fill="#A78BFA"
    />
    <Path d="M54 80 L58 85 L67 74" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

    {/* Gold sparkle dots */}
    <Circle cx="60" cy="108" r="2.5" fill="#FFD166" opacity="0.6" />
    <Circle cx="52" cy="106" r="1.5" fill="#FFD166" opacity="0.4" />
    <Circle cx="68" cy="106" r="1.5" fill="#FFD166" opacity="0.4" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 6. ON TIME — stopwatch / lightning bolt with radar rings
// ─────────────────────────────────────────────────────────────────────────────
export const OnTimeIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Radar pulse rings */}
    <Circle cx="60" cy="64" r="44" fill="none" stroke="#5DAA72" strokeWidth="0.8" opacity="0.12" />
    <Circle cx="60" cy="64" r="34" fill="none" stroke="#5DAA72" strokeWidth="0.8" opacity="0.18" />

    {/* Stopwatch outer body */}
    <Circle cx="60" cy="66" r="30" fill="#1C1C1E" stroke="#2C2C2E" strokeWidth="2" />
    <Circle cx="60" cy="66" r="26" fill="#111" />

    {/* Clock face tick marks */}
    <Line x1="60" y1="41" x2="60" y2="46" stroke="#3A3A3C" strokeWidth="2" strokeLinecap="round" />
    <Line x1="60" y1="86" x2="60" y2="91" stroke="#3A3A3C" strokeWidth="2" strokeLinecap="round" />
    <Line x1="35" y1="66" x2="40" y2="66" stroke="#3A3A3C" strokeWidth="2" strokeLinecap="round" />
    <Line x1="80" y1="66" x2="85" y2="66" stroke="#3A3A3C" strokeWidth="2" strokeLinecap="round" />
    {/* Diagonal ticks */}
    <Line x1="42" y1="49" x2="45" y2="52" stroke="#2C2C2E" strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="75" y1="49" x2="78" y2="46" stroke="#2C2C2E" strokeWidth="1.5" strokeLinecap="round" />

    {/* Minute hand — pointing near 12 */}
    <Line x1="60" y1="66" x2="60" y2="48" stroke="#5DAA72" strokeWidth="2.5" strokeLinecap="round" />
    {/* Hour hand — pointing to ~3 */}
    <Line x1="60" y1="66" x2="74" y2="66" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    {/* Centre pivot */}
    <Circle cx="60" cy="66" r="3.5" fill="#5DAA72" />
    <Circle cx="60" cy="66" r="1.5" fill="#1C1C1E" />

    {/* Crown / winder at top */}
    <Rect x="56" y="32" width="8" height="6" rx="2" fill="#2C2C2E" />
    <Rect x="54" y="29" width="12" height="5" rx="2.5" fill="#3A3A3C" />

    {/* Side crown buttons */}
    <Rect x="86" y="58" width="7" height="4" rx="2" fill="#2C2C2E" />
    <Rect x="27" y="58" width="7" height="4" rx="2" fill="#2C2C2E" />

    {/* Lightning bolt overlay — speed indicator */}
    <Path
      d="M65 50 L54 68 L61 68 L55 84 L72 62 L64 62 Z"
      fill="#5DAA72"
      opacity="0.85"
    />
    <Path
      d="M65 50 L54 68 L61 68 L55 84 L72 62 L64 62 Z"
      fill="none"
      stroke="#fff"
      strokeWidth="0.8"
      opacity="0.3"
    />

    {/* Sparkle dots */}
    <Circle cx="96" cy="36" r="2.5" fill="#5DAA72" opacity="0.55" />
    <Circle cx="102" cy="44" r="1.5" fill="#5DAA72" opacity="0.35" />
    <Circle cx="24" cy="42" r="2"   fill="#FFD166" opacity="0.45" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. BIKE — motorcycle / bicycle silhouette with teal speed lines
// ─────────────────────────────────────────────────────────────────────────────
export const BikeIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Ground shadow */}
    <Ellipse cx="60" cy="96" rx="44" ry="5" fill="#000" opacity="0.15" />

    {/* Road strip */}
    <Rect x="6" y="88" width="108" height="10" rx="4" fill="#1A1A1A" />
    <Rect x="16" y="92" width="12" height="2.5" rx="1.2" fill="#3A3A3C" />
    <Rect x="38" y="92" width="12" height="2.5" rx="1.2" fill="#3A3A3C" />
    <Rect x="60" y="92" width="12" height="2.5" rx="1.2" fill="#3A3A3C" />
    <Rect x="82" y="92" width="12" height="2.5" rx="1.2" fill="#3A3A3C" />

    {/* Rear wheel */}
    <Circle cx="34" cy="82" r="18" fill="#111" />
    <Circle cx="34" cy="82" r="12" fill="#1C1C1E" />
    <Circle cx="34" cy="82" r="6"  fill="#2C2C2E" />
    <Circle cx="34" cy="82" r="2.5" fill="#444" />
    {/* Spokes */}
    <Line x1="34" y1="70" x2="34" y2="94" stroke="#333" strokeWidth="1" />
    <Line x1="22" y1="82" x2="46" y2="82" stroke="#333" strokeWidth="1" />
    <Line x1="26" y1="74" x2="42" y2="90" stroke="#333" strokeWidth="1" />
    <Line x1="42" y1="74" x2="26" y2="90" stroke="#333" strokeWidth="1" />

    {/* Front wheel */}
    <Circle cx="88" cy="82" r="18" fill="#111" />
    <Circle cx="88" cy="82" r="12" fill="#1C1C1E" />
    <Circle cx="88" cy="82" r="6"  fill="#2C2C2E" />
    <Circle cx="88" cy="82" r="2.5" fill="#444" />
    {/* Spokes */}
    <Line x1="88" y1="70" x2="88" y2="94" stroke="#333" strokeWidth="1" />
    <Line x1="76" y1="82" x2="100" y2="82" stroke="#333" strokeWidth="1" />
    <Line x1="80" y1="74" x2="96" y2="90" stroke="#333" strokeWidth="1" />
    <Line x1="96" y1="74" x2="80" y2="90" stroke="#333" strokeWidth="1" />

    {/* Frame — main triangle */}
    <Path d="M34 82 L52 52 L88 82" stroke="#34D399" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M52 52 L88 62 L88 82" stroke="#2C2C2E" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M52 52 L34 62" stroke="#2C2C2E" strokeWidth="2.5" fill="none" strokeLinecap="round" />

    {/* Chain stay */}
    <Line x1="34" y1="82" x2="88" y2="62" stroke="#2A2A2A" strokeWidth="2" strokeLinecap="round" />

    {/* Seat */}
    <Rect x="46" y="46" width="20" height="5" rx="2.5" fill="#3A3A3C" />
    <Rect x="48" y="40" width="4" height="8" rx="2" fill="#2C2C2E" />

    {/* Handlebar */}
    <Rect x="84" y="50" width="4" height="14" rx="2" fill="#2C2C2E" />
    <Rect x="80" y="50" width="12" height="4" rx="2" fill="#3A3A3C" />

    {/* Package / delivery box on rack */}
    <Rect x="54" y="36" width="20" height="14" rx="3" fill="#E07030" />
    <Rect x="54" y="36" width="20" height="5"  rx="3" fill="#FF8C30" />
    <Line x1="64" y1="36" x2="64" y2="50" stroke="#C46425" strokeWidth="1" />
    <Line x1="54" y1="43" x2="74" y2="43" stroke="#C46425" strokeWidth="1" />
    {/* Bow */}
    <Circle cx="64" cy="35" r="2.5" fill="#FFB060" />

    {/* Teal green underline on frame */}
    <Path d="M34 82 L88 82" stroke="#34D399" strokeWidth="1.5" opacity="0.4" />

    {/* Speed lines */}
    <Line x1="4"  y1="60" x2="20" y2="60" stroke="#34D399" strokeWidth="2"   strokeLinecap="round" opacity="0.75" />
    <Line x1="4"  y1="67" x2="16" y2="67" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
    <Line x1="6"  y1="74" x2="14" y2="74" stroke="#34D399" strokeWidth="1"   strokeLinecap="round" opacity="0.25" />

    {/* Helmet badge — top right */}
    <Circle cx="102" cy="32" r="14" fill="#34D399" opacity="0.10" />
    <Path d="M102 20 C95 20 89 25 89 32 C89 37 92 41 96 43 L108 43 C112 41 115 37 115 32 C115 25 109 20 102 20 Z" fill="#2C2C2E" />
    <Path d="M96 43 L108 43 L108 46 L96 46 Z" fill="#3A3A3C" />
    <Path d="M92 30 Q102 24 112 30" stroke="#34D399" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. CAR (for non-bike couriers) — compact courier car with teal palette
// ─────────────────────────────────────────────────────────────────────────────
export const CarIcon = ({ size = SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 120 120">
    {/* Road */}
    <Rect x="8" y="84" width="104" height="14" rx="5" fill="#1A1A1A" />
    <Rect x="18" y="89" width="12" height="2.5" rx="1.2" fill="#3A3A3C" />
    <Rect x="40" y="89" width="12" height="2.5" rx="1.2" fill="#3A3A3C" />
    <Rect x="62" y="89" width="12" height="2.5" rx="1.2" fill="#3A3A3C" />
    <Rect x="84" y="89" width="12" height="2.5" rx="1.2" fill="#3A3A3C" />

    {/* Ground shadow */}
    <Ellipse cx="60" cy="85" rx="42" ry="4" fill="#000" opacity="0.18" />

    {/* Car body */}
    <Rect x="12" y="60" width="96" height="26" rx="7" fill="#1C1C1E" />

    {/* Roof / cabin */}
    <Path d="M34 60 Q38 42 50 40 L70 40 Q82 42 86 60 Z" fill="#2C2C2E" />

    {/* Windshields */}
    <Path d="M50 40 Q41 43 37 60 L50 60 Z" fill="#34D399" opacity="0.30" />
    <Path d="M70 40 Q79 43 83 60 L70 60 Z" fill="#34D399" opacity="0.30" />
    <Path d="M50 40 L70 40 L72 60 L48 60 Z" fill="#34D399" opacity="0.20" />

    {/* B-pillars */}
    <Rect x="48" y="42" width="2.5" height="18" rx="1" fill="#111" />
    <Rect x="69.5" y="42" width="2.5" height="18" rx="1" fill="#111" />

    {/* Teal green-effect strip */}
    <Rect x="12" y="72" width="96" height="4" rx="1" fill="#34D399" opacity="0.75" />

    {/* Headlight */}
    <Rect x="12" y="61" width="9" height="6" rx="3" fill="#34D399" opacity="0.9" />
    <Rect x="13" y="62" width="7" height="4" rx="2" fill="#fff" opacity="0.4" />

    {/* Tail-light */}
    <Rect x="99" y="61" width="9" height="6" rx="3" fill="#FFE066" />

    {/* Rear wheel */}
    <Circle cx="82" cy="85" r="11" fill="#111" />
    <Circle cx="82" cy="85" r="7"  fill="#1C1C1E" />
    <Circle cx="82" cy="85" r="3.5" fill="#2C2C2E" />
    <Circle cx="82" cy="85" r="1.5" fill="#444" />
    <Path d="M68 74 Q82 68 96 75" stroke="#111" strokeWidth="3.5" fill="none" />

    {/* Front wheel */}
    <Circle cx="38" cy="85" r="11" fill="#111" />
    <Circle cx="38" cy="85" r="7"  fill="#1C1C1E" />
    <Circle cx="38" cy="85" r="3.5" fill="#2C2C2E" />
    <Circle cx="38" cy="85" r="1.5" fill="#444" />
    <Path d="M24 75 Q38 68 52 74" stroke="#111" strokeWidth="3.5" fill="none" />

    {/* Package on roof rack */}
    <Rect x="46" y="30" width="28" height="12" rx="3" fill="#E07030" />
    <Rect x="46" y="30" width="28" height="5"  rx="3" fill="#FF8C30" />
    <Line x1="60" y1="30" x2="60" y2="42" stroke="#C46425" strokeWidth="1" />
    <Line x1="46" y1="36" x2="74" y2="36" stroke="#C46425" strokeWidth="1" />
    {/* Rack straps */}
    <Line x1="50" y1="42" x2="50" y2="40" stroke="#3A3A3C" strokeWidth="2" strokeLinecap="round" />
    <Line x1="70" y1="42" x2="70" y2="40" stroke="#3A3A3C" strokeWidth="2" strokeLinecap="round" />

    {/* Speed lines */}
    <Line x1="4"  y1="54" x2="18" y2="54" stroke="#34D399" strokeWidth="2"   strokeLinecap="round" opacity="0.75" />
    <Line x1="4"  y1="60" x2="14" y2="60" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
    <Line x1="4"  y1="66" x2="13" y2="66" stroke="#34D399" strokeWidth="1"   strokeLinecap="round" opacity="0.25" />

    {/* Sparkle */}
    <Circle cx="106" cy="38" r="2.5" fill="#34D399" opacity="0.55" />
    <Circle cx="112" cy="48" r="1.5" fill="#34D399" opacity="0.30" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. SUPPORT — headset with speech bubble & pulse rings (teal palette)
// ─────────────────────────────────────────────────────────────────────────────
export { SupportIcon } from './ServiceIcons';