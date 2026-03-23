// mobile/src/screens/Customer/ShieldBeneficiariesScreen.js
//
// Full CRUD screen for managing saved SHIELD guardians.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
  StatusBar,
} from 'react-native';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }          from '../../context/ThemeContext';
import { shieldAPI }         from '../../services/api';

const EMPTY_FORM = { name: '', phone: '', email: '', isDefault: false };

export default function ShieldBeneficiariesScreen({ navigation, route }) {
  const { theme }  = useTheme();
  const insets     = useSafeAreaInsets();
  const accentFg   = theme.accentFg ?? '#111';

  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [modalVisible,  setModalVisible]  = useState(false);
  const [editId,        setEditId]        = useState(null);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [errors,        setErrors]        = useState({});

  const fetchBeneficiaries = useCallback(async () => {
    try {
      const res     = await shieldAPI.listBeneficiaries();
      setBeneficiaries(res?.data?.beneficiaries ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBeneficiaries(); }, [fetchBeneficiaries]);

  // If navigated with editId param, open editor
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

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalVisible(true);
  };

  const openEdit = (b) => {
    setEditId(b.id);
    setForm({ name: b.name, phone: b.phone, email: b.email ?? '', isDefault: b.isDefault });
    setErrors({});
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) {
        await shieldAPI.updateBeneficiary(editId, form);
      } else {
        await shieldAPI.addBeneficiary(form);
      }
      setModalVisible(false);
      fetchBeneficiaries();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not save guardian.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, name) => {
    Alert.alert(`Remove ${name}?`, 'They will no longer be a saved guardian.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await shieldAPI.deleteBeneficiary(id);
            setBeneficiaries(prev => prev.filter(b => b.id !== id));
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.message ?? 'Could not remove.');
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (id) => {
    try {
      await shieldAPI.updateBeneficiary(id, { isDefault: true });
      fetchBeneficiaries();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not update.');
    }
  };

  const Field = ({ label, field, placeholder, keyboard, error }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={[f.label, { color: theme.hint }]}>{label}</Text>
      <TextInput
        style={[f.input, { backgroundColor: theme.background, borderColor: error ? '#E05555' : theme.border, color: theme.foreground }]}
        placeholder={placeholder}
        placeholderTextColor={theme.hint}
        keyboardType={keyboard ?? 'default'}
        value={form[field]}
        onChangeText={v => { setForm(p => ({ ...p, [field]: v })); setErrors(p => ({ ...p, [field]: null })); }}
      />
      {error ? <Text style={f.error}>{error}</Text> : null}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.foreground }]}>My Guardians</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: theme.accent }]}
          onPress={openAdd}
        >
          <Ionicons name="add" size={18} color={accentFg} />
          <Text style={[s.addBtnTxt, { color: accentFg }]}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Info banner */}
          <View style={[s.infoBanner, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
            <Text style={[s.infoTxt, { color: theme.hint }]}>
              Up to 5 guardians. Mark one as <Text style={{ fontWeight: '700', color: theme.foreground }}>Default</Text> for Auto-SHIELD on night rides.
            </Text>
          </View>

          {beneficiaries.length === 0 ? (
            <View style={s.emptyState}>
              <View style={[s.emptyIcon, { backgroundColor: theme.accent + '15' }]}>
                <Ionicons name="people-outline" size={32} color={theme.accent} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.foreground }]}>No guardians yet</Text>
              <Text style={[s.emptySub, { color: theme.hint }]}>
                Add a trusted person who will receive your live location during rides.
              </Text>
              <TouchableOpacity
                style={[s.emptyAddBtn, { backgroundColor: theme.accent }]}
                onPress={openAdd}
              >
                <Ionicons name="add" size={16} color={accentFg} />
                <Text style={[s.emptyAddTxt, { color: accentFg }]}>Add First Guardian</Text>
              </TouchableOpacity>
            </View>
          ) : (
            beneficiaries.map((b) => (
              <View key={b.id} style={[s.card, { backgroundColor: theme.backgroundAlt, borderColor: b.isDefault ? '#4CAF50' : theme.border }]}>
                {/* Avatar */}
                <View style={[s.avatar, { backgroundColor: b.isDefault ? '#4CAF5020' : theme.accent + '15' }]}>
                  <Text style={[s.avatarTxt, { color: b.isDefault ? '#4CAF50' : theme.accent }]}>
                    {b.name[0].toUpperCase()}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Text style={[s.name, { color: theme.foreground }]}>{b.name}</Text>
                    {b.isDefault && (
                      <View style={s.defaultBadge}>
                        <Ionicons name="star" size={9} color="#4CAF50" />
                        <Text style={s.defaultBadgeTxt}>AUTO-SHIELD</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.phone, { color: theme.hint }]}>{b.phone}</Text>
                  {b.email ? <Text style={[s.email, { color: theme.hint }]}>{b.email}</Text> : null}
                </View>

                {/* Actions */}
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

      {/* Add / Edit modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={m.backdrop} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={m.kav}>
          <View style={[m.sheet, { backgroundColor: theme.backgroundAlt }]}>
            <View style={[m.handle, { backgroundColor: theme.border }]} />
            <Text style={[m.title, { color: theme.foreground }]}>{editId ? 'Edit Guardian' : 'New Guardian'}</Text>

            <Field label="FULL NAME" field="name" placeholder="e.g. Mum" error={errors.name} />
            <Field label="PHONE NUMBER" field="phone" placeholder="+234 800 000 0000" keyboard="phone-pad" error={errors.phone} />
            <Field label="EMAIL (OPTIONAL)" field="email" placeholder="email@example.com" keyboard="email-address" error={errors.email} />

            {/* Default toggle */}
            <TouchableOpacity
              style={[m.toggleRow, { borderColor: form.isDefault ? '#4CAF50' : theme.border, backgroundColor: form.isDefault ? '#4CAF5012' : 'transparent' }]}
              onPress={() => setForm(p => ({ ...p, isDefault: !p.isDefault }))}
            >
              <Ionicons name={form.isDefault ? 'star' : 'star-outline'} size={18} color={form.isDefault ? '#4CAF50' : theme.hint} />
              <View style={{ flex: 1 }}>
                <Text style={[m.toggleTitle, { color: theme.foreground }]}>Set as Default Guardian</Text>
                <Text style={[m.toggleSub, { color: theme.hint }]}>Automatically notified on night rides (9 PM – 5 AM)</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[m.saveBtn, { backgroundColor: '#4CAF50', opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : (
                <Text style={m.saveBtnTxt}>{editId ? 'Save Changes' : 'Add Guardian'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const f = StyleSheet.create({
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  error: { fontSize: 11, color: '#E05555', marginTop: 4 },
});

const m = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  kav:         { justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:       { fontSize: 18, fontWeight: '900', marginBottom: 20 },
  toggleRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 20 },
  toggleTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  toggleSub:   { fontSize: 11 },
  saveBtn:     { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  saveBtnTxt:  { fontSize: 16, fontWeight: '800', color: '#FFF' },
});

const s = StyleSheet.create({
  root:       { flex: 1 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:    { padding: 4 },
  title:      { fontSize: 18, fontWeight: '900', flex: 1 },
  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnTxt:  { fontSize: 13, fontWeight: '700' },
  scroll:     { paddingHorizontal: 20, paddingTop: 20 },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 20 },
  infoTxt:    { fontSize: 12, flex: 1, lineHeight: 17 },

  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyIcon:  { width: 70, height: 70, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 24, paddingHorizontal: 20 },
  emptyAddBtn:{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },
  emptyAddTxt:{ fontSize: 14, fontWeight: '700' },

  card:       { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 10 },
  avatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarTxt:  { fontSize: 18, fontWeight: '800' },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  name:       { fontSize: 14, fontWeight: '700' },
  phone:      { fontSize: 12 },
  email:      { fontSize: 11 },
  defaultBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#4CAF5018', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  defaultBadgeTxt: { fontSize: 8, fontWeight: '800', color: '#4CAF50' },
  actions:    { flexDirection: 'row', gap: 2 },
  actionBtn:  { padding: 6 },
});