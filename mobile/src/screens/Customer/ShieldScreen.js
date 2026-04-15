// mobile/src/screens/Customer/ShieldScreen.js
// ── Premium Glass Edition ─────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Linking, Animated,
  Platform, StatusBar,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { useAuth }           from '../../context/AuthContext';
import { shieldAPI }         from '../../services/api';
import ShieldActivateSheet   from '../../components/ShieldActivateSheet';

const SHIELD_GREEN = '#4CAF50';

const G = {
  card:   (mode) => mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.80)',
  border: (mode) => mode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
  borderHi:(mode)=> mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
  icon:   (mode) => mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
};

// ── Shield Badge (animated) ───────────────────────────────────────────────────
const ShieldBadge = ({ active, theme, mode }) => {
  const pulseA  = useRef(new Animated.Value(1)).current;
  const rotateA = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseA, { toValue:1.15, duration:1000, useNativeDriver:true }),
          Animated.timing(pulseA, { toValue:1,    duration:1000, useNativeDriver:true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseA.setValue(1);
    }
  }, [active]);

  return (
    <View style={sb.wrap}>
      {active && (
        <>
          <Animated.View style={[sb.ring3, { borderColor: SHIELD_GREEN + '15', transform:[{ scale: pulseA }] }]} />
          <Animated.View style={[sb.ring2, { borderColor: SHIELD_GREEN + '25', transform:[{ scale: pulseA }] }]} />
          <View style={[sb.ring1, { borderColor: SHIELD_GREEN + '35' }]} />
        </>
      )}
      <View style={[sb.inner, {
        backgroundColor: active ? SHIELD_GREEN + '18' : G.icon(mode),
        borderColor: active ? SHIELD_GREEN + '50' : G.border(mode),
        borderWidth: 1.5,
      }]}>
        <Ionicons name="shield-checkmark" size={40} color={active ? SHIELD_GREEN : theme.hint} />
      </View>
      <View style={[sb.labelWrap, { backgroundColor: active ? SHIELD_GREEN + '18' : G.icon(mode), borderColor: active ? SHIELD_GREEN + '30' : G.border(mode) }]}>
        <View style={[sb.dot, { backgroundColor: active ? SHIELD_GREEN : theme.hint }]} />
        <Text style={[sb.label, { color: active ? SHIELD_GREEN : theme.hint }]}>
          {active ? 'SHIELD ACTIVE' : 'SHIELD OFF'}
        </Text>
      </View>
    </View>
  );
};
const sb = StyleSheet.create({
  wrap:     { alignItems:'center', marginBottom:32, paddingTop:12 },
  ring3:    { position:'absolute', width:160, height:160, borderRadius:80, borderWidth:1, top:'50%', marginTop:-80 },
  ring2:    { position:'absolute', width:120, height:120, borderRadius:60, borderWidth:1, top:'50%', marginTop:-60 },
  ring1:    { position:'absolute', width:90,  height:90,  borderRadius:45, borderWidth:1, top:'50%', marginTop:-45 },
  inner:    { width:80, height:80, borderRadius:24, justifyContent:'center', alignItems:'center', marginBottom:14 },
  labelWrap:{ flexDirection:'row', alignItems:'center', gap:7, borderRadius:20, borderWidth:1, paddingHorizontal:14, paddingVertical:7 },
  dot:      { width:6, height:6, borderRadius:3 },
  label:    { fontSize:11, fontWeight:'800', letterSpacing:2 },
});

// ── Beneficiary card ──────────────────────────────────────────────────────────
const BeneficiaryCard = ({ item, onEdit, onDelete, onSetDefault, theme, mode }) => (
  <View style={[bc.card, { borderColor: item.isDefault ? SHIELD_GREEN + '50' : G.border(mode), overflow:'hidden' }]}>
    <LinearGradient
      colors={item.isDefault
        ? ['rgba(76,175,80,0.10)','rgba(76,175,80,0.04)']
        : (mode==='dark' ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.70)'])
      }
      start={{ x:0, y:0 }} end={{ x:1, y:1 }}
      style={StyleSheet.absoluteFill}
    />
    {item.isDefault && <View style={[bc.topEdge, { backgroundColor: SHIELD_GREEN + '60' }]} />}
    <View style={[bc.avatar, { backgroundColor: item.isDefault ? SHIELD_GREEN + '18' : G.icon(mode) }]}>
      <Text style={[bc.initials, { color: item.isDefault ? SHIELD_GREEN : theme.foreground }]}>{item.name[0].toUpperCase()}</Text>
    </View>
    <View style={{ flex:1 }}>
      <View style={bc.nameRow}>
        <Text style={[bc.name, { color: theme.foreground }]}>{item.name}</Text>
        {item.isDefault && (
          <View style={[bc.defaultBadge, { backgroundColor: SHIELD_GREEN + '18', borderColor: SHIELD_GREEN + '30', borderWidth:1 }]}>
            <Ionicons name="star" size={9} color={SHIELD_GREEN} />
            <Text style={[bc.defaultTxt, { color: SHIELD_GREEN }]}>DEFAULT</Text>
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
  card:       { flexDirection:'row', alignItems:'center', borderRadius:16, borderWidth:1.5, padding:14, marginBottom:10, gap:12, overflow:'hidden' },
  topEdge:    { position:'absolute', top:0, left:0, right:0, height:1 },
  avatar:     { width:44, height:44, borderRadius:22, justifyContent:'center', alignItems:'center', flexShrink:0 },
  initials:   { fontSize:18, fontWeight:'800' },
  nameRow:    { flexDirection:'row', alignItems:'center', gap:8, marginBottom:3 },
  name:       { fontSize:14, fontWeight:'700' },
  phone:      { fontSize:12 },
  defaultBadge: { flexDirection:'row', alignItems:'center', gap:4, borderRadius:8, paddingHorizontal:6, paddingVertical:3 },
  defaultTxt:   { fontSize:8, fontWeight:'800', letterSpacing:0.5 },
  actions:    { flexDirection:'row', gap:2 },
  actionBtn:  { padding:6 },
});

// ── Active session card ───────────────────────────────────────────────────────
const ActiveSessionCard = ({ session, viewUrl, whatsappLink, onDeactivate, onArrivedSafe, theme, mode }) => (
  <View style={[asc.card, { overflow:'hidden' }]}>
    <LinearGradient
      colors={['rgba(76,175,80,0.14)','rgba(76,175,80,0.06)']}
      start={{ x:0, y:0 }} end={{ x:1, y:1 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={[asc.topEdge, { backgroundColor: SHIELD_GREEN + '60' }]} />
    <View style={asc.header}>
      <Ionicons name="shield-checkmark" size={18} color={SHIELD_GREEN} />
      <Text style={asc.title}>Guardian: {session.beneficiaryName}</Text>
    </View>
    <Text style={[asc.phone, { color: theme.hint }]}>{session.beneficiaryPhone}</Text>
    <Text style={[asc.views, { color: theme.hint }]}>
      👁 Viewed {session.viewCount} {session.viewCount === 1 ? 'time' : 'times'}
    </Text>
    <View style={asc.btnRow}>
      <TouchableOpacity style={[asc.btn, { backgroundColor: '#25D366' }]} onPress={() => Linking.openURL(whatsappLink)}>
        <Ionicons name="logo-whatsapp" size={15} color="#FFF" />
        <Text style={asc.btnTxt}>Share Again</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[asc.btn, { backgroundColor: SHIELD_GREEN }]} onPress={onArrivedSafe}>
        <Ionicons name="checkmark-circle" size={15} color="#FFF" />
        <Text style={asc.btnTxt}>I'm Safe</Text>
      </TouchableOpacity>
    </View>
    <TouchableOpacity onPress={onDeactivate} style={asc.deactivate}>
      <Text style={asc.deactivateTxt}>Deactivate SHIELD</Text>
    </TouchableOpacity>
  </View>
);
const asc = StyleSheet.create({
  card:         { borderRadius:18, borderWidth:1.5, borderColor: SHIELD_GREEN + '40', padding:18, marginBottom:22, overflow:'hidden' },
  topEdge:      { position:'absolute', top:0, left:0, right:0, height:1 },
  header:       { flexDirection:'row', alignItems:'center', gap:8, marginBottom:6 },
  title:        { fontSize:15, fontWeight:'700', color: SHIELD_GREEN },
  phone:        { fontSize:12, marginBottom:4, marginLeft:26 },
  views:        { fontSize:11, marginBottom:14, marginLeft:26 },
  btnRow:       { flexDirection:'row', gap:10, marginBottom:12 },
  btn:          { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, borderRadius:12, paddingVertical:12 },
  btnTxt:       { fontSize:13, fontWeight:'700', color:'#FFF' },
  deactivate:   { alignItems:'center' },
  deactivateTxt:{ fontSize:12, color:'#E05555', fontWeight:'600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function ShieldScreen({ navigation, route }) {
  const { theme, mode } = useTheme();
  const { user }        = useAuth();
  const insets          = useSafeAreaInsets();
  const darkMode        = mode === 'dark';

  const rideId     = route?.params?.rideId;
  const deliveryId = route?.params?.deliveryId;

  const [beneficiaries, setBeneficiaries] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [viewUrl,       setViewUrl]       = useState(null);
  const [whatsappLink,  setWhatsappLink]  = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [sheetVisible,  setSheetVisible]  = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, sRes] = await Promise.allSettled([
        shieldAPI.listBeneficiaries(),
        rideId || deliveryId ? shieldAPI.getSession({ rideId, deliveryId }) : Promise.resolve(null),
      ]);
      if (bRes.status === 'fulfilled') setBeneficiaries(bRes.value?.data?.beneficiaries ?? []);
      if (sRes.status === 'fulfilled' && sRes.value) {
        const d = sRes.value?.data;
        if (d?.session) { setActiveSession(d.session); setViewUrl(d.viewUrl); setWhatsappLink(d.whatsappLink); }
      }
    } catch {}
    finally { setLoading(false); }
  }, [rideId, deliveryId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = (id) => {
    Alert.alert('Remove Guardian?', 'This person will no longer be a quick option.',[
      { text:'Cancel', style:'cancel' },
      { text:'Remove', style:'destructive', onPress: async () => {
        try {
          await shieldAPI.deleteBeneficiary(id);
          setBeneficiaries(prev => prev.filter(b => b.id !== id));
        } catch(e) { Alert.alert('Error', e?.response?.data?.message ?? 'Could not remove guardian.'); }
      }},
    ]);
  };

  const handleSetDefault = async (id) => {
    try { await shieldAPI.updateBeneficiary(id,{ isDefault:true }); fetchAll(); }
    catch(e) { Alert.alert('Error', e?.response?.data?.message ?? 'Could not update guardian.'); }
  };

  const handleActivated = (result) => {
    setSheetVisible(false);
    setActiveSession(result.session);
    setViewUrl(result.viewUrl);
    setWhatsappLink(result.whatsappLink);
    Linking.openURL(result.whatsappLink).catch(() => {});
  };

  const handleDeactivate = () => {
    Alert.alert('Deactivate SHIELD?','Your guardian will no longer be able to track this trip.',[
      { text:'Cancel', style:'cancel' },
      { text:'Deactivate', style:'destructive', onPress: async () => {
        try {
          await shieldAPI.deactivate({ rideId, deliveryId });
          setActiveSession(null); setViewUrl(null); setWhatsappLink(null);
        } catch(e) { Alert.alert('Error', e?.response?.data?.message ?? 'Could not deactivate.'); }
      }},
    ]);
  };

  const handleArrivedSafe = async () => {
    try {
      await shieldAPI.arrivedSafe({ rideId, deliveryId });
      Alert.alert('✅ Confirmed!','Your guardian has been notified that you arrived safely.');
    } catch(e) { Alert.alert('Error', e?.response?.data?.message ?? 'Could not confirm arrival.'); }
  };

  const hasActiveRide = !!(rideId || deliveryId);

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Green ambient glow */}
      {!!activeSession && (
        <View style={[s.glow, { backgroundColor: darkMode ? 'rgba(76,175,80,0.06)' : 'rgba(76,175,80,0.04)' }]} />
      )}

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 14, borderBottomColor: G.border(mode) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex:1 }}>
          <Text style={[s.headerTitle, { color: theme.foreground }]}>SHIELD</Text>
          <Text style={[s.headerSub, { color: theme.hint }]}>Safety Guardian</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('ShieldBeneficiaries')}
          style={[s.manageBtn, { backgroundColor: G.icon(mode), borderColor: G.border(mode) }]}
        >
          <Ionicons name="people-outline" size={15} color={theme.foreground} />
          <Text style={[s.manageBtnTxt, { color: theme.foreground }]}>Guardians</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={SHIELD_GREEN} style={{ marginTop:60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + (Platform.OS==='ios' ? 110 : 90) }]}
          showsVerticalScrollIndicator={false}
        >
          <ShieldBadge active={!!activeSession} theme={theme} mode={mode} />

          {/* Info card */}
          {!activeSession && (
            <View style={[s.infoCard, { borderColor: G.border(mode), overflow:'hidden' }]}>
              <LinearGradient
                colors={darkMode ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.70)']}
                start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={[s.infoTitle, { color: theme.foreground }]}>How SHIELD Works</Text>
              {[
                { icon:'person-add-outline',    text:'Add a trusted guardian — no app download needed' },
                { icon:'link-outline',           text:'Share a secure link via WhatsApp in one tap' },
                { icon:'navigate-outline',       text:'They see live driver location, vehicle details & route' },
                { icon:'alert-circle-outline',   text:'They can send a safety check alert directly to your driver' },
                { icon:'checkmark-done-outline', text:"Tap \"I'm Safe\" when you arrive — they're instantly notified" },
              ].map((item, i) => (
                <View key={i} style={s.infoRow}>
                  <View style={[s.infoIcon, { backgroundColor: SHIELD_GREEN + '15' }]}>
                    <Ionicons name={item.icon} size={15} color={SHIELD_GREEN} />
                  </View>
                  <Text style={[s.infoText, { color: theme.hint }]}>{item.text}</Text>
                </View>
              ))}
            </View>
          )}

          {activeSession && viewUrl && (
            <ActiveSessionCard
              session={activeSession} viewUrl={viewUrl} whatsappLink={whatsappLink}
              onDeactivate={handleDeactivate} onArrivedSafe={handleArrivedSafe}
              theme={theme} mode={mode}
            />
          )}

          {/* Night banner */}
          {!activeSession && (
            <View style={[s.nightBanner, { backgroundColor:'rgba(123,104,238,0.10)', borderColor:'rgba(123,104,238,0.30)' }]}>
              <Ionicons name="moon-outline" size={15} color="#7B68EE" />
              <Text style={[s.nightTxt, { color:'#7B68EE' }]}>
                Auto-SHIELD notifies your default guardian automatically for rides after 9 PM.
              </Text>
            </View>
          )}

          {/* Activate */}
          {hasActiveRide && !activeSession && (
            <TouchableOpacity style={s.activateBtn} onPress={() => setSheetVisible(true)} activeOpacity={0.85}>
              <LinearGradient
                colors={[SHIELD_GREEN, '#388E3C']}
                start={{ x:0, y:0 }} end={{ x:1, y:0 }}
                style={[StyleSheet.absoluteFill, { borderRadius:18 }]}
              />
              <View style={[s.activateBtnInner, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Ionicons name="shield-checkmark" size={18} color="#FFF" />
              </View>
              <Text style={s.activateBtnTxt}>Activate SHIELD</Text>
            </TouchableOpacity>
          )}

          {!hasActiveRide && (
            <View style={[s.noRideNote, { borderColor: G.border(mode), overflow:'hidden' }]}>
              <LinearGradient
                colors={darkMode ? ['rgba(255,255,255,0.04)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.80)','rgba(255,255,255,0.60)']}
                start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="information-circle-outline" size={15} color={theme.hint} />
              <Text style={[s.noRideNoteTxt, { color: theme.hint }]}>
                SHIELD can be activated from the ride or delivery tracking screen once your trip has started.
              </Text>
            </View>
          )}

          <Text style={[s.sectionTitle, { color: theme.hint }]}>SAVED GUARDIANS</Text>

          {beneficiaries.length === 0 ? (
            <TouchableOpacity
              style={[s.addFirstBtn, { borderColor: G.borderHi(mode), overflow:'hidden' }]}
              onPress={() => navigation.navigate('ShieldBeneficiaries')}
            >
              <LinearGradient
                colors={darkMode ? ['rgba(76,175,80,0.08)','rgba(76,175,80,0.03)'] : ['rgba(76,175,80,0.06)','rgba(76,175,80,0.02)']}
                start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="add-circle-outline" size={22} color={SHIELD_GREEN} />
              <Text style={[s.addFirstTxt, { color: SHIELD_GREEN }]}>Add your first guardian</Text>
            </TouchableOpacity>
          ) : (
            beneficiaries.slice(0,3).map(b => (
              <BeneficiaryCard
                key={b.id} item={b} theme={theme} mode={mode}
                onEdit={() => navigation.navigate('ShieldBeneficiaries',{ editId:b.id })}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
              />
            ))
          )}
          {beneficiaries.length > 3 && (
            <TouchableOpacity onPress={() => navigation.navigate('ShieldBeneficiaries')}>
              <Text style={[s.viewAll, { color: SHIELD_GREEN }]}>View all {beneficiaries.length} guardians →</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

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

const G2 = { borderHi: (mode) => mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' };

const s = StyleSheet.create({
  root:          { flex:1 },
  glow:          { position:'absolute', width:400, height:400, borderRadius:200, top:-100, alignSelf:'center' },
  header:        { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, paddingBottom:14, borderBottomWidth:1 },
  backBtn:       { padding:4 },
  headerTitle:   { fontSize:20, fontWeight:'900', letterSpacing:-0.3 },
  headerSub:     { fontSize:11 },
  manageBtn:     { flexDirection:'row', alignItems:'center', gap:5, borderRadius:11, borderWidth:1, paddingHorizontal:11, paddingVertical:8 },
  manageBtnTxt:  { fontSize:12, fontWeight:'700' },
  scroll:        { paddingHorizontal:20, paddingTop:24 },

  infoCard:   { borderRadius:18, borderWidth:1, padding:18, marginBottom:22, gap:14, overflow:'hidden' },
  infoTitle:  { fontSize:14, fontWeight:'800', marginBottom:2 },
  infoRow:    { flexDirection:'row', alignItems:'flex-start', gap:12 },
  infoIcon:   { width:30, height:30, borderRadius:9, justifyContent:'center', alignItems:'center', flexShrink:0, marginTop:1 },
  infoText:   { fontSize:13, flex:1, lineHeight:18 },

  nightBanner: { flexDirection:'row', alignItems:'flex-start', gap:10, borderRadius:14, borderWidth:1, padding:14, marginBottom:22 },
  nightTxt:    { fontSize:12, flex:1, lineHeight:17 },

  activateBtn:       { height:58, borderRadius:18, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:12, marginBottom:24, overflow:'hidden' },
  activateBtnInner:  { width:36, height:36, borderRadius:11, justifyContent:'center', alignItems:'center' },
  activateBtnTxt:    { fontSize:16, fontWeight:'900', color:'#FFF', letterSpacing:0.3 },

  noRideNote:    { flexDirection:'row', alignItems:'flex-start', gap:10, borderRadius:14, borderWidth:1, padding:14, marginBottom:24, overflow:'hidden' },
  noRideNoteTxt: { fontSize:12, flex:1, lineHeight:17 },

  sectionTitle:  { fontSize:9, fontWeight:'800', letterSpacing:3.5, marginBottom:14 },
  addFirstBtn:   { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, borderRadius:16, borderWidth:1.5, paddingVertical:18, marginBottom:16, overflow:'hidden' },
  addFirstTxt:   { fontSize:14, fontWeight:'700' },
  viewAll:       { fontSize:13, fontWeight:'600', textAlign:'center', marginTop:4 },
});