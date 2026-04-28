// mobile/src/screens/Shared/ProfileScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Dimensions, Animated, ActivityIndicator,
  Platform, Switch, Modal, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { userAPI, driverAPI, partnerAPI, authAPI } from '../../services/api';
import { useBiometric } from '../../hooks/useBiometric';

const { width } = Dimensions.get('window');

const ROLE_META = {
  CUSTOMER:         { label: 'Rider',   icon: 'person-outline'   },
  DRIVER:           { label: 'Driver',  icon: 'car-outline'      },
  DELIVERY_PARTNER: { label: 'Courier', icon: 'bicycle-outline'  },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
// Shows profile photo when available; falls back to name initials.
const Avatar = ({ user, theme }) => {
  const hasPhoto = !!user?.profileImage;
  return (
    <View style={[av.ring, { borderColor: theme.accent + '40' }]}>
      {hasPhoto ? (
        <Image
          source={{ uri: user.profileImage }}
          style={av.photo}
          resizeMode="cover"
        />
      ) : (
        <View style={[av.circle, { backgroundColor: theme.accent + '18' }]}>
          <Text style={[av.initials, { color: theme.accent }]}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Text>
        </View>
      )}
    </View>
  );
};
const av = StyleSheet.create({
  ring:     { width: 88, height: 88, borderRadius: 44, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 14, overflow: 'hidden' },
  photo:    { width: 85, height: 85, borderRadius: 42 },
  circle:   { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center' },
  initials: { fontSize: 28, fontWeight: '800' },
});

// ─── InfoRow ──────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, theme }) => (
  <View style={[ir.row, { borderBottomColor: theme.border }]}>
    <Ionicons name={icon} size={15} color={theme.hint} style={ir.icon} />
    <View style={{ flex: 1 }}>
      <Text style={[ir.label, { color: theme.hint }]}>{label}</Text>
      <Text style={[ir.value, { color: theme.foreground }]}>{value || '—'}</Text>
    </View>
  </View>
);
const ir = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, gap: 12 },
  icon:  { width: 20 },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 3 },
  value: { fontSize: 14, fontWeight: '500' },
});

// ─── MenuItem ─────────────────────────────────────────────────────────────────
const MenuItem = ({ icon, label, onPress, danger, value, theme, last }) => {
  const color = danger ? '#E05555' : theme.foreground;
  return (
    <TouchableOpacity
      style={[mi.item, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={[mi.iconWrap, { backgroundColor: (danger ? '#E05555' : theme.accent) + '14' }]}>
        <Ionicons name={icon} size={17} color={danger ? '#E05555' : theme.accent} />
      </View>
      <Text style={[mi.label, { color }]}>{label}</Text>
      <View style={mi.right}>
        {value && <Text style={[mi.value, { color: theme.muted }]}>{value}</Text>}
        <Ionicons name="chevron-forward" size={15} color={theme.hint} />
      </View>
    </TouchableOpacity>
  );
};
const mi = StyleSheet.create({
  item:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  label:   { flex: 1, fontSize: 14, fontWeight: '500' },
  right:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value:   { fontSize: 13, fontWeight: '600' },
});

// ─── ToggleRow ─────────────────────────────────────────────────────────────────
const ToggleRow = ({ icon, label, sublabel, value, onValueChange, theme, last, loading }) => (
  <View style={[tr.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
    <View style={[tr.iconWrap, { backgroundColor: theme.accent + '14' }]}>
      <Ionicons name={icon} size={17} color={theme.accent} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[tr.label, { color: theme.foreground }]}>{label}</Text>
      {sublabel ? <Text style={[tr.sublabel, { color: theme.hint }]}>{sublabel}</Text> : null}
    </View>
    {loading
      ? <ActivityIndicator size="small" color={theme.accent} />
      : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: theme.border, true: theme.accent + '88' }}
          thumbColor={value ? theme.accent : theme.hint}
          ios_backgroundColor={theme.border}
        />
      )
    }
  </View>
);
const tr = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  label:   { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  sublabel:{ fontSize: 11, fontWeight: '400' },
});

