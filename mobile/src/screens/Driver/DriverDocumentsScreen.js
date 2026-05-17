// mobile/src/screens/Driver/DriverDocumentsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, ActivityIndicator, Image, TextInput,
  KeyboardAvoidingView, Platform, Modal, Dimensions,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import * as ImagePicker   from 'expo-image-picker';
import * as MediaLibrary  from 'expo-media-library';
import * as FileSystem    from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }       from '../../context/ThemeContext';
import { driverAPI, uploadAPI } from '../../services/api';
import { toBase64DataUri } from '../../utils/toBase64DataUri';

const { height } = Dimensions.get('window');

const VEHICLE_TYPES = ['CAR', 'MOTORCYCLE', 'BIKE', 'VAN', 'TRICYCLE'];

const DOC_SLOTS = [
  { key: 'licenseImageUrl',  label: 'Driver License',          icon: 'card-outline',          uploadKey: 'license'      },
  { key: 'vehicleRegUrl',    label: 'Vehicle Registration',     icon: 'document-text-outline', uploadKey: 'registration' },
  { key: 'insuranceUrl',     label: 'Insurance Certificate',    icon: 'shield-outline',        uploadKey: 'insurance'    },
];

export default function DriverDocumentsScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const insets          = useSafeAreaInsets();

  // ── Bounded scroll height (mirrors ProfileScreen) ──────────────────────────
  const TAB_H        = 54;
  const EXTRA_BOTTOM = Platform.OS === 'android' ? 16 : 0;
  // No fixed header in this screen — back button lives inside the scroll.
  // Reserve only status bar + tab bar + safe area bottom.
  const SCROLL_H     = height - insets.top - TAB_H - insets.bottom - EXTRA_BOTTOM;

  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState({});
  const [viewImage, setViewImage] = useState(null);

  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleType,   setVehicleType]   = useState('CAR');
  const [vehicleMake,   setVehicleMake]   = useState('');
  const [vehicleModel,  setVehicleModel]  = useState('');
  const [vehicleYear,   setVehicleYear]   = useState('');
  const [vehicleColor,  setVehicleColor]  = useState('');
  const [vehiclePlate,  setVehiclePlate]  = useState('');

  const fetchProfile = async () => {
    try {
      const res  = await driverAPI.getProfile();
      const data = res?.data?.profile ?? res?.profile ?? res;
      setProfile(data ?? null);
    } catch (err) {
      const is404 =
        err?.message?.toLowerCase().includes('not found') ||
        err?.statusCode === 404 ||
        err?.status === 404;
      if (!is404) {
        Alert.alert('Error', 'Could not load your profile. Please try again.');
      }
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleCreateProfile = async () => {
    if (!licenseNumber.trim()) return Alert.alert('Missing Field', 'Please enter your driver license number.');
    if (!vehicleMake.trim() || !vehicleModel.trim()) return Alert.alert('Missing Field', 'Please enter your vehicle make and model.');
    const yr = parseInt(vehicleYear, 10);
    if (!vehicleYear || isNaN(yr) || yr < 1990 || yr > new Date().getFullYear() + 1)
      return Alert.alert('Invalid Year', 'Please enter a valid vehicle year (e.g. 2019).');
    if (!vehicleColor.trim()) return Alert.alert('Missing Field', 'Please enter your vehicle colour.');
    if (!vehiclePlate.trim()) return Alert.alert('Missing Field', 'Please enter your plate number.');

    const payload = {
      licenseNumber: licenseNumber.trim().toUpperCase(),
      vehicleType,
      vehicleMake:   vehicleMake.trim(),
      vehicleModel:  vehicleModel.trim(),
      vehicleYear:   yr,
      vehicleColor:  vehicleColor.trim(),
      vehiclePlate:  vehiclePlate.trim().toUpperCase(),
    };

    setSaving(true);
    try {
      await driverAPI.updateProfile(payload);
      Alert.alert('Profile Created ✅', 'Your driver profile has been submitted for review. You can now upload your documents below.');
      await fetchProfile();
    } catch (err) {
      const msg = err?.message || err?.errors?.[0]?.msg || 'Could not create profile. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const pickAndUpload = async (slot) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow access to your photo library.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality:    0.85,
        allowsEditing: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      setUploading(prev => ({ ...prev, [slot.key]: true }));

      let url = null;

      try {
        let uploadRes;
        if      (slot.uploadKey === 'license')       uploadRes = await uploadAPI.uploadDriverLicense(asset);
        else if (slot.uploadKey === 'registration')  uploadRes = await uploadAPI.uploadVehicleRegistration(asset);
        else if (slot.uploadKey === 'insurance')     uploadRes = await uploadAPI.uploadInsurance(asset);

        url =
          uploadRes?.data?.url        ??
          uploadRes?.data?.secure_url ??
          uploadRes?.url              ??
          uploadRes?.secure_url       ??
          null;
      } catch (multipartErr) {
        console.warn('[DriverDocuments] multipart failed, trying base64 fallback:', multipartErr?.message);
      }

      if (!url) {
        const dataUri   = await toBase64DataUri(asset.uri);
        const uploadRes = await uploadAPI.uploadBase64(dataUri, 'duoride/documents');
        url =
          uploadRes?.data?.url        ??
          uploadRes?.data?.secure_url ??
          uploadRes?.url              ??
          uploadRes?.secure_url       ??
          null;
      }

      if (!url) throw new Error('Upload succeeded but no URL was returned. Check Cloudinary config.');

      await driverAPI.uploadDocuments({ [slot.key]: url });
      await fetchProfile();
      Alert.alert('Uploaded ✅', `${slot.label} uploaded successfully.`);

    } catch (err) {
      Alert.alert('Upload Failed', err?.message || 'Please try again.');
    } finally {
      setUploading(prev => ({ ...prev, [slot.key]: false }));
    }
  };

  const handleDownload = async (url) => {
    if (Platform.OS === 'web') {
      try { window.open(url, '_blank'); }
      catch (err) { Alert.alert('Download failed', 'Could not open image on web.'); }
      return;
    }
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(false);
      if (!perm.granted) {
        Alert.alert('Permission needed', 'We need access to your media library to save the image.');
        return;
      }
      const localUri = FileSystem.documentDirectory + `doc_${Date.now()}.jpg`;
      const downloadRes = await FileSystem.downloadAsync(url, localUri);
      if (downloadRes.status !== 200) throw new Error('Download failed');
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert('Saved ✅', 'Document saved to your photos.');
    } catch (err) {
      Alert.alert('Download Failed', err?.message || 'Could not save document.');
    }
  };

  if (loading) {
    return (
      <View style={[sx.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // ── VIEW A: No profile yet (create profile form) ─────────────────────────
  if (!profile) {
    return (
      <View style={[sx.root, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* ── Bounded scroll container ── */}
          <View style={{ height: SCROLL_H }}>
            <ScrollView
              contentContainerStyle={sx.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces
              overScrollMode="always"
            >
              {/* Back button */}
              <TouchableOpacity style={sx.back} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={22} color={theme.foreground} />
              </TouchableOpacity>

              <View style={[sx.infoBanner, { backgroundColor: theme.backgroundAlt ?? '#F8FAFC', borderColor: theme.border ?? '#E2E8F0' }]}>
                <Ionicons name="information-circle-outline" size={20} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[sx.infoTitle, { color: theme.foreground }]}>Complete Your Driver Profile</Text>
                  <Text style={[sx.infoSub, { color: theme.hint }]}>Enter your vehicle details to submit your driver application. Documents can be added after.</Text>
                </View>
              </View>

              <Text style={[sx.sectionLabel, { color: theme.hint }]}>LICENSE INFO</Text>
              <InputField placeholder="License Number (e.g. ABC123456)" value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" theme={theme} />

              <Text style={[sx.sectionLabel, { color: theme.hint }]}>VEHICLE TYPE</Text>
              <View style={sx.chipRow}>
                {VEHICLE_TYPES.map(vt => {
                  const sel = vehicleType === vt;
                  return (
                    <TouchableOpacity key={vt} style={[sx.chip, { borderColor: sel ? (theme.accent ?? '#10B981') : (theme.border ?? '#E2E8F0'), backgroundColor: sel ? (theme.accent ?? '#10B981') + '15' : 'transparent' }]} onPress={() => setVehicleType(vt)}>
                      <Text style={[sx.chipTxt, { color: sel ? (theme.accent ?? '#10B981') : theme.hint }]}>{vt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[sx.sectionLabel, { color: theme.hint }]}>VEHICLE DETAILS</Text>
              <View style={sx.row}>
                <View style={{ flex: 1 }}><InputField placeholder="Make (Toyota)" value={vehicleMake} onChangeText={setVehicleMake} autoCapitalize="words" theme={theme} /></View>
                <View style={{ flex: 1 }}><InputField placeholder="Model (Camry)" value={vehicleModel} onChangeText={setVehicleModel} autoCapitalize="words" theme={theme} /></View>
              </View>
              <View style={sx.row}>
                <View style={{ flex: 1 }}><InputField placeholder="Year (2019)" value={vehicleYear} onChangeText={setVehicleYear} keyboardType="numeric" theme={theme} /></View>
                <View style={{ flex: 1 }}><InputField placeholder="Colour (Black)" value={vehicleColor} onChangeText={setVehicleColor} autoCapitalize="words" theme={theme} /></View>
              </View>
              <InputField placeholder="Plate Number (e.g. ABC123XY)" value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" theme={theme} />

              <TouchableOpacity style={[sx.primaryBtn, saving && sx.btnDim, { backgroundColor: theme.accent ?? '#10B981' }]} onPress={handleCreateProfile} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={[sx.primaryBtnTxt, { color: theme.accentFg }]}>Submit Application →</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── VIEW B: Profile exists, document upload / view / download ────────────
  const isApproved = profile?.isApproved ?? false;
  const isRejected = profile?.isRejected ?? false;

  return (
    <View style={[sx.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* ── Bounded scroll container ── */}
      <View style={{ height: SCROLL_H }}>
        <ScrollView
          contentContainerStyle={sx.scroll}
          showsVerticalScrollIndicator={false}
          bounces
          overScrollMode="always"
        >
          {/* Back button */}
          <TouchableOpacity style={sx.back} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={theme.foreground} />
          </TouchableOpacity>

          <Text style={[sx.title, { color: theme.foreground }]}>Documents</Text>
          <Text style={[sx.subtitle, { color: theme.hint }]}>Upload clear photos to speed up your approval.</Text>

          {/* Approval status banner */}
          {isRejected ? (
            <View style={[sx.statusBanner, { backgroundColor: '#E0555510', borderColor: '#E05555' }]}>
              <Ionicons name="close-circle-outline" size={18} color="#E05555" />
              <View style={{ flex: 1 }}>
                <Text style={[sx.statusTitle, { color: '#E05555' }]}>Application Not Approved</Text>
                <Text style={[sx.statusSub, { color: theme.hint }]}>{profile.rejectionReason || 'Please contact support for more information.'}</Text>
              </View>
            </View>
          ) : isApproved ? (
            <View style={[sx.statusBanner, { backgroundColor: '#10B98110', borderColor: '#10B981' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={[sx.statusTitle, { color: '#10B981' }]}>Approved & Verified ✅</Text>
                <Text style={[sx.statusSub, { color: theme.hint }]}>Your account is active. You can go online from the dashboard.</Text>
              </View>
            </View>
          ) : (
            <View style={[sx.statusBanner, { backgroundColor: theme.backgroundAlt ?? '#F8FAFC', borderColor: theme.border ?? '#E2E8F0' }]}>
              <Ionicons name="time-outline" size={18} color={theme.hint} />
              <View style={{ flex: 1 }}>
                <Text style={[sx.statusTitle, { color: theme.foreground }]}>Under Review</Text>
                <Text style={[sx.statusSub, { color: theme.hint }]}>Our team is reviewing your application. Upload documents below to speed up approval.</Text>
              </View>
            </View>
          )}

          {/* Vehicle summary card */}
          <View style={[sx.vehicleCard, { backgroundColor: theme.backgroundAlt ?? '#F8FAFC', borderColor: theme.border ?? '#E2E8F0' }]}>
            <Ionicons name="car-outline" size={20} color={theme.accent} style={{ marginBottom: 8 }} />
            <Text style={[sx.vehicleTitle, { color: theme.foreground }]}>{profile.vehicleColor} {profile.vehicleMake} {profile.vehicleModel} ({profile.vehicleYear})</Text>
            <Text style={[sx.vehiclePlate, { color: theme.accent }]}>{profile.vehiclePlate}</Text>
            <Text style={[sx.vehicleType, { color: theme.hint }]}>{profile.vehicleType} • License: {profile.licenseNumber}</Text>
          </View>

          {/* Document slots */}
          <Text style={[sx.sectionLabel, { color: theme.hint, marginTop: 8 }]}>DOCUMENTS</Text>
          {DOC_SLOTS.map(slot => {
            const currentUrl   = profile?.[slot.key];
            const isUploading  = uploading[slot.key];

            return (
              <View key={slot.key} style={[sx.docCard, { backgroundColor: theme.backgroundAlt ?? '#F8FAFC', borderColor: theme.border ?? '#E2E8F0' }]}>
                <View style={sx.docCardHeader}>
                  <View style={[sx.docIconBox, { backgroundColor: (theme.accent ?? '#10B981') + '15' }]}>
                    <Ionicons name={slot.icon} size={20} color={theme.accent} />
                  </View>
                  <Text style={[sx.docLabel, { color: theme.foreground }]}>{slot.label}</Text>
                  {currentUrl ? <Ionicons name="checkmark-circle" size={20} color="#10B981" /> : <Ionicons name="ellipse-outline" size={20} color={theme.hint} />}
                </View>

                {currentUrl ? (
                  <>
                    <Image source={{ uri: currentUrl }} style={sx.preview} resizeMode="cover" />
                    <View style={sx.actionsRow}>
                      <TouchableOpacity style={[sx.iconBtn, { backgroundColor: theme.accent + '15' }]} onPress={() => setViewImage({ url: currentUrl })}>
                        <Ionicons name="eye-outline" size={18} color={theme.accent} />
                        <Text style={[sx.iconBtnText, { color: theme.accent }]}>View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[sx.iconBtn, { backgroundColor: theme.accent + '15' }]} onPress={() => handleDownload(currentUrl)}>
                        <Ionicons name="download-outline" size={18} color={theme.accent} />
                        <Text style={[sx.iconBtnText, { color: theme.accent }]}>Download</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={[sx.placeholder, { borderColor: theme.border ?? '#E2E8F0' }]}>
                    <Ionicons name="cloud-upload-outline" size={36} color={theme.hint} />
                    <Text style={[sx.placeholderTxt, { color: theme.hint }]}>Not uploaded yet</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[sx.uploadBtn, { backgroundColor: theme.accent ?? '#10B981' }, isUploading && sx.btnDim]}
                  onPress={() => pickAndUpload(slot)}
                  disabled={isUploading}
                  activeOpacity={0.85}
                >
                  {isUploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                    <Ionicons name="cloud-upload-outline" size={16} color={theme.accentFg} />
                    <Text style={[sx.uploadBtnTxt, { color: theme.accentFg }]}>{currentUrl ? 'Replace' : 'Upload'}</Text>
                  </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}

          <Text style={[sx.footerNote, { color: theme.hint }]}>
            Documents are stored securely and only reviewed by our admin team. You will receive a notification once your application is approved.
          </Text>
        </ScrollView>
      </View>

      {/* Full screen image viewer modal */}
      <Modal visible={!!viewImage} transparent={true} animationType="fade" onRequestClose={() => setViewImage(null)}>
        <View style={sx.modalBackdrop}>
          <TouchableOpacity style={sx.modalClose} onPress={() => setViewImage(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Image source={{ uri: viewImage?.url }} style={sx.modalImage} resizeMode="contain" />
        </View>
      </Modal>
    </View>
  );
}

// ── Reusable input ────────────────────────────────────────────────────────────
function InputField({ placeholder, value, onChangeText, keyboardType, autoCapitalize, theme }) {
  return (
    <TextInput
      style={[sx.input, { color: theme.foreground, borderColor: theme.border ?? '#E2E8F0', backgroundColor: theme.backgroundAlt ?? '#F8FAFC' }]}
      placeholder={placeholder}
      placeholderTextColor={theme.hint}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType || 'default'}
      autoCapitalize={autoCapitalize || 'none'}
      autoCorrect={false}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const sx = StyleSheet.create({
  root:    { flex: 1 },
  centered:{ flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:  { padding: 24, paddingTop: Platform.OS === 'ios' ? 58 : 42, paddingBottom: 32 },

  back: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },

  title:    { fontSize: 26, fontWeight: '900', marginBottom: 6, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, marginBottom: 24, lineHeight: 21 },

  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  infoTitle:  { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  infoSub:    { fontSize: 12, lineHeight: 18 },

  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 3, marginBottom: 10, marginTop: 4 },

  input: { borderWidth: 1.5, borderRadius: 13, padding: 14, fontSize: 15, marginBottom: 12 },

  row: { flexDirection: 'row', gap: 10 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:    { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8 },
  chipTxt: { fontSize: 12, fontWeight: '700' },

  primaryBtn: { height: 54, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  primaryBtnTxt: { fontSize: 16, fontWeight: '800' },
  btnDim:        { opacity: 0.6 },

  statusBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 18 },
  statusTitle: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  statusSub:   { fontSize: 12, lineHeight: 17 },

  vehicleCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 20 },
  vehicleTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  vehiclePlate: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, marginBottom: 3 },
  vehicleType:  { fontSize: 12 },

  docCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14 },
  docCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  docIconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  docLabel: { flex: 1, fontSize: 15, fontWeight: '700' },

  preview: { width: '100%', height: 190, borderRadius: 10, marginBottom: 8 },

  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginBottom: 12 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  iconBtnText: { fontSize: 13, fontWeight: '700' },

  placeholder: { height: 190, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 12, gap: 8 },
  placeholderTxt: { fontSize: 13 },

  uploadBtn: { height: 46, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  uploadBtnTxt: { fontSize: 14, fontWeight: '700' },

  footerNote: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 20, paddingHorizontal: 8 },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  modalImage: { width: '95%', height: '75%' },
});