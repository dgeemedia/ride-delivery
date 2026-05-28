// mobile/src/screens/Partner/PartnerDocumentsScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, ActivityIndicator, Image, Animated, Modal, Platform,
  Dimensions,
} from 'react-native';
import { Ionicons }      from '@expo/vector-icons';
import * as ImagePicker  from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem   from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme }      from '../../context/ThemeContext';
import { useScrollY }    from '../../context/ScrollContext';
import { partnerAPI, uploadAPI } from '../../services/api';
import { toBase64DataUri } from '../../utils/toBase64DataUri';

const { height } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
//  Vehicle type options
// ─────────────────────────────────────────────────────────────────────────────
const VEHICLE_TYPES = [
  { value: 'BIKE',       label: 'Bike',       icon: 'bicycle-outline' },
  { value: 'MOTORCYCLE', label: 'Motorcycle', icon: 'bicycle-outline' },
  { value: 'CAR',        label: 'Car',        icon: 'car-outline'     },
  { value: 'VAN',        label: 'Van',        icon: 'bus-outline'     },
  { value: 'TRICYCLE',   label: 'Tricycle',   icon: 'bicycle-outline' },
];

const VEHICLE_SUB_TYPES = {
  CAR:        ['Sedan', 'SUV', 'Hatchback', 'Minivan'],
  VAN:        ['Panel Van', 'Minibus', 'Pickup Truck', 'Box Truck'],
  MOTORCYCLE: ['Standard', 'Scooter', 'Sport'],
  BIKE:       ['Road Bike', 'Mountain Bike', 'Cargo Bike'],
  TRICYCLE:   ['Keke Napep', 'Cargo Tricycle'],
};

// ─────────────────────────────────────────────────────────────────────────────
//  Document slots per vehicle type
// ─────────────────────────────────────────────────────────────────────────────
const getDocSlots = (vehicleType) => {
  // Universal for all partners
  const base = [
    {
      key: 'applicantPhotoUrl',
      label: 'Your Photograph',
      hint: 'Clear chest-up photo, plain background',
      icon: 'person-outline',
      uploadKey: 'applicant_photo',
      required: true,
    },
    {
      key: 'govtIdUrl',
      label: 'Government-Issued ID',
      hint: 'NIN slip, Voter card, or Passport (front)',
      icon: 'card-outline',
      uploadKey: 'govt_id',
      required: true,
    },
    {
      key: 'idImageUrl',
      label: 'ID Card Photo',
      hint: 'Full photo of your ID card — front and back if possible',
      icon: 'id-card-outline',
      uploadKey: 'partner_id',
      required: true,
    },
    {
      key: 'vehicleImageUrl',
      label: 'Vehicle Photo',
      hint: 'Clear photo of your vehicle showing plate number',
      icon: 'camera-outline',
      uploadKey: 'partner_vehicle',
      required: true,
    },
  ];

  // MOTORCYCLE
  if (vehicleType === 'MOTORCYCLE') {
    base.push(
      {
        key: 'insuranceUrl',
        label: 'Insurance Certificate',
        hint: 'Third-party insurance for your motorcycle',
        icon: 'shield-outline',
        uploadKey: 'insurance',
        required: true,
      },
      {
        key: 'roadWorthinessUrl',
        label: 'Road Worthiness Cert',
        hint: 'State-issued road worthiness certificate',
        icon: 'checkmark-circle-outline',
        uploadKey: 'road_worthiness',
        required: true,
      },
      {
        key: 'riderCardUrl',
        label: "Rider's Card / Union Card",
        hint: 'State or LGA-issued rider registration card',
        icon: 'ribbon-outline',
        uploadKey: 'rider_card',
        required: true,
      },
      {
        key: 'helmetPhotoUrl',
        label: 'Helmet Photo',
        hint: 'Show your compliant safety helmet',
        icon: 'glasses-outline',
        uploadKey: 'helmet',
        required: true,
      }
    );
  }

  // BIKE (pedal / dispatch)
  if (vehicleType === 'BIKE') {
    base.push(
      {
        key: 'dispatchPermitUrl',
        label: 'Dispatch / Courier Permit',
        hint: 'Lagos dispatch pass or equivalent state permit',
        icon: 'bicycle-outline',
        uploadKey: 'dispatch_permit',
        required: true,
      },
      {
        key: 'guarantorLetterUrl',
        label: 'Guarantor Letter',
        hint: 'Letter from a verified guarantor on headed paper',
        icon: 'document-outline',
        uploadKey: 'guarantor_letter',
        required: true,
      },
      {
        key: 'guarantorIdUrl',
        label: "Guarantor's ID",
        hint: 'Valid government ID belonging to your guarantor',
        icon: 'person-add-outline',
        uploadKey: 'guarantor_id',
        required: true,
      }
    );
  }

  // CAR
  if (vehicleType === 'CAR') {
    base.push(
      {
        key: 'insuranceUrl',
        label: 'Insurance Certificate',
        hint: 'Third-party or comprehensive insurance',
        icon: 'shield-outline',
        uploadKey: 'insurance',
        required: true,
      },
      {
        key: 'roadWorthinessUrl',
        label: 'Road Worthiness Cert',
        hint: 'Issued by MVAA or your state agency',
        icon: 'checkmark-circle-outline',
        uploadKey: 'road_worthiness',
        required: true,
      },
      {
        key: 'vehiclePhotoInteriorUrl',
        label: 'Vehicle Interior / Salon',
        hint: 'Show passenger seating condition',
        icon: 'car-outline',
        uploadKey: 'vehicle_interior',
        required: false,
      }
    );
  }

  // VAN
  if (vehicleType === 'VAN') {
    base.push(
      {
        key: 'insuranceUrl',
        label: 'Insurance Certificate',
        hint: 'Third-party or comprehensive insurance',
        icon: 'shield-outline',
        uploadKey: 'insurance',
        required: true,
      },
      {
        key: 'roadWorthinessUrl',
        label: 'Road Worthiness Cert',
        hint: 'Issued by MVAA or your state agency',
        icon: 'checkmark-circle-outline',
        uploadKey: 'road_worthiness',
        required: true,
      },
      {
        key: 'vehiclePhotoInteriorUrl',
        label: 'Van Interior / Cargo Area',
        hint: 'Show load space and cargo capacity',
        icon: 'cube-outline',
        uploadKey: 'vehicle_interior',
        required: true,
      }
    );
  }

  // TRICYCLE
  if (vehicleType === 'TRICYCLE') {
    base.push(
      {
        key: 'operatorPermitUrl',
        label: 'Tricycle Operator Permit',
        hint: 'State or LGA-issued keke operator permit',
        icon: 'document-lock-outline',
        uploadKey: 'operator_permit',
        required: true,
      },
      {
        key: 'insuranceUrl',
        label: 'Insurance Certificate',
        hint: 'Third-party insurance for your tricycle',
        icon: 'shield-outline',
        uploadKey: 'insurance',
        required: false,
      }
    );
  }

  return base;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Map uploadKey → uploadAPI / base64 folder
// ─────────────────────────────────────────────────────────────────────────────
const getUploadFn = (uploadKey) => {
  const map = {
    applicant_photo:  (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/photos'),
    govt_id:          (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/ids'),
    partner_id:       (asset) => uploadAPI.uploadPartnerId(asset),
    partner_vehicle:  (asset) => uploadAPI.uploadPartnerVehicle(asset),
    insurance:        (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/insurance'),
    road_worthiness:  (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/roadworthy'),
    rider_card:       (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/permits'),
    helmet:           (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/helmet'),
    dispatch_permit:  (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/permits'),
    guarantor_letter: (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/guarantor'),
    guarantor_id:     (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/guarantor'),
    vehicle_interior: (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/vehicles'),
    operator_permit:  (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/permits'),
  };
  return map[uploadKey] ?? null;
};

const extractUrl = (res) =>
  res?.data?.url        ??
  res?.data?.secure_url ??
  res?.url              ??
  res?.secure_url       ??
  null;

// ─────────────────────────────────────────────────────────────────────────────
//  Floating label input
// ─────────────────────────────────────────────────────────────────────────────
const FloatInput = ({ label, iconName, value, onChangeText, keyboardType, autoCapitalize }) => {
  const { theme }  = useTheme();
  const [focused, setFocused] = useState(false);
  const labelY  = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderV = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(labelY,  { toValue: focused || value ? 1 : 0, duration: 170, useNativeDriver: false }).start();
    Animated.timing(borderV, { toValue: focused ? 1 : 0,          duration: 170, useNativeDriver: false }).start();
  }, [focused, value]);

  return (
    <Animated.View style={[styles.inputBox, {
      backgroundColor: theme.backgroundAlt,
      borderColor: borderV.interpolate({ inputRange: [0, 1], outputRange: [theme.border, theme.accent] }),
    }]}>
      <Ionicons name={iconName} size={16} color={focused ? theme.accent : theme.hint} style={styles.inputIcon} />
      <View style={{ flex: 1 }}>
        <Animated.Text style={[styles.floatLabel, {
          top:      labelY.interpolate({ inputRange: [0, 1], outputRange: [18, 7] }),
          fontSize: labelY.interpolate({ inputRange: [0, 1], outputRange: [15, 11] }),
          color:    labelY.interpolate({ inputRange: [0, 1], outputRange: [theme.hint, focused ? theme.accent : theme.muted ?? theme.hint] }),
        }]}>{label}</Animated.Text>
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

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────
export default function PartnerDocumentsScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const insets  = useSafeAreaInsets();
  const scrollY = useScrollY();

  const TAB_H        = 54;
  const EXTRA_BOTTOM = Platform.OS === 'android' ? 16 : 0;
  const SCROLL_H     = height - insets.top - TAB_H - insets.bottom - EXTRA_BOTTOM;

  const [profile,         setProfile]         = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [uploading,       setUploading]       = useState({});
  const [profileMissing,  setProfileMissing]  = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [viewImage,       setViewImage]       = useState(null);

  // Profile creation
  const [vehicleType,   setVehicleType]   = useState('');
  const [vehiclePlate,  setVehiclePlate]  = useState('');
  const [vehicleSubType,setVehicleSubType]= useState('');
  const [numberOfSeats, setNumberOfSeats] = useState('');

  // ── Fetch profile ──────────────────────────────────────────────────────────
  const fetchProfile = async () => {
    try {
      const res = await partnerAPI.getProfile();
      setProfile(res?.data?.profile ?? res?.data);
      setProfileMissing(false);
    } catch (err) {
      const isNotFound =
        err?.message === 'Delivery partner profile not found' ||
        (typeof err?.message === 'string' && err.message.includes('not found'));
      if (isNotFound) {
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

  // ── Create profile ─────────────────────────────────────────────────────────
  const handleCreateProfile = async () => {
    if (!vehicleType) {
      Alert.alert('Vehicle type required', 'Please select a vehicle type.');
      return;
    }
    setCreatingProfile(true);
    try {
      const seats = parseInt(numberOfSeats, 10);
      await partnerAPI.updateProfile({
        vehicleType,
        vehiclePlate:   vehiclePlate.trim() || undefined,
        vehicleSubType: vehicleSubType     || undefined,
        numberOfSeats:  isNaN(seats)       ? undefined : seats,
      });
      await fetchProfile();
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || 'Failed to create profile.';
      Alert.alert('Error', msg);
    } finally {
      setCreatingProfile(false);
    }
  };

  // ── Pick & upload ──────────────────────────────────────────────────────────
  const pickAndUpload = async (docType) => {
    if (!profile) {
      Alert.alert('No Profile', 'Please complete your courier profile first.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll access to upload documents.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:    ImagePicker.MediaTypeOptions.Images,
        quality:       0.85,
        allowsEditing: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      setUploading((prev) => ({ ...prev, [docType.key]: true }));

      let url = null;

      const uploadFn = getUploadFn(docType.uploadKey);
      if (uploadFn) {
        try {
          url = extractUrl(await uploadFn(asset));
        } catch (e) {
          console.warn('[PartnerDocuments] primary upload failed, falling back:', e?.message);
        }
      }

      if (!url) {
        const dataUri   = await toBase64DataUri(asset.uri);
        const uploadRes = await uploadAPI.uploadBase64(dataUri, 'duoride/partner-documents');
        url = extractUrl(uploadRes);
      }

      if (!url) throw new Error('Upload succeeded but no URL was returned.');

      await partnerAPI.uploadDocuments({ [docType.key]: url });
      await fetchProfile();
      Alert.alert('Uploaded ✅', `${docType.label} uploaded successfully.`);
    } catch (err) {
      Alert.alert('Upload Failed', err?.response?.data?.message || err?.message || 'Please try again.');
    } finally {
      setUploading((prev) => ({ ...prev, [docType.key]: false }));
    }
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const handleDownload = async (url) => {
    if (Platform.OS === 'web') {
      try { window.open(url, '_blank'); }
      catch { Alert.alert('Download failed', 'Could not open image on web.'); }
      return;
    }
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(false);
      if (!perm.granted) {
        Alert.alert('Permission needed', 'We need access to your media library to save the image.');
        return;
      }
      const localUri    = FileSystem.documentDirectory + `doc_${Date.now()}.jpg`;
      const downloadRes = await FileSystem.downloadAsync(url, localUri);
      if (downloadRes.status !== 200) throw new Error('Download failed');
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert('Saved ✅', 'Document saved to your photos.');
    } catch (err) {
      Alert.alert('Download Failed', err?.message || 'Could not save document.');
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  VIEW A — No profile yet: create profile form
  // ─────────────────────────────────────────────────────────────────────────
  if (profileMissing) {
    const subTypes = VEHICLE_SUB_TYPES[vehicleType] ?? [];

    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

        <View style={{ height: SCROLL_H }}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: 40 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={(e) => { scrollY.value = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color={theme.foreground} />
            </TouchableOpacity>

            <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Complete Your Courier Profile</Text>
            <Text style={[styles.emptyText, { color: theme.hint }]}>
              Select your vehicle type and enter your plate number to get started.
            </Text>

            {/* Vehicle type */}
            <Text style={[styles.sectionLabel, { color: theme.hint }]}>VEHICLE TYPE</Text>
            <View style={styles.vehicleTypeGrid}>
              {VEHICLE_TYPES.map((vt) => {
                const selected = vehicleType === vt.value;
                return (
                  <TouchableOpacity
                    key={vt.value}
                    style={[styles.vehicleTypeOption, {
                      backgroundColor: selected ? theme.accent + '18' : theme.backgroundAlt,
                      borderColor:     selected ? theme.accent : theme.border,
                    }]}
                    onPress={() => { setVehicleType(vt.value); setVehicleSubType(''); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={vt.icon} size={18} color={selected ? theme.accent : theme.hint} />
                    <Text style={[styles.vehicleTypeLabel, { color: selected ? theme.accent : theme.hint }]}>
                      {vt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Sub type */}
            {subTypes.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.hint }]}>SUB-TYPE</Text>
                <View style={styles.vehicleTypeGrid}>
                  {subTypes.map((st) => {
                    const selected = vehicleSubType === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[styles.vehicleTypeOption, {
                          backgroundColor: selected ? theme.accent + '18' : theme.backgroundAlt,
                          borderColor:     selected ? theme.accent : theme.border,
                        }]}
                        onPress={() => setVehicleSubType(st)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.vehicleTypeLabel, { color: selected ? theme.accent : theme.hint }]}>
                          {st}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Plate & seats */}
            <FloatInput
              label="Plate Number (optional)"
              iconName="document-text-outline"
              value={vehiclePlate}
              onChangeText={setVehiclePlate}
              autoCapitalize="characters"
            />
            {(vehicleType === 'CAR' || vehicleType === 'VAN') && (
              <FloatInput
                label="Number of Seats (optional)"
                iconName="people-outline"
                value={numberOfSeats}
                onChangeText={setNumberOfSeats}
                keyboardType="numeric"
              />
            )}

            <TouchableOpacity
              style={[styles.createProfileBtn, { backgroundColor: theme.accent, opacity: creatingProfile ? 0.7 : 1 }]}
              onPress={handleCreateProfile}
              disabled={creatingProfile}
              activeOpacity={0.8}
            >
              {creatingProfile
                ? <ActivityIndicator color={theme.accentFg ?? '#fff'} />
                : <Text style={[styles.createProfileBtnText, { color: theme.accentFg ?? '#fff' }]}>
                    Save & Continue →
                  </Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  VIEW B — Profile exists: document upload
  // ─────────────────────────────────────────────────────────────────────────
  const isApproved  = profile?.isApproved ?? false;
  const isRejected  = profile?.isRejected ?? false;
  const docSlots    = getDocSlots(profile?.vehicleType ?? 'BIKE');

  const requiredSlots    = docSlots.filter((s) => s.required);
  const requiredUploaded = requiredSlots.filter((s) => !!profile?.[s.key]).length;
  const totalUploaded    = docSlots.filter((s) => !!profile?.[s.key]).length;
  const progressPct      = Math.round((requiredUploaded / requiredSlots.length) * 100);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <View style={{ height: SCROLL_H }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => { scrollY.value = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={theme.foreground} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: theme.foreground }]}>KYC Documents</Text>
          <Text style={[styles.subtitle, { color: theme.hint }]}>
            Upload clear photos of each document for verification and approval.
          </Text>

          {/* Progress */}
          <View style={[styles.progressWrap, { backgroundColor: theme.border }]}>
            <View style={[styles.progressBar, { width: `${progressPct}%`, backgroundColor: theme.accent }]} />
          </View>
          <Text style={[styles.progressLabel, { color: theme.hint }]}>
            {requiredUploaded} of {requiredSlots.length} required documents uploaded
            {totalUploaded > requiredUploaded ? ` (+${totalUploaded - requiredUploaded} optional)` : ''}
          </Text>

          {/* Status banner */}
          {isRejected ? (
            <View style={[styles.statusBanner, { backgroundColor: '#E0555510', borderColor: '#E05555' }]}>
              <Ionicons name="close-circle-outline" size={18} color="#E05555" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: '#E05555' }]}>Application Not Approved</Text>
                <Text style={[styles.statusSub, { color: theme.hint }]}>
                  {profile.rejectionReason || 'Please contact support for more information.'}
                </Text>
              </View>
            </View>
          ) : isApproved ? (
            <View style={[styles.statusBanner, { backgroundColor: '#10B98110', borderColor: '#10B981' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: '#10B981' }]}>Approved & Verified ✅</Text>
                <Text style={[styles.statusSub, { color: theme.hint }]}>
                  Your account is active. You can go online and start accepting deliveries.
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.statusBanner, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <Ionicons name="time-outline" size={18} color={theme.hint} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: theme.foreground }]}>Under Review</Text>
                <Text style={[styles.statusSub, { color: theme.hint }]}>
                  Our team is reviewing your application. Upload all required documents to speed up approval.
                </Text>
              </View>
            </View>
          )}

          {/* Vehicle summary */}
          <View style={[styles.vehicleCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Ionicons name="bicycle-outline" size={20} color={theme.accent} style={{ marginBottom: 6 }} />
            <Text style={[styles.vehicleTitle, { color: theme.foreground }]}>
              {profile.vehicleType}
              {profile.vehicleSubType ? ` · ${profile.vehicleSubType}` : ''}
            </Text>
            {profile.vehiclePlate ? (
              <Text style={[styles.vehiclePlate, { color: theme.accent }]}>{profile.vehiclePlate}</Text>
            ) : null}
            {profile.numberOfSeats ? (
              <Text style={[styles.vehicleMeta, { color: theme.hint }]}>{profile.numberOfSeats} seats</Text>
            ) : null}
          </View>

          {/* Document cards */}
          <Text style={[styles.sectionLabel, { color: theme.hint, marginTop: 4 }]}>DOCUMENTS</Text>

          {docSlots.map((doc) => {
            const currentUrl  = profile?.[doc.key];
            const isUploading = uploading[doc.key];

            return (
              <View
                key={doc.key}
                style={[styles.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
              >
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={[styles.docIconBox, { backgroundColor: theme.accent + '15' }]}>
                    <Ionicons name={doc.icon} size={18} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: theme.foreground }]}>
                      {doc.label}
                      {doc.required
                        ? <Text style={{ color: '#E05555' }}> *</Text>
                        : <Text style={[styles.optional, { color: theme.hint }]}> (optional)</Text>
                      }
                    </Text>
                    <Text style={[styles.docHint, { color: theme.hint }]}>{doc.hint}</Text>
                  </View>
                  <View style={[styles.statusDot, {
                    backgroundColor: currentUrl ? '#5DAA72' : theme.hint,
                  }]} />
                </View>

                {/* Preview or placeholder */}
                {currentUrl ? (
                  <>
                    <Image source={{ uri: currentUrl }} style={styles.preview} resizeMode="cover" />
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.iconBtn, { backgroundColor: theme.accent + '15' }]}
                        onPress={() => setViewImage({ url: currentUrl })}
                      >
                        <Ionicons name="eye-outline" size={16} color={theme.accent} />
                        <Text style={[styles.iconBtnText, { color: theme.accent }]}>View</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconBtn, { backgroundColor: theme.accent + '15' }]}
                        onPress={() => handleDownload(currentUrl)}
                      >
                        <Ionicons name="download-outline" size={16} color={theme.accent} />
                        <Text style={[styles.iconBtnText, { color: theme.accent }]}>Download</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={[styles.placeholder, { borderColor: theme.border }]}>
                    <Ionicons name="cloud-upload-outline" size={32} color={theme.hint} />
                    <Text style={[styles.placeholderText, { color: theme.hint }]}>No file uploaded</Text>
                  </View>
                )}

                {/* Upload button */}
                <TouchableOpacity
                  style={[styles.uploadBtn, { backgroundColor: theme.accent, opacity: isUploading ? 0.7 : 1 }]}
                  onPress={() => pickAndUpload(doc)}
                  disabled={!!isUploading}
                  activeOpacity={0.8}
                >
                  {isUploading ? (
                    <ActivityIndicator color={theme.accentFg ?? '#fff'} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={15} color={theme.accentFg ?? '#fff'} />
                      <Text style={[styles.uploadBtnText, { color: theme.accentFg ?? '#fff' }]}>
                        {currentUrl ? 'Replace' : 'Upload'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}

          <Text style={[styles.note, { color: theme.hint }]}>
            An admin will review your documents. You can start accepting deliveries once approved.
          </Text>
        </ScrollView>
      </View>

      {/* Full-screen image viewer */}
      <Modal visible={!!viewImage} transparent animationType="fade" onRequestClose={() => setViewImage(null)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setViewImage(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Image source={{ uri: viewImage?.url }} style={styles.modalImage} resizeMode="contain" />
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:    { flex: 1 },
  scroll:  { paddingHorizontal: 20 },
  backBtn: { marginBottom: 16, alignSelf: 'flex-start' },

  title:    { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 14, lineHeight: 20 },

  progressWrap:  { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBar:   { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 12, marginBottom: 16 },

  statusBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  statusTitle:  { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  statusSub:    { fontSize: 12, lineHeight: 17 },

  vehicleCard:  { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 18 },
  vehicleTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  vehiclePlate: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, marginBottom: 2 },
  vehicleMeta:  { fontSize: 12 },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 12, marginTop: 4 },

  card:       { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  docIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  cardTitle:  { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  docHint:    { fontSize: 11, lineHeight: 15 },
  optional:   { fontWeight: '400', fontSize: 12 },
  statusDot:  { width: 10, height: 10, borderRadius: 5, marginTop: 4 },

  preview:     { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, marginBottom: 8 },
  actionsRow:  { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginBottom: 12 },
  iconBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  iconBtnText: { fontSize: 13, fontWeight: '700' },

  placeholder:     { aspectRatio: 16 / 9, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 12, gap: 6 },
  placeholderText: { fontSize: 12, marginTop: 4 },

  uploadBtn:     { flexDirection: 'row', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', gap: 8 },
  uploadBtnText: { fontSize: 14, fontWeight: '700' },

  note:    { fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  centered:{ flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, marginTop: 10 },
  emptyText:  { fontSize: 14, marginBottom: 24, lineHeight: 20 },

  vehicleTypeGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  vehicleTypeOption: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1.5, paddingVertical: 10, paddingHorizontal: 14 },
  vehicleTypeLabel:  { fontSize: 14, fontWeight: '600' },

  createProfileBtn:     { borderRadius: 13, height: 54, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 24 },
  createProfileBtnText: { fontSize: 16, fontWeight: '700' },

  inputBox:   { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, marginBottom: 12, height: 60, paddingHorizontal: 14 },
  inputIcon:  { marginRight: 10 },
  floatLabel: { position: 'absolute', left: 0 },
  inputText:  { fontSize: 15, paddingTop: 18, paddingBottom: 4 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalClose:    { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  modalImage:    { width: '95%', height: '75%' },
});