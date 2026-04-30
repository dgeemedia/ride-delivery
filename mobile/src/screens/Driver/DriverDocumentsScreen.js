// mobile/src/screens/Driver/DriverDocumentsScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, ActivityIndicator,
  Image, Platform, TextInput, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { driverAPI, uploadAPI } from '../../services/api';

const VEHICLE_TYPES = [
  { value: 'CAR',        label: 'Car',        icon: 'car-outline' },
  { value: 'BIKE',       label: 'Bike',       icon: 'bicycle-outline' },
  { value: 'MOTORCYCLE', label: 'Motorcycle', icon: 'bicycle-outline' },
  { value: 'VAN',        label: 'Van',        icon: 'bus-outline' },
  { value: 'TRICYCLE',   label: 'Tricycle',   icon: 'bicycle-outline' },
];

const DOC_TYPES = [
  {
    key: 'licenseImageUrl',
    label: 'Driver License',
    icon: 'card-outline',
    required: true,
    uploadFn: uploadAPI.uploadDriverLicense,
  },
  {
    key: 'vehicleRegUrl',
    label: 'Vehicle Registration',
    icon: 'document-text-outline',
    required: true,
    uploadFn: uploadAPI.uploadVehicleRegistration,
  },
  {
    key: 'insuranceUrl',
    label: 'Insurance Certificate',
    icon: 'shield-outline',
    required: true,
    uploadFn: uploadAPI.uploadInsurance,
  },
];

