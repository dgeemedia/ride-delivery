// mobile/src/screens/Auth/OnboardingScreen.js
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const VEHICLES = [
  { emoji: '🏎️', size: 30, delay: 0,   dur: 3200, dist: 12, style: { top: height * 0.06, left: width * 0.04 } },
  { emoji: '🚕', size: 26, delay: 300, dur: 3800, dist: 10, style: { top: height * 0.06, left: width * 0.30 } },
  { emoji: '🛵', size: 24, delay: 600, dur: 2900, dist: 14, style: { top: height * 0.10, right: width * 0.06 } },
  { emoji: '🚐', size: 22, delay: 200, dur: 3500, dist: 11, style: { top: height * 0.19, left: width * 0.14 } },
  { emoji: '🚙', size: 26, delay: 700, dur: 3100, dist: 13, style: { top: height * 0.17, right: width * 0.18 } },
  { emoji: '🚌', size: 28, delay: 500, dur: 4000, dist: 9,  style: { top: height * 0.27, left: -2 } },
  { emoji: '🚎', size: 26, delay: 800, dur: 3300, dist: 12, style: { top: height * 0.29, right: -2 } },
  { emoji: '🏍️', size: 26, delay: 350, dur: 2800, dist: 14, style: { bottom: height * 0.27, left: width * 0.05 } },
  { emoji: '🚗', size: 28, delay: 550, dur: 3600, dist: 10, style: { bottom: height * 0.25, right: width * 0.06 } },
  { emoji: '🚚', size: 24, delay: 750, dur: 3000, dist: 12, style: { bottom: height * 0.17, left: width * 0.26 } },
  { emoji: '🚛', size: 26, delay: 450, dur: 3700, dist: 11, style: { bottom: height * 0.13, right: width * 0.22 } },
  { emoji: '🛺', size: 22, delay: 150, dur: 4200, dist: 8,  style: { bottom: height * 0.28, left: width * 0.46 } },
];

