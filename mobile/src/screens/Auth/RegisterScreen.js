// mobile/src/screens/Auth/RegisterScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { driverAPI, partnerAPI } from '../../services/api';

const { width } = Dimensions.get('window');

const ROLES = [
  { id: 'CUSTOMER',         label: 'Rider',   sub: 'Book rides & send packages', emoji: '🧑‍💼', steps: 2, perks: ['Book instant rides', 'Send packages', 'Track in real-time'] },
  { id: 'DRIVER',           label: 'Driver',  sub: 'Drive passengers & earn',    emoji: '🚗',  steps: 3, perks: ['Set your own hours', 'Weekly payouts', 'Bonus rewards'] },
  { id: 'DELIVERY_PARTNER', label: 'Courier', sub: 'Deliver packages daily',     emoji: '🛵',  steps: 3, perks: ['Multiple pickups', 'Route optimization', 'Daily payouts'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Vehicle types — order matches FloorPriceScreen rate table + fareEngine.js
// Icons match VEHICLE_ICON in NearbyDriversScreen
// ─────────────────────────────────────────────────────────────────────────────
const VEHICLE_TYPES = [
  { value: 'CAR',        label: 'Car',        icon: 'car-outline'     },
  { value: 'BIKE',       label: 'Bike',       icon: 'bicycle-outline' },
  { value: 'MOTORCYCLE', label: 'Motorcycle', icon: 'bicycle-outline' },
  { value: 'VAN',        label: 'Van',        icon: 'bus-outline'     },
];

// Same set for delivery partners — couriers typically use bikes/motorcycles/vans
const COURIER_VEHICLE_TYPES = [
  { value: 'BIKE',       label: 'Bike',       icon: 'bicycle-outline' },
  { value: 'MOTORCYCLE', label: 'Motorcycle', icon: 'bicycle-outline' },
  { value: 'CAR',        label: 'Car',        icon: 'car-outline'     },
  { value: 'VAN',        label: 'Van',        icon: 'bus-outline'     },
];

// ── Floating label input ──────────────────────────────────────────────────────
const FloatInput = ({ label, iconName, value, onChangeText, keyboardType, autoCapitalize, secureTextEntry }) => {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const labelY  = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderV = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(labelY,  { toValue: focused || value ? 1 : 0, duration: 180, useNativeDriver: false }).start();
    Animated.timing(borderV, { toValue: focused ? 1 : 0,          duration: 180, useNativeDriver: false }).start();
  }, [focused, value]);

  const borderColor = borderV.interpolate({ inputRange: [0, 1], outputRange: [theme.border, theme.accent] });
  const top      = labelY.interpolate({ inputRange: [0, 1], outputRange: [19, 7] });
  const fontSize = labelY.interpolate({ inputRange: [0, 1], outputRange: [15, 11] });
  const lColor   = labelY.interpolate({ inputRange: [0, 1], outputRange: [theme.hint, focused ? theme.accent : theme.muted] });

  return (
    <Animated.View style={[s.inputBox, { backgroundColor: theme.backgroundAlt, borderColor }]}>
      <Ionicons name={iconName} size={17} color={focused ? theme.accent : theme.hint} style={s.inputIcon} />
      <View style={{ flex: 1 }}>
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

// ── Vehicle type picker ───────────────────────────────────────────────────────
// Now shows icons + full labels, consistent with NearbyDriversScreen and
// FloorPriceScreen. The stored VALUE is always the enum string (CAR, BIKE, etc.)
const VehiclePicker = ({ value, onSelect, options = VEHICLE_TYPES }) => {
  const { theme } = useTheme();
  return (
    <View style={s.pickerWrap}>
      <Text style={[s.pickerLabel, { color: theme.hint }]}>VEHICLE TYPE</Text>
      <View style={s.pickerGrid}>
        {options.map(type => {
          const selected = value === type.value;
          return (
            <TouchableOpacity
              key={type.value}
              style={[
                s.pickerOption,
                {
                  backgroundColor: selected ? theme.accent + '15' : theme.backgroundAlt,
                  borderColor:     selected ? theme.accent         : theme.border,
                },
              ]}
              onPress={() => onSelect(type.value)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={type.icon}
                size={20}
                color={selected ? theme.accent : theme.hint}
              />
              <Text style={[s.pickerOptionTxt, { color: selected ? theme.accent : theme.muted }]}>
                {type.label}
              </Text>
              {selected && (
                <View style={[s.pickerCheck, { backgroundColor: theme.accent }]}>
                  <Ionicons name="checkmark" size={10} color="#080C18" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ── Role Card ─────────────────────────────────────────────────────────────────
const RoleCard = ({ role, selected, onSelect }) => {
  const { theme } = useTheme();
  const scaleA = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (selected) {
      Animated.sequence([
        Animated.timing(scaleA, { toValue: 0.94, duration: 80, useNativeDriver: true }),
        Animated.spring(scaleA, { toValue: 1, tension: 120, friction: 6, useNativeDriver: true }),
      ]).start();
    }
  }, [selected]);

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={() => onSelect(role.id)} style={[s.roleOuter, { width: (width - 56 - 10) / 2 }]}>
      <Animated.View style={[s.roleCard, {
        transform: [{ scale: scaleA }],
        borderColor:     selected ? theme.accent     : theme.border,
        backgroundColor: selected ? theme.pill       : theme.backgroundAlt,
      }]}>
        {selected && (
          <View style={[s.checkBadge, { backgroundColor: theme.accent }]}>
            <Ionicons name="checkmark" size={11} color="#080C18" />
          </View>
        )}
        <Text style={s.roleEmoji}>{role.emoji}</Text>
        <Text style={[s.roleLabel, { color: selected ? theme.accent : theme.foreground }]}>{role.label}</Text>
        <Text style={[s.roleSub, { color: theme.muted }]}>{role.sub}</Text>
        {selected && (
          <View style={s.perks}>
            {role.perks.map(p => (
              <View key={p} style={s.perkRow}>
                <View style={[s.perkDot, { backgroundColor: theme.accent }]} />
                <Text style={[s.perkTxt, { color: theme.muted }]}>{p}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── Progress bar ──────────────────────────────────────────────────────────────
const ProgressBar = ({ step, total }) => {
  const { theme } = useTheme();
  return (
    <View style={s.progRow}>
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <View style={[s.progDot, { backgroundColor: step > i ? theme.accent : theme.border }]}>
            <Text style={[s.progNum, { color: step > i ? '#080C18' : theme.hint }]}>{i + 1}</Text>
          </View>
          {i < total - 1 && (
            <View style={[s.progLine, { backgroundColor: step > i + 1 ? theme.accent : theme.border }]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const { theme, mode } = useTheme();

  const [step,      setStep]      = useState(1);
  const [roleId,    setRoleId]    = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [password,  setPassword]  = useState('');

  // Driver vehicle fields
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleType,   setVehicleType]   = useState('');   // e.g. 'CAR'
  const [vehicleMake,   setVehicleMake]   = useState('');
  const [vehicleModel,  setVehicleModel]  = useState('');
  const [vehicleYear,   setVehicleYear]   = useState('');
  const [vehicleColor,  setVehicleColor]  = useState('');
  const [vehiclePlate,  setVehiclePlate]  = useState('');

  // Courier vehicle fields
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
  const totalSteps = activeRole?.steps || 2;

  const pwdStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const pwdColors   = [theme.border, '#FF6B6B', '#FFB800', theme.accent];

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
    if (roleId === 'CUSTOMER') { handleFinalRegister(); } else { goToStep(3); }
  };

  const handleStep3 = () => {
    if (roleId === 'DRIVER') {
      if (!licenseNumber)
        return Alert.alert('Missing Fields', 'Please enter your license number.');
      if (!vehicleType)
        return Alert.alert('Missing Fields', 'Please select your vehicle type.');
      if (!vehicleMake || !vehicleModel || !vehicleYear || !vehicleColor || !vehiclePlate)
        return Alert.alert('Missing Fields', 'Please fill in all vehicle details.');
      const year = parseInt(vehicleYear);
      if (isNaN(year) || year < 1990 || year > new Date().getFullYear() + 1)
        return Alert.alert('Invalid Year', 'Please enter a valid vehicle year (1990–present).');
    }
    if (roleId === 'DELIVERY_PARTNER' && !courierVehicleType)
      return Alert.alert('Missing Fields', 'Please select your vehicle type.');
    handleFinalRegister();
  };

  const handleFinalRegister = async () => {
    setLoading(true);
    try {
      const res = await register({ firstName, lastName, email, phone, password, role: roleId });
      if (!res.success) { setLoading(false); return Alert.alert('Registration Failed', res.message); }

      if (roleId === 'DRIVER') {
        try {
          await driverAPI.updateProfile({
            licenseNumber, vehicleType, vehicleMake, vehicleModel,
            vehicleYear: parseInt(vehicleYear), vehicleColor, vehiclePlate,
          });
        } catch {
          Alert.alert('Almost Done!', 'Account created! Complete your vehicle documents in your profile.');
        }
      }

      if (roleId === 'DELIVERY_PARTNER') {
        try {
          await partnerAPI.updateProfile({
            vehicleType: courierVehicleType,
            ...(courierVehiclePlate && { vehiclePlate: courierVehiclePlate }),
          });
        } catch {
          Alert.alert('Almost Done!', 'Account created! Upload your ID documents in your profile.');
        }
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // Selected vehicle label for the step header
  const selectedVehicleLabel = VEHICLE_TYPES.find(v => v.value === vehicleType)?.label ?? '';
  const selectedCourierLabel = COURIER_VEHICLE_TYPES.find(v => v.value === courierVehicleType)?.label ?? '';

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[s.orb1, { backgroundColor: theme.accent }]} />
      <View style={[s.orb2, { backgroundColor: theme.accent }]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[s.back, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
            onPress={() => step === 1 ? navigation.goBack() : goToStep(step - 1)}
          >
            <Ionicons name="arrow-back" size={20} color={theme.muted} />
          </TouchableOpacity>

          <ProgressBar step={step} total={totalSteps || 2} />

          <Animated.View style={{ opacity: slideO, transform: [{ translateY: slideY }] }}>

            {/* ── STEP 1 — choose role ── */}
            {step === 1 && (
              <>
                <Text style={[s.eyebrow, { color: theme.accent }]}>STEP 1 OF {totalSteps || 2}</Text>
                <Text style={[s.title, { color: theme.foreground }]}>Who are{'\n'}you joining as?</Text>
                <Text style={[s.subtitle, { color: theme.muted }]}>Select your role to get started</Text>
                <View style={s.rolesGrid}>
                  {ROLES.map(r => <RoleCard key={r.id} role={r} selected={roleId === r.id} onSelect={setRoleId} />)}
                </View>
                <TouchableOpacity
                  style={[s.btn, !roleId && s.btnOff, roleId && { backgroundColor: theme.accent, shadowColor: theme.shadow }]}
                  activeOpacity={0.85}
                  onPress={handleStep1}
                >
                  <Text style={s.btnTxt}>Continue</Text>
                  <Ionicons name="arrow-forward-circle-outline" size={22} color="#080C18" />
                </TouchableOpacity>
                <TouchableOpacity style={s.altLink} onPress={() => navigation.navigate('Login')}>
                  <Text style={[s.altTxt, { color: theme.muted }]}>Already have an account?{'  '}
                    <Text style={[s.altBold, { color: theme.accent }]}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 2 — personal details ── */}
            {step === 2 && (
              <>
                <View style={[s.roleBadge, { borderColor: theme.accent + '40', backgroundColor: theme.pill }]}>
                  <Text style={{ fontSize: 26 }}>{activeRole?.emoji}</Text>
                  <View>
                    <Text style={[s.badgeRole, { color: theme.accent }]}>Joining as {activeRole?.label}</Text>
                    <Text style={[s.badgeSub, { color: theme.muted }]}>{activeRole?.sub}</Text>
                  </View>
                </View>
                <Text style={[s.eyebrow, { color: theme.accent }]}>STEP 2 OF {totalSteps}</Text>
                <Text style={[s.title, { color: theme.foreground }]}>Your Account{'\n'}Details</Text>
                <Text style={[s.subtitle, { color: theme.muted }]}>Personal information for your account</Text>

                <View style={s.nameRow}>
                  <View style={{ flex: 1 }}><FloatInput label="First Name" iconName="person-outline" value={firstName} onChangeText={setFirstName} autoCapitalize="words" /></View>
                  <View style={{ flex: 1 }}><FloatInput label="Last Name"  iconName="person-outline" value={lastName}  onChangeText={setLastName}  autoCapitalize="words" /></View>
                </View>
                <FloatInput label="Email Address"          iconName="mail-outline"        value={email}    onChangeText={setEmail}    keyboardType="email-address" />
                <FloatInput label="Phone Number"           iconName="call-outline"        value={phone}    onChangeText={setPhone}    keyboardType="phone-pad" />
                <FloatInput label="Password (min 8 chars)" iconName="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry />

                {password.length > 0 && (
                  <View style={s.strengthRow}>
                    {[1, 2, 3].map(lvl => (
                      <View key={lvl} style={[s.strengthBar, { backgroundColor: pwdStrength >= lvl ? pwdColors[lvl] : theme.border }]} />
                    ))}
                    <Text style={[s.strengthLbl, { color: theme.hint }]}>{['', 'Weak', 'Fair', 'Strong'][pwdStrength]}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.btn, loading && s.btnDim, { backgroundColor: theme.accent, shadowColor: theme.shadow }]}
                  activeOpacity={0.85}
                  onPress={handleStep2}
                  disabled={loading}
                >
                  <Text style={s.btnTxt}>{loading ? 'Creating Account...' : roleId === 'CUSTOMER' ? 'Create Account' : 'Next: Vehicle Info'}</Text>
                  {!loading && <Ionicons name={roleId === 'CUSTOMER' ? 'rocket-outline' : 'arrow-forward-circle-outline'} size={22} color="#080C18" />}
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 3 — DRIVER vehicle details ── */}
            {step === 3 && roleId === 'DRIVER' && (
              <>
                <Text style={[s.eyebrow, { color: theme.accent }]}>STEP 3 OF 3</Text>
                <Text style={[s.title, { color: theme.foreground }]}>Vehicle{'\n'}Details</Text>
                <Text style={[s.subtitle, { color: theme.muted }]}>Required to start accepting rides</Text>

                <FloatInput label="Driver License Number" iconName="card-outline" value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" />

                {/* Vehicle type — icons + full labels, order matches fareEngine rate table */}
                <VehiclePicker value={vehicleType} onSelect={setVehicleType} options={VEHICLE_TYPES} />

                {/* Show per-vehicle rate hint once a type is selected */}
                {vehicleType && (
                  <View style={[s.rateHint, { backgroundColor: theme.backgroundAlt, borderColor: theme.accent + '30' }]}>
                    <Ionicons name="information-circle-outline" size={14} color={theme.accent} />
                    <Text style={[s.rateHintTxt, { color: theme.hint }]}>
                      {vehicleType === 'CAR'        && 'CAR — ₦500 base + ₦130/km + ₦15/min. Booking fee: ₦100'}
                      {vehicleType === 'BIKE'       && 'BIKE — ₦200 base + ₦80/km + ₦8/min. Booking fee: ₦50'}
                      {vehicleType === 'MOTORCYCLE' && 'MOTORCYCLE — ₦200 base + ₦80/km + ₦8/min. Booking fee: ₦50'}
                      {vehicleType === 'VAN'        && 'VAN — ₦800 base + ₦180/km + ₦20/min. Booking fee: ₦150'}
                    </Text>
                  </View>
                )}

                <View style={s.nameRow}>
                  <View style={{ flex: 1 }}><FloatInput label="Make (e.g. Toyota)" iconName="car-outline" value={vehicleMake}  onChangeText={setVehicleMake}  autoCapitalize="words" /></View>
                  <View style={{ flex: 1 }}><FloatInput label="Model (e.g. Camry)" iconName="car-outline" value={vehicleModel} onChangeText={setVehicleModel} autoCapitalize="words" /></View>
                </View>
                <View style={s.nameRow}>
                  <View style={{ flex: 1 }}><FloatInput label="Year"  iconName="calendar-outline"      value={vehicleYear}  onChangeText={setVehicleYear}  keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><FloatInput label="Color" iconName="color-palette-outline" value={vehicleColor} onChangeText={setVehicleColor} autoCapitalize="words" /></View>
                </View>
                <FloatInput label="Plate Number" iconName="document-text-outline" value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" />

                <View style={[s.docNote, { borderColor: theme.accent + '30', backgroundColor: theme.backgroundAlt }]}>
                  <Ionicons name="information-circle-outline" size={18} color={theme.accent} />
                  <Text style={[s.docNoteTxt, { color: theme.muted }]}>
                    License photo, vehicle registration &amp; insurance can be uploaded in your profile after account creation.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[s.btn, loading && s.btnDim, { backgroundColor: theme.accent, shadowColor: theme.shadow }]}
                  activeOpacity={0.85}
                  onPress={handleStep3}
                  disabled={loading}
                >
                  <Text style={s.btnTxt}>{loading ? 'Creating Account...' : 'Create Driver Account'}</Text>
                  {!loading && <Ionicons name="rocket-outline" size={22} color="#080C18" />}
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 3 — COURIER vehicle details ── */}
            {step === 3 && roleId === 'DELIVERY_PARTNER' && (
              <>
                <Text style={[s.eyebrow, { color: theme.accent }]}>STEP 3 OF 3</Text>
                <Text style={[s.title, { color: theme.foreground }]}>Courier{'\n'}Vehicle</Text>
                <Text style={[s.subtitle, { color: theme.muted }]}>Tell us about your delivery vehicle</Text>

                {/* Couriers see BIKE/MOTORCYCLE first since those are most common */}
                <VehiclePicker value={courierVehicleType} onSelect={setCourierVehicleType} options={COURIER_VEHICLE_TYPES} />

                <FloatInput label="Plate Number (optional)" iconName="document-text-outline" value={courierVehiclePlate} onChangeText={setCourierVehiclePlate} autoCapitalize="characters" />

                <View style={[s.docNote, { borderColor: theme.accent + '30', backgroundColor: theme.backgroundAlt }]}>
                  <Ionicons name="information-circle-outline" size={18} color={theme.accent} />
                  <Text style={[s.docNoteTxt, { color: theme.muted }]}>
                    Your ID document can be uploaded in your profile. Account approval is required before accepting deliveries.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[s.btn, loading && s.btnDim, { backgroundColor: theme.accent, shadowColor: theme.shadow }]}
                  activeOpacity={0.85}
                  onPress={handleStep3}
                  disabled={loading}
                >
                  <Text style={s.btnTxt}>{loading ? 'Creating Account...' : 'Create Courier Account'}</Text>
                  {!loading && <Ionicons name="rocket-outline" size={22} color="#080C18" />}
                </TouchableOpacity>
              </>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  orb1:    { position: 'absolute', width: width * 1.1, height: width * 1.1, borderRadius: width * 0.55, top: -width * 0.7, right: -width * 0.3, opacity: 0.04 },
  orb2:    { position: 'absolute', width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4,  bottom: -width * 0.3, left: -width * 0.2, opacity: 0.04 },
  scroll:  { paddingHorizontal: 28, paddingBottom: 64 },

  back:    { marginTop: Platform.OS === 'ios' ? 56 : 40, width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },

  progRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  progDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  progNum: { fontSize: 13, fontWeight: '800' },
  progLine:{ flex: 1, height: 2, marginHorizontal: 6 },

  eyebrow: { fontSize: 11, letterSpacing: 4, fontWeight: '700', marginBottom: 10 },
  title:   { fontSize: 34, fontWeight: '900', lineHeight: 40, marginBottom: 8, letterSpacing: -0.5 },
  subtitle:{ fontSize: 15, marginBottom: 28 },

  rolesGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  roleOuter:  {},
  roleCard:   { borderRadius: 18, borderWidth: 1.5, padding: 16, minHeight: 130 },
  checkBadge: { position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  roleEmoji:  { fontSize: 30, marginBottom: 8 },
  roleLabel:  { fontSize: 16, fontWeight: '800', marginBottom: 3 },
  roleSub:    { fontSize: 11, lineHeight: 15 },
  perks:      { marginTop: 10, gap: 5 },
  perkRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  perkDot:    { width: 5, height: 5, borderRadius: 3 },
  perkTxt:    { fontSize: 10, fontWeight: '600' },

  roleBadge:{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  badgeRole:{ fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  badgeSub: { fontSize: 12, marginTop: 2 },

  nameRow:  { flexDirection: 'row', gap: 10 },

  inputBox:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, marginBottom: 12, height: 62, paddingHorizontal: 14 },
  inputIcon:  { marginRight: 10 },
  floatLabel: { position: 'absolute', left: 0 },
  inputText:  { fontSize: 15, paddingTop: 18, paddingBottom: 4, fontWeight: '500' },
  eyeBtn:     { padding: 6, marginLeft: 4 },

  // ── Vehicle picker — 2×2 grid with icon + label ──
  pickerWrap:      { marginBottom: 12 },
  pickerLabel:     { fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 10 },
  pickerGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pickerOption:    {
    width: (width - 56 - 10) / 2,   // 2 columns with 10px gap
    borderRadius: 14, borderWidth: 1.5,
    paddingVertical: 14, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  pickerOptionTxt: { fontSize: 13, fontWeight: '700', flex: 1 },
  pickerCheck:     { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

  // Rate hint shown after vehicle type selection
  rateHint:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 14, marginTop: -4 },
  rateHintTxt: { flex: 1, fontSize: 11, lineHeight: 17 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, marginTop: -4 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthLbl: { fontSize: 11, fontWeight: '600', minWidth: 36 },

  docNote:    { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  docNoteTxt: { flex: 1, fontSize: 12, lineHeight: 18 },

  btn:     { borderRadius: 16, height: 58, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 22, elevation: 12, marginBottom: 20 },
  btnOff:  { backgroundColor: '#1A2840', shadowOpacity: 0 },
  btnDim:  { opacity: 0.6 },
  btnTxt:  { color: '#080C18', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },

  altLink: { alignItems: 'center', paddingVertical: 10 },
  altTxt:  { fontSize: 14 },
  altBold: { fontWeight: '700' },
});