// ── Small floating‑label input (reused) ─────────────────────────────────────
const FloatInput = ({ label, iconName, value, onChangeText, keyboardType, autoCapitalize }) => {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const labelY  = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderV = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(labelY,  { toValue: focused || value ? 1 : 0, duration: 170, useNativeDriver: false }).start();
    Animated.timing(borderV, { toValue: focused ? 1 : 0,          duration: 170, useNativeDriver: false }).start();
  }, [focused, value]);

  const borderColor = borderV.interpolate({ inputRange: [0, 1], outputRange: [theme.border, theme.accent] });
  const labelTop    = labelY.interpolate({ inputRange: [0, 1], outputRange: [18, 7] });
  const labelSize   = labelY.interpolate({ inputRange: [0, 1], outputRange: [15, 11] });
  const labelColor  = labelY.interpolate({ inputRange: [0, 1], outputRange: [theme.hint, focused ? theme.accent : theme.muted] });

  return (
    <Animated.View style={[styles.inputBox, { backgroundColor: theme.backgroundAlt, borderColor }]}>
      <Ionicons name={iconName} size={16} color={focused ? theme.accent : theme.hint} style={styles.inputIcon} />
      <View style={{ flex: 1 }}>
        <Animated.Text style={[styles.floatLabel, { top: labelTop, fontSize: labelSize, color: labelColor }]}>
          {label}
        </Animated.Text>
        <TextInput
          style={[styles.inputText, { color: theme.foreground }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'none'}
          placeholder=" "
          placeholderTextColor="transparent"
        />
      </View>
    </Animated.View>
  );
};

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function DriverDocumentsScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});
  const [profileMissing, setProfileMissing] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Profile creation fields
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleType,   setVehicleType]   = useState('');
  const [vehicleMake,   setVehicleMake]   = useState('');
  const [vehicleModel,  setVehicleModel]  = useState('');
  const [vehicleYear,   setVehicleYear]   = useState('');
  const [vehicleColor,  setVehicleColor]  = useState('');
  const [vehiclePlate,  setVehiclePlate]  = useState('');

  const fetchProfile = async () => {
    try {
      const res = await driverAPI.getProfile();
      const data = res?.data?.profile ?? res?.data;
      setProfile(data);
      setProfileMissing(false);
    } catch (err) {
      console.error('[DriverDocuments] fetchProfile error:', err);
      if (
        err?.message === 'Driver profile not found' ||
        (typeof err?.message === 'string' && err.message.includes('not found'))
      ) {
        setProfileMissing(true);
        setProfile(null);
      } else {
        Alert.alert('Error', err?.message || 'Could not load profile');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleCreateProfile = async () => {
    if (!licenseNumber || !vehicleType || !vehicleMake || !vehicleModel || !vehicleYear || !vehicleColor || !vehiclePlate) {
      Alert.alert('Missing Fields', 'Please fill in all vehicle details.');
      return;
    }
    const year = parseInt(vehicleYear);
    if (isNaN(year) || year < 1990 || year > new Date().getFullYear() + 1) {
      Alert.alert('Invalid Year', 'Please enter a valid vehicle year.');
      return;
    }
    setCreatingProfile(true);
    try {
      await driverAPI.updateProfile({
        licenseNumber,
        vehicleType,
        vehicleMake,
        vehicleModel,
        vehicleYear: year,
        vehicleColor,
        vehiclePlate,
      });
      await fetchProfile(); // should now succeed and show upload section
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || 'Failed to create profile.';
      Alert.alert('Error', msg);
    } finally {
      setCreatingProfile(false);
    }
  };

  // ── Upload handlers (unchanged) ───────────────────────────────────────────
  const pickAndUpload = async (docType) => {
    if (!profile) { Alert.alert('No Profile', 'Please complete your driver profile first.'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'We need camera roll access to upload documents.'); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setUploading((prev) => ({ ...prev, [docType.key]: true }));
      const uploadRes = await docType.uploadFn(asset);
      const url = uploadRes?.data?.url ?? uploadRes?.url;
      if (!url) throw new Error('Upload failed – no URL returned');
      const updatePayload = { [docType.key]: url };
      await driverAPI.updateProfile(updatePayload);
      await fetchProfile();
      Alert.alert('Success', `${docType.label} uploaded.`);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Upload failed';
      Alert.alert('Error', msg);
    } finally { setUploading((prev) => ({ ...prev, [docType.key]: false })); }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // ── Profile missing → inline creation form ────────────────────────────────
  if (profileMissing) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.title, { color: theme.foreground }]}>Complete Your Driver Profile</Text>
          <Text style={[styles.subtitle, { color: theme.hint }]}>
            Fill in your vehicle details below to continue.
          </Text>

          <FloatInput label="License Number" iconName="card-outline" value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" />
          <FloatInput label="Vehicle Make"   iconName="car-outline"   value={vehicleMake}   onChangeText={setVehicleMake}   autoCapitalize="words" />
          <FloatInput label="Vehicle Model"  iconName="car-outline"   value={vehicleModel}  onChangeText={setVehicleModel}  autoCapitalize="words" />
          <FloatInput label="Year"           iconName="calendar-outline" value={vehicleYear}  onChangeText={setVehicleYear}  keyboardType="numeric" />
          <FloatInput label="Color"          iconName="color-palette-outline" value={vehicleColor} onChangeText={setVehicleColor} autoCapitalize="words" />
          <FloatInput label="Plate Number"   iconName="document-text-outline" value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" />

          <Text style={[styles.sectionLabel, { color: theme.hint }]}>VEHICLE TYPE</Text>
          <View style={styles.vehicleTypeGrid}>
            {VEHICLE_TYPES.map(vt => {
              const selected = vehicleType === vt.value;
              return (
                <TouchableOpacity
                  key={vt.value}
                  style={[styles.vehicleTypeOption, {
                    backgroundColor: selected ? theme.accent + '18' : theme.backgroundAlt,
                    borderColor: selected ? theme.accent : theme.border,
                  }]}
                  onPress={() => setVehicleType(vt.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={vt.icon} size={18} color={selected ? theme.accent : theme.hint} />
                  <Text style={[styles.vehicleTypeLabel, { color: selected ? theme.accent : theme.hint }]}>{vt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: theme.accent, opacity: creatingProfile ? 0.7 : 1 }]}
            onPress={handleCreateProfile}
            disabled={creatingProfile}
            activeOpacity={0.8}
          >
            {creatingProfile ? (
              <ActivityIndicator color={theme.accentFg} />
            ) : (
              <Text style={[styles.createBtnText, { color: theme.accentFg }]}>Save Vehicle Details</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Profile exists → document upload UI ───────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: theme.foreground }]}>Required Documents</Text>
        <Text style={[styles.subtitle, { color: theme.hint }]}>
          Upload clear photos of your documents for verification.
        </Text>
        {DOC_TYPES.map(doc => {
          const currentUrl = profile?.[doc.key];
          const isUploaded = !!currentUrl;
          const isUploading = uploading[doc.key];
          return (
            <View key={doc.key} style={[styles.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <Ionicons name={doc.icon} size={20} color={theme.accent} />
                <Text style={[styles.cardTitle, { color: theme.foreground }]}>{doc.label}</Text>
                <View style={[styles.statusDot, { backgroundColor: isUploaded ? '#5DAA72' : theme.hint }]} />
              </View>
              {isUploaded ? <Image source={{ uri: currentUrl }} style={styles.preview} resizeMode="cover" /> :
                <View style={[styles.placeholder, { borderColor: theme.border }]}>
                  <Ionicons name="cloud-upload-outline" size={32} color={theme.hint} />
                  <Text style={[styles.placeholderText, { color: theme.hint }]}>No file uploaded</Text>
                </View>
              }
              <TouchableOpacity
                style={[styles.uploadBtn, { backgroundColor: theme.accent, opacity: isUploading ? 0.7 : 1 }]}
                onPress={() => pickAndUpload(doc)}
                disabled={isUploading}
                activeOpacity={0.8}
              >
                {isUploading ? <ActivityIndicator color={theme.accentFg} /> :
                  <Text style={[styles.uploadBtnText, { color: theme.accentFg }]}>{isUploaded ? 'Replace' : 'Upload'}</Text>
                }
              </TouchableOpacity>
            </View>
          );
        })}
        <Text style={[styles.note, { color: theme.hint }]}>
          After uploading all required documents, an admin will review your application. Approval usually takes 24–48 hours.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // profile creation
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 12, marginTop: 8 },
  vehicleTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  vehicleTypeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1.5, paddingVertical: 10, paddingHorizontal: 14,
  },
  vehicleTypeLabel: { fontSize: 14, fontWeight: '600' },
  createBtn: { borderRadius: 13, height: 54, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  createBtnText: { fontSize: 16, fontWeight: '700' },

  // upload UI
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  preview: { width: '100%', aspectRatio: 16/9, borderRadius: 10, marginBottom: 12 },
  placeholder: { aspectRatio: 16/9, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  placeholderText: { fontSize: 12, marginTop: 8 },
  uploadBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  uploadBtnText: { fontSize: 14, fontWeight: '700' },
  note: { fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },

  // float input
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1.5, marginBottom: 12,
    height: 60, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  floatLabel: { position: 'absolute', left: 0 },
  inputText: { fontSize: 15, paddingTop: 18, paddingBottom: 4, fontWeight: '400' },
});