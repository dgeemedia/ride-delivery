// mobile/src/screens/Customer/ShieldScreen.js
//
// Main SHIELD screen. Shows:
//  - Active session status (if a ride is in progress)
//  - Saved beneficiaries list
//  - Activate / deactivate controls
//  - "I'm Safe" button when active

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Linking, Animated,
  Platform, StatusBar, Image,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { useAuth }           from '../../context/AuthContext';
import { shieldAPI }         from '../../services/api';
import ShieldActivateSheet   from '../../components/ShieldActivateSheet';

// ── Shield strength badge ────────────────────────────────────────────────────
const ShieldBadge = ({ active, theme }) => {
  const pulseA = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseA, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseA, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  const color = active ? '#4CAF50' : theme.hint;
  return (
    <View style={sb.wrap}>
      <Animated.View style={[sb.pulse, { backgroundColor: color + '20', transform: [{ scale: pulseA }] }]} />
      <View style={[sb.inner, { backgroundColor: active ? '#4CAF50' : theme.backgroundAlt, borderColor: color }]}>
        <Ionicons name="shield-checkmark" size={36} color={active ? '#FFF' : theme.hint} />
      </View>
      <Text style={[sb.label, { color }]}>{active ? 'SHIELD ACTIVE' : 'SHIELD OFF'}</Text>
    </View>
  );
};
const sb = StyleSheet.create({
  wrap:  { alignItems: 'center', marginBottom: 28 },
  pulse: { position: 'absolute', width: 100, height: 100, borderRadius: 50 },
  inner: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
});

// ── Beneficiary card ─────────────────────────────────────────────────────────
const BeneficiaryCard = ({ item, onEdit, onDelete, onSetDefault, theme }) => (
  <View style={[bc.card, { backgroundColor: theme.backgroundAlt, borderColor: item.isDefault ? theme.accent : theme.border }]}>
    <View style={[bc.avatar, { backgroundColor: theme.accent + '18' }]}>
      <Text style={[bc.initials, { color: theme.accent }]}>{item.name[0].toUpperCase()}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <View style={bc.nameRow}>
        <Text style={[bc.name, { color: theme.foreground }]}>{item.name}</Text>
        {item.isDefault && (
          <View style={[bc.defaultBadge, { backgroundColor: theme.accent }]}>
            <Text style={[bc.defaultTxt, { color: theme.accentFg ?? '#111' }]}>DEFAULT</Text>
          </View>
        )}
      </View>
      <Text style={[bc.phone, { color: theme.hint }]}>{item.phone}</Text>
    </View>
    <View style={bc.actions}>
      {!item.isDefault && (
        <TouchableOpacity onPress={() => onSetDefault(item.id)} style={bc.actionBtn}>
          <Ionicons name="star-outline" size={16} color={theme.hint} />
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => onEdit(item)} style={bc.actionBtn}>
        <Ionicons name="create-outline" size={16} color={theme.hint} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onDelete(item.id)} style={bc.actionBtn}>
        <Ionicons name="trash-outline" size={16} color="#E05555" />
      </TouchableOpacity>
    </View>
  </View>
);
const bc = StyleSheet.create({
  card:       { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 10, gap: 12 },
  avatar:     { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  initials:   { fontSize: 17, fontWeight: '800' },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  name:       { fontSize: 14, fontWeight: '700' },
  phone:      { fontSize: 12 },
  defaultBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  defaultTxt:   { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  actions:    { flexDirection: 'row', gap: 4 },
  actionBtn:  { padding: 6 },
});

// ── Active session card ───────────────────────────────────────────────────────
const ActiveSessionCard = ({ session, viewUrl, whatsappLink, onDeactivate, onArrivedSafe, theme }) => {
  const accentFg = theme.accentFg ?? '#111';
  return (
    <View style={[asc.card, { backgroundColor: '#4CAF5015', borderColor: '#4CAF50' }]}>
      <View style={asc.header}>
        <Ionicons name="shield-checkmark" size={18} color="#4CAF50" />
        <Text style={asc.title}>Guardian: {session.beneficiaryName}</Text>
      </View>
      <Text style={[asc.phone, { color: theme.hint }]}>{session.beneficiaryPhone}</Text>
      <Text style={[asc.views, { color: theme.hint }]}>
        👁 Viewed {session.viewCount} {session.viewCount === 1 ? 'time' : 'times'}
      </Text>

      <View style={asc.btnRow}>
        <TouchableOpacity
          style={[asc.btn, { backgroundColor: '#25D366' }]}
          onPress={() => Linking.openURL(whatsappLink)}
        >
          <Ionicons name="logo-whatsapp" size={15} color="#FFF" />
          <Text style={asc.btnTxt}>Share Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[asc.btn, { backgroundColor: '#4CAF50' }]}
          onPress={onArrivedSafe}
        >
          <Ionicons name="checkmark-circle" size={15} color="#FFF" />
          <Text style={asc.btnTxt}>I'm Safe</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onDeactivate} style={asc.deactivate}>
        <Text style={asc.deactivateTxt}>Deactivate SHIELD</Text>
      </TouchableOpacity>
    </View>
  );
};
const asc = StyleSheet.create({
  card:         { borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 22 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title:        { fontSize: 15, fontWeight: '700', color: '#4CAF50' },
  phone:        { fontSize: 12, marginBottom: 4, marginLeft: 26 },
  views:        { fontSize: 11, marginBottom: 14, marginLeft: 26 },
  btnRow:       { flexDirection: 'row', gap: 10, marginBottom: 12 },
  btn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10 },
  btnTxt:       { fontSize: 13, fontWeight: '700', color: '#FFF' },
  deactivate:   { alignItems: 'center' },
  deactivateTxt:{ fontSize: 12, color: '#E05555', fontWeight: '600' },
});

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function ShieldScreen({ navigation, route }) {
  const { theme }  = useTheme();
  const { user }   = useAuth();
  const insets     = useSafeAreaInsets();

  // rideId or deliveryId passed from RideTracking / DeliveryTracking
  const rideId     = route?.params?.rideId;
  const deliveryId = route?.params?.deliveryId;

  const [beneficiaries,  setBeneficiaries]  = useState([]);
  const [activeSession,  setActiveSession]  = useState(null);
  const [viewUrl,        setViewUrl]        = useState(null);
  const [whatsappLink,   setWhatsappLink]   = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [sheetVisible,   setSheetVisible]   = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, sRes] = await Promise.allSettled([
        shieldAPI.listBeneficiaries(),
        rideId || deliveryId
          ? shieldAPI.getSession({ rideId, deliveryId })
          : Promise.resolve(null),
      ]);

      if (bRes.status === 'fulfilled') {
        setBeneficiaries(bRes.value?.data?.beneficiaries ?? []);
      }
      if (sRes.status === 'fulfilled' && sRes.value) {
        const d = sRes.value?.data;
        if (d?.session) {
          setActiveSession(d.session);
          setViewUrl(d.viewUrl);
          setWhatsappLink(d.whatsappLink);
        }
      }
    } catch {}
    finally { setLoading(false); }
  }, [rideId, deliveryId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = (id) => {
    Alert.alert('Remove Guardian?', 'This person will no longer be available as a quick option.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await shieldAPI.deleteBeneficiary(id);
            setBeneficiaries(prev => prev.filter(b => b.id !== id));
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.message ?? 'Could not remove guardian.');
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (id) => {
    try {
      await shieldAPI.updateBeneficiary(id, { isDefault: true });
      fetchAll();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not update guardian.');
    }
  };

  const handleActivated = (result) => {
    setSheetVisible(false);
    setActiveSession(result.session);
    setViewUrl(result.viewUrl);
    setWhatsappLink(result.whatsappLink);

    // Auto-open WhatsApp
    Linking.openURL(result.whatsappLink).catch(() => {});
  };

  const handleDeactivate = () => {
    Alert.alert('Deactivate SHIELD?', 'Your guardian will no longer be able to track this trip.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate', style: 'destructive',
        onPress: async () => {
          try {
            await shieldAPI.deactivate({ rideId, deliveryId });
            setActiveSession(null);
            setViewUrl(null);
            setWhatsappLink(null);
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.message ?? 'Could not deactivate SHIELD.');
          }
        },
      },
    ]);
  };

  const handleArrivedSafe = async () => {
    try {
      await shieldAPI.arrivedSafe({ rideId, deliveryId });
      Alert.alert('✅ Confirmed!', 'Your guardian has been notified that you arrived safely.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not confirm arrival.');
    }
  };

  const hasActiveRide = !!(rideId || deliveryId);

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 12, backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>SHIELD</Text>
          <Text style={[s.headerSub, { color: theme.hint }]}>Safety Guardian</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('ShieldBeneficiaries')}
          style={[s.manageBtn, { borderColor: theme.border }]}
        >
          <Ionicons name="people-outline" size={16} color={theme.accent} />
          <Text style={[s.manageBtnTxt, { color: theme.accent }]}>Guardians</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Shield badge ── */}
          <ShieldBadge active={!!activeSession} theme={theme} />

          {/* ── What is SHIELD ── */}
          {!activeSession && (
            <View style={[s.infoCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <Text style={[s.infoTitle, { color: theme.foreground }]}>How SHIELD Works</Text>
              {[
                { icon: 'person-add-outline',   text: 'Add a trusted guardian — no app download needed' },
                { icon: 'link-outline',          text: 'Share a secure link via WhatsApp in one tap' },
                { icon: 'navigate-outline',      text: 'They see live driver location, vehicle details & route' },
                { icon: 'alert-circle-outline',  text: 'They can send a safety check alert directly to your driver' },
                { icon: 'checkmark-done-outline',text: 'Tap "I\'m Safe" when you arrive — they\'re instantly notified' },
              ].map((item, i) => (
                <View key={i} style={s.infoRow}>
                  <View style={[s.infoIcon, { backgroundColor: theme.accent + '15' }]}>
                    <Ionicons name={item.icon} size={15} color={theme.accent} />
                  </View>
                  <Text style={[s.infoText, { color: theme.hint }]}>{item.text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Active session ── */}
          {activeSession && viewUrl && (
            <ActiveSessionCard
              session={activeSession}
              viewUrl={viewUrl}
              whatsappLink={whatsappLink}
              onDeactivate={handleDeactivate}
              onArrivedSafe={handleArrivedSafe}
              theme={theme}
            />
          )}

          {/* ── Night time auto-SHIELD notice ── */}
          {!activeSession && (
            <View style={[s.nightBanner, { backgroundColor: '#7B68EE15', borderColor: '#7B68EE50' }]}>
              <Ionicons name="moon-outline" size={16} color="#7B68EE" />
              <Text style={[s.nightTxt, { color: '#7B68EE' }]}>
                Auto-SHIELD notifies your default guardian automatically for rides after 9 PM.
                Set a default guardian below to enable it.
              </Text>
            </View>
          )}

          {/* ── Activate button ── */}
          {hasActiveRide && !activeSession && (
            <TouchableOpacity
              style={[s.activateBtn, { backgroundColor: '#4CAF50' }]}
              onPress={() => setSheetVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="shield-checkmark" size={20} color="#FFF" />
              <Text style={s.activateBtnTxt}>Activate SHIELD</Text>
            </TouchableOpacity>
          )}

          {!hasActiveRide && (
            <View style={[s.noRideNote, { borderColor: theme.border }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.hint} />
              <Text style={[s.noRideNoteTxt, { color: theme.hint }]}>
                SHIELD can be activated from the ride or delivery tracking screen once your trip has started.
              </Text>
            </View>
          )}

          {/* ── Quick guardians ── */}
          <Text style={[s.sectionTitle, { color: theme.hint }]}>SAVED GUARDIANS</Text>
          {beneficiaries.length === 0 ? (
            <TouchableOpacity
              style={[s.addFirstBtn, { borderColor: theme.accent + '50', backgroundColor: theme.accent + '0D' }]}
              onPress={() => navigation.navigate('ShieldBeneficiaries')}
            >
              <Ionicons name="add-circle-outline" size={22} color={theme.accent} />
              <Text style={[s.addFirstTxt, { color: theme.accent }]}>Add your first guardian</Text>
            </TouchableOpacity>
          ) : (
            beneficiaries.slice(0, 3).map(b => (
              <BeneficiaryCard
                key={b.id}
                item={b}
                onEdit={() => navigation.navigate('ShieldBeneficiaries', { editId: b.id })}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
                theme={theme}
              />
            ))
          )}
          {beneficiaries.length > 3 && (
            <TouchableOpacity onPress={() => navigation.navigate('ShieldBeneficiaries')}>
              <Text style={[s.viewAll, { color: theme.accent }]}>
                View all {beneficiaries.length} guardians →
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* ── Activate bottom sheet ── */}
      <ShieldActivateSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onActivated={handleActivated}
        beneficiaries={beneficiaries}
        rideId={rideId}
        deliveryId={deliveryId}
        theme={theme}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:       { padding: 4 },
  headerTitle:   { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  headerSub:     { fontSize: 11, fontWeight: '500' },
  manageBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  manageBtnTxt:  { fontSize: 12, fontWeight: '700' },
  scroll:        { paddingHorizontal: 20, paddingTop: 24 },

  infoCard:   { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 22, gap: 14 },
  infoTitle:  { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  infoRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon:   { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  infoText:   { fontSize: 13, flex: 1, lineHeight: 18 },

  nightBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 20 },
  nightTxt:    { fontSize: 12, flex: 1, lineHeight: 17 },

  activateBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 16, marginBottom: 24 },
  activateBtnTxt: { fontSize: 16, fontWeight: '800', color: '#FFF' },

  noRideNote:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 24 },
  noRideNoteTxt: { fontSize: 12, flex: 1, lineHeight: 17 },

  sectionTitle:  { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 14 },
  addFirstBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, borderWidth: 1.5, paddingVertical: 16, marginBottom: 16 },
  addFirstTxt:   { fontSize: 14, fontWeight: '700' },
  viewAll:       { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 4 },
});