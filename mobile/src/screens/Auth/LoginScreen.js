// mobile/src/screens/Auth/LoginScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

// ─── Input: border/label use useNativeDriver:false (they animate non-transform props)
// ─── These values are NEVER shared with native-driver animations
const FloatInput = ({ label, iconName, value, onChangeText, keyboardType, secureTextEntry, accentColor = '#00D4FF' }) => {
  const [focused, setFocused]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  // JS-driver only (color, fontSize, top) — completely isolated values
  const labelY  = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderV = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(labelY,  { toValue: focused || value ? 1 : 0, duration: 180, useNativeDriver: false }).start();
    Animated.timing(borderV, { toValue: focused ? 1 : 0,          duration: 180, useNativeDriver: false }).start();
  }, [focused, value]);

  const borderColor = borderV.interpolate({ inputRange:[0,1], outputRange:['#1A2840', accentColor] });
  const top         = labelY.interpolate({ inputRange:[0,1], outputRange:[19, 7] });
  const fontSize    = labelY.interpolate({ inputRange:[0,1], outputRange:[15, 11] });
  const labelColor  = labelY.interpolate({ inputRange:[0,1], outputRange:['#3A5070', focused ? accentColor : '#5A7A9A'] });

  return (
    <Animated.View style={[s.inputBox, { borderColor }]}>
      <Ionicons name={iconName} size={17} color={focused ? accentColor : '#3A5070'} style={s.inputIcon} />
      <View style={{ flex:1 }}>
        <Animated.Text style={[s.floatLabel, { top, fontSize, color: labelColor }]}>{label}</Animated.Text>
        <TextInput
          style={s.inputText}
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
          <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={17} color="#3A5070" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

export default function LoginScreen({ navigation }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login } = useAuth();

  // These are ONLY used with useNativeDriver:true (transform + opacity)
  const hdrO = useRef(new Animated.Value(0)).current;
  const hdrY = useRef(new Animated.Value(-36)).current;
  const frmO = useRef(new Animated.Value(0)).current;
  const frmY = useRef(new Animated.Value(36)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrO, { toValue:1, duration:600, useNativeDriver:true }),
      Animated.timing(hdrY, { toValue:0, duration:600, useNativeDriver:true }),
      Animated.timing(frmO, { toValue:1, duration:700, delay:180, useNativeDriver:true }),
      Animated.timing(frmY, { toValue:0, duration:700, delay:180, useNativeDriver:true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Missing Fields', 'Please fill in all fields.');
    setLoading(true);
    const res = await login({ email, password });
    setLoading(false);
    if (!res.success) Alert.alert('Login Failed', res.message);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080C18" />
      <View style={s.orb1} /><View style={s.orb2} />

      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* back */}
          <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#5A7A9A" />
          </TouchableOpacity>

          {/* header */}
          <Animated.View style={[s.header, { opacity: hdrO, transform: [{ translateY: hdrY }] }]}>
            <View style={s.headerIcon}>
              <Ionicons name="shield-checkmark-outline" size={28} color="#00D4FF" />
            </View>
            <Text style={s.eyebrow}>WELCOME BACK</Text>
            <Text style={s.title}>Sign In to{'\n'}Diakite app</Text>
            <Text style={s.subtitle}>Access rides, deliveries and your earnings</Text>
          </Animated.View>

          {/* form */}
          <Animated.View style={[{ opacity: frmO, transform: [{ translateY: frmY }] }]}>
            <FloatInput label="Email Address"       iconName="mail-outline"        value={email}    onChangeText={setEmail}    keyboardType="email-address" />
            <FloatInput label="Password"            iconName="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry />

            <TouchableOpacity style={s.forgot}>
              <Text style={s.forgotTxt}>Forgot your password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[s.signBtn, loading && s.signBtnDim]} activeOpacity={0.85} onPress={handleLogin} disabled={loading}>
              <Text style={s.signBtnTxt}>{loading ? 'Signing In...' : 'Sign In'}</Text>
              {!loading && <Ionicons name="arrow-forward-circle-outline" size={22} color="#080C18" />}
            </TouchableOpacity>

            {/* divider */}
            <View style={s.divRow}>
              <View style={s.divLine} /><Text style={s.divTxt}>or</Text><View style={s.divLine} />
            </View>

            {/* trust stats */}
            <View style={s.statsRow}>
              {[['🚗','50K+','Rides'],['📦','30K+','Deliveries'],['⭐','4.9','Rating']].map(([ic,val,lbl]) => (
                <View key={lbl} style={s.statCard}>
                  <Text style={{ fontSize:20 }}>{ic}</Text>
                  <Text style={s.statVal}>{val}</Text>
                  <Text style={s.statLbl}>{lbl}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.regLink} onPress={() => navigation.navigate('Register')}>
              <Text style={s.regTxt}>
                New to Diakite?{'  '}<Text style={s.regBold}>Create Account</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:'#080C18' },
  orb1: { position:'absolute', width:width*1.1, height:width*1.1, borderRadius:width*0.55,
    backgroundColor:'#00D4FF', top:-width*0.65, left:-width*0.2, opacity:0.04 },
  orb2: { position:'absolute', width:width*0.75, height:width*0.75, borderRadius:width*0.375,
    backgroundColor:'#FFB800', bottom:-width*0.2, right:-width*0.1, opacity:0.04 },

  scroll: { paddingHorizontal:28, paddingBottom:48 },
  back: { marginTop: Platform.OS==='ios' ? 56 : 40, width:44, height:44, borderRadius:12,
    backgroundColor:'#0D1A2E', borderWidth:1, borderColor:'#1A2840',
    justifyContent:'center', alignItems:'center', marginBottom:24 },

  header: { marginBottom:36 },
  headerIcon: { width:56, height:56, borderRadius:16, backgroundColor:'#0D1A2E',
    borderWidth:1.5, borderColor:'#00D4FF30', justifyContent:'center', alignItems:'center',
    marginBottom:20, shadowColor:'#00D4FF', shadowOffset:{width:0,height:6},
    shadowOpacity:0.25, shadowRadius:14, elevation:8 },
  eyebrow: { fontSize:11, letterSpacing:4, color:'#00D4FF', fontWeight:'700', marginBottom:10 },
  title: { fontSize:36, fontWeight:'900', color:'#FFF', lineHeight:42, marginBottom:10, letterSpacing:-0.5 },
  subtitle: { fontSize:15, color:'#5A7A9A', lineHeight:22 },

  // input
  inputBox: { flexDirection:'row', alignItems:'center', backgroundColor:'#0D1A2E',
    borderRadius:14, borderWidth:1.5, marginBottom:14, height:62, paddingHorizontal:14 },
  inputIcon: { marginRight:10 },
  floatLabel: { position:'absolute', left:0, pointerEvents:'none' },
  inputText: { color:'#FFF', fontSize:15, paddingTop:18, paddingBottom:4, fontWeight:'500' },
  eyeBtn: { padding:6, marginLeft:4 },

  forgot: { alignSelf:'flex-end', marginBottom:24, marginTop:2 },
  forgotTxt: { color:'#00D4FF', fontSize:13, fontWeight:'600' },

  signBtn: { backgroundColor:'#00D4FF', borderRadius:16, height:58,
    flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10,
    shadowColor:'#00D4FF', shadowOffset:{width:0,height:10}, shadowOpacity:0.5,
    shadowRadius:22, elevation:12, marginBottom:28 },
  signBtnDim: { opacity:0.6 },
  signBtnTxt: { color:'#080C18', fontSize:17, fontWeight:'800', letterSpacing:0.3 },

  divRow: { flexDirection:'row', alignItems:'center', marginBottom:24, gap:12 },
  divLine: { flex:1, height:1, backgroundColor:'#1A2840' },
  divTxt: { color:'#3A5070', fontSize:13 },

  statsRow: { flexDirection:'row', gap:10, marginBottom:28 },
  statCard: { flex:1, backgroundColor:'#0D1A2E', borderRadius:14, borderWidth:1,
    borderColor:'#1A2840', padding:14, alignItems:'center', gap:4 },
  statVal: { color:'#FFF', fontSize:16, fontWeight:'800' },
  statLbl: { color:'#3A5070', fontSize:10, fontWeight:'600', letterSpacing:0.5 },

  regLink: { alignItems:'center', paddingVertical:8 },
  regTxt: { color:'#5A7A9A', fontSize:14 },
  regBold: { color:'#00D4FF', fontWeight:'700' },
});