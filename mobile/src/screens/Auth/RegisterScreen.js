// mobile/src/screens/Auth/RegisterScreen.js
// ── Premium Glass Edition • Onyx Theme ───────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useAuth }        from '../../context/AuthContext';
import { useTheme }       from '../../context/ThemeContext';
import { driverAPI, partnerAPI } from '../../services/api';

const { width } = Dimensions.get('window');

const G = {
  card:    (mode) => mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.82)',
  border:  (mode) => mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
  borderHi:(mode) => mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)',
  icon:    (mode) => mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
};

const ROLES = [
  { id:'CUSTOMER',         label:'Rider',   sub:'Book rides & send packages', emoji:'🧑‍💼', steps:2, perks:['Book instant rides','Send packages','Track in real-time'] },
  { id:'DRIVER',           label:'Driver',  sub:'Drive passengers & earn',    emoji:'🚗',  steps:3, perks:['Set your own hours','Weekly payouts','Bonus rewards'] },
  { id:'DELIVERY_PARTNER', label:'Courier', sub:'Deliver packages daily',     emoji:'🛵',  steps:3, perks:['Multiple pickups','Route optimization','Daily payouts'] },
];

const VEHICLE_TYPES = [
  { value:'CAR',        label:'Car',        icon:'car-outline'     },
  { value:'BIKE',       label:'Bike',       icon:'bicycle-outline' },
  { value:'MOTORCYCLE', label:'Motorcycle', icon:'bicycle-outline' },
  { value:'VAN',        label:'Van',        icon:'bus-outline'     },
];

const COURIER_VEHICLE_TYPES = [
  { value:'BIKE',       label:'Bike',       icon:'bicycle-outline' },
  { value:'MOTORCYCLE', label:'Motorcycle', icon:'bicycle-outline' },
  { value:'CAR',        label:'Car',        icon:'car-outline'     },
  { value:'VAN',        label:'Van',        icon:'bus-outline'     },
];