// ─── DocBadge ─────────────────────────────────────────────────────────────────
const DocBadge = ({ label, uploaded, theme }) => {
  const color = uploaded ? theme.accent : theme.hint;
  return (
    <View style={[db.wrap, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <Ionicons name={uploaded ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={color} />
      <Text style={[db.txt, { color }]}>{label}</Text>
    </View>
  );
};
const db = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  txt:  { fontSize: 11, fontWeight: '600' },
});

// ─── Section ──────────────────────────────────────────────────────────────────
const Section = ({ title, children, theme }) => (
  <View style={[sec.wrap, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
    {title && <Text style={[sec.title, { color: theme.hint }]}>{title}</Text>}
    {children}
  </View>
);
const sec = StyleSheet.create({
  wrap:  { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, marginBottom: 14 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 6 },
});

// ─── MethodModal ─────────────────────────────────────────────────────────────
const MethodModal = ({ visible, onSelect, onDismiss, theme }) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
    <TouchableOpacity style={mm.overlay} activeOpacity={1} onPress={onDismiss}>
      <View style={[mm.sheet, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
        <Text style={[mm.title, { color: theme.foreground }]}>Choose verification method</Text>
        <Text style={[mm.sub, { color: theme.hint }]}>An OTP will be sent to confirm setup.</Text>

        {[
          { method: 'SMS',   icon: 'phone-portrait-outline', label: 'SMS',   desc: 'Code sent to your phone number' },
          { method: 'EMAIL', icon: 'mail-outline',           label: 'Email', desc: 'Code sent to your email address' },
        ].map(({ method, icon, label, desc }) => (
          <TouchableOpacity
            key={method}
            style={[mm.option, { borderColor: theme.border }]}
            onPress={() => onSelect(method)}
            activeOpacity={0.7}
          >
            <View style={[mm.optIcon, { backgroundColor: theme.accent + '14' }]}>
              <Ionicons name={icon} size={20} color={theme.accent} />
            </View>
            <View>
              <Text style={[mm.optLabel, { color: theme.foreground }]}>{label}</Text>
              <Text style={[mm.optDesc, { color: theme.hint }]}>{desc}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity onPress={onDismiss} style={mm.cancel}>
          <Text style={[mm.cancelTxt, { color: theme.hint }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);
const mm = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:    { borderRadius: 20, borderWidth: 1, margin: 16, padding: 22 },
  title:    { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  sub:      { fontSize: 13, marginBottom: 20 },
  option:   { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  optIcon:  { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  optLabel: { fontSize: 15, fontWeight: '700' },
  optDesc:  { fontSize: 12, marginTop: 2 },
  cancel:   { alignItems: 'center', paddingVertical: 12 },
  cancelTxt:{ fontSize: 14, fontWeight: '600' },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { user, logout, updateUser }                         = useAuth();
  const { theme, mode, changeMode }                          = useTheme(); // accentId & changeAccent removed
  const { isAvailable, isEnabled, biometricType, enable, disable } = useBiometric();

  const [stats,   setStats]   = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [twoFaEnabled,    setTwoFaEnabled]    = useState(user?.twoFactorEnabled ?? false);
  const [twoFaMethod,     setTwoFaMethod]     = useState(user?.twoFactorMethod  ?? 'SMS');
  const [twoFaLoading,    setTwoFaLoading]    = useState(false);
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [bioLoading,      setBioLoading]      = useState(false);

  const fadeA = useRef(new Animated.Value(0)).current;

  const role = user?.role ?? 'CUSTOMER';
  const meta = ROLE_META[role] ?? ROLE_META.CUSTOMER;

  useEffect(() => {
    fetchData();
    Animated.timing(fadeA, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    setTwoFaEnabled(user?.twoFactorEnabled ?? false);
    setTwoFaMethod(user?.twoFactorMethod ?? 'SMS');
  }, [user?.twoFactorEnabled, user?.twoFactorMethod]);

  const fetchData = async () => {
    try {
      const promises = [userAPI.getStats()];
      if (role === 'DRIVER')           promises.push(driverAPI.getProfile());
      if (role === 'DELIVERY_PARTNER') promises.push(partnerAPI.getProfile());
      const results = await Promise.allSettled(promises);
      if (results[0].status === 'fulfilled') setStats(results[0].value?.data);
      if (results[1]?.status === 'fulfilled') setProfile(results[1].value?.data);
    } catch {}
    finally { setLoading(false); }
  };

  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Sign out of Diakite?')) logout();
    } else {
      Alert.alert('Sign Out', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]);
    }
  };

  const handle2faToggle = async (value) => {
    if (value) {
      setShowMethodModal(true);
    } else {
      if (Platform.OS === 'web') {
        const pwd = window.prompt('Enter your password to disable 2FA:');
        if (pwd) await disable2FA(pwd);
      } else {
        Alert.prompt(
          'Disable 2FA',
          'Enter your password to confirm.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Disable', style: 'destructive', onPress: disable2FA },
          ],
          'secure-text'
        );
      }
    }
  };

  const enable2FA = async (method) => {
    setShowMethodModal(false);
    setTwoFaLoading(true);
    try {
      const res = await authAPI.setup2FA({ method });
      if (res?.data) {
        navigation.navigate('OtpVerification', {
          tempToken:     res.data.tempToken,
          method:        res.data.method,
          maskedContact: res.data.maskedContact,
          purpose:       'SETUP_2FA',
          onSuccess: () => {
            setTwoFaEnabled(true);
            setTwoFaMethod(method);
            updateUser?.({ twoFactorEnabled: true, twoFactorMethod: method });
          },
        });
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not start 2FA setup. Try again.');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const disable2FA = async (password) => {
    if (!password) return;
    setTwoFaLoading(true);
    try {
      await authAPI.disable2FA({ password });
      setTwoFaEnabled(false);
      setTwoFaMethod(null);
      updateUser?.({ twoFactorEnabled: false, twoFactorMethod: null });
      Alert.alert('2FA Disabled', 'Two-factor authentication has been turned off.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Incorrect password or request failed.');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleBiometricToggle = async (value) => {
    if (!isAvailable) {
      Alert.alert('Not Available', 'Biometric authentication is not set up on this device. Please enable it in your device settings first.');
      return;
    }
    setBioLoading(true);
    try {
      if (value) {
        const success = await enable();
        if (!success) Alert.alert('Failed', 'Could not enable biometric login. Please try again.');
      } else {
        Alert.alert(
          'Disable Biometric Login',
          'You will need to enter your password to sign in next time.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Disable', style: 'destructive', onPress: async () => { await disable?.(); } },
          ]
        );
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setBioLoading(false);
    }
  };

  const biometricLabel = biometricType === 'faceid' ? 'Face ID' : biometricType === 'iris' ? 'Iris Scan' : 'Fingerprint';
  const biometricIcon  = biometricType === 'faceid' ? 'scan-outline' : 'finger-print-outline';

  const dp = profile?.driverProfile;
  const pp = profile?.deliveryProfile;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[s.ambientGlow, { backgroundColor: theme.accent }]} />

      <MethodModal
        visible={showMethodModal}
        onSelect={enable2FA}
        onDismiss={() => setShowMethodModal(false)}
        theme={theme}
      />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeA }}>

          {/* Hero */}
          <View style={s.hero}>
            <Avatar user={user} theme={theme} />
            <Text style={[s.name, { color: theme.foreground }]}>{user?.firstName} {user?.lastName}</Text>
            <View style={[s.rolePill, { backgroundColor: theme.accent + '14', borderColor: theme.accent + '30' }]}>
              <Ionicons name={meta.icon} size={13} color={theme.accent} />
              <Text style={[s.roleLabel, { color: theme.accent }]}>{meta.label}</Text>
            </View>
            <View style={s.verifiedRow}>
              <Ionicons
                name={user?.isVerified ? 'shield-checkmark-outline' : 'shield-outline'}
                size={13}
                color={user?.isVerified ? theme.accent : theme.hint}
              />
              <Text style={[s.verifiedTxt, { color: user?.isVerified ? theme.accent : theme.hint }]}>
                {user?.isVerified ? 'Verified Account' : 'Not verified'}
              </Text>
            </View>
          </View>

          {/* Stats strip */}
          {loading ? (
            <ActivityIndicator color={theme.accent} style={{ marginBottom: 20 }} />
          ) : (
            <View style={[s.statsStrip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              {role === 'CUSTOMER' && (
                <>
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: theme.foreground }]}>{stats?.totalRides ?? 0}</Text>
                    <Text style={[s.stripLbl, { color: theme.hint }]}>Rides</Text>
                  </View>
                  <View style={[s.stripDivider, { backgroundColor: theme.border }]} />
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: theme.foreground }]}>{stats?.totalDeliveries ?? 0}</Text>
                    <Text style={[s.stripLbl, { color: theme.hint }]}>Packages</Text>
                  </View>
                  <View style={[s.stripDivider, { backgroundColor: theme.border }]} />
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: theme.foreground }]}>₦{(stats?.walletBalance ?? 0).toLocaleString()}</Text>
                    <Text style={[s.stripLbl, { color: theme.hint }]}>Wallet</Text>
                  </View>
                </>
              )}
              {(role === 'DRIVER' || role === 'DELIVERY_PARTNER') && (
                <>
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: theme.foreground }]}>
                      {role === 'DRIVER' ? (stats?.completedRides ?? 0) : (stats?.completedDeliveries ?? 0)}
                    </Text>
                    <Text style={[s.stripLbl, { color: theme.hint }]}>{role === 'DRIVER' ? 'Rides' : 'Deliveries'}</Text>
                  </View>
                  <View style={[s.stripDivider, { backgroundColor: theme.border }]} />
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: theme.foreground }]}>{(stats?.rating ?? 0).toFixed(1)} ⭐</Text>
                    <Text style={[s.stripLbl, { color: theme.hint }]}>Rating</Text>
                  </View>
                  <View style={[s.stripDivider, { backgroundColor: theme.border }]} />
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: theme.foreground }]}>₦{(stats?.totalEarnings ?? 0).toLocaleString()}</Text>
                    <Text style={[s.stripLbl, { color: theme.hint }]}>Earned</Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Personal info */}
          <Section title="PERSONAL INFORMATION" theme={theme}>
            <InfoRow icon="mail-outline"     label="EMAIL"        value={user?.email}   theme={theme} />
            <InfoRow icon="call-outline"     label="PHONE"        value={user?.phone}   theme={theme} />
            <InfoRow icon="calendar-outline" label="MEMBER SINCE"
              value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' }) : '—'}
              theme={theme}
            />
          </Section>

          {/* Driver — vehicle & docs */}
          {role === 'DRIVER' && dp && (
            <Section title="VEHICLE & DOCUMENTS" theme={theme}>
              <InfoRow icon="car-outline"           label="VEHICLE" value={`${dp.vehicleMake ?? ''} ${dp.vehicleModel ?? ''} ${dp.vehicleYear ?? ''}`.trim()} theme={theme} />
              <InfoRow icon="document-text-outline" label="PLATE"   value={dp.vehiclePlate} theme={theme} />
              <View style={s.docRow}>
                <DocBadge label="Licence"      uploaded={!!dp.licenseImageUrl} theme={theme} />
                <DocBadge label="Registration" uploaded={!!dp.vehicleRegUrl}   theme={theme} />
                <DocBadge label="Insurance"    uploaded={!!dp.insuranceUrl}    theme={theme} />
              </View>
              {!dp.isApproved && (
                <View style={[s.pendingNote, { borderColor: theme.border }]}>
                  <Ionicons name="time-outline" size={14} color={theme.muted} />
                  <Text style={[s.pendingTxt, { color: theme.muted }]}>Account under review — approval takes 24–48 hours.</Text>
                </View>
              )}
            </Section>
          )}

          {/* Delivery partner — vehicle & docs */}
          {role === 'DELIVERY_PARTNER' && pp && (
            <Section title="VEHICLE & DOCUMENTS" theme={theme}>
              <InfoRow icon="bicycle-outline"       label="VEHICLE TYPE" value={pp.vehicleType}  theme={theme} />
              {pp.vehiclePlate && <InfoRow icon="document-text-outline" label="PLATE" value={pp.vehiclePlate} theme={theme} />}
              <View style={s.docRow}>
                <DocBadge label="ID Document"   uploaded={!!pp.idImageUrl}      theme={theme} />
                <DocBadge label="Vehicle Photo" uploaded={!!pp.vehicleImageUrl} theme={theme} />
              </View>
              {!pp.isApproved && (
                <View style={[s.pendingNote, { borderColor: theme.border }]}>
                  <Ionicons name="time-outline" size={14} color={theme.muted} />
                  <Text style={[s.pendingTxt, { color: theme.muted }]}>Awaiting approval. Upload your ID to speed up the process.</Text>
                </View>
              )}
            </Section>
          )}

          {/* Security */}
          <Section title="SECURITY" theme={theme}>
            <ToggleRow
              icon="shield-checkmark-outline"
              label="Two-Factor Authentication"
              sublabel={
                twoFaEnabled
                  ? `Active · ${twoFaMethod === 'EMAIL' ? 'Email' : 'SMS'} verification`
                  : 'Adds an extra login step via SMS or Email'
              }
              value={twoFaEnabled}
              onValueChange={handle2faToggle}
              theme={theme}
              loading={twoFaLoading}
            />
            {isAvailable && (
              <ToggleRow
                icon={biometricIcon}
                label={`${biometricLabel} Login`}
                sublabel={isEnabled ? 'Unlock the app with biometrics' : `Use ${biometricLabel} instead of password`}
                value={isEnabled}
                onValueChange={handleBiometricToggle}
                theme={theme}
                loading={bioLoading}
                last
              />
            )}
            {!isAvailable && (
              <View style={[tr.row, { opacity: 0.4, paddingBottom: 10 }]}>
                <View style={[tr.iconWrap, { backgroundColor: theme.accent + '14' }]}>
                  <Ionicons name="finger-print-outline" size={17} color={theme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[tr.label, { color: theme.foreground }]}>Biometric Login</Text>
                  <Text style={[tr.sublabel, { color: theme.hint }]}>Not available on this device</Text>
                </View>
              </View>
            )}
          </Section>

          {/* Appearance – only dark/light toggle, no accent swatches */}
          <Section title="APPEARANCE" theme={theme}>
            <View style={[s.modeToggle, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {['dark', 'light'].map(m => {
                const active = mode === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => changeMode(m)}
                    style={[s.modeBtn, active && { backgroundColor: theme.accent + '20' }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={m === 'dark' ? 'moon-outline' : 'sunny-outline'} size={13} color={active ? theme.accent : theme.hint} />
                    <Text style={[s.modeTxt, { color: active ? theme.accent : theme.hint }]}>{m === 'dark' ? 'Dark' : 'Light'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Account */}
          <Section title="ACCOUNT" theme={theme}>
            <MenuItem icon="create-outline"         label="Edit Profile"       theme={theme} onPress={() => navigation.navigate('EditProfile')} />
            {role === 'CUSTOMER' && (
              <MenuItem icon="wallet-outline"       label="My Wallet"          theme={theme}
                value={stats ? `₦${(stats.walletBalance ?? 0).toLocaleString()}` : null}
                onPress={() => navigation.navigate('Wallet')} />
            )}
            {(role === 'DRIVER' || role === 'DELIVERY_PARTNER') && (
              <MenuItem icon="cash-outline"         label="Earnings & Payouts" theme={theme}
                onPress={() => navigation.navigate(role === 'DRIVER' ? 'DriverEarnings' : 'PartnerEarnings')} />
            )}
            <MenuItem icon="notifications-outline"  label="Notifications"     theme={theme} onPress={() => navigation.navigate('Notifications')} />
            <MenuItem icon="lock-closed-outline"    label="Change Password"   theme={theme} last onPress={() => navigation.navigate('ChangePassword')} />
          </Section>

          {/* Support */}
          <Section title="SUPPORT" theme={theme}>
            <MenuItem icon="help-circle-outline"    label="Help & Support"  theme={theme} onPress={() => navigation.navigate('Support')} />
            <MenuItem icon="star-outline"           label="Rate the App"    theme={theme} onPress={() => navigation.navigate('AppFeedback')} />
          </Section>

          {/* Sign out */}
          <TouchableOpacity style={[s.logoutBtn, { borderColor: theme.border }]} onPress={confirmLogout} activeOpacity={0.75}>
            <Ionicons name="log-out-outline" size={18} color="#E05555" />
            <Text style={s.logoutTxt}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={[s.version, { color: theme.hint }]}>Diakite v1.0.0</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  ambientGlow: { position: 'absolute', width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, top: -width * 0.75, alignSelf: 'center', opacity: 0.05 },
  scroll:      { paddingHorizontal: 24, paddingBottom: 90, paddingTop: 56 },
  hero:        { alignItems: 'center', paddingBottom: 28 },
  name:        { fontSize: 22, fontWeight: '800', marginBottom: 10, letterSpacing: -0.3 },
  rolePill:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  roleLabel:   { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifiedTxt: { fontSize: 12, fontWeight: '500' },
  statsStrip:  { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 20, alignItems: 'center' },
  stripItem:   { flex: 1, alignItems: 'center', gap: 4 },
  stripVal:    { fontSize: 17, fontWeight: '800' },
  stripLbl:    { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  stripDivider:{ width: 1, height: 32 },
  docRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, marginBottom: 6 },
  pendingNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: 1, paddingTop: 12, marginTop: 8, paddingBottom: 8 },
  pendingTxt:  { flex: 1, fontSize: 12, lineHeight: 18 },
  modeToggle:  { flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden', height: 38, marginBottom: 10 },
  modeBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  modeTxt:     { fontSize: 12, fontWeight: '600' },
  logoutBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingVertical: 15, marginBottom: 14 },
  logoutTxt:   { fontSize: 15, fontWeight: '700', color: '#E05555' },
  version:     { textAlign: 'center', fontSize: 11, fontWeight: '500', marginBottom: 12 },
});