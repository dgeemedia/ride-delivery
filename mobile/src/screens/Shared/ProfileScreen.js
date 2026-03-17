// mobile/src/screens/Shared/ProfileScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Dimensions, Animated, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { userAPI, driverAPI, partnerAPI } from '../../services/api';

const { width } = Dimensions.get('window');

const ROLE_META = {
  CUSTOMER:         { label: 'Rider',   icon: 'person-outline'   },
  DRIVER:           { label: 'Driver',  icon: 'car-outline'      },
  DELIVERY_PARTNER: { label: 'Courier', icon: 'bicycle-outline'  },
};

const ACCENT_OPTIONS = [
  { id: 'onyx',  label: 'Onyx',  color: '#FFFFFF' },
  { id: 'chalk', label: 'Chalk', color: '#EAE5DA' },
];

const Avatar = ({ user, theme }) => (
  <View style={[av.ring, { borderColor: theme.accent + '40' }]}>
    <View style={[av.circle, { backgroundColor: theme.accent + '18' }]}>
      <Text style={[av.initials, { color: theme.accent }]}>
        {user?.firstName?.[0]}{user?.lastName?.[0]}
      </Text>
    </View>
  </View>
);
const av = StyleSheet.create({
  ring:     { width: 88, height: 88, borderRadius: 44, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  circle:   { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center' },
  initials: { fontSize: 28, fontWeight: '800' },
});

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

export default function ProfileScreen({ navigation }) {
  const { user, logout }           = useAuth();
  const { theme, mode, accentId, changeAccent, changeMode } = useTheme();
  const [stats,   setStats]        = useState(null);
  const [profile, setProfile]      = useState(null);
  const [loading, setLoading]      = useState(true);
  const fadeA = useRef(new Animated.Value(0)).current;

  const role = user?.role ?? 'CUSTOMER';
  const meta = ROLE_META[role] ?? ROLE_META.CUSTOMER;

  useEffect(() => {
    fetchData();
    Animated.timing(fadeA, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

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

  // ── Sign out — works on both web and native ────────────────────────────────
  // Alert.alert is a no-op on web, so we use window.confirm instead.
  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      // Browser native confirm dialog — always works, no extra deps needed
      if (window.confirm('Sign out of Diakite?')) {
        logout();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]);
    }
  };

  const dp = profile?.driverProfile;
  const pp = profile?.deliveryProfile;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[s.ambientGlow, { backgroundColor: theme.accent }]} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeA }}>

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

          <Section title="PERSONAL INFORMATION" theme={theme}>
            <InfoRow icon="mail-outline"     label="EMAIL"        value={user?.email}   theme={theme} />
            <InfoRow icon="call-outline"     label="PHONE"        value={user?.phone}   theme={theme} />
            <InfoRow icon="calendar-outline" label="MEMBER SINCE"
              value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' }) : '—'}
              theme={theme}
            />
          </Section>

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

          <Section title="APPEARANCE" theme={theme}>
            <View style={s.swatchRow}>
              {ACCENT_OPTIONS.map(opt => {
                const active = accentId === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => changeAccent(opt.id)}
                    style={[s.swatch, {
                      backgroundColor: active ? opt.color + '18' : 'transparent',
                      borderColor:     active ? opt.color        : theme.border,
                    }]}
                    activeOpacity={0.75}
                  >
                    <View style={[s.swatchDot, { backgroundColor: opt.color }]} />
                    <Text style={[s.swatchTxt, { color: active ? opt.color : theme.hint }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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

          <Section title="ACCOUNT" theme={theme}>
            <MenuItem icon="create-outline"         label="Edit Profile"       theme={theme} onPress={() => navigation.navigate('EditProfile')} />
            {role === 'CUSTOMER' && (
              <MenuItem icon="wallet-outline"       label="My Wallet"          theme={theme}
                value={stats ? `₦${(stats.walletBalance ?? 0).toLocaleString()}` : null}
                onPress={() => navigation.navigate('Wallet')} />
            )}
            {(role === 'DRIVER' || role === 'DELIVERY_PARTNER') && (
              <MenuItem icon="cash-outline"         label="Earnings & Payouts" theme={theme} onPress={() => navigation.navigate(role === 'DRIVER' ? 'DriverEarnings' : 'PartnerEarnings')} />
            )}
            <MenuItem icon="notifications-outline"  label="Notifications"     theme={theme} onPress={() => navigation.navigate('Notifications')} />
            <MenuItem icon="lock-closed-outline"    label="Change Password"   theme={theme} last onPress={() => navigation.navigate('ChangePassword')} />
          </Section>

          <Section title="SUPPORT" theme={theme}>
            <MenuItem icon="help-circle-outline"   label="Help & Support"  theme={theme} onPress={() => navigation.navigate('Support')} />
            <MenuItem icon="star-outline"          label="Rate the App"    theme={theme} onPress={() => navigation.navigate('AppFeedback')} />
            <MenuItem icon="document-text-outline" label="Terms & Privacy" theme={theme} last onPress={() => navigation.navigate('Terms')} />
          </Section>

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
  swatchRow:   { flexDirection: 'row', gap: 8, marginBottom: 10 },
  swatch:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  swatchDot:   { width: 8, height: 8, borderRadius: 4 },
  swatchTxt:   { fontSize: 11, fontWeight: '700' },
  modeToggle:  { flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden', height: 38, marginBottom: 10 },
  modeBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  modeTxt:     { fontSize: 12, fontWeight: '600' },
  logoutBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingVertical: 15, marginBottom: 14 },
  logoutTxt:   { fontSize: 15, fontWeight: '700', color: '#E05555' },
  version:     { textAlign: 'center', fontSize: 11, fontWeight: '500', marginBottom: 12 },
});