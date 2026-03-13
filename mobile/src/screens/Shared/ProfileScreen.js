// mobile/src/screens/Shared/ProfileScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, Dimensions, Animated, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ACCENT_COLORS } from '../../theme/theme';
import { userAPI, driverAPI, partnerAPI } from '../../services/api';

const { width } = Dimensions.get('window');

// Role accent is separate from user theme accent — it reflects the role type
const ROLE_META = {
  CUSTOMER:         { label:'Rider',   emoji:'🧑‍💼' },
  DRIVER:           { label:'Driver',  emoji:'🚗'  },
  DELIVERY_PARTNER: { label:'Courier', emoji:'🛵'  },
};

// ── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ user }) => {
  const { theme } = useTheme();
  return (
    <View style={[av.ring, { borderColor: theme.accent + '50' }]}>
      <View style={[av.circle, { backgroundColor: theme.accent + '20' }]}>
        <Text style={[av.initials, { color: theme.accent }]}>
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </Text>
      </View>
    </View>
  );
};
const av = StyleSheet.create({
  ring:     { width:96, height:96, borderRadius:48, borderWidth:2, justifyContent:'center', alignItems:'center', marginBottom:14 },
  circle:   { width:84, height:84, borderRadius:42, justifyContent:'center', alignItems:'center' },
  initials: { fontSize:32, fontWeight:'900' },
});

// ── Info row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }) => {
  const { theme } = useTheme();
  return (
    <View style={[ir.row, { borderBottomColor: theme.border }]}>
      <View style={[ir.iconWrap, { backgroundColor: theme.accent + '15' }]}>
        <Ionicons name={icon} size={16} color={theme.accent} />
      </View>
      <View style={{ flex:1 }}>
        <Text style={[ir.label, { color: theme.muted }]}>{label}</Text>
        <Text style={[ir.value, { color: theme.foreground }]}>{value || '—'}</Text>
      </View>
    </View>
  );
};
const ir = StyleSheet.create({
  row:     { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12, borderBottomWidth:1 },
  iconWrap:{ width:36, height:36, borderRadius:10, justifyContent:'center', alignItems:'center' },
  label:   { fontSize:11, fontWeight:'600', marginBottom:2 },
  value:   { fontSize:14, fontWeight:'600' },
});