// RULE: Only opacity + transform → useNativeDriver: true, no exceptions
const FloatingVehicle = ({ emoji, size, delay, dur, dist, style }) => {
  const ty  = useRef(new Animated.Value(0)).current;
  const tx  = useRef(new Animated.Value(0)).current;
  const op  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(op, { toValue: 0.92, duration: 800, delay, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(ty, { toValue: -dist,       duration: dur,       useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0,           duration: dur,       useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(tx, { toValue: dist * 0.25,  duration: dur * 1.4, useNativeDriver: true }),
      Animated.timing(tx, { toValue: -dist * 0.25, duration: dur * 1.4, useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <Animated.View style={[s.vehicle, style, { opacity: op, transform: [{ translateY: ty }, { translateX: tx }] }]}>
      <View style={s.bubble}>
        <Text style={{ fontSize: size }}>{emoji}</Text>
      </View>
    </Animated.View>
  );
};

export default function OnboardingScreen({ navigation }) {
  const badgeS = useRef(new Animated.Value(0)).current;
  const titleO = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(32)).current;
  const subO   = useRef(new Animated.Value(0)).current;
  const subY   = useRef(new Animated.Value(24)).current;
  const btnO   = useRef(new Animated.Value(0)).current;
  const btnY   = useRef(new Animated.Value(20)).current;
  const glowS  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(badgeS, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(titleO, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(subO, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(subY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btnO, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(btnY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(glowS, { toValue: 1.22, duration: 1900, useNativeDriver: true }),
      Animated.timing(glowS, { toValue: 1,    duration: 1900, useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080C18" />
      <View style={s.orb1} />
      <View style={s.orb2} />

      {VEHICLES.map((v, i) => <FloatingVehicle key={i} {...v} />)}

      {/* scan lines */}
      {[0.24, 0.48, 0.73].map((t, i) => (
        <View key={i} style={[s.scan, { top: height * t, opacity: 0.055 - i * 0.015 }]} />
      ))}

      {/* hero */}
      <View style={s.hero}>
        <Animated.View style={[s.badgeWrap, { transform: [{ scale: badgeS }] }]}>
          <Animated.View style={[s.glowRing, { transform: [{ scale: glowS }] }]} />
          <View style={s.badge}><Text style={{ fontSize: 42 }}>🚗</Text></View>
        </Animated.View>

        <Animated.View style={[s.brandRow, { opacity: titleO, transform: [{ translateY: titleY }] }]}>
          <Text style={s.brand}>Diakite</Text>
          <View style={s.dot} />
        </Animated.View>

        <Animated.Text style={[s.tag, { opacity: subO, transform: [{ translateY: subY }] }]}>
          Rides {'&'} Deliveries,{'\n'}On Your Terms.
        </Animated.Text>

        <Animated.View style={[s.pills, { opacity: subO, transform: [{ translateY: subY }] }]}>
          {[['🚗','Book Rides'],['📦','Send Packages'],['💰','Earn Money']].map(([ic, lb]) => (
            <View key={lb} style={s.pill}>
              <Text style={{ fontSize: 13 }}>{ic}</Text>
              <Text style={s.pillTxt}>{lb}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* footer */}
      <Animated.View style={[s.footer, { opacity: btnO, transform: [{ translateY: btnY }] }]}>
        <TouchableOpacity style={s.cta} activeOpacity={0.85} onPress={() => navigation.navigate('Register')}>
          <Text style={s.ctaTxt}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#080C18" />
        </TouchableOpacity>
        <TouchableOpacity style={s.ghost} onPress={() => navigation.navigate('Login')}>
          <Text style={s.ghostTxt}>
            Already have an account?{'  '}
            <Text style={s.ghostBold}>Sign In</Text>
          </Text>
        </TouchableOpacity>
        <Text style={s.fine}>Available for riders, drivers {'&'} couriers</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080C18' },
  orb1: { position:'absolute', width: width, height: width, borderRadius: width/2,
    backgroundColor:'#00D4FF', top:-width*0.5, left:-width*0.2, opacity:0.045 },
  orb2: { position:'absolute', width:width*0.8, height:width*0.8, borderRadius:width*0.4,
    backgroundColor:'#FFB800', bottom:-width*0.1, right:-width*0.15, opacity:0.05 },
  scan: { position:'absolute', left:0, right:0, height:1, backgroundColor:'#00D4FF' },

  vehicle: { position:'absolute', zIndex:2 },
  bubble: { width:60, height:60, borderRadius:16, backgroundColor:'#0D1525',
    borderWidth:1, borderColor:'#1E3050', justifyContent:'center', alignItems:'center',
    shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.4, shadowRadius:8, elevation:5 },

  hero: { flex:1, justifyContent:'center', alignItems:'center', zIndex:10, paddingHorizontal:32 },

  badgeWrap: { width:100, height:100, justifyContent:'center', alignItems:'center', marginBottom:28 },
  glowRing: { position:'absolute', width:100, height:100, borderRadius:50,
    backgroundColor:'#00D4FF', opacity:0.1 },
  badge: { width:84, height:84, borderRadius:24, backgroundColor:'#0D1A2E',
    borderWidth:1.5, borderColor:'#00D4FF35', justifyContent:'center', alignItems:'center',
    shadowColor:'#00D4FF', shadowOffset:{width:0,height:8}, shadowOpacity:0.35, shadowRadius:18, elevation:10 },

  brandRow: { flexDirection:'row', alignItems:'center', gap:10, marginBottom:16 },
  brand: { fontSize:38, fontWeight:'900', color:'#FFF', letterSpacing:9 },
  dot: { width:8, height:8, borderRadius:4, backgroundColor:'#00D4FF', marginTop:8 },

  tag: { fontSize:20, color:'#7A9DBE', textAlign:'center', lineHeight:30,
    fontWeight:'300', letterSpacing:0.3, marginBottom:28 },

  pills: { flexDirection:'row', gap:8, flexWrap:'wrap', justifyContent:'center' },
  pill: { flexDirection:'row', alignItems:'center', gap:5,
    paddingHorizontal:14, paddingVertical:8, borderRadius:20,
    backgroundColor:'#0D1A2E', borderWidth:1, borderColor:'#1E3050' },
  pillTxt: { color:'#6A90B0', fontSize:12, fontWeight:'600' },

  footer: { paddingHorizontal:28, paddingBottom: Platform.OS==='ios' ? 52 : 36, zIndex:10, gap:12 },
  cta: { backgroundColor:'#00D4FF', borderRadius:16, height:58,
    flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10,
    shadowColor:'#00D4FF', shadowOffset:{width:0,height:10}, shadowOpacity:0.5, shadowRadius:22, elevation:12 },
  ctaTxt: { color:'#080C18', fontSize:17, fontWeight:'800', letterSpacing:0.5 },
  ghost: { height:44, justifyContent:'center', alignItems:'center' },
  ghostTxt: { color:'#4A6A8A', fontSize:14 },
  ghostBold: { color:'#00D4FF', fontWeight:'700' },
  fine: { textAlign:'center', color:'#243650', fontSize:11 },
});