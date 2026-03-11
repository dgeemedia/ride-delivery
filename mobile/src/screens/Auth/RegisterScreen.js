// mobile/src/screens/Auth/RegisterScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { driverAPI, partnerAPI } from '../../services/api';

const { width } = Dimensions.get('window');

// ─── Role config ──────────────────────────────────────────────────────────────
// id must match backend: CUSTOMER | DRIVER | DELIVERY_PARTNER
const ROLES = [
  {
    id: 'CUSTOMER',
    label: 'Rider',
    sub: 'Book rides & send packages',
    emoji: '🧑‍💼',
    color: '#00D4FF',
    bg: '#001E2B',
    steps: 2,   // account only
    perks: ['Book instant rides', 'Send packages', 'Track in real-time'],
  },
  {
    id: 'DRIVER',
    label: 'Driver',
    sub: 'Drive passengers & earn',
    emoji: '🚗',
    color: '#FFB800',
    bg: '#1E1600',
    steps: 3,   // account + vehicle profile
    perks: ['Set your own hours', 'Weekly payouts', 'Bonus rewards'],
  },
  {
    id: 'DELIVERY_PARTNER',
    label: 'Courier',
    sub: 'Deliver packages daily',
    emoji: '🛵',
    color: '#34D399',
    bg: '#001A10',
    steps: 3,   // account + courier profile
    perks: ['Multiple pickups', 'Route optimization', 'Daily payouts'],
  },
];

// Vehicle types accepted by backend validator
const VEHICLE_TYPES = ['BIKE', 'CAR', 'MOTORCYCLE', 'VAN'];

// ─── Floating label input — JS driver only (color/fontSize/top) ───────────────
const FloatInput = ({
  label, iconName, value, onChangeText,
  keyboardType, autoCapitalize, secureTextEntry, accentColor = '#00D4FF',
}) => {
  const [focused, setFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const labelY  = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderV = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(labelY,  { toValue: focused || value ? 1 : 0, duration: 180, useNativeDriver: false }).start();
    Animated.timing(borderV, { toValue: focused ? 1 : 0,          duration: 180, useNativeDriver: false }).start();
  }, [focused, value]);

  const borderColor = borderV.interpolate({ inputRange: [0,1], outputRange: ['#1A2840', accentColor] });
  const top      = labelY.interpolate({ inputRange: [0,1], outputRange: [19, 7] });
  const fontSize = labelY.interpolate({ inputRange: [0,1], outputRange: [15, 11] });
  const lColor   = labelY.interpolate({ inputRange: [0,1], outputRange: ['#3A5070', focused ? accentColor : '#5A7A9A'] });

  return (
    <Animated.View style={[s.inputBox, { borderColor }]}>
      <Ionicons name={iconName} size={17} color={focused ? accentColor : '#3A5070'} style={s.inputIcon} />
      <View style={{ flex: 1 }}>
        <Animated.Text style={[s.floatLabel, { top, fontSize, color: lColor }]}>{label}</Animated.Text>
        <TextInput
          style={s.inputText}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'none'}
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

// ─── Vehicle type picker ──────────────────────────────────────────────────────
const VehiclePicker = ({ value, onSelect, accentColor }) => (
  <View style={s.pickerWrap}>
    <Text style={[s.pickerLabel, { color: accentColor + '99' }]}>Vehicle Type</Text>
    <View style={s.pickerRow}>
      {VEHICLE_TYPES.map(type => (
        <TouchableOpacity
          key={type}
          style={[
            s.pickerOption,
            { borderColor: value === type ? accentColor : '#1A2840' },
            value === type && { backgroundColor: accentColor + '15' },
          ]}
          onPress={() => onSelect(type)}>
          <Text style={[s.pickerOptionTxt, { color: value === type ? accentColor : '#5A7A9A' }]}>
            {type === 'MOTORCYCLE' ? 'MOTO' : type}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

// ─── Role Card ─────────────────────────────────────────────────────────────────
const RoleCard = ({ role, selected, onSelect }) => {
  const scaleA = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (selected) {
      Animated.sequence([
        Animated.timing(scaleA, { toValue: 0.94, duration: 80,  useNativeDriver: true }),
        Animated.spring(scaleA,  { toValue: 1,    tension: 120, friction: 6, useNativeDriver: true }),
      ]).start();
    }
  }, [selected]);

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => onSelect(role.id)}
      style={[s.roleOuter, { width: (width - 56 - 10) / 2 }]}>
      <Animated.View style={[
        s.roleCard,
        { transform: [{ scale: scaleA }] },
        selected
          ? { borderColor: role.color, backgroundColor: role.bg }
          : { borderColor: '#1A2840', backgroundColor: '#0D1A2E' },
      ]}>
        {selected && (
          <View style={[s.checkBadge, { backgroundColor: role.color }]}>
            <Ionicons name="checkmark" size={11} color="#080C18" />
          </View>
        )}
        <Text style={s.roleEmoji}>{role.emoji}</Text>
        <Text style={[s.roleLabel, { color: selected ? role.color : '#FFF' }]}>{role.label}</Text>
        <Text style={s.roleSub}>{role.sub}</Text>
        {selected && (
          <View style={s.perks}>
            {role.perks.map(p => (
              <View key={p} style={s.perkRow}>
                <View style={[s.perkDot, { backgroundColor: role.color }]} />
                <Text style={[s.perkTxt, { color: role.color + 'CC' }]}>{p}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Progress bar ──────────────────────────────────────────────────────────────
const ProgressBar = ({ step, total, accent }) => (
  <View style={s.progRow}>
    {Array.from({ length: total }).map((_, i) => (
      <React.Fragment key={i}>
        <View style={[s.progDot, { backgroundColor: step > i ? accent : '#1A2840' }]}>
          <Text style={[s.progNum, { color: step > i ? '#080C18' : '#3A5070' }]}>{i + 1}</Text>
        </View>
        {i < total - 1 && (
          <View style={[s.progLine, { backgroundColor: step > i + 1 ? accent : '#1A2840' }]} />
        )}
      </React.Fragment>
    ))}
  </View>
);

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const [step,      setStep]      = useState(1);
  const [roleId,    setRoleId]    = useState(null);

  // Step 2 — account fields (all roles)
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [password,  setPassword]  = useState('');

  // Step 3 — driver fields (DRIVER only)
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleType,   setVehicleType]   = useState('');
  const [vehicleMake,   setVehicleMake]   = useState('');
  const [vehicleModel,  setVehicleModel]  = useState('');
  const [vehicleYear,   setVehicleYear]   = useState('');
  const [vehicleColor,  setVehicleColor]  = useState('');
  const [vehiclePlate,  setVehiclePlate]  = useState('');

  // Step 3 — courier fields (DELIVERY_PARTNER only)
  const [courierVehicleType,  setCourierVehicleType]  = useState('');
  const [courierVehiclePlate, setCourierVehiclePlate] = useState('');

  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const slideO = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(36)).current;

  const animateIn = () => {
    slideO.setValue(0); slideY.setValue(36);
    Animated.parallel([
      Animated.timing(slideO, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => { animateIn(); }, []);

  const activeRole = ROLES.find(r => r.id === roleId);
  const accent     = activeRole?.color || '#00D4FF';
  const totalSteps = activeRole?.steps || 2;

  const pwdStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const pwdColors   = ['#1A2840', '#FF6B6B', '#FFB800', accent];

  // ── Step navigation ──
  const goToStep = (n) => { setStep(n); animateIn(); };

  const handleStep1 = () => {
    if (!roleId) return Alert.alert('Choose Your Role', 'Please select how you want to use DuoRide.');
    goToStep(2);
  };

  const handleStep2 = () => {
    if (!firstName || !lastName || !email || !phone || !password)
      return Alert.alert('Missing Fields', 'Please fill in all fields.');
    if (password.length < 8)
      return Alert.alert('Weak Password', 'Password must be at least 8 characters.');

    if (roleId === 'CUSTOMER') {
      // Customers: register directly, no step 3
      handleFinalRegister();
    } else {
      goToStep(3);
    }
  };

  const handleStep3 = async () => {
    if (roleId === 'DRIVER') {
      if (!licenseNumber || !vehicleType || !vehicleMake || !vehicleModel || !vehicleYear || !vehicleColor || !vehiclePlate)
        return Alert.alert('Missing Fields', 'Please fill in all vehicle details.');
      const year = parseInt(vehicleYear);
      if (isNaN(year) || year < 1990 || year > new Date().getFullYear() + 1)
        return Alert.alert('Invalid Year', 'Please enter a valid vehicle year (1990 or later).');
    }
    if (roleId === 'DELIVERY_PARTNER') {
      if (!courierVehicleType)
        return Alert.alert('Missing Fields', 'Please select your vehicle type.');
    }
    handleFinalRegister();
  };

  const handleFinalRegister = async () => {
    setLoading(true);
    try {
      // Step A: Create the account
      const res = await register({ firstName, lastName, email, phone, password, role: roleId });
      if (!res.success) {
        setLoading(false);
        return Alert.alert('Registration Failed', res.message);
      }

      // Step B: Submit role profile if needed
      if (roleId === 'DRIVER') {
        try {
          await driverAPI.updateProfile({
            licenseNumber,
            vehicleType,
            vehicleMake,
            vehicleModel,
            vehicleYear: parseInt(vehicleYear),
            vehicleColor,
            vehiclePlate,
            // Documents uploaded separately via profile screen
          });
        } catch (profileErr) {
          // Account created but profile failed — user can complete later
          Alert.alert(
            'Almost Done!',
            'Account created! Please complete your vehicle documents in your profile to start accepting rides.',
          );
        }
      }

      if (roleId === 'DELIVERY_PARTNER') {
        try {
          await partnerAPI.updateProfile({
            vehicleType: courierVehicleType,
            ...(courierVehiclePlate && { vehiclePlate: courierVehiclePlate }),
            // idImageUrl uploaded separately via profile screen
          });
        } catch (profileErr) {
          Alert.alert(
            'Almost Done!',
            'Account created! Please upload your ID documents in your profile to start accepting deliveries.',
          );
        }
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080C18" />
      <View style={[s.orb1, activeRole && { backgroundColor: activeRole.color }]} />
      <View style={s.orb2} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Back button */}
          <TouchableOpacity
            style={s.back}
            onPress={() => step === 1 ? navigation.goBack() : goToStep(step - 1)}>
            <Ionicons name="arrow-back" size={20} color="#5A7A9A" />
          </TouchableOpacity>

          {/* Progress */}
          <ProgressBar step={step} total={totalSteps || 2} accent={accent} />

          <Animated.View style={{ opacity: slideO, transform: [{ translateY: slideY }] }}>

            {/* ── STEP 1: Role Selection ── */}
            {step === 1 && (
              <>
                <Text style={s.eyebrow}>STEP 1 OF {totalSteps || 2}</Text>
                <Text style={s.title}>Who are{'\n'}you joining as?</Text>
                <Text style={s.subtitle}>Select your role to get started</Text>

                <View style={s.rolesGrid}>
                  {ROLES.map(r => (
                    <RoleCard key={r.id} role={r} selected={roleId === r.id} onSelect={setRoleId} />
                  ))}
                </View>

                <TouchableOpacity
                  style={[s.btn, !roleId && s.btnOff, roleId && { backgroundColor: accent, shadowColor: accent }]}
                  activeOpacity={0.85} onPress={handleStep1}>
                  <Text style={s.btnTxt}>Continue</Text>
                  <Ionicons name="arrow-forward-circle-outline" size={22} color="#080C18" />
                </TouchableOpacity>

                <TouchableOpacity style={s.altLink} onPress={() => navigation.navigate('Login')}>
                  <Text style={s.altTxt}>Already have an account?{'  '}
                    <Text style={s.altBold}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 2: Account Details (all roles) ── */}
            {step === 2 && (
              <>
                {/* Role badge */}
                <View style={[s.roleBadge, { borderColor: accent + '40', backgroundColor: activeRole?.bg }]}>
                  <Text style={{ fontSize: 26 }}>{activeRole?.emoji}</Text>
                  <View>
                    <Text style={[s.badgeRole, { color: accent }]}>Joining as {activeRole?.label}</Text>
                    <Text style={s.badgeSub}>{activeRole?.sub}</Text>
                  </View>
                </View>

                <Text style={[s.eyebrow, { color: accent }]}>STEP 2 OF {totalSteps}</Text>
                <Text style={s.title}>Your Account{'\n'}Details</Text>
                <Text style={s.subtitle}>Personal information for your account</Text>

                <View style={s.nameRow}>
                  <View style={{ flex: 1 }}>
                    <FloatInput label="First Name" iconName="person-outline"
                      value={firstName} onChangeText={setFirstName}
                      autoCapitalize="words" accentColor={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FloatInput label="Last Name" iconName="person-outline"
                      value={lastName} onChangeText={setLastName}
                      autoCapitalize="words" accentColor={accent} />
                  </View>
                </View>

                <FloatInput label="Email Address" iconName="mail-outline"
                  value={email} onChangeText={setEmail}
                  keyboardType="email-address" accentColor={accent} />

                <FloatInput label="Phone Number" iconName="call-outline"
                  value={phone} onChangeText={setPhone}
                  keyboardType="phone-pad" accentColor={accent} />

                <FloatInput label="Password (min 8 chars)" iconName="lock-closed-outline"
                  value={password} onChangeText={setPassword}
                  secureTextEntry accentColor={accent} />

                {/* Password strength */}
                {password.length > 0 && (
                  <View style={s.strengthRow}>
                    {[1,2,3].map(lvl => (
                      <View key={lvl} style={[s.strengthBar, { backgroundColor: pwdStrength >= lvl ? pwdColors[lvl] : '#1A2840' }]} />
                    ))}
                    <Text style={s.strengthLbl}>{['','Weak','Fair','Strong'][pwdStrength]}</Text>
                  </View>
                )}

                {/* CUSTOMER: show terms before final submit */}
                {roleId === 'CUSTOMER' && (
                  <Text style={s.terms}>
                    By continuing you agree to our{' '}
                    <Text style={[s.termsLink, { color: accent }]}>Terms</Text>
                    {' '}&{' '}
                    <Text style={[s.termsLink, { color: accent }]}>Privacy Policy</Text>
                  </Text>
                )}

                <TouchableOpacity
                  style={[s.btn, loading && s.btnDim, { backgroundColor: accent, shadowColor: accent }]}
                  activeOpacity={0.85} onPress={handleStep2} disabled={loading}>
                  <Text style={s.btnTxt}>
                    {loading ? 'Creating Account...' : roleId === 'CUSTOMER' ? 'Create Account' : 'Next: Vehicle Info'}
                  </Text>
                  {!loading && (
                    <Ionicons
                      name={roleId === 'CUSTOMER' ? 'rocket-outline' : 'arrow-forward-circle-outline'}
                      size={22} color="#080C18" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={s.altLink} onPress={() => navigation.navigate('Login')}>
                  <Text style={s.altTxt}>Already have an account?{'  '}
                    <Text style={[s.altBold, { color: accent }]}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 3a: Driver Vehicle Details ── */}
            {step === 3 && roleId === 'DRIVER' && (
              <>
                <View style={[s.roleBadge, { borderColor: accent + '40', backgroundColor: activeRole?.bg }]}>
                  <Text style={{ fontSize: 26 }}>🚗</Text>
                  <View>
                    <Text style={[s.badgeRole, { color: accent }]}>Driver Profile Setup</Text>
                    <Text style={s.badgeSub}>Vehicle & license information</Text>
                  </View>
                </View>

                <Text style={[s.eyebrow, { color: accent }]}>STEP 3 OF 3</Text>
                <Text style={s.title}>Vehicle{'\n'}Details</Text>
                <Text style={s.subtitle}>Required to start accepting rides</Text>

                <FloatInput label="Driver License Number" iconName="card-outline"
                  value={licenseNumber} onChangeText={setLicenseNumber}
                  autoCapitalize="characters" accentColor={accent} />

                <VehiclePicker value={vehicleType} onSelect={setVehicleType} accentColor={accent} />

                <View style={s.nameRow}>
                  <View style={{ flex: 1 }}>
                    <FloatInput label="Make (e.g. Toyota)" iconName="car-outline"
                      value={vehicleMake} onChangeText={setVehicleMake}
                      autoCapitalize="words" accentColor={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FloatInput label="Model (e.g. Camry)" iconName="car-outline"
                      value={vehicleModel} onChangeText={setVehicleModel}
                      autoCapitalize="words" accentColor={accent} />
                  </View>
                </View>

                <View style={s.nameRow}>
                  <View style={{ flex: 1 }}>
                    <FloatInput label="Year (e.g. 2020)" iconName="calendar-outline"
                      value={vehicleYear} onChangeText={setVehicleYear}
                      keyboardType="numeric" accentColor={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FloatInput label="Color" iconName="color-palette-outline"
                      value={vehicleColor} onChangeText={setVehicleColor}
                      autoCapitalize="words" accentColor={accent} />
                  </View>
                </View>

                <FloatInput label="Plate Number" iconName="document-text-outline"
                  value={vehiclePlate} onChangeText={setVehiclePlate}
                  autoCapitalize="characters" accentColor={accent} />

                {/* Documents note */}
                <View style={[s.docNote, { borderColor: accent + '30' }]}>
                  <Ionicons name="information-circle-outline" size={18} color={accent} />
                  <Text style={[s.docNoteTxt, { color: accent + 'BB' }]}>
                    License photo, vehicle registration & insurance can be uploaded in your profile after account creation.
                  </Text>
                </View>

                <Text style={s.terms}>
                  By continuing you agree to our{' '}
                  <Text style={[s.termsLink, { color: accent }]}>Terms</Text>
                  {' '}&{' '}
                  <Text style={[s.termsLink, { color: accent }]}>Privacy Policy</Text>
                </Text>

                <TouchableOpacity
                  style={[s.btn, loading && s.btnDim, { backgroundColor: accent, shadowColor: accent }]}
                  activeOpacity={0.85} onPress={handleStep3} disabled={loading}>
                  <Text style={s.btnTxt}>{loading ? 'Creating Account...' : 'Create Driver Account'}</Text>
                  {!loading && <Ionicons name="rocket-outline" size={22} color="#080C18" />}
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 3b: Courier Vehicle Details ── */}
            {step === 3 && roleId === 'DELIVERY_PARTNER' && (
              <>
                <View style={[s.roleBadge, { borderColor: accent + '40', backgroundColor: activeRole?.bg }]}>
                  <Text style={{ fontSize: 26 }}>🛵</Text>
                  <View>
                    <Text style={[s.badgeRole, { color: accent }]}>Courier Profile Setup</Text>
                    <Text style={s.badgeSub}>Your delivery vehicle info</Text>
                  </View>
                </View>

                <Text style={[s.eyebrow, { color: accent }]}>STEP 3 OF 3</Text>
                <Text style={s.title}>Courier{'\n'}Vehicle</Text>
                <Text style={s.subtitle}>Tell us about your delivery vehicle</Text>

                <VehiclePicker value={courierVehicleType} onSelect={setCourierVehicleType} accentColor={accent} />

                <FloatInput label="Plate Number (optional)" iconName="document-text-outline"
                  value={courierVehiclePlate} onChangeText={setCourierVehiclePlate}
                  autoCapitalize="characters" accentColor={accent} />

                {/* Documents note */}
                <View style={[s.docNote, { borderColor: accent + '30' }]}>
                  <Ionicons name="information-circle-outline" size={18} color={accent} />
                  <Text style={[s.docNoteTxt, { color: accent + 'BB' }]}>
                    Your ID document and vehicle image can be uploaded in your profile. Account approval is required before you can accept deliveries.
                  </Text>
                </View>

                <Text style={s.terms}>
                  By continuing you agree to our{' '}
                  <Text style={[s.termsLink, { color: accent }]}>Terms</Text>
                  {' '}&{' '}
                  <Text style={[s.termsLink, { color: accent }]}>Privacy Policy</Text>
                </Text>

                <TouchableOpacity
                  style={[s.btn, loading && s.btnDim, { backgroundColor: accent, shadowColor: accent }]}
                  activeOpacity={0.85} onPress={handleStep3} disabled={loading}>
                  <Text style={s.btnTxt}>{loading ? 'Creating Account...' : 'Create Courier Account'}</Text>
                  {!loading && <Ionicons name="rocket-outline" size={22} color="#080C18" />}
                </TouchableOpacity>

                <TouchableOpacity style={s.altLink} onPress={() => navigation.navigate('Login')}>
                  <Text style={s.altTxt}>Already have an account?{'  '}
                    <Text style={[s.altBold, { color: accent }]}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080C18' },
  orb1: { position:'absolute', width:width*1.1, height:width*1.1, borderRadius:width*0.55,
    backgroundColor:'#00D4FF', top:-width*0.7, right:-width*0.3, opacity:0.04 },
  orb2: { position:'absolute', width:width*0.8, height:width*0.8, borderRadius:width*0.4,
    backgroundColor:'#A78BFA', bottom:-width*0.3, left:-width*0.2, opacity:0.04 },

  scroll: { paddingHorizontal:28, paddingBottom:64 },

  back: { marginTop: Platform.OS==='ios' ? 56 : 40, width:44, height:44, borderRadius:12,
    backgroundColor:'#0D1A2E', borderWidth:1, borderColor:'#1A2840',
    justifyContent:'center', alignItems:'center', marginBottom:20 },

  // Progress
  progRow: { flexDirection:'row', alignItems:'center', marginBottom:28 },
  progDot: { width:28, height:28, borderRadius:14, justifyContent:'center', alignItems:'center' },
  progNum: { fontSize:13, fontWeight:'800' },
  progLine: { flex:1, height:2, backgroundColor:'#1A2840', marginHorizontal:6 },

  // Typography
  eyebrow: { fontSize:11, letterSpacing:4, color:'#00D4FF', fontWeight:'700', marginBottom:10 },
  title: { fontSize:34, fontWeight:'900', color:'#FFF', lineHeight:40, marginBottom:8, letterSpacing:-0.5 },
  subtitle: { fontSize:15, color:'#5A7A9A', marginBottom:28 },

  // Role cards
  rolesGrid: { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:28 },
  roleOuter: {},
  roleCard: { borderRadius:18, borderWidth:1.5, padding:16, minHeight:130 },
  checkBadge: { position:'absolute', top:10, right:10, width:20, height:20,
    borderRadius:10, justifyContent:'center', alignItems:'center' },
  roleEmoji: { fontSize:30, marginBottom:8 },
  roleLabel: { fontSize:16, fontWeight:'800', marginBottom:3 },
  roleSub: { fontSize:11, color:'#5A7A9A', lineHeight:15 },
  perks: { marginTop:10, gap:5 },
  perkRow: { flexDirection:'row', alignItems:'center', gap:5 },
  perkDot: { width:5, height:5, borderRadius:3 },
  perkTxt: { fontSize:10, fontWeight:'600' },

  // Role badge (step 2+)
  roleBadge: { flexDirection:'row', alignItems:'center', gap:12, padding:14,
    borderRadius:14, borderWidth:1, marginBottom:24 },
  badgeRole: { fontSize:14, fontWeight:'800', letterSpacing:0.3 },
  badgeSub: { fontSize:12, color:'#5A7A9A', marginTop:2 },

  // Inputs
  nameRow: { flexDirection:'row', gap:10 },
  inputBox: { flexDirection:'row', alignItems:'center', backgroundColor:'#0D1A2E',
    borderRadius:14, borderWidth:1.5, marginBottom:12, height:62, paddingHorizontal:14 },
  inputIcon: { marginRight:10 },
  floatLabel: { position:'absolute', left:0 },
  inputText: { color:'#FFF', fontSize:15, paddingTop:18, paddingBottom:4, fontWeight:'500' },
  eyeBtn: { padding:6, marginLeft:4 },

  // Vehicle type picker
  pickerWrap: { marginBottom:12 },
  pickerLabel: { fontSize:11, fontWeight:'700', letterSpacing:2, marginBottom:8 },
  pickerRow: { flexDirection:'row', gap:8 },
  pickerOption: { flex:1, height:44, borderRadius:10, borderWidth:1.5,
    justifyContent:'center', alignItems:'center', backgroundColor:'#0D1A2E' },
  pickerOptionTxt: { fontSize:11, fontWeight:'700', letterSpacing:0.5 },

  // Password strength
  strengthRow: { flexDirection:'row', alignItems:'center', gap:6, marginBottom:14, marginTop:-4 },
  strengthBar: { flex:1, height:3, borderRadius:2 },
  strengthLbl: { fontSize:11, color:'#5A7A9A', fontWeight:'600', minWidth:36 },

  // Documents note
  docNote: { flexDirection:'row', gap:10, alignItems:'flex-start', padding:14,
    borderRadius:12, borderWidth:1, backgroundColor:'#0A0F1A', marginBottom:16 },
  docNoteTxt: { flex:1, fontSize:12, lineHeight:18 },

  // Terms
  terms: { fontSize:12, color:'#3A5070', textAlign:'center', lineHeight:18, marginBottom:20, marginTop:4 },
  termsLink: { fontWeight:'700' },

  // Buttons
  btn: { borderRadius:16, height:58, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10,
    shadowOffset:{width:0,height:10}, shadowOpacity:0.5, shadowRadius:22, elevation:12, marginBottom:20 },
  btnOff: { backgroundColor:'#1A2840', shadowOpacity:0 },
  btnDim: { opacity:0.6 },
  btnTxt: { color:'#080C18', fontSize:17, fontWeight:'800', letterSpacing:0.3 },

  altLink: { alignItems:'center', paddingVertical:10 },
  altTxt: { color:'#5A7A9A', fontSize:14 },
  altBold: { color:'#00D4FF', fontWeight:'700' },
});