// ── Menu item ────────────────────────────────────────────────────────────────
const MenuItem = ({ icon, label, onPress, danger, value }) => {
  const { theme } = useTheme();
  const itemColor = danger ? '#FF6B6B' : theme.accent;
  return (
    <TouchableOpacity style={[mi.item, { borderBottomColor: theme.border }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[mi.iconWrap, { backgroundColor: itemColor + '15' }]}>
        <Ionicons name={icon} size={18} color={itemColor} />
      </View>
      <Text style={[mi.label, { color: danger ? '#FF6B6B' : theme.foreground }]}>{label}</Text>
      <View style={mi.right}>
        {value && <Text style={[mi.value, { color: theme.accent }]}>{value}</Text>}
        <Ionicons name="chevron-forward" size={16} color={theme.hint} />
      </View>
    </TouchableOpacity>
  );
};
const mi = StyleSheet.create({
  item:    { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:14, borderBottomWidth:1 },
  iconWrap:{ width:38, height:38, borderRadius:10, justifyContent:'center', alignItems:'center' },
  label:   { flex:1, fontSize:15, fontWeight:'600' },
  right:   { flexDirection:'row', alignItems:'center', gap:6 },
  value:   { fontSize:13, fontWeight:'700' },
});

// ── Doc badge ────────────────────────────────────────────────────────────────
const DocBadge = ({ label, uploaded }) => {
  const { theme } = useTheme();
  const color = uploaded ? theme.accent : theme.hint;
  return (
    <View style={[db.wrap, { backgroundColor: theme.backgroundAlt, borderColor: color + '30' }]}>
      <Ionicons name={uploaded ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={color} />
      <Text style={[db.txt, { color }]}>{label}</Text>
    </View>
  );
};
const db = StyleSheet.create({
  wrap: { flexDirection:'row', alignItems:'center', gap:6, borderRadius:10, borderWidth:1, paddingHorizontal:10, paddingVertical:7 },
  txt:  { fontSize:12, fontWeight:'600' },
});

// ── Theme switcher (inline in profile) ───────────────────────────────────────
const ThemeSwitcher = () => {
  const { theme, accentId, mode, changeAccent, changeMode } = useTheme();
  const OPTS = [
    { id:'cyan',    color:'#00D4FF', label:'Cyan'    },
    { id:'emerald', color:'#34D399', label:'Emerald' },
    { id:'violet',  color:'#A78BFA', label:'Violet'  },
  ];
  return (
    <View style={[ts.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
      <Text style={[ts.heading, { color: theme.hint }]}>APP THEME</Text>
      <View style={ts.row}>
        {OPTS.map(opt => {
          const active = accentId === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => changeAccent(opt.id)}
              style={[ts.swatch, { backgroundColor: active ? opt.color + '20' : theme.card, borderColor: active ? opt.color : theme.border }]}
              activeOpacity={0.8}>
              <View style={[ts.dot, { backgroundColor: opt.color }]} />
              <Text style={[ts.swatchLabel, { color: active ? opt.color : theme.muted }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[ts.modeRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {['dark','light'].map(m => {
          const active = mode === m;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => changeMode(m)}
              style={[ts.modeBtn, active && { backgroundColor: theme.accent }]}
              activeOpacity={0.85}>
              <Ionicons name={m === 'dark' ? 'moon-outline' : 'sunny-outline'} size={14} color={active ? '#080C18' : theme.muted} />
              <Text style={[ts.modeTxt, { color: active ? '#080C18' : theme.muted }]}>{m === 'dark' ? 'Dark' : 'Light'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};
const ts = StyleSheet.create({
  card:      { borderRadius:20, borderWidth:1, padding:16, marginBottom:16 },
  heading:   { fontSize:11, fontWeight:'800', letterSpacing:2, marginBottom:12 },
  row:       { flexDirection:'row', gap:8, marginBottom:10 },
  swatch:    { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:10, borderRadius:12, borderWidth:1.5 },
  dot:       { width:10, height:10, borderRadius:5 },
  swatchLabel:{ fontSize:11, fontWeight:'700' },
  modeRow:   { flexDirection:'row', borderRadius:12, borderWidth:1, overflow:'hidden', height:40 },
  modeBtn:   { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6 },
  modeTxt:   { fontSize:12, fontWeight:'700' },
});

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { theme, mode }  = useTheme();
  const [stats,   setStats]   = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const fadeA = useRef(new Animated.Value(0)).current;

  const role = user?.role ?? 'CUSTOMER';
  const meta = ROLE_META[role] ?? ROLE_META.CUSTOMER;

  useEffect(() => {
    fetchData();
    Animated.timing(fadeA, { toValue:1, duration:600, useNativeDriver:true }).start();
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
      { text:'Cancel', style:'cancel' },
      { text:'Sign Out', style:'destructive', onPress: logout },
    ]);

  const dp = profile?.driverProfile;
  const pp = profile?.deliveryProfile;

  const StripVal = ({ value, label }) => (
    <View style={s.stripItem}>
      <Text style={[s.stripVal, { color: theme.accent }]}>{value}</Text>
      <Text style={[s.stripLbl, { color: theme.muted }]}>{label}</Text>
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <View style={[s.orb, { backgroundColor: theme.accent }]} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeA }}>

          {/* Hero */}
          <View style={s.hero}>
            <Avatar user={user} />
            <Text style={[s.name, { color: theme.foreground }]}>{user?.firstName} {user?.lastName}</Text>
            <View style={[s.roleBadge, { backgroundColor: theme.accent + '20', borderColor: theme.accent + '40' }]}>
              <Text style={s.roleEmoji}>{meta.emoji}</Text>
              <Text style={[s.roleLabel, { color: theme.accent }]}>{meta.label}</Text>
            </View>
            <View style={s.verifiedRow}>
              <Ionicons
                name={user?.isVerified ? 'shield-checkmark' : 'shield-outline'}
                size={14}
                color={user?.isVerified ? theme.accent : theme.hint}
              />
              <Text style={[s.verifiedTxt, { color: user?.isVerified ? theme.accent : theme.hint }]}>
                {user?.isVerified ? 'Verified Account' : 'Email not verified'}
              </Text>
            </View>
          </View>

          {/* Stats strip */}
          {loading ? (
            <ActivityIndicator color={theme.accent} style={{ marginBottom:20 }} />
          ) : (
            <View style={[s.statsStrip, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              {role === 'CUSTOMER' && (
                <>
                  <StripVal value={stats?.totalRides ?? 0}      label="Rides" />
                  <View style={[s.stripDivider, { backgroundColor: theme.border }]} />
                  <StripVal value={stats?.totalDeliveries ?? 0} label="Deliveries" />
                  <View style={[s.stripDivider, { backgroundColor: theme.border }]} />
                  <StripVal value={`₦${(stats?.walletBalance ?? 0).toLocaleString()}`} label="Wallet" />
                </>
              )}
              {(role === 'DRIVER' || role === 'DELIVERY_PARTNER') && (
                <>
                  <StripVal value={role === 'DRIVER' ? (stats?.completedRides ?? 0) : (stats?.completedDeliveries ?? 0)} label={role === 'DRIVER' ? 'Rides' : 'Deliveries'} />
                  <View style={[s.stripDivider, { backgroundColor: theme.border }]} />
                  <StripVal value={`${(stats?.rating ?? 0).toFixed(1)} ⭐`} label="Rating" />
                  <View style={[s.stripDivider, { backgroundColor: theme.border }]} />
                  <StripVal value={`₦${(stats?.totalEarnings ?? 0).toLocaleString()}`} label="Earned" />
                </>
              )}
            </View>
          )}

          {/* Personal info */}
          <View style={[s.section, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[s.sectionTitle, { color: theme.hint }]}>PERSONAL INFORMATION</Text>
            <InfoRow icon="mail-outline"     label="Email"  value={user?.email} />
            <InfoRow icon="call-outline"     label="Phone"  value={user?.phone} />
            <InfoRow icon="calendar-outline" label="Member since"
              value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-NG',{ year:'numeric', month:'long' }) : '—'} />
          </View>

          {/* Driver docs */}
          {role === 'DRIVER' && dp && (
            <View style={[s.section, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <Text style={[s.sectionTitle, { color: theme.hint }]}>VEHICLE & DOCUMENTS</Text>
              <InfoRow icon="car-outline"            label="Vehicle" value={`${dp.vehicleMake ?? ''} ${dp.vehicleModel ?? ''} ${dp.vehicleYear ?? ''}`.trim()} />
              <InfoRow icon="document-text-outline"  label="Plate"   value={dp.vehiclePlate} />
              <View style={s.docRow}>
                <DocBadge label="Licence"      uploaded={!!dp.licenseImageUrl} />
                <DocBadge label="Registration" uploaded={!!dp.vehicleRegUrl}   />
                <DocBadge label="Insurance"    uploaded={!!dp.insuranceUrl}    />
              </View>
              {!dp.isApproved && (
                <View style={[s.pendingNote, { borderColor: theme.accent + '30' }]}>
                  <Ionicons name="time-outline" size={16} color={theme.accent} />
                  <Text style={[s.pendingTxt, { color: theme.accent + 'CC' }]}>Account under review. Approval usually takes 24–48 hours.</Text>
                </View>
              )}
            </View>
          )}

          {/* Courier docs */}
          {role === 'DELIVERY_PARTNER' && pp && (
            <View style={[s.section, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <Text style={[s.sectionTitle, { color: theme.hint }]}>VEHICLE & DOCUMENTS</Text>
              <InfoRow icon="bicycle-outline"       label="Vehicle type" value={pp.vehicleType} />
              {pp.vehiclePlate && <InfoRow icon="document-text-outline" label="Plate" value={pp.vehiclePlate} />}
              <View style={s.docRow}>
                <DocBadge label="ID Document"   uploaded={!!pp.idImageUrl}      />
                <DocBadge label="Vehicle Photo" uploaded={!!pp.vehicleImageUrl} />
              </View>
              {!pp.isApproved && (
                <View style={[s.pendingNote, { borderColor: theme.accent + '30' }]}>
                  <Ionicons name="time-outline" size={16} color={theme.accent} />
                  <Text style={[s.pendingTxt, { color: theme.accent + 'CC' }]}>Awaiting admin approval. Upload your ID document to speed up the process.</Text>
                </View>
              )}
            </View>
          )}

          {/* Theme switcher */}
          <ThemeSwitcher />

          {/* Account menu */}
          <View style={[s.section, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[s.sectionTitle, { color: theme.hint }]}>ACCOUNT</Text>
            <MenuItem icon="create-outline"        label="Edit Profile"      onPress={() => navigation.navigate('EditProfile')} />
            {role === 'CUSTOMER' && (
              <MenuItem icon="wallet-outline"      label="My Wallet"         value={`₦${(stats?.walletBalance ?? 0).toLocaleString()}`} onPress={() => navigation.navigate('Wallet')} />
            )}
            {(role === 'DRIVER' || role === 'DELIVERY_PARTNER') && (
              <MenuItem icon="wallet-outline"      label="Earnings & Payouts" onPress={() => navigation.navigate(role === 'DRIVER' ? 'DriverEarnings' : 'PartnerEarnings')} />
            )}
            <MenuItem icon="notifications-outline" label="Notifications"    onPress={() => navigation.navigate('Notifications')} />
            <MenuItem icon="lock-closed-outline"   label="Change Password"  onPress={() => navigation.navigate('ChangePassword')} />
          </View>

          <View style={[s.section, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Text style={[s.sectionTitle, { color: theme.hint }]}>SUPPORT</Text>
            <MenuItem icon="help-circle-outline"   label="Help & Support"   onPress={() => navigation.navigate('Support')} />
            <MenuItem icon="star-outline"          label="Rate the App"     onPress={() => navigation.navigate('AppFeedback')} />
            <MenuItem icon="document-text-outline" label="Terms & Privacy"  onPress={() => navigation.navigate('Terms')} />
          </View>

          {/* Logout */}
          <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
            <Text style={s.logoutTxt}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={[s.version, { color: theme.border }]}>Diakite v1.0.0</Text>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex:1 },
  orb:         { position:'absolute', width:width*1.2, height:width*1.2, borderRadius:width*0.6, top:-width*0.8, right:-width*0.4, opacity:0.04 },
  scroll:      { paddingHorizontal:24, paddingBottom:80 },
  hero:        { alignItems:'center', paddingTop:60, paddingBottom:24 },
  name:        { fontSize:24, fontWeight:'900', marginBottom:10 },
  roleBadge:   { flexDirection:'row', alignItems:'center', gap:6, borderRadius:12, borderWidth:1, paddingHorizontal:14, paddingVertical:7, marginBottom:10 },
  roleEmoji:   { fontSize:16 },
  roleLabel:   { fontSize:13, fontWeight:'800', letterSpacing:0.5 },
  verifiedRow: { flexDirection:'row', alignItems:'center', gap:5 },
  verifiedTxt: { fontSize:12, fontWeight:'600' },
  statsStrip:  { flexDirection:'row', borderRadius:20, borderWidth:1, padding:16, marginBottom:24, alignItems:'center' },
  stripItem:   { flex:1, alignItems:'center' },
  stripVal:    { fontSize:18, fontWeight:'900', marginBottom:4 },
  stripLbl:    { fontSize:11, fontWeight:'600' },
  stripDivider:{ width:1, height:36 },
  section:     { borderRadius:20, borderWidth:1, padding:16, marginBottom:16 },
  sectionTitle:{ fontSize:11, fontWeight:'800', letterSpacing:2, marginBottom:4 },
  docRow:      { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:12 },
  pendingNote: { flexDirection:'row', alignItems:'flex-start', gap:10, borderRadius:12, borderWidth:1, padding:12, marginTop:12 },
  pendingTxt:  { flex:1, fontSize:12, lineHeight:18 },
  logoutBtn:   { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#FF6B6B15', borderRadius:16, borderWidth:1, borderColor:'#FF6B6B30', paddingVertical:16, marginBottom:16 },
  logoutTxt:   { fontSize:16, fontWeight:'700', color:'#FF6B6B' },
  version:     { textAlign:'center', fontSize:12, fontWeight:'600', marginBottom:20 },
});