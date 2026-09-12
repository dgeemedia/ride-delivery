// mobile/src/components/ShieldActivateSheet.js
//
// Bottom sheet that pops up when the customer taps "Activate SHIELD".
// Lets them pick a saved beneficiary OR enter a one-off name + phone.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { shieldAPI } from '../services/api';

export default function ShieldActivateSheet({
  visible,
  onClose,
  onActivated,
  beneficiaries = [],
  rideId,
  deliveryId,
  theme,
}) {
  const { t } = useTranslation();
  const [mode,       setMode]       = useState('saved'); // 'saved' | 'manual'
  const [selectedId, setSelectedId] = useState(null);
  const [manualName, setManualName] = useState('');
  const [manualPhone,setManualPhone]= useState('');
  const [loading,    setLoading]    = useState(false);

  const accentFg = theme.accentFg ?? '#111';

  const handleActivate = async () => {
    if (mode === 'saved' && !selectedId) {
      Alert.alert(t('shieldActivateSheet.selectGuardianTitle'), t('shieldActivateSheet.selectGuardianBody'));
      return;
    }
    if (mode === 'manual') {
      if (!manualName.trim() || !manualPhone.trim()) {
        Alert.alert(t('shieldActivateSheet.missingInfoTitle'), t('shieldActivateSheet.missingInfoBody'));
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        ...(rideId     && { rideId }),
        ...(deliveryId && { deliveryId }),
        ...(mode === 'saved'  && { beneficiaryId: selectedId }),
        ...(mode === 'manual' && { beneficiaryName: manualName.trim(), beneficiaryPhone: manualPhone.trim() }),
      };

      const res = await shieldAPI.activate(payload);
      onActivated(res.data);
    } catch (e) {
      Alert.alert(t('shieldActivateSheet.couldNotActivateTitle'), e?.response?.data?.message ?? t('shieldActivateSheet.pleaseTryAgain'));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMode('saved');
    setSelectedId(null);
    setManualName('');
    setManualPhone('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => { reset(); onClose(); }}
    >
      <TouchableWithoutFeedback onPress={() => { reset(); onClose(); }}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <View style={[s.sheet, { backgroundColor: theme.backgroundAlt }]}>

          {/* Handle */}
          <View style={[s.handle, { backgroundColor: theme.border }]} />

          {/* Title */}
          <View style={s.titleRow}>
            <Ionicons name="shield-checkmark" size={22} color="#4CAF50" />
            <Text style={[s.title, { color: theme.foreground }]}>{t('shieldActivateSheet.activateShieldTitle')}</Text>
          </View>
          <Text style={[s.sub, { color: theme.hint }]}>
            {rideId ? t('shieldActivateSheet.chooseWhoWillWatchRide') : t('shieldActivateSheet.chooseWhoWillWatchDelivery')}
            {' '}{t('shieldActivateSheet.noAppNeeded')}
          </Text>

          {/* Mode toggle */}
          <View style={[s.toggle, { backgroundColor: theme.background }]}>
            {['saved', 'manual'].map(m => (
              <TouchableOpacity
                key={m}
                style={[s.toggleBtn, mode === m && { backgroundColor: theme.accent }]}
                onPress={() => setMode(m)}
              >
                <Text style={[s.toggleTxt, { color: mode === m ? accentFg : theme.hint }]}>
                  {m === 'saved' ? t('shieldActivateSheet.savedGuardiansTab') : t('shieldActivateSheet.enterManuallyTab')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {mode === 'saved' && (
              beneficiaries.length === 0 ? (
                <View style={s.emptyRow}>
                  <Text style={[s.emptyTxt, { color: theme.hint }]}>
                    {t('shieldActivateSheet.noSavedGuardiansYet')}
                  </Text>
                </View>
              ) : (
                beneficiaries.map(b => (
                  <TouchableOpacity
                    key={b.id}
                    style={[
                      s.beneficiaryRow,
                      { borderColor: selectedId === b.id ? '#4CAF50' : theme.border, backgroundColor: theme.background },
                    ]}
                    onPress={() => setSelectedId(b.id)}
                  >
                    <View style={[s.avatar, { backgroundColor: '#4CAF5020' }]}>
                      <Text style={[s.avatarTxt, { color: '#4CAF50' }]}>{b.name[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[s.bName, { color: theme.foreground }]}>{b.name}</Text>
                        {b.isDefault && (
                          <View style={[s.defaultPill, { backgroundColor: theme.accent }]}>
                            <Text style={[s.defaultPillTxt, { color: accentFg }]}>{t('shieldActivateSheet.defaultBadge')}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[s.bPhone, { color: theme.hint }]}>{b.phone}</Text>
                    </View>
                    {selectedId === b.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    )}
                  </TouchableOpacity>
                ))
              )
            )}

            {mode === 'manual' && (
              <View style={s.manualForm}>
                <Text style={[s.inputLabel, { color: theme.hint }]}>{t('shieldActivateSheet.guardianName')}</Text>
                <TextInput
                  style={[s.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.foreground }]}
                  placeholder={t('shieldActivateSheet.namePlaceholder')}
                  placeholderTextColor={theme.hint}
                  value={manualName}
                  onChangeText={setManualName}
                />
                <Text style={[s.inputLabel, { color: theme.hint }]}>{t('shieldActivateSheet.phoneNumber')}</Text>
                <TextInput
                  style={[s.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.foreground }]}
                  placeholder="+234 800 000 0000"
                  placeholderTextColor={theme.hint}
                  keyboardType="phone-pad"
                  value={manualPhone}
                  onChangeText={setManualPhone}
                />
              </View>
            )}
          </ScrollView>

          {/* Activate button */}
          <TouchableOpacity
            style={[s.activateBtn, { backgroundColor: '#4CAF50', opacity: loading ? 0.7 : 1 }]}
            onPress={handleActivate}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={18} color="#FFF" />
                <Text style={s.activateBtnTxt}>{t('shieldActivateSheet.activateAndSendLink')}</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={[s.disclaimer, { color: theme.hint }]}>
            {t('shieldActivateSheet.whatsappDisclaimer')}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  kav:           { justifyContent: 'flex-end' },
  sheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  handle:        { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  title:         { fontSize: 18, fontWeight: '900' },
  sub:           { fontSize: 13, lineHeight: 18, marginBottom: 20 },
  toggle:        { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 16 },
  toggleBtn:     { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  toggleTxt:     { fontSize: 12, fontWeight: '700' },

  emptyRow:      { padding: 20, alignItems: 'center' },
  emptyTxt:      { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  beneficiaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1.5, padding: 12, marginBottom: 8 },
  avatar:        { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  avatarTxt:     { fontSize: 15, fontWeight: '800' },
  bName:         { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  bPhone:        { fontSize: 12 },
  defaultPill:   { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  defaultPillTxt:{ fontSize: 8, fontWeight: '800' },

  manualForm:    { paddingTop: 4 },
  inputLabel:    { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  input:         { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 14 },

  activateBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 15, marginTop: 16, marginBottom: 10 },
  activateBtnTxt:{ fontSize: 16, fontWeight: '800', color: '#FFF' },
  disclaimer:    { fontSize: 11, textAlign: 'center', lineHeight: 16 },
});