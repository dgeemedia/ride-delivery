// mobile/src/components/MaintenanceBanner.js
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PX_PER_SECOND = 40; // lower = slower
const SEPARATOR     = '          ·          ';

export default function MaintenanceBanner({ message, endsAt, scheduled = false }) {
  const translateX       = useRef(new Animated.Value(0)).current;
  const animRef          = useRef(null);
  const [oneWidth, setOneWidth]   = useState(0); // width of ONE copy (message + sep)
  const [countdown, setCountdown] = useState('');

  // ── Start the loop once we know the single-copy width ──────────────────────
  useEffect(() => {
    if (oneWidth <= 0) return;

    animRef.current?.stop();
    translateX.setValue(0);

    // Animate exactly one copy to the left, then Animated.loop snaps back to 0.
    // Because copy 2 is right behind copy 1, the snap is invisible — seamless loop.
    const duration = (oneWidth / PX_PER_SECOND) * 1000;

    animRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue:         -oneWidth,
        duration,
        useNativeDriver: true,
        easing:          t => t,   // linear — constant speed
      })
    );
    animRef.current.start();

    return () => animRef.current?.stop();
  }, [oneWidth, message]);

  // ── Countdown ticker ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!endsAt) { setCountdown(''); return; }
    const tick = () => {
      const diff = new Date(endsAt) - Date.now();
      if (diff <= 0) { setCountdown('ending…'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(
        h > 0
          ? `${h}h ${String(m).padStart(2, '0')}m`
          : `${m}m ${String(s).padStart(2, '0')}s`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const bg     = scheduled ? '#EFF6FF' : '#FFF3CD';
  const border = scheduled ? '#BFDBFE' : '#FFD369';
  const fg     = scheduled ? '#1e40af' : '#7c3800';
  const icon   = scheduled ? 'information-circle-outline' : 'warning-outline';

  const singleCopy = message + SEPARATOR;
  const doubleCopy = singleCopy + singleCopy; // two copies side-by-side

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderBottomColor: border }]}>
      <Ionicons name={icon} size={14} color={fg} style={styles.icon} />

      {/* ── Hidden ghost text — measures real unconstrained width of one copy ── */}
      <Text
        numberOfLines={1}
        style={[styles.text, styles.ghost, { color: fg }]}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && w !== oneWidth) setOneWidth(w);
        }}
      >
        {singleCopy}
      </Text>

      {/* ── Visible clip area — two copies scroll as one seamless loop ── */}
      <View style={styles.clip}>
        <Animated.Text
          numberOfLines={1}
          style={[styles.text, { color: fg, transform: [{ translateX }] }]}
        >
          {doubleCopy}
        </Animated.Text>
      </View>

      {countdown ? (
        <View style={[styles.pill, { backgroundColor: fg + '22' }]}>
          <Text style={[styles.pillTxt, { color: fg }]}>{countdown}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  {
    flexDirection:     'row',
    alignItems:        'center',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  icon:  { marginRight: 6, flexShrink: 0 },

  // Invisible, positioned off-screen — exists only to measure text width
  ghost: {
    position: 'absolute',
    top:      -1000,     // off-screen, never seen by user
    left:     0,
    opacity:  0,
  },

  // Clips the scrolling text to the available horizontal space
  clip:  { flex: 1, overflow: 'hidden' },

  text:  { fontSize: 12, fontWeight: '600' },
  pill:  {
    borderRadius:      10,
    paddingHorizontal: 8,
    paddingVertical:   3,
    marginLeft:        8,
    flexShrink:        0,
  },
  pillTxt: { fontSize: 10, fontWeight: '700' },
});