// mobile/src/screens/Auth/LoginScreen.js
// ── Premium Glass Edition · Onyx Theme ───────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  Animated, Dimensions, StatusBar, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useAuth }        from '../../context/AuthContext';
import { useTheme }       from '../../context/ThemeContext';

const { width } = Dimensions.get('window');
const LOGO = require('../../../assets/diakite_dark.png');

const G = {
  card:   (mode) => mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.80)',
  border: (mode) => mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
  icon:   (mode) => mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
};

// ── Glass Float Input ─────────────────────────────────────────────────────────
const FloatInput = ({ label, iconName, value, onChangeText, keyboardType, secureTextEntry }) => {
  const { theme, mode } = useTheme();
  const [focused, setFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const labelY  = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(labelY,  { toValue: focused || value ? 1 : 0, duration:180, useNativeDriver:false }),
      Animated.timing(borderA, { toValue: focused ? 1 : 0,          duration:200, useNativeDriver:false }),
    ]).start();
  }, [focused, value]);

  const top      = labelY.interpolate({ inputRange:[0,1], outputRange:[19,7] });
  const fontSize = labelY.interpolate({ inputRange:[0,1], outputRange:[15,11] });
  const lColor   = labelY.interpolate({ inputRange:[0,1], outputRange:[theme.hint, mode==='dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'] });
  const borderC  = borderA.interpolate({ inputRange:[0,1], outputRange:[G.border(mode), mode==='dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.20)'] });

  return (
    <Animated.View style={[s.inputBox, { backgroundColor: G.card(mode), borderColor: borderC, overflow:'hidden' }]}>
      <LinearGradient
        colors={mode==='dark' ? ['rgba(255,255,255,0.04)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.9)','rgba(255,255,255,0.75)']}
        start={{ x:0, y:0 }} end={{ x:1, y:1 }}
        style={StyleSheet.absoluteFill}
      />
      <Ionicons name={iconName} size={16} color={focused ? (mode==='dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)') : theme.hint} style={s.inputIcon} />
      <View style={{ flex:1 }}>
        <Animated.Text style={[s.floatLabel, { top, fontSize, color: lColor }]}>{label}</Animated.Text>
        <TextInput
          style={[s.inputText, { color: theme.foreground }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={keyboardType || 'default'}
          autoCapitalize="none"
          secureTextEntry={secureTextEntry && !showPwd}
          placeholder=" "
          placeholderTextColor="transparent"
        />
      </View>
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShowPwd(p => !p)} style={s.eyeBtn}>
          <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={16} color={theme.hint} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { login }       = useAuth();
  const darkMode        = mode === 'dark';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const hdrO = useRef(new Animated.Value(0)).current;
  const hdrY = useRef(new Animated.Value(-32)).current;
  const frmO = useRef(new Animated.Value(0)).current;
  const frmY = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrO, { toValue:1, duration:700,             useNativeDriver:true }),
      Animated.timing(hdrY, { toValue:0, duration:700,             useNativeDriver:true }),
      Animated.timing(frmO, { toValue:1, duration:700, delay:180,  useNativeDriver:true }),
      Animated.timing(frmY, { toValue:0, duration:700, delay:180,  useNativeDriver:true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields','Please fill in all fields.');
      return;
    }
    setLoading(true);
    const res = await login({ email: email.trim(), password });
    setLoading(false);
    if (!res.success) Alert.alert('Login Failed', res.message ?? 'Please check your credentials.');
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Ambient orbs */}
      <View style={[s.orb1, { backgroundColor: darkMode ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)' }]} />
      <View style={[s.orb2, { backgroundColor: darkMode ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)' }]} />

      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header — starts at the top, no back button above it */}
          <Animated.View style={[s.header, { opacity: hdrO, transform:[{ translateY: hdrY }] }]}>
            {/* Logo badge */}
            <View style={[s.logoBadge, {
              backgroundColor:'#FFFFFF',
              borderColor:  '#E5E5E5',
            }]}>
              <Image source={LOGO} style={s.logoImg} resizeMode="contain" />
            </View>

            <View style={[s.pillLabel, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}>
              <View style={[s.pillDot, { backgroundColor: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }]} />
              <Text style={[s.eyebrow, { color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>WELCOME BACK</Text>
            </View>

            <Text style={[s.title, { color: theme.foreground }]}>Sign in</Text>
            <Text style={[s.subtitle, { color: theme.hint }]}>Good to see you again.</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View style={{ opacity: frmO, transform:[{ translateY: frmY }] }}>
            <FloatInput label="Email"    iconName="mail-outline"        value={email}    onChangeText={setEmail}    keyboardType="email-address" />
            <FloatInput label="Password" iconName="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry />

            <TouchableOpacity style={s.forgot}>
              <Text style={[s.forgotTxt, { color: theme.hint }]}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign in button */}
            <TouchableOpacity
              style={[s.signBtn, loading && s.signBtnDim, { overflow:'hidden' }]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}
            >
              <LinearGradient
                colors={darkMode ? ['rgba(255,255,255,1)','rgba(220,220,220,1)'] : ['rgba(0,0,0,1)','rgba(30,30,30,1)']}
                start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Top shimmer */}
              <View style={[s.btnShimmer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.15)' }]} />
              <Text style={[s.signBtnTxt, { color: theme.accentFg }]}>
                {loading ? 'Signing in…' : 'Sign In'}
              </Text>
              {!loading && <Ionicons name="arrow-forward" size={18} color={theme.accentFg} />}
            </TouchableOpacity>

            <View style={s.divRow}>
              <View style={[s.divLine, { backgroundColor: G.border(mode) }]} />
              <Text style={[s.divTxt, { color: theme.hint }]}>or</Text>
              <View style={[s.divLine, { backgroundColor: G.border(mode) }]} />
            </View>

            <TouchableOpacity
              style={[s.regBtn, { backgroundColor: G.card(mode), borderColor: G.border(mode), overflow:'hidden' }]}
              onPress={() => navigation.navigate('Register')}
            >
              <LinearGradient
                colors={darkMode ? ['rgba(255,255,255,0.06)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.7)']}
                start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={[s.regTxt, { color: theme.hint }]}>
                New to Diakite?{'  '}
                <Text style={[s.regBold, { color: theme.foreground }]}>Create Account</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex:1 },
  orb1:   { position:'absolute', width:width*1.3, height:width*1.3, borderRadius:width*0.65, top:-width*0.8, alignSelf:'center' },
  orb2:   { position:'absolute', width:width*0.7, height:width*0.7, borderRadius:width*0.35, bottom:-width*0.2, left:-width*0.1 },
  scroll: { paddingHorizontal:32, paddingBottom:60 },

  // Header now sits at the top of the scroll with extra top padding
  // to clear the status bar — no back button above it any more.
  header: {
    marginTop: Platform.OS === 'ios' ? 72 : 56,
    marginBottom: 44,
  },

  logoBadge: {
    width:74, height:74, borderRadius:20, borderWidth:1,
    justifyContent:'center', alignItems:'center', marginBottom:28,
    shadowOffset:{ width:0, height:6 }, shadowOpacity:0.20, shadowRadius:16, elevation:8,
    shadowColor:'#000000',
  },
  logoImg:   { width:52, height:36 },

  pillLabel: { flexDirection:'row', alignItems:'center', gap:7, borderRadius:20, borderWidth:1, paddingHorizontal:12, paddingVertical:6, alignSelf:'flex-start', marginBottom:16 },
  pillDot:   { width:5, height:5, borderRadius:3 },
  eyebrow:   { fontSize:10, letterSpacing:4, fontWeight:'800' },
  title:     { fontSize:36, fontWeight:'900', letterSpacing:-1, marginBottom:8 },
  subtitle:  { fontSize:15, fontWeight:'300' },

  inputBox:   { flexDirection:'row', alignItems:'center', borderRadius:14, borderWidth:1.5, marginBottom:12, height:62, paddingHorizontal:14, overflow:'hidden' },
  inputIcon:  { marginRight:10 },
  floatLabel: { position:'absolute', left:0 },
  inputText:  { fontSize:15, paddingTop:18, paddingBottom:4, fontWeight:'400' },
  eyeBtn:     { padding:6, marginLeft:4 },

  forgot:    { alignSelf:'flex-end', marginBottom:28, marginTop:6 },
  forgotTxt: { fontSize:13, fontWeight:'500' },

  signBtn:    { borderRadius:16, height:56, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10, marginBottom:32, overflow:'hidden' },
  btnShimmer: { position:'absolute', top:0, left:0, right:0, height:1 },
  signBtnDim: { opacity:0.6 },
  signBtnTxt: { fontSize:16, fontWeight:'800', letterSpacing:0.3 },

  divRow: { flexDirection:'row', alignItems:'center', marginBottom:28, gap:12 },
  divLine:{ flex:1, height:1 },
  divTxt: { fontSize:12 },

  regBtn: { borderRadius:16, height:54, borderWidth:1, justifyContent:'center', alignItems:'center', overflow:'hidden' },
  regTxt: { fontSize:14 },
  regBold:{ fontWeight:'700' },
});