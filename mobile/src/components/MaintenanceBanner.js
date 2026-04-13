// mobile/src/components/MaintenanceBanner.js
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_W   = Dimensions.get('window').width;
const PX_PER_SEC = 50;
const SEPARATOR  = '          •          ';

export default function MaintenanceBanner({ message, endsAt, scheduled = false }) {
  const translateX = useRef(new Animated.Value(SCREEN_W)).current;
  const bannerOpacity = useRef(new Animated.Value(1)).current;
  const animRef    = useRef(null);
  const [oneWidth, setOneWidth]   = useState(0);
  const [countdown, setCountdown] = useState('');
  const [expired, setExpired]     = useState(false);

  // ── Marquee — single copy travels right → left, snaps back invisibly ───
  useEffect(() => {
    if (oneWidth <= 0) return;
    animRef.current?.stop();

    // Start off-screen right, end off-screen left — snap is invisible to user
    const duration = ((SCREEN_W + oneWidth) / PX_PER_SEC) * 1000;
    translateX.setValue(SCREEN_W);

    animRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue:         -oneWidth,
        duration,
        useNativeDriver: true,
        easing:          t => t, // linear
      })
    );
    animRef.current.start();
    return () => animRef.current?.stop();
  }, [oneWidth, message]);

  // ── Countdown ticker — fades banner out when time is up ────────────────
  useEffect(() => {
    if (!endsAt) { setCountdown(''); return; }

    const tick = () => {
      const diff = new Date(endsAt) - Date.now();

      if (diff <= 0) {
        setCountdown('ending…');
        // Fade the whole banner out after a short pause
        setTimeout(() => {
          Animated.timing(bannerOpacity, {
            toValue:         0,
            duration:        800,
            useNativeDriver: true,
          }).start(() => setExpired(true));
        }, 2000); // show "ending…" for 2 s then fade
        return;
      }

      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000)    / 1_000);
      setCountdown(
        h > 0
          ? `${h}h ${String(m).padStart(2,'0')}m`
          : `${m}m ${String(s).padStart(2,'0')}s`
      );
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  // Fully unmount after fade completes
  if (expired) return null;

  const bg     = scheduled ? '#EFF6FF' : '#FFF3CD';
  const border = scheduled ? '#BFDBFE' : '#FFD369';
  const fg     = scheduled ? '#1e40af' : '#7c3800';
  const icon   = scheduled ? 'information-circle-outline' : 'warning-outline';

  // Single copy — no double text visible at the same time
  const singleCopy = message + SEPARATOR;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { backgroundColor: bg, borderBottomColor: border, opacity: bannerOpacity },
      ]}
    >
      <Ionicons name={icon} size={14} color={fg} style={styles.icon} />

      <View style={styles.clip}>
        {/* Ghost — measures real text width without constraining the animated text */}
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

        {/* Ticker — single copy scrolls right → left on repeat */}
        <Animated.Text
          numberOfLines={1}
          style={[styles.text, { color: fg, transform: [{ translateX }] }]}
        >
          {singleCopy}
        </Animated.Text>
      </View>

      {countdown ? (
        <View style={[styles.pill, { backgroundColor: fg + '22' }]}>
          <Text style={[styles.pillTxt, { color: fg }]}>{countdown}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection:     'row',
    alignItems:        'center',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical:   9,
    minHeight:         38,
  },
  icon:  { marginRight: 6, flexShrink: 0 },
  clip:  { flex: 1, overflow: 'hidden' },
  ghost: {
    position: 'absolute',
    top:      0,
    left:     0,
    opacity:  0,
  },
  text:    { fontSize: 12, fontWeight: '600' },
  pill:    {
    borderRadius:      10,
    paddingHorizontal: 8,
    paddingVertical:   3,
    marginLeft:        8,
    flexShrink:        0,
  },
  pillTxt: { fontSize: 10, fontWeight: '700' },
});