// ── Glass Float Input ─────────────────────────────────────────────────────────
const FloatInput = ({ label, iconName, value, onChangeText, keyboardType, autoCapitalize, secureTextEntry }) => {
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

  const borderC  = borderA.interpolate({ inputRange:[0,1], outputRange:[G.border(mode), mode==='dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.20)'] });
  const top      = labelY.interpolate({ inputRange:[0,1], outputRange:[19,7] });
  const fontSize = labelY.interpolate({ inputRange:[0,1], outputRange:[15,11] });
  const lColor   = labelY.interpolate({ inputRange:[0,1], outputRange:[theme.hint, mode==='dark' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'] });

  return (
    <Animated.View style={[s.inputBox, { backgroundColor: G.card(mode), borderColor: borderC, overflow:'hidden' }]}>
      <LinearGradient
        colors={mode==='dark' ? ['rgba(255,255,255,0.04)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.9)','rgba(255,255,255,0.75)']}
        start={{ x:0, y:0 }} end={{ x:1, y:1 }}
        style={StyleSheet.absoluteFill}
      />
      <Ionicons name={iconName} size={17} color={focused ? (mode==='dark' ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.50)') : theme.hint} style={s.inputIcon} />
      <View style={{ flex:1 }}>
        <Animated.Text style={[s.floatLabel, { top, fontSize, color: lColor }]}>{label}</Animated.Text>
        <TextInput
          style={[s.inputText, { color: theme.foreground }]}
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
          <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={17} color={theme.hint} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

// ── Vehicle Picker ────────────────────────────────────────────────────────────
const VehiclePicker = ({ value, onSelect, options = VEHICLE_TYPES, theme, mode }) => (
  <View style={s.pickerWrap}>
    <Text style={[s.pickerLabel, { color: theme.hint }]}>VEHICLE TYPE</Text>
    <View style={s.pickerGrid}>
      {options.map(type => {
        const selected = value === type.value;
        return (
          <TouchableOpacity
            key={type.value}
            style={[s.pickerOption, {
              backgroundColor: selected ? G.card(mode) : G.icon(mode),
              borderColor:     selected ? G.borderHi(mode) : G.border(mode),
              overflow:'hidden',
            }]}
            onPress={() => onSelect(type.value)}
            activeOpacity={0.8}
          >
            {selected && (
              <LinearGradient
                colors={mode==='dark' ? ['rgba(255,255,255,0.08)','rgba(255,255,255,0.03)'] : ['rgba(255,255,255,0.95)','rgba(255,255,255,0.80)']}
                start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Ionicons name={type.icon} size={20} color={selected ? theme.foreground : theme.hint} />
            <Text style={[s.pickerOptionTxt, { color: selected ? theme.foreground : theme.hint }]}>{type.label}</Text>
            {selected && (
              <View style={[s.pickerCheck, { backgroundColor: G.border(mode) }]}>
                <Ionicons name="checkmark" size={10} color={theme.foreground} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

// ── Role Card ─────────────────────────────────────────────────────────────────
const RoleCard = ({ role, selected, onSelect, theme, mode }) => {
  const scaleA = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (selected) {
      Animated.sequence([
        Animated.timing(scaleA, { toValue:0.94, duration:80, useNativeDriver:true }),
        Animated.spring(scaleA, { toValue:1, tension:120, friction:6, useNativeDriver:true }),
      ]).start();
    }
  }, [selected]);

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={() => onSelect(role.id)} style={[s.roleOuter, { width:(width - 56 - 10) / 2 }]}>
      <Animated.View style={[s.roleCard, {
        transform:[{ scale: scaleA }],
        borderColor: selected ? G.borderHi(mode) : G.border(mode),
        overflow:'hidden',
      }]}>
        <LinearGradient
          colors={selected
            ? (mode==='dark' ? ['rgba(255,255,255,0.09)','rgba(255,255,255,0.04)'] : ['rgba(255,255,255,0.95)','rgba(255,255,255,0.80)'])
            : (mode==='dark' ? ['rgba(255,255,255,0.04)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.80)','rgba(255,255,255,0.60)'])
          }
          start={{ x:0, y:0 }} end={{ x:1, y:1 }}
          style={StyleSheet.absoluteFill}
        />
        {selected && <View style={[s.roleShimmer, { backgroundColor: G.borderHi(mode) }]} />}
        {selected && (
          <View style={[s.checkBadge, { backgroundColor: G.card(mode), borderColor: G.border(mode), borderWidth:1 }]}>
            <Ionicons name="checkmark" size={11} color={theme.foreground} />
          </View>
        )}
        <Text style={s.roleEmoji}>{role.emoji}</Text>
        <Text style={[s.roleLabel, { color: theme.foreground }]}>{role.label}</Text>
        <Text style={[s.roleSub, { color: theme.hint }]}>{role.sub}</Text>
        {selected && (
          <View style={s.perks}>
            {role.perks.map(p => (
              <View key={p} style={s.perkRow}>
                <View style={[s.perkDot, { backgroundColor: theme.foreground }]} />
                <Text style={[s.perkTxt, { color: theme.hint }]}>{p}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── Progress Bar ──────────────────────────────────────────────────────────────
const ProgressBar = ({ step, total, theme, mode }) => (
  <View style={s.progRow}>
    {Array.from({ length: total }).map((_, i) => (
      <React.Fragment key={i}>
        <View style={[s.progDot, {
          backgroundColor: step > i ? theme.foreground : G.icon(mode),
          borderWidth: step > i ? 0 : 1,
          borderColor: G.border(mode),
        }]}>
          <Text style={[s.progNum, { color: step > i ? theme.background : theme.hint }]}>{i + 1}</Text>
        </View>
        {i < total - 1 && (
          <View style={[s.progLine, { flex:1, backgroundColor: step > i + 1 ? theme.foreground : G.border(mode) }]} />
        )}
      </React.Fragment>
    ))}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const darkMode = mode === 'dark';

  const [step,      setStep]      = useState(1);
  const [roleId,    setRoleId]    = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [password,  setPassword]  = useState('');

  const [licenseNumber,  setLicenseNumber]  = useState('');
  const [vehicleType,    setVehicleType]    = useState('');
  const [vehicleMake,    setVehicleMake]    = useState('');
  const [vehicleModel,   setVehicleModel]   = useState('');
  const [vehicleYear,    setVehicleYear]    = useState('');
  const [vehicleColor,   setVehicleColor]   = useState('');
  const [vehiclePlate,   setVehiclePlate]   = useState('');

  const [courierVehicleType,  setCourierVehicleType]  = useState('');
  const [courierVehiclePlate, setCourierVehiclePlate] = useState('');

  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const slideO = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(36)).current;

  const animateIn = () => {
    slideO.setValue(0); slideY.setValue(36);
    Animated.parallel([
      Animated.timing(slideO, { toValue:1, duration:480, useNativeDriver:true }),
      Animated.timing(slideY, { toValue:0, duration:480, useNativeDriver:true }),
    ]).start();
  };
  useEffect(() => { animateIn(); }, []);

  const activeRole = ROLES.find(r => r.id === roleId);
  const totalSteps = activeRole?.steps || 2;

  const pwdStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const pwdColors   = [G.border(mode), '#FF6B6B', '#FFB800', theme.foreground];

  const goToStep = (n) => { setStep(n); animateIn(); };

  const handleStep1 = () => {
    if (!roleId) return Alert.alert('Choose Your Role', 'Please select how you want to use Diakite.');
    goToStep(2);
  };

  const handleStep2 = () => {
    if (!firstName || !lastName || !email || !phone || !password)
      return Alert.alert('Missing Fields', 'Please fill in all fields.');
    if (password.length < 8)
      return Alert.alert('Weak Password', 'Password must be at least 8 characters.');
    if (roleId === 'CUSTOMER') handleFinalRegister(); else goToStep(3);
  };

  const handleStep3 = () => {
    if (roleId === 'DRIVER') {
      if (!licenseNumber) return Alert.alert('Missing Fields', 'Please enter your license number.');
      if (!vehicleType)   return Alert.alert('Missing Fields', 'Please select your vehicle type.');
      if (!vehicleMake || !vehicleModel || !vehicleYear || !vehicleColor || !vehiclePlate)
        return Alert.alert('Missing Fields', 'Please fill in all vehicle details.');
      const year = parseInt(vehicleYear);
      if (isNaN(year) || year < 1990 || year > new Date().getFullYear() + 1)
        return Alert.alert('Invalid Year', 'Please enter a valid vehicle year.');
    }
    if (roleId === 'DELIVERY_PARTNER' && !courierVehicleType)
      return Alert.alert('Missing Fields', 'Please select your vehicle type.');
    handleFinalRegister();
  };

  const handleFinalRegister = async () => {
  setLoading(true);
  try {
    const res = await register({
      firstName,
      lastName,
      email,
      phone,
      password,
      role: roleId,
    });

    // ── Validation or server error ──────────────────────────────────────
    if (!res.success) {
      setLoading(false);
      return Alert.alert('Registration Failed', res.message);
    }

    // ── OTP gated registration (ENABLE_REGISTRATION_OTP=true) ───────────
    if (res.requiresOtp) {
      setLoading(false);
      // Navigate to the same OTP screen used for login 2FA
      navigation.navigate('OtpVerification', {
        tempToken: res.tempToken,
        method: res.method,            // 'SMS' or 'EMAIL'
        maskedContact: res.maskedContact,
        purpose: 'REGISTER',           // optional – OTP screen can handle this
      });
      return;
    }

    // ── Registration succeeded – set up role‑specific profile ───────────
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
        });
      } catch {
        Alert.alert(
          'Almost Done!',
          'Account created! Complete your vehicle documents in your profile.'
        );
      }
    }

    if (roleId === 'DELIVERY_PARTNER') {
      try {
        await partnerAPI.updateProfile({
          vehicleType: courierVehicleType,
          ...(courierVehiclePlate && { vehiclePlate: courierVehiclePlate }),
        });
      } catch {
        Alert.alert(
          'Almost Done!',
          'Account created! Upload your ID documents in your profile.'
        );
      }
    }

    // Registration + profile setup finished
    // AuthContext already logged the user in (persisted session)
    // No need to call anything else – navigation will happen automatically
  } catch (err) {
    Alert.alert('Error', err.message || 'Something went wrong.');
  } finally {
    setLoading(false);
  }
};

  // ── Shared CTA button ───────────────────────────────────────────────────────
  const PrimaryBtn = ({ label, onPress, disabled, icon }) => (
    <TouchableOpacity
      style={[s.btn, disabled && s.btnDim, { overflow:'hidden' }]}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
    >
      <LinearGradient
        colors={darkMode ? ['rgba(255,255,255,1)','rgba(210,210,210,1)'] : ['rgba(0,0,0,1)','rgba(25,25,25,1)']}
        start={{ x:0, y:0 }} end={{ x:1, y:1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.btnShimmer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.15)' }]} />
      <Text style={[s.btnTxt, { color: theme.accentFg }]}>{label}</Text>
      {icon && <Ionicons name={icon} size={22} color={theme.accentFg} />}
    </TouchableOpacity>
  );

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Ambient orbs */}
      <View style={[s.orb1, { backgroundColor: darkMode ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)' }]} />
      <View style={[s.orb2, { backgroundColor: darkMode ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)' }]} />

      <KeyboardAvoidingView
        style={{ flex:1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back */}
          <TouchableOpacity
            style={[s.back, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}
            onPress={() => step === 1 ? navigation.goBack() : goToStep(step - 1)}
          >
            <Ionicons name="arrow-back" size={20} color={theme.foreground} />
          </TouchableOpacity>

          <ProgressBar step={step} total={totalSteps || 2} theme={theme} mode={mode} />

          <Animated.View style={{ opacity: slideO, transform:[{ translateY: slideY }] }}>

            {/* ── STEP 1 — choose role ── */}
            {step === 1 && (
              <>
                <View style={[s.pillLabel, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}>
                  <View style={[s.pillDot, { backgroundColor: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }]} />
                  <Text style={[s.eyebrow, { color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>STEP 1 OF {totalSteps || 2}</Text>
                </View>
                <Text style={[s.title, { color: theme.foreground }]}>Who are{'\n'}you joining as?</Text>
                <Text style={[s.subtitle, { color: theme.hint }]}>Select your role to get started</Text>
                <View style={s.rolesGrid}>
                  {ROLES.map(r => (
                    <RoleCard key={r.id} role={r} selected={roleId === r.id} onSelect={setRoleId} theme={theme} mode={mode} />
                  ))}
                </View>
                {/* Disabled state: glass outline; enabled: solid gradient */}
                {roleId ? (
                  <PrimaryBtn label="Continue" onPress={handleStep1} icon="arrow-forward-circle-outline" />
                ) : (
                  <TouchableOpacity
                    style={[s.btn, s.btnOff, { borderColor: G.border(mode), overflow:'hidden' }]}
                    activeOpacity={0.6}
                    onPress={handleStep1}
                  >
                    <LinearGradient
                      colors={darkMode ? ['rgba(255,255,255,0.06)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.70)']}
                      start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={[s.btnTxt, { color: theme.hint }]}>Continue</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.altLink} onPress={() => navigation.navigate('Login')}>
                  <Text style={[s.altTxt, { color: theme.hint }]}>
                    Already have an account?{'  '}
                    <Text style={[s.altBold, { color: theme.foreground }]}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 2 — personal details ── */}
            {step === 2 && (
              <>
                {/* Role badge — matches LoginScreen logoBadge style */}
                <View style={[s.roleBadge, { backgroundColor: G.card(mode), borderColor: G.border(mode), overflow:'hidden' }]}>
                  <LinearGradient
                    colors={darkMode ? ['rgba(255,255,255,0.06)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.70)']}
                    start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={{ fontSize:26 }}>{activeRole?.emoji}</Text>
                  <View>
                    <Text style={[s.badgeRole, { color: theme.foreground }]}>Joining as {activeRole?.label}</Text>
                    <Text style={[s.badgeSub, { color: theme.hint }]}>{activeRole?.sub}</Text>
                  </View>
                </View>

                <View style={[s.pillLabel, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}>
                  <View style={[s.pillDot, { backgroundColor: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }]} />
                  <Text style={[s.eyebrow, { color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>STEP 2 OF {totalSteps}</Text>
                </View>
                <Text style={[s.title, { color: theme.foreground }]}>Your Account{'\n'}Details</Text>
                <Text style={[s.subtitle, { color: theme.hint }]}>Personal information for your account</Text>

                <View style={s.nameRow}>
                  <View style={{ flex:1 }}><FloatInput label="First Name" iconName="person-outline" value={firstName} onChangeText={setFirstName} autoCapitalize="words" /></View>
                  <View style={{ flex:1 }}><FloatInput label="Last Name"  iconName="person-outline" value={lastName}  onChangeText={setLastName}  autoCapitalize="words" /></View>
                </View>
                <FloatInput label="Email Address"          iconName="mail-outline"        value={email}    onChangeText={setEmail}    keyboardType="email-address" />
                <FloatInput label="Phone Number"           iconName="call-outline"        value={phone}    onChangeText={setPhone}    keyboardType="phone-pad" />
                <FloatInput label="Password (min 8 chars)" iconName="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry />

                {password.length > 0 && (
                  <View style={s.strengthRow}>
                    {[1, 2, 3].map(lvl => (
                      <View key={lvl} style={[s.strengthBar, { backgroundColor: pwdStrength >= lvl ? pwdColors[lvl] : G.border(mode) }]} />
                    ))}
                    <Text style={[s.strengthLbl, { color: theme.hint }]}>{['', 'Weak', 'Fair', 'Strong'][pwdStrength]}</Text>
                  </View>
                )}

                <PrimaryBtn
                  label={loading ? 'Creating Account...' : roleId === 'CUSTOMER' ? 'Create Account' : 'Next: Vehicle Info'}
                  onPress={handleStep2}
                  disabled={loading}
                  icon={!loading ? (roleId === 'CUSTOMER' ? 'rocket-outline' : 'arrow-forward-circle-outline') : null}
                />
              </>
            )}

            {/* ── STEP 3 — DRIVER vehicle details ── */}
            {step === 3 && roleId === 'DRIVER' && (
              <>
                <View style={[s.pillLabel, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}>
                  <View style={[s.pillDot, { backgroundColor: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }]} />
                  <Text style={[s.eyebrow, { color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>STEP 3 OF 3</Text>
                </View>
                <Text style={[s.title, { color: theme.foreground }]}>Vehicle{'\n'}Details</Text>
                <Text style={[s.subtitle, { color: theme.hint }]}>Required to start accepting rides</Text>

                <FloatInput label="Driver License Number" iconName="card-outline" value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" />
                <VehiclePicker value={vehicleType} onSelect={setVehicleType} options={VEHICLE_TYPES} theme={theme} mode={mode} />

                {vehicleType && (
                  <View style={[s.rateHint, { backgroundColor: G.card(mode), borderColor: G.border(mode), overflow:'hidden' }]}>
                    <LinearGradient
                      colors={darkMode ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.70)']}
                      start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons name="information-circle-outline" size={14} color={theme.hint} />
                    <Text style={[s.rateHintTxt, { color: theme.hint }]}>
                      {vehicleType === 'CAR'        && 'CAR — ₦500 base + ₦130/km + ₦15/min. Booking fee: ₦100'}
                      {vehicleType === 'BIKE'       && 'BIKE — ₦200 base + ₦80/km + ₦8/min. Booking fee: ₦50'}
                      {vehicleType === 'MOTORCYCLE' && 'MOTORCYCLE — ₦200 base + ₦80/km + ₦8/min. Booking fee: ₦50'}
                      {vehicleType === 'VAN'        && 'VAN — ₦800 base + ₦180/km + ₦20/min. Booking fee: ₦150'}
                    </Text>
                  </View>
                )}

                <View style={s.nameRow}>
                  <View style={{ flex:1 }}><FloatInput label="Make (e.g. Toyota)" iconName="car-outline" value={vehicleMake}  onChangeText={setVehicleMake}  autoCapitalize="words" /></View>
                  <View style={{ flex:1 }}><FloatInput label="Model (e.g. Camry)" iconName="car-outline" value={vehicleModel} onChangeText={setVehicleModel} autoCapitalize="words" /></View>
                </View>
                <View style={s.nameRow}>
                  <View style={{ flex:1 }}><FloatInput label="Year"  iconName="calendar-outline"      value={vehicleYear}  onChangeText={setVehicleYear}  keyboardType="numeric" /></View>
                  <View style={{ flex:1 }}><FloatInput label="Color" iconName="color-palette-outline" value={vehicleColor} onChangeText={setVehicleColor} autoCapitalize="words" /></View>
                </View>
                <FloatInput label="Plate Number" iconName="document-text-outline" value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" />

                <View style={[s.docNote, { backgroundColor: G.card(mode), borderColor: G.border(mode), overflow:'hidden' }]}>
                  <LinearGradient
                    colors={darkMode ? ['rgba(255,255,255,0.04)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.70)']}
                    start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="information-circle-outline" size={18} color={theme.hint} />
                  <Text style={[s.docNoteTxt, { color: theme.hint }]}>
                    License photo, vehicle registration & insurance can be uploaded after account creation.
                  </Text>
                </View>

                <PrimaryBtn
                  label={loading ? 'Creating Account...' : 'Create Driver Account'}
                  onPress={handleStep3}
                  disabled={loading}
                  icon={!loading ? 'rocket-outline' : null}
                />
              </>
            )}

            {/* ── STEP 3 — COURIER vehicle details ── */}
            {step === 3 && roleId === 'DELIVERY_PARTNER' && (
              <>
                <View style={[s.pillLabel, { backgroundColor: G.card(mode), borderColor: G.border(mode) }]}>
                  <View style={[s.pillDot, { backgroundColor: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)' }]} />
                  <Text style={[s.eyebrow, { color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>STEP 3 OF 3</Text>
                </View>
                <Text style={[s.title, { color: theme.foreground }]}>Courier{'\n'}Vehicle</Text>
                <Text style={[s.subtitle, { color: theme.hint }]}>Tell us about your delivery vehicle</Text>

                <VehiclePicker value={courierVehicleType} onSelect={setCourierVehicleType} options={COURIER_VEHICLE_TYPES} theme={theme} mode={mode} />
                <FloatInput label="Plate Number (optional)" iconName="document-text-outline" value={courierVehiclePlate} onChangeText={setCourierVehiclePlate} autoCapitalize="characters" />

                <View style={[s.docNote, { backgroundColor: G.card(mode), borderColor: G.border(mode), overflow:'hidden' }]}>
                  <LinearGradient
                    colors={darkMode ? ['rgba(255,255,255,0.04)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.70)']}
                    start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="information-circle-outline" size={18} color={theme.hint} />
                  <Text style={[s.docNoteTxt, { color: theme.hint }]}>
                    Your ID document can be uploaded after account creation. Approval required before accepting deliveries.
                  </Text>
                </View>

                <PrimaryBtn
                  label={loading ? 'Creating Account...' : 'Create Courier Account'}
                  onPress={handleStep3}
                  disabled={loading}
                  icon={!loading ? 'rocket-outline' : null}
                />
              </>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:  { flex:1 },
  orb1:  { position:'absolute', width:width*1.1, height:width*1.1, borderRadius:width*0.55, top:-width*0.7, right:-width*0.3 },
  orb2:  { position:'absolute', width:width*0.8, height:width*0.8, borderRadius:width*0.4,  bottom:-width*0.3, left:-width*0.2 },
  scroll:{ paddingHorizontal:28, paddingBottom:64 },

  back: {
    marginTop: Platform.OS === 'ios' ? 58 : 42,
    width:44, height:44, borderRadius:13, borderWidth:1,
    justifyContent:'center', alignItems:'center', marginBottom:22,
  },

  // Progress
  progRow: { flexDirection:'row', alignItems:'center', marginBottom:28 },
  progDot: { width:28, height:28, borderRadius:14, justifyContent:'center', alignItems:'center' },
  progNum: { fontSize:13, fontWeight:'800' },
  progLine:{ height:2, marginHorizontal:6 },

  // Pill eyebrow (matches LoginScreen pillLabel)
  pillLabel: { flexDirection:'row', alignItems:'center', gap:7, borderRadius:20, borderWidth:1, paddingHorizontal:12, paddingVertical:6, alignSelf:'flex-start', marginBottom:16 },
  pillDot:   { width:5, height:5, borderRadius:3 },
  eyebrow:   { fontSize:10, letterSpacing:4, fontWeight:'800' },

  title:   { fontSize:34, fontWeight:'900', lineHeight:40, marginBottom:8, letterSpacing:-0.8 },
  subtitle:{ fontSize:15, fontWeight:'300', marginBottom:28 },

  // Role cards
  rolesGrid:  { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:28 },
  roleOuter:  {},
  roleCard:   { borderRadius:18, borderWidth:1.5, padding:16, minHeight:130, overflow:'hidden' },
  roleShimmer:{ position:'absolute', top:0, left:0, right:0, height:1 },
  checkBadge: { position:'absolute', top:10, right:10, width:20, height:20, borderRadius:10, justifyContent:'center', alignItems:'center' },
  roleEmoji:  { fontSize:30, marginBottom:8 },
  roleLabel:  { fontSize:16, fontWeight:'800', marginBottom:3 },
  roleSub:    { fontSize:11, lineHeight:15 },
  perks:      { marginTop:10, gap:5 },
  perkRow:    { flexDirection:'row', alignItems:'center', gap:5 },
  perkDot:    { width:5, height:5, borderRadius:3 },
  perkTxt:    { fontSize:10, fontWeight:'600' },

  // Role badge (step 2 header)
  roleBadge: { flexDirection:'row', alignItems:'center', gap:12, padding:14, borderRadius:16, borderWidth:1, marginBottom:24, overflow:'hidden' },
  badgeRole: { fontSize:14, fontWeight:'800', letterSpacing:0.3 },
  badgeSub:  { fontSize:12, marginTop:2 },

  nameRow: { flexDirection:'row', gap:10 },

  // Inputs
  inputBox:   { flexDirection:'row', alignItems:'center', borderRadius:14, borderWidth:1.5, marginBottom:12, height:62, paddingHorizontal:14, overflow:'hidden' },
  inputIcon:  { marginRight:10 },
  floatLabel: { position:'absolute', left:0 },
  inputText:  { fontSize:15, paddingTop:18, paddingBottom:4, fontWeight:'500' },
  eyeBtn:     { padding:6, marginLeft:4 },

  // Vehicle picker
  pickerWrap:      { marginBottom:12 },
  pickerLabel:     { fontSize:9, fontWeight:'800', letterSpacing:3, marginBottom:10 },
  pickerGrid:      { flexDirection:'row', flexWrap:'wrap', gap:10 },
  pickerOption:    { width:(width-56-10)/2, borderRadius:14, borderWidth:1.5, paddingVertical:14, paddingHorizontal:12, flexDirection:'row', alignItems:'center', gap:10, overflow:'hidden' },
  pickerOptionTxt: { fontSize:13, fontWeight:'700', flex:1 },
  pickerCheck:     { width:18, height:18, borderRadius:9, justifyContent:'center', alignItems:'center' },

  // Rate hint
  rateHint:    { flexDirection:'row', alignItems:'flex-start', gap:8, borderRadius:12, borderWidth:1, padding:10, marginBottom:14, marginTop:-4, overflow:'hidden' },
  rateHintTxt: { flex:1, fontSize:11, lineHeight:17 },

  // Password strength
  strengthRow: { flexDirection:'row', alignItems:'center', gap:6, marginBottom:14, marginTop:-4 },
  strengthBar: { flex:1, height:3, borderRadius:2 },
  strengthLbl: { fontSize:11, fontWeight:'600', minWidth:36 },

  // Doc note
  docNote:    { flexDirection:'row', gap:10, alignItems:'flex-start', padding:14, borderRadius:14, borderWidth:1, marginBottom:16, overflow:'hidden' },
  docNoteTxt: { flex:1, fontSize:12, lineHeight:18 },

  // Primary button (matches LoginScreen signBtn)
  btn:       { borderRadius:16, height:56, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10, marginBottom:20, overflow:'hidden' },
  btnShimmer:{ position:'absolute', top:0, left:0, right:0, height:1 },
  btnOff:    { borderWidth:1 },
  btnDim:    { opacity:0.6 },
  btnTxt:    { fontSize:16, fontWeight:'800', letterSpacing:0.3 },

  altLink: { alignItems:'center', paddingVertical:10 },
  altTxt:  { fontSize:14 },
  altBold: { fontWeight:'700' },
});