// mobile/src/screens/Customer/ShieldBeneficiariesScreen.js
// ── Premium Glass Edition ─────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
  StatusBar,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { shieldAPI }         from '../../services/api';

const SHIELD_GREEN = '#4CAF50';
const EMPTY_FORM   = { name:'', phone:'', email:'', isDefault:false };

const G = {
  card:   (mode) => mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.80)',
  cardMid:(mode) => mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.90)',
  border: (mode) => mode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
  borderHi:(mode)=> mode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
  icon:   (mode) => mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
  input:  (mode) => mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.80)',
};

export default function ShieldBeneficiariesScreen({ navigation, route }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();
  const darkMode        = mode === 'dark';

  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [modalVisible,  setModalVisible]  = useState(false);
  const [editId,        setEditId]        = useState(null);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [errors,        setErrors]        = useState({});

  const fetchBeneficiaries = useCallback(async () => {
    try {
      const res = await shieldAPI.listBeneficiaries();
      setBeneficiaries(res?.data?.beneficiaries ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBeneficiaries(); }, [fetchBeneficiaries]);

  useEffect(() => {
    if (route?.params?.editId && beneficiaries.length > 0) {
      const target = beneficiaries.find(b => b.id === route.params.editId);
      if (target) openEdit(target);
    }
  }, [route?.params?.editId, beneficiaries]);

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name  = 'Name is required';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    else if (!/^\+?[\d\s\-()]{7,}$/.test(form.phone)) e.phone = 'Invalid phone number';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setErrors({}); setModalVisible(true); };
  const openEdit = (b) => { setEditId(b.id); setForm({ name:b.name, phone:b.phone, email:b.email??'', isDefault:b.isDefault }); setErrors({}); setModalVisible(true); };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) await shieldAPI.updateBeneficiary(editId, form);
      else await shieldAPI.addBeneficiary(form);
      setModalVisible(false);
      fetchBeneficiaries();
    } catch(e) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not save guardian.');
    } finally { setSaving(false); }
  };

  const handleDelete = (id, name) => {
    Alert.alert(`Remove ${name}?`,'They will no longer be a saved guardian.',[
      { text:'Cancel', style:'cancel' },
      { text:'Remove', style:'destructive', onPress: async () => {
        try {
          await shieldAPI.deleteBeneficiary(id);
          setBeneficiaries(prev => prev.filter(b => b.id !== id));
        } catch(e) { Alert.alert('Error', e?.response?.data?.message ?? 'Could not remove.'); }
      }},
    ]);
  };

  const handleSetDefault = async (id) => {
    try { await shieldAPI.updateBeneficiary(id,{ isDefault:true }); fetchBeneficiaries(); }
    catch(e) { Alert.alert('Error', e?.response?.data?.message ?? 'Could not update.'); }
  };

  // ── Glass field ──────────────────────────────────────────────────────────
  const Field = ({ label, field, placeholder, keyboard, error }) => (
    <View style={{ marginBottom:14 }}>
      <Text style={[f.label, { color: theme.hint }]}>{label}</Text>
      <View style={[f.inputWrap, { backgroundColor: G.input(mode), borderColor: error ? '#E05555' : G.border(mode), overflow:'hidden' }]}>
        <TextInput
          style={[f.input, { color: theme.foreground }]}
          placeholder={placeholder}
          placeholderTextColor={theme.hint}
          keyboardType={keyboard ?? 'default'}
          value={form[field]}
          onChangeText={v => { setForm(p => ({ ...p, [field]:v })); setErrors(p => ({ ...p, [field]:null })); }}
        />
      </View>
      {error && <Text style={f.error}>{error}</Text>}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Ambient glow */}
      <View style={[s.glow, { backgroundColor: darkMode ? 'rgba(76,175,80,0.04)' : 'rgba(76,175,80,0.03)' }]} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 14, borderBottomColor: G.border(mode) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.foreground }]}>My Guardians</Text>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: SHIELD_GREEN }]} onPress={openAdd}>
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={s.addBtnTxt}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={SHIELD_GREEN} style={{ marginTop:60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + (Platform.OS==='ios' ? 110 : 90) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Info banner */}
          <View style={[s.infoBanner, { borderColor: G.border(mode), overflow:'hidden' }]}>
            <LinearGradient
              colors={darkMode ? ['rgba(76,175,80,0.08)','rgba(76,175,80,0.03)'] : ['rgba(76,175,80,0.06)','rgba(76,175,80,0.02)']}
              start={{ x:0, y:0 }} end={{ x:1, y:1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="shield-checkmark" size={16} color={SHIELD_GREEN} />
            <Text style={[s.infoTxt, { color: theme.hint }]}>
              Up to 5 guardians. Mark one as{' '}
              <Text style={{ fontWeight:'700', color: SHIELD_GREEN }}>Default</Text>{' '}
              for Auto-SHIELD on night rides.
            </Text>
          </View>

          {beneficiaries.length === 0 ? (
            <View style={s.emptyState}>
              <View style={[s.emptyIcon, { backgroundColor: SHIELD_GREEN + '12', borderColor: SHIELD_GREEN + '25', borderWidth:1 }]}>
                <Ionicons name="people-outline" size={32} color={SHIELD_GREEN} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.foreground }]}>No guardians yet</Text>
              <Text style={[s.emptySub, { color: theme.hint }]}>Add a trusted person who will receive your live location during rides.</Text>
              <TouchableOpacity style={[s.emptyAddBtn, { backgroundColor: SHIELD_GREEN }]} onPress={openAdd}>
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={s.emptyAddTxt}>Add First Guardian</Text>
              </TouchableOpacity>
            </View>
          ) : (
            beneficiaries.map((b) => (
              <View key={b.id} style={[s.card, { borderColor: b.isDefault ? SHIELD_GREEN + '50' : G.border(mode), overflow:'hidden' }]}>
                <LinearGradient
                  colors={b.isDefault
                    ? ['rgba(76,175,80,0.10)','rgba(76,175,80,0.04)']
                    : (darkMode ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.88)','rgba(255,255,255,0.70)'])
                  }
                  start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                  style={StyleSheet.absoluteFill}
                />
                {b.isDefault && <View style={[s.cardTopEdge, { backgroundColor: SHIELD_GREEN + '60' }]} />}

                <View style={[s.avatar, { backgroundColor: b.isDefault ? SHIELD_GREEN + '18' : G.icon(mode) }]}>
                  <Text style={[s.avatarTxt, { color: b.isDefault ? SHIELD_GREEN : theme.foreground }]}>
                    {b.name[0].toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex:1 }}>
                  <View style={s.nameRow}>
                    <Text style={[s.name, { color: theme.foreground }]}>{b.name}</Text>
                    {b.isDefault && (
                      <View style={[s.defaultBadge, { backgroundColor: SHIELD_GREEN + '18', borderColor: SHIELD_GREEN + '30', borderWidth:1 }]}>
                        <Ionicons name="star" size={9} color={SHIELD_GREEN} />
                        <Text style={[s.defaultBadgeTxt, { color: SHIELD_GREEN }]}>AUTO-SHIELD</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.phone, { color: theme.hint }]}>{b.phone}</Text>
                  {b.email ? <Text style={[s.email, { color: theme.hint }]}>{b.email}</Text> : null}
                </View>

                <View style={s.actions}>
                  {!b.isDefault && (
                    <TouchableOpacity style={s.actionBtn} onPress={() => handleSetDefault(b.id)}>
                      <Ionicons name="star-outline" size={18} color={theme.hint} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(b)}>
                    <Ionicons name="create-outline" size={18} color={theme.hint} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.actionBtn} onPress={() => handleDelete(b.id, b.name)}>
                    <Ionicons name="trash-outline" size={18} color="#E05555" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={m.backdrop} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={m.kav}>
          <View style={[m.sheet, { backgroundColor: darkMode ? 'rgba(10,10,10,0.98)' : 'rgba(255,255,255,0.98)', borderColor: G.border(mode) }]}>
            <LinearGradient
              colors={darkMode ? ['rgba(255,255,255,0.06)','rgba(255,255,255,0.02)'] : ['rgba(255,255,255,1)','rgba(255,255,255,0.9)']}
              start={{ x:0, y:0 }} end={{ x:1, y:1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[m.handle, { backgroundColor: G.border(mode) }]} />
            <Text style={[m.title, { color: theme.foreground }]}>{editId ? 'Edit Guardian' : 'New Guardian'}</Text>

            <Field label="FULL NAME"          field="name"  placeholder="e.g. Mum"               error={errors.name}  />
            <Field label="PHONE NUMBER"        field="phone" placeholder="+234 800 000 0000" keyboard="phone-pad"   error={errors.phone} />
            <Field label="EMAIL (OPTIONAL)"    field="email" placeholder="email@example.com" keyboard="email-address" error={errors.email} />

            <TouchableOpacity
              style={[m.toggleRow, { borderColor: form.isDefault ? SHIELD_GREEN + '50' : G.border(mode), backgroundColor: form.isDefault ? SHIELD_GREEN + '10' : 'transparent' }]}
              onPress={() => setForm(p => ({ ...p, isDefault: !p.isDefault }))}
            >
              <Ionicons name={form.isDefault ? 'star' : 'star-outline'} size={18} color={form.isDefault ? SHIELD_GREEN : theme.hint} />
              <View style={{ flex:1 }}>
                <Text style={[m.toggleTitle, { color: theme.foreground }]}>Set as Default Guardian</Text>
                <Text style={[m.toggleSub, { color: theme.hint }]}>Automatically notified on night rides (9 PM – 5 AM)</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[m.saveBtn, { opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <LinearGradient
                colors={[SHIELD_GREEN, '#388E3C']}
                start={{ x:0, y:0 }} end={{ x:1, y:0 }}
                style={[StyleSheet.absoluteFill, { borderRadius:16 }]}
              />
              {saving
                ? <ActivityIndicator color="#FFF" />
                : <Text style={m.saveBtnTxt}>{editId ? 'Save Changes' : 'Add Guardian'}</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const f = StyleSheet.create({
  label:    { fontSize:9, fontWeight:'800', letterSpacing:2, marginBottom:7 },
  inputWrap:{ borderRadius:14, borderWidth:1.5, overflow:'hidden' },
  input:    { paddingHorizontal:14, paddingVertical:14, fontSize:14 },
  error:    { fontSize:11, color:'#E05555', marginTop:4 },
});

const m = StyleSheet.create({
  backdrop:    { flex:1, backgroundColor:'rgba(0,0,0,0.55)' },
  kav:         { justifyContent:'flex-end' },
  sheet:       { borderTopLeftRadius:28, borderTopRightRadius:28, borderWidth:1, padding:24, paddingBottom:40, overflow:'hidden' },
  handle:      { width:40, height:4, borderRadius:2, alignSelf:'center', marginBottom:22 },
  title:       { fontSize:20, fontWeight:'900', marginBottom:22, letterSpacing:-0.3 },
  toggleRow:   { flexDirection:'row', alignItems:'center', gap:12, borderRadius:16, borderWidth:1.5, padding:14, marginBottom:20 },
  toggleTitle: { fontSize:14, fontWeight:'700', marginBottom:2 },
  toggleSub:   { fontSize:11 },
  saveBtn:     { height:56, borderRadius:16, alignItems:'center', justifyContent:'center', overflow:'hidden' },
  saveBtnTxt:  { fontSize:16, fontWeight:'800', color:'#FFF' },
});

const s = StyleSheet.create({
  root:       { flex:1 },
  glow:       { position:'absolute', width:400, height:400, borderRadius:200, top:-150, alignSelf:'center' },
  header:     { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, paddingBottom:14, borderBottomWidth:1 },
  backBtn:    { padding:4 },
  title:      { fontSize:20, fontWeight:'900', flex:1, letterSpacing:-0.3 },
  addBtn:     { flexDirection:'row', alignItems:'center', gap:5, borderRadius:11, paddingHorizontal:12, paddingVertical:9 },
  addBtnTxt:  { fontSize:13, fontWeight:'700', color:'#FFF' },
  scroll:     { paddingHorizontal:20, paddingTop:20 },
  infoBanner: { flexDirection:'row', alignItems:'flex-start', gap:10, borderRadius:14, borderWidth:1, padding:14, marginBottom:20, overflow:'hidden' },
  infoTxt:    { fontSize:12, flex:1, lineHeight:17 },

  emptyState: { alignItems:'center', paddingTop:48 },
  emptyIcon:  { width:72, height:72, borderRadius:22, justifyContent:'center', alignItems:'center', marginBottom:18 },
  emptyTitle: { fontSize:17, fontWeight:'800', marginBottom:8 },
  emptySub:   { fontSize:13, textAlign:'center', lineHeight:18, marginBottom:28, paddingHorizontal:20 },
  emptyAddBtn:{ flexDirection:'row', alignItems:'center', gap:8, borderRadius:14, paddingHorizontal:20, paddingVertical:13 },
  emptyAddTxt:{ fontSize:14, fontWeight:'700', color:'#FFF' },

  card:          { flexDirection:'row', alignItems:'center', gap:12, borderRadius:16, borderWidth:1.5, padding:14, marginBottom:10, overflow:'hidden' },
  cardTopEdge:   { position:'absolute', top:0, left:0, right:0, height:1 },
  avatar:        { width:46, height:46, borderRadius:23, justifyContent:'center', alignItems:'center', flexShrink:0 },
  avatarTxt:     { fontSize:18, fontWeight:'900' },
  nameRow:       { flexDirection:'row', alignItems:'center', gap:8, marginBottom:3 },
  name:          { fontSize:14, fontWeight:'700' },
  phone:         { fontSize:12 },
  email:         { fontSize:11, marginTop:1 },
  defaultBadge:  { flexDirection:'row', alignItems:'center', gap:3, borderRadius:7, paddingHorizontal:6, paddingVertical:3 },
  defaultBadgeTxt:{ fontSize:8, fontWeight:'800' },
  actions:       { flexDirection:'row', gap:2 },
  actionBtn:     { padding:6 },
});