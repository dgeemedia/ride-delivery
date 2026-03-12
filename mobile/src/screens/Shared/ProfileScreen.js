// mobile/src/screens/Shared/ProfileScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Dimensions, Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { userAPI, driverAPI, partnerAPI } from '../../services/api';

const { width } = Dimensions.get('window');

const ROLE_CONFIG = {
  CUSTOMER:         { accent: '#00D4FF', bg: '#001E2B', label: 'Rider',   emoji: '🧑‍💼' },
  DRIVER:           { accent: '#FFB800', bg: '#1E1600', label: 'Driver',  emoji: '🚗'  },
  DELIVERY_PARTNER: { accent: '#34D399', bg: '#001A10', label: 'Courier', emoji: '🛵'  },
};

// ── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ user, accent }) => (
  <View style={[av.ring, { borderColor: accent + '50' }]}>
    <View style={[av.circle, { backgroundColor: accent + '20' }]}>
      <Text style={[av.initials, { color: accent }]}>
        {user?.firstName?.[0]}{user?.lastName?.[0]}
      </Text>
    </View>
  </View>
);

const av = StyleSheet.create({
  ring:    { width: 96, height: 96, borderRadius: 48, borderWidth: 2,
             justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  circle:  { width: 84, height: 84, borderRadius: 42,
             justifyContent: 'center', alignItems: 'center' },
  initials:{ fontSize: 32, fontWeight: '900' },
});

// ── Info row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, accent }) => (
  <View style={ir.row}>
    <View style={[ir.iconWrap, { backgroundColor: accent + '15' }]}>
      <Ionicons name={icon} size={16} color={accent} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={ir.label}>{label}</Text>
      <Text style={ir.value}>{value || '—'}</Text>
    </View>
  </View>
);

const ir = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12,
             paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#0D1A2E' },
  iconWrap:{ width: 36, height: 36, borderRadius: 10,
             justifyContent: 'center', alignItems: 'center' },
  label:   { fontSize: 11, color: '#5A7A9A', fontWeight: '600', marginBottom: 2 },
  value:   { fontSize: 14, color: '#FFF', fontWeight: '600' },
});

// ── Menu item ────────────────────────────────────────────────────────────────
const MenuItem = ({ icon, label, onPress, accent, danger, value }) => (
  <TouchableOpacity style={mi.item} onPress={onPress} activeOpacity={0.7}>
    <View style={[mi.iconWrap, { backgroundColor: (danger ? '#FF6B6B' : accent) + '15' }]}>
      <Ionicons name={icon} size={18} color={danger ? '#FF6B6B' : accent} />
    </View>
    <Text style={[mi.label, danger && { color: '#FF6B6B' }]}>{label}</Text>
    <View style={mi.right}>
      {value && <Text style={[mi.value, { color: accent }]}>{value}</Text>}
      <Ionicons name="chevron-forward" size={16} color="#3A5070" />
    </View>
  </TouchableOpacity>
);

const mi = StyleSheet.create({
  item:    { flexDirection: 'row', alignItems: 'center', gap: 12,
             paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#0D1A2E' },
  iconWrap:{ width: 38, height: 38, borderRadius: 10,
             justifyContent: 'center', alignItems: 'center' },
  label:   { flex: 1, fontSize: 15, color: '#FFF', fontWeight: '600' },
  right:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value:   { fontSize: 13, fontWeight: '700' },
});

// ── Document status badge ────────────────────────────────────────────────────
const DocBadge = ({ label, uploaded, accent }) => (
  <View style={[db.wrap, { borderColor: (uploaded ? accent : '#3A5070') + '30' }]}>
    <Ionicons
      name={uploaded ? 'checkmark-circle' : 'ellipse-outline'}
      size={16}
      color={uploaded ? accent : '#3A5070'}
    />
    <Text style={[db.txt, { color: uploaded ? accent : '#3A5070' }]}>{label}</Text>
  </View>
);

const db = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: '#0D1A2E', borderRadius: 10, borderWidth: 1,
          paddingHorizontal: 10, paddingVertical: 7 },
  txt:  { fontSize: 12, fontWeight: '600' },
});

// ── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const fadeA = useRef(new Animated.Value(0)).current;

  const role   = user?.role ?? 'CUSTOMER';
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.CUSTOMER;
  const accent = config.accent;

  useEffect(() => {
    fetchData();
    Animated.timing(fadeA, { toValue: 1, duration: 600, useNativeDriver: true }).start();
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

  const confirmLogout = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);

  // ── Driver doc status ──
  const dp = profile?.driverProfile;
  const pp = profile?.deliveryProfile;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080C18" />
      <View style={[s.orb, { backgroundColor: accent }]} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeA }}>

          {/* ── Hero ── */}
          <View style={s.hero}>
            <Avatar user={user} accent={accent} />
            <Text style={s.name}>{user?.firstName} {user?.lastName}</Text>
            <View style={[s.roleBadge, { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
              <Text style={s.roleEmoji}>{config.emoji}</Text>
              <Text style={[s.roleLabel, { color: accent }]}>{config.label}</Text>
            </View>
            {/* Verified badge */}
            <View style={s.verifiedRow}>
              <Ionicons
                name={user?.isVerified ? 'shield-checkmark' : 'shield-outline'}
                size={14}
                color={user?.isVerified ? accent : '#3A5070'}
              />
              <Text style={[s.verifiedTxt, { color: user?.isVerified ? accent : '#3A5070' }]}>
                {user?.isVerified ? 'Verified Account' : 'Email not verified'}
              </Text>
            </View>
          </View>

          {/* ── Stats strip ── */}
          {loading ? (
            <ActivityIndicator color={accent} style={{ marginBottom: 20 }} />
          ) : (
            <View style={s.statsStrip}>
              {role === 'CUSTOMER' && (
                <>
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: accent }]}>{stats?.totalRides ?? 0}</Text>
                    <Text style={s.stripLbl}>Rides</Text>
                  </View>
                  <View style={s.stripDivider} />
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: accent }]}>{stats?.totalDeliveries ?? 0}</Text>
                    <Text style={s.stripLbl}>Deliveries</Text>
                  </View>
                  <View style={s.stripDivider} />
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: accent }]}>
                      ₦{(stats?.walletBalance ?? 0).toLocaleString()}
                    </Text>
                    <Text style={s.stripLbl}>Wallet</Text>
                  </View>
                </>
              )}
              {role === 'DRIVER' && (
                <>
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: accent }]}>{stats?.completedRides ?? 0}</Text>
                    <Text style={s.stripLbl}>Rides</Text>
                  </View>
                  <View style={s.stripDivider} />
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: accent }]}>
                      {(stats?.rating ?? 0).toFixed(1)} ⭐
                    </Text>
                    <Text style={s.stripLbl}>Rating</Text>
                  </View>
                  <View style={s.stripDivider} />
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: accent }]}>
                      ₦{(stats?.totalEarnings ?? 0).toLocaleString()}
                    </Text>
                    <Text style={s.stripLbl}>Earned</Text>
                  </View>
                </>
              )}
              {role === 'DELIVERY_PARTNER' && (
                <>
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: accent }]}>{stats?.completedDeliveries ?? 0}</Text>
                    <Text style={s.stripLbl}>Deliveries</Text>
                  </View>
                  <View style={s.stripDivider} />
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: accent }]}>
                      {(stats?.rating ?? 0).toFixed(1)} ⭐
                    </Text>
                    <Text style={s.stripLbl}>Rating</Text>
                  </View>
                  <View style={s.stripDivider} />
                  <View style={s.stripItem}>
                    <Text style={[s.stripVal, { color: accent }]}>
                      ₦{(stats?.totalEarnings ?? 0).toLocaleString()}
                    </Text>
                    <Text style={s.stripLbl}>Earned</Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── Personal info ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Personal Information</Text>
            <InfoRow icon="mail-outline"    label="Email"  value={user?.email} accent={accent} />
            <InfoRow icon="call-outline"    label="Phone"  value={user?.phone} accent={accent} />
            <InfoRow icon="calendar-outline" label="Member since"
              value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' }) : '—'}
              accent={accent} />
          </View>

          {/* ── Driver: vehicle info + doc status ── */}
          {role === 'DRIVER' && dp && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Vehicle & Documents</Text>
              <InfoRow icon="car-outline"  label="Vehicle"       value={`${dp.vehicleMake ?? ''} ${dp.vehicleModel ?? ''} ${dp.vehicleYear ?? ''}`.trim()} accent={accent} />
              <InfoRow icon="document-text-outline" label="Plate" value={dp.vehiclePlate} accent={accent} />
              <View style={s.docRow}>
                <DocBadge label="Licence"     uploaded={!!dp.licenseImageUrl} accent={accent} />
                <DocBadge label="Registration" uploaded={!!dp.vehicleRegUrl}  accent={accent} />
                <DocBadge label="Insurance"   uploaded={!!dp.insuranceUrl}    accent={accent} />
              </View>
              {!dp.isApproved && (
                <View style={[s.pendingNote, { borderColor: accent + '30' }]}>
                  <Ionicons name="time-outline" size={16} color={accent} />
                  <Text style={[s.pendingTxt, { color: accent + 'CC' }]}>
                    Account under review. Approval usually takes 24–48 hours.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Courier: vehicle info + doc status ── */}
          {role === 'DELIVERY_PARTNER' && pp && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Vehicle & Documents</Text>
              <InfoRow icon="bicycle-outline" label="Vehicle type" value={pp.vehicleType} accent={accent} />
              {pp.vehiclePlate && <InfoRow icon="document-text-outline" label="Plate" value={pp.vehiclePlate} accent={accent} />}
              <View style={s.docRow}>
                <DocBadge label="ID Document"   uploaded={!!pp.idImageUrl}      accent={accent} />
                <DocBadge label="Vehicle Photo" uploaded={!!pp.vehicleImageUrl} accent={accent} />
              </View>
              {!pp.isApproved && (
                <View style={[s.pendingNote, { borderColor: accent + '30' }]}>
                  <Ionicons name="time-outline" size={16} color={accent} />
                  <Text style={[s.pendingTxt, { color: accent + 'CC' }]}>
                    Awaiting admin approval. Upload your ID document to speed up the process.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Menu ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Account</Text>
            <MenuItem icon="create-outline"       label="Edit Profile"    accent={accent} onPress={() => navigation.navigate('EditProfile')} />
            {role === 'CUSTOMER' && (
              <MenuItem icon="wallet-outline"     label="My Wallet"       accent={accent}
                value={`₦${(stats?.walletBalance ?? 0).toLocaleString()}`}
                onPress={() => navigation.navigate('Wallet')} />
            )}
            {(role === 'DRIVER' || role === 'DELIVERY_PARTNER') && (
              <MenuItem icon="wallet-outline"     label="Earnings & Payouts" accent={accent} onPress={() => navigation.navigate(role === 'DRIVER' ? 'DriverEarnings' : 'PartnerEarnings')} />
            )}
            <MenuItem icon="notifications-outline" label="Notifications"  accent={accent} onPress={() => navigation.navigate('Notifications')} />
            <MenuItem icon="lock-closed-outline"  label="Change Password" accent={accent} onPress={() => navigation.navigate('ChangePassword')} />
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Support</Text>
            <MenuItem icon="help-circle-outline"  label="Help & Support"  accent={accent} onPress={() => navigation.navigate('Support')} />
            <MenuItem icon="star-outline"         label="Rate the App"    accent={accent} onPress={() => navigation.navigate('AppFeedback')} />
            <MenuItem icon="document-text-outline" label="Terms & Privacy" accent={accent} onPress={() => navigation.navigate('Terms')} />
          </View>

          {/* ── Logout ── */}
          <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
            <Text style={s.logoutTxt}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={s.version}>DuoRide v1.0.0</Text>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#080C18' },
  orb:    { position: 'absolute', width: width * 1.2, height: width * 1.2,
            borderRadius: width * 0.6, top: -width * 0.8,
            right: -width * 0.4, opacity: 0.04 },
  scroll: { paddingHorizontal: 24, paddingBottom: 80 },

  hero:       { alignItems: 'center', paddingTop: 60, paddingBottom: 24 },
  name:       { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 10 },
  roleBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6,
                borderRadius: 12, borderWidth: 1,
                paddingHorizontal: 14, paddingVertical: 7, marginBottom: 10 },
  roleEmoji:  { fontSize: 16 },
  roleLabel:  { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  verifiedRow:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  verifiedTxt:{ fontSize: 12, fontWeight: '600' },

  statsStrip: { flexDirection: 'row', backgroundColor: '#0D1A2E', borderRadius: 20,
                borderWidth: 1, borderColor: '#1A2840', padding: 16,
                marginBottom: 24, alignItems: 'center' },
  stripItem:  { flex: 1, alignItems: 'center' },
  stripVal:   { fontSize: 18, fontWeight: '900', marginBottom: 4 },
  stripLbl:   { fontSize: 11, color: '#5A7A9A', fontWeight: '600' },
  stripDivider:{ width: 1, height: 36, backgroundColor: '#1A2840' },

  section:      { backgroundColor: '#0D1A2E', borderRadius: 20, borderWidth: 1,
                  borderColor: '#1A2840', padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#3A5070',
                  letterSpacing: 2, marginBottom: 4 },

  docRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pendingNote:{ flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  pendingTxt: { flex: 1, fontSize: 12, lineHeight: 18 },

  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, backgroundColor: '#FF6B6B15', borderRadius: 16,
                borderWidth: 1, borderColor: '#FF6B6B30',
                paddingVertical: 16, marginBottom: 16 },
  logoutTxt:  { fontSize: 16, fontWeight: '700', color: '#FF6B6B' },
  version:    { textAlign: 'center', fontSize: 12, color: '#1A2840',
                fontWeight: '600', marginBottom: 20 },
});