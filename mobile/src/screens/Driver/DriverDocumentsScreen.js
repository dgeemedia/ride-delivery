// mobile/src/screens/Driver/DriverDocumentsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, ActivityIndicator, Image, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import * as ImagePicker   from 'expo-image-picker';
import { useTheme }       from '../../context/ThemeContext';
import { driverAPI, uploadAPI } from '../../services/api';

// ── Vehicle types accepted by the backend validator ───────────────────────────
const VEHICLE_TYPES = ['CAR', 'MOTORCYCLE', 'BIKE', 'VAN', 'TRICYCLE'];

// ── Document slots ────────────────────────────────────────────────────────────
const DOC_SLOTS = [
  { key: 'licenseImageUrl',  label: 'Driver License',          icon: 'card-outline',          uploadKey: 'license'      },
  { key: 'vehicleRegUrl',    label: 'Vehicle Registration',     icon: 'document-text-outline', uploadKey: 'registration' },
  { key: 'insuranceUrl',     label: 'Insurance Certificate',    icon: 'shield-outline',        uploadKey: 'insurance'    },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function DriverDocumentsScreen({ navigation }) {
  const { theme, mode } = useTheme();

  const [profile,   setProfile]   = useState(null);   // null = no profile yet
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState({});

  // ── Profile creation form fields ──────────────────────────────────────────
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleType,   setVehicleType]   = useState('CAR');
  const [vehicleMake,   setVehicleMake]   = useState('');
  const [vehicleModel,  setVehicleModel]  = useState('');
  const [vehicleYear,   setVehicleYear]   = useState('');
  const [vehicleColor,  setVehicleColor]  = useState('');
  const [vehiclePlate,  setVehiclePlate]  = useState('');

  // ── Load profile on mount ─────────────────────────────────────────────────
  const fetchProfile = async () => {
    console.log('[DriverDocuments] fetchProfile started');
    try {
      const res  = await driverAPI.getProfile();
      console.log('[DriverDocuments] getProfile raw response:', JSON.stringify(res));
      // Interceptor unwraps .data, so res = { success, data: { profile } }
      const data = res?.data?.profile ?? res?.profile ?? res;
      console.log('[DriverDocuments] extracted profile data:', JSON.stringify(data));
      setProfile(data ?? null);
      console.log('[DriverDocuments] profile set successfully, is null?', data == null);
    } catch (err) {
      console.log('[DriverDocuments] fetchProfile error:', JSON.stringify(err));
      console.log('[DriverDocuments] error message:', err?.message);
      console.log('[DriverDocuments] error status:', err?.status, err?.statusCode);
      // 404 = no profile yet — show creation form
      const is404 =
        err?.message?.toLowerCase().includes('not found') ||
        err?.statusCode === 404 ||
        err?.status === 404;
      if (!is404) {
        console.log('[DriverDocuments] showing error alert');
        Alert.alert('Error', 'Could not load your profile. Please try again.');
      } else {
        console.log('[DriverDocuments] 404 detected – no profile yet');
      }
      setProfile(null);
    } finally {
      setLoading(false);
      console.log('[DriverDocuments] loading set to false');
    }
  };

  useEffect(() => {
    console.log('[DriverDocuments] component mounted');
    fetchProfile();
  }, []);

  // ── Create profile with real user-entered data ────────────────────────────
  const handleCreateProfile = async () => {
    console.log('[DriverDocuments] handleCreateProfile called');
    if (!licenseNumber.trim()) {
      console.log('[DriverDocuments] validation failed: missing licenseNumber');
      return Alert.alert('Missing Field', 'Please enter your driver license number.');
    }
    if (!vehicleMake.trim() || !vehicleModel.trim()) {
      console.log('[DriverDocuments] validation failed: missing make/model');
      return Alert.alert('Missing Field', 'Please enter your vehicle make and model.');
    }
    const yr = parseInt(vehicleYear, 10);
    if (!vehicleYear || isNaN(yr) || yr < 1990 || yr > new Date().getFullYear() + 1) {
      console.log('[DriverDocuments] validation failed: invalid year', vehicleYear);
      return Alert.alert('Invalid Year', 'Please enter a valid vehicle year (e.g. 2019).');
    }
    if (!vehicleColor.trim()) {
      console.log('[DriverDocuments] validation failed: missing color');
      return Alert.alert('Missing Field', 'Please enter your vehicle colour.');
    }
    if (!vehiclePlate.trim()) {
      console.log('[DriverDocuments] validation failed: missing plate');
      return Alert.alert('Missing Field', 'Please enter your plate number.');
    }

    const payload = {
      licenseNumber: licenseNumber.trim().toUpperCase(),
      vehicleType,
      vehicleMake:   vehicleMake.trim(),
      vehicleModel:  vehicleModel.trim(),
      vehicleYear:   yr,
      vehicleColor:  vehicleColor.trim(),
      vehiclePlate:  vehiclePlate.trim().toUpperCase(),
    };
    console.log('[DriverDocuments] calling driverAPI.updateProfile with:', JSON.stringify(payload));

    setSaving(true);
    try {
      const result = await driverAPI.updateProfile(payload);
      console.log('[DriverDocuments] updateProfile success:', JSON.stringify(result));
      Alert.alert(
        'Profile Created ✅',
        'Your driver profile has been submitted for review. You can now upload your documents below.',
      );
      await fetchProfile();
    } catch (err) {
      console.log('[DriverDocuments] updateProfile error:', JSON.stringify(err));
      const msg = err?.message || err?.errors?.[0]?.msg || 'Could not create profile. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Pick image and upload to Cloudinary, then save URL to profile ─────────
  const pickAndUpload = async (slot) => {
    console.log('[DriverDocuments] pickAndUpload for slot:', slot.key);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.log('[DriverDocuments] media library permission not granted');
      Alert.alert('Permission Needed', 'Please allow access to your photo library.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality:    0.85,
        allowsEditing: true,
      });
      if (result.canceled) {
        console.log('[DriverDocuments] image picker cancelled');
        return;
      }

      const asset = result.assets[0];
      console.log('[DriverDocuments] selected asset:', asset.uri);
      setUploading(prev => ({ ...prev, [slot.key]: true }));

      // Upload via multipart helper
      let uploadRes;
      try {
        if (slot.uploadKey === 'license')       uploadRes = await uploadAPI.uploadDriverLicense(asset);
        else if (slot.uploadKey === 'registration') uploadRes = await uploadAPI.uploadVehicleRegistration(asset);
        else if (slot.uploadKey === 'insurance')    uploadRes = await uploadAPI.uploadInsurance(asset);
        else uploadRes = await uploadAPI.uploadBase64(asset.uri, 'duoride/documents');
        console.log('[DriverDocuments] upload response:', JSON.stringify(uploadRes));
      } catch {
        // Fallback: base64 upload
        console.log('[DriverDocuments] multipart upload failed, trying base64 fallback');
        uploadRes = await uploadAPI.uploadBase64(asset.uri, 'duoride/documents');
        console.log('[DriverDocuments] base64 upload response:', JSON.stringify(uploadRes));
      }

      const url =
        uploadRes?.data?.url     ??
        uploadRes?.data?.secure_url ??
        uploadRes?.url          ??
        uploadRes?.secure_url   ??
        null;

      if (!url) {
        console.log('[DriverDocuments] no URL in upload response – aborting');
        throw new Error('Upload succeeded but no URL was returned. Check Cloudinary config.');
      }

      console.log('[DriverDocuments] saving URL to profile:', url);
      // Save the URL to the driver profile
      await driverAPI.uploadDocuments({ [slot.key]: url });
      console.log('[DriverDocuments] documents saved to profile');

      await fetchProfile();
      Alert.alert('Uploaded ✅', `${slot.label} uploaded successfully.`);

    } catch (err) {
      console.log('[DriverDocuments] pickAndUpload error:', JSON.stringify(err));
      Alert.alert('Upload Failed', err?.message || 'Please try again.');
    } finally {
      setUploading(prev => ({ ...prev, [slot.key]: false }));
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    console.log('[DriverDocuments] rendering loading state');
    return (
      <View style={[sx.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW A — No profile yet: show vehicle details form
  // ─────────────────────────────────────────────────────────────────────────
  if (!profile) {
    console.log('[DriverDocuments] rendering VIEW A (no profile)');
    return (
      <View style={[sx.root, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={sx.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <TouchableOpacity style={sx.back} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color={theme.foreground} />
            </TouchableOpacity>

            <View style={[sx.infoBanner, { backgroundColor: theme.backgroundAlt ?? '#F8FAFC', borderColor: theme.border ?? '#E2E8F0' }]}>
              <Ionicons name="information-circle-outline" size={20} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[sx.infoTitle, { color: theme.foreground }]}>Complete Your Driver Profile</Text>
                <Text style={[sx.infoSub, { color: theme.hint }]}>
                  Enter your vehicle details to submit your driver application. Documents can be added after.
                </Text>
              </View>
            </View>

            <Text style={[sx.sectionLabel, { color: theme.hint }]}>LICENSE INFO</Text>
            <InputField
              placeholder="License Number (e.g. ABC123456)"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              autoCapitalize="characters"
              theme={theme}
            />

            <Text style={[sx.sectionLabel, { color: theme.hint }]}>VEHICLE TYPE</Text>
            <View style={sx.chipRow}>
              {VEHICLE_TYPES.map(vt => {
                const sel = vehicleType === vt;
                return (
                  <TouchableOpacity
                    key={vt}
                    style={[
                      sx.chip,
                      {
                        borderColor:     sel ? (theme.accent ?? '#10B981') : (theme.border ?? '#E2E8F0'),
                        backgroundColor: sel ? (theme.accent ?? '#10B981') + '15' : 'transparent',
                      },
                    ]}
                    onPress={() => setVehicleType(vt)}
                  >
                    <Text style={[sx.chipTxt, { color: sel ? (theme.accent ?? '#10B981') : theme.hint }]}>
                      {vt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[sx.sectionLabel, { color: theme.hint }]}>VEHICLE DETAILS</Text>
            <View style={sx.row}>
              <View style={{ flex: 1 }}>
                <InputField placeholder="Make (Toyota)" value={vehicleMake} onChangeText={setVehicleMake} autoCapitalize="words" theme={theme} />
              </View>
              <View style={{ flex: 1 }}>
                <InputField placeholder="Model (Camry)" value={vehicleModel} onChangeText={setVehicleModel} autoCapitalize="words" theme={theme} />
              </View>
            </View>

            <View style={sx.row}>
              <View style={{ flex: 1 }}>
                <InputField placeholder="Year (2019)" value={vehicleYear} onChangeText={setVehicleYear} keyboardType="numeric" theme={theme} />
              </View>
              <View style={{ flex: 1 }}>
                <InputField placeholder="Colour (Black)" value={vehicleColor} onChangeText={setVehicleColor} autoCapitalize="words" theme={theme} />
              </View>
            </View>

            <InputField
              placeholder="Plate Number (e.g. ABC123XY)"
              value={vehiclePlate}
              onChangeText={setVehiclePlate}
              autoCapitalize="characters"
              theme={theme}
            />

            <TouchableOpacity
              style={[sx.primaryBtn, saving && sx.btnDim, { backgroundColor: theme.accent ?? '#10B981' }]}
              onPress={handleCreateProfile}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={sx.primaryBtnTxt}>Submit Application →</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW B — Profile exists: show approval status + document upload
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[DriverDocuments] rendering VIEW B (profile exists)');
  const isApproved = profile?.isApproved ?? false;
  const isRejected = profile?.isRejected ?? false;

  return (
    <View style={[sx.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />

      <ScrollView
        contentContainerStyle={sx.scroll}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={sx.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>

        <Text style={[sx.title, { color: theme.foreground }]}>Documents</Text>
        <Text style={[sx.subtitle, { color: theme.hint }]}>
          Upload clear photos to speed up your approval.
        </Text>

        {/* ── Approval status banner ── */}
        {isRejected ? (
          <View style={[sx.statusBanner, { backgroundColor: '#E0555510', borderColor: '#E05555' }]}>
            <Ionicons name="close-circle-outline" size={18} color="#E05555" />
            <View style={{ flex: 1 }}>
              <Text style={[sx.statusTitle, { color: '#E05555' }]}>Application Not Approved</Text>
              <Text style={[sx.statusSub, { color: theme.hint }]}>
                {profile.rejectionReason || 'Please contact support for more information.'}
              </Text>
            </View>
          </View>
        ) : isApproved ? (
          <View style={[sx.statusBanner, { backgroundColor: '#10B98110', borderColor: '#10B981' }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={[sx.statusTitle, { color: '#10B981' }]}>Approved & Verified ✅</Text>
              <Text style={[sx.statusSub, { color: theme.hint }]}>
                Your account is active. You can go online from the dashboard.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[sx.statusBanner, { backgroundColor: theme.backgroundAlt ?? '#F8FAFC', borderColor: theme.border ?? '#E2E8F0' }]}>
            <Ionicons name="time-outline" size={18} color={theme.hint} />
            <View style={{ flex: 1 }}>
              <Text style={[sx.statusTitle, { color: theme.foreground }]}>Under Review</Text>
              <Text style={[sx.statusSub, { color: theme.hint }]}>
                Our team is reviewing your application. Upload documents below to speed up approval.
              </Text>
            </View>
          </View>
        )}

        {/* ── Vehicle summary ── */}
        <View style={[sx.vehicleCard, { backgroundColor: theme.backgroundAlt ?? '#F8FAFC', borderColor: theme.border ?? '#E2E8F0' }]}>
          <Ionicons name="car-outline" size={20} color={theme.accent} style={{ marginBottom: 8 }} />
          <Text style={[sx.vehicleTitle, { color: theme.foreground }]}>
            {profile.vehicleColor} {profile.vehicleMake} {profile.vehicleModel} ({profile.vehicleYear})
          </Text>
          <Text style={[sx.vehiclePlate, { color: theme.accent }]}>{profile.vehiclePlate}</Text>
          <Text style={[sx.vehicleType, { color: theme.hint }]}>
            {profile.vehicleType} • License: {profile.licenseNumber}
          </Text>
        </View>

        {/* ── Document upload slots ── */}
        <Text style={[sx.sectionLabel, { color: theme.hint, marginTop: 8 }]}>DOCUMENTS</Text>

        {DOC_SLOTS.map(slot => {
          const currentUrl   = profile?.[slot.key];
          const isUploading  = uploading[slot.key];

          return (
            <View
              key={slot.key}
              style={[sx.docCard, { backgroundColor: theme.backgroundAlt ?? '#F8FAFC', borderColor: theme.border ?? '#E2E8F0' }]}
            >
              {/* Card header */}
              <View style={sx.docCardHeader}>
                <View style={[sx.docIconBox, { backgroundColor: (theme.accent ?? '#10B981') + '15' }]}>
                  <Ionicons name={slot.icon} size={20} color={theme.accent} />
                </View>
                <Text style={[sx.docLabel, { color: theme.foreground }]}>{slot.label}</Text>
                {currentUrl
                  ? <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  : <Ionicons name="ellipse-outline"  size={20} color={theme.hint} />
                }
              </View>

              {/* Preview or placeholder */}
              {currentUrl ? (
                <Image
                  source={{ uri: currentUrl }}
                  style={sx.preview}
                  resizeMode="cover"
                />
              ) : (
                <View style={[sx.placeholder, { borderColor: theme.border ?? '#E2E8F0' }]}>
                  <Ionicons name="cloud-upload-outline" size={36} color={theme.hint} />
                  <Text style={[sx.placeholderTxt, { color: theme.hint }]}>Not uploaded yet</Text>
                </View>
              )}

              {/* Upload button */}
              <TouchableOpacity
                style={[sx.uploadBtn, { backgroundColor: theme.accent ?? '#10B981' }, isUploading && sx.btnDim]}
                onPress={() => pickAndUpload(slot)}
                disabled={isUploading}
                activeOpacity={0.85}
              >
                {isUploading
                  ? <ActivityIndicator color="#fff" />
                  : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                      <Text style={sx.uploadBtnTxt}>
                        {currentUrl ? 'Replace' : 'Upload'}
                      </Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          );
        })}

        <Text style={[sx.footerNote, { color: theme.hint }]}>
          Documents are stored securely and only reviewed by our admin team.
          You will receive a notification once your application is approved.
        </Text>
      </ScrollView>
    </View>
  );
}

// ── Reusable input ────────────────────────────────────────────────────────────
function InputField({ placeholder, value, onChangeText, keyboardType, autoCapitalize, theme }) {
  return (
    <TextInput
      style={[
        sx.input,
        {
          color:           theme.foreground,
          borderColor:     theme.border ?? '#E2E8F0',
          backgroundColor: theme.backgroundAlt ?? '#F8FAFC',
        },
      ]}
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
  scroll:  { padding: 24, paddingTop: Platform.OS === 'ios' ? 58 : 42, paddingBottom: 80 },

  back: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },

  title:    { fontSize: 26, fontWeight: '900', marginBottom: 6, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, marginBottom: 24, lineHeight: 21 },

  // Info banner (profile creation)
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 24,
  },
  infoTitle:  { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  infoSub:    { fontSize: 12, lineHeight: 18 },

  // Section label
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 3, marginBottom: 10, marginTop: 4 },

  // Input field
  input: {
    borderWidth: 1.5, borderRadius: 13, padding: 14,
    fontSize: 15, marginBottom: 12,
  },

  // Two-column row
  row: { flexDirection: 'row', gap: 10 },

  // Vehicle type chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:    { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8 },
  chipTxt: { fontSize: 12, fontWeight: '700' },

  // Primary button
  primaryBtn: {
    height: 54, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    marginTop: 8,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  primaryBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnDim:        { opacity: 0.6 },

  // Status banner (approval state)
  statusBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 18,
  },
  statusTitle: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  statusSub:   { fontSize: 12, lineHeight: 17 },

  // Vehicle summary card
  vehicleCard: {
    borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 20,
  },
  vehicleTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  vehiclePlate: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, marginBottom: 3 },
  vehicleType:  { fontSize: 12 },

  // Document card
  docCard: {
    borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14,
  },
  docCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  docIconBox:    {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  docLabel: { flex: 1, fontSize: 15, fontWeight: '700' },

  preview: {
    width: '100%', height: 190, borderRadius: 10, marginBottom: 12,
  },
  placeholder: {
    height: 190, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    gap: 8,
  },
  placeholderTxt: { fontSize: 13 },

  uploadBtn: {
    height: 46, borderRadius: 10,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  uploadBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  footerNote: {
    fontSize: 12, textAlign: 'center', lineHeight: 18,
    marginTop: 20, paddingHorizontal: 8,
  },
});