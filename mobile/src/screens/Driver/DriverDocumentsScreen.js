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
import { useTranslation } from 'react-i18next';
import { driverAPI, uploadAPI } from '../../services/api';
import { toBase64DataUri } from '../../utils/toBase64DataUri';

const { height } = Dimensions.get('window');

const VEHICLE_TYPES = ['CAR', 'MOTORCYCLE', 'BIKE', 'VAN', 'TRICYCLE'];

// ─────────────────────────────────────────────────────────────────────────────
//  Vehicle sub-type options per vehicle type
// ─────────────────────────────────────────────────────────────────────────────
const VEHICLE_SUB_TYPES = {
  CAR:        ['Sedan', 'SUV', 'Hatchback', 'Minivan', 'Coupe'],
  VAN:        ['Panel Van', 'Minibus', 'Pickup Truck', 'Box Truck'],
  MOTORCYCLE: ['Standard', 'Scooter', 'Sport', 'Cruiser'],
  BIKE:       ['Road Bike', 'Mountain Bike', 'Cargo Bike'],
  TRICYCLE:   ['Keke Napep', 'Cargo Tricycle'],
};

// ─────────────────────────────────────────────────────────────────────────────
//  Document slots — returned based on vehicle type
//  uploadKey maps to the uploadAPI function to call
// ─────────────────────────────────────────────────────────────────────────────
const getDocSlots = (vehicleType, t) => {
  // Universal docs every driver must submit
  const base = [
    {
      key: 'applicantPhotoUrl',
      label: t('driverDocs.yourPhotoLabel'),
      hint: t('driverDocs.yourPhotoHint'),
      icon: 'person-outline',
      uploadKey: 'applicant_photo',
      required: true,
    },
    {
      key: 'govtIdUrl',
      label: t('driverDocs.govtIdLabel'),
      hint: t('driverDocs.govtIdHint'),
      icon: 'card-outline',
      uploadKey: 'govt_id',
      required: true,
    },
    {
      key: 'proofOfAddressUrl',
      label: t('driverDocs.proofOfAddressLabel'),
      hint: t('driverDocs.proofOfAddressHint'),
      icon: 'home-outline',
      uploadKey: 'proof_of_address',
      required: true,
    },
    {
      key: 'licenseImageUrl',
      label: t('driverDocs.driversLicenceLabel'),
      hint: t('driverDocs.driversLicenceHint'),
      icon: 'ribbon-outline',
      uploadKey: 'license',
      required: true,
    },
    {
      key: 'vehicleRegUrl',
      label: t('driverDocs.vehicleRegLabel'),
      hint: t('driverDocs.vehicleRegHint'),
      icon: 'document-text-outline',
      uploadKey: 'registration',
      required: true,
    },
    {
      key: 'insuranceUrl',
      label: t('driverDocs.insuranceLabel'),
      hint: t('driverDocs.insuranceHint'),
      icon: 'shield-outline',
      uploadKey: 'insurance',
      required: true,
    },
    {
      key: 'roadWorthinessUrl',
      label: t('driverDocs.roadWorthinessLabel'),
      hint: t('driverDocs.roadWorthinessHint'),
      icon: 'checkmark-circle-outline',
      uploadKey: 'road_worthiness',
      required: true,
    },
    {
      key: 'vehiclePhotoExteriorUrl',
      label: t('driverDocs.vehicleExteriorLabel'),
      hint: t('driverDocs.vehicleExteriorHint'),
      icon: 'camera-outline',
      uploadKey: 'vehicle_exterior',
      required: true,
    },
  ];

  // CAR & VAN extras
  if (vehicleType === 'CAR' || vehicleType === 'VAN') {
    base.push(
      {
        key: 'vehiclePhotoInteriorUrl',
        label: vehicleType === 'VAN' ? t('driverDocs.vanInteriorLabel') : t('driverDocs.carInteriorLabel'),
        hint: vehicleType === 'VAN' ? t('driverDocs.vanInteriorHint') : t('driverDocs.carInteriorHint'),
        icon: 'car-outline',
        uploadKey: 'vehicle_interior',
        required: true,
      },
      {
        key: 'hackneyCertUrl',
        label: t('driverDocs.hackneyLabel'),
        hint: t('driverDocs.hackneyHint'),
        icon: 'newspaper-outline',
        uploadKey: 'hackney',
        required: true,
      },
      {
        key: 'vehicleInspectionUrl',
        label: t('driverDocs.vehicleInspectionLabel'),
        hint: t('driverDocs.vehicleInspectionHint'),
        icon: 'construct-outline',
        uploadKey: 'inspection',
        required: false,
      }
    );
  }

  // MOTORCYCLE extras
  if (vehicleType === 'MOTORCYCLE') {
    base.push(
      {
        key: 'riderCardUrl',
        label: t('driverDocs.riderCardLabel'),
        hint: t('driverDocs.riderCardHint'),
        icon: 'id-card-outline',
        uploadKey: 'rider_card',
        required: true,
      },
      {
        key: 'helmetPhotoUrl',
        label: t('driverDocs.helmetLabel'),
        hint: t('driverDocs.helmetHint'),
        icon: 'glasses-outline',
        uploadKey: 'helmet',
        required: true,
      }
    );
  }

  // BIKE extras
  if (vehicleType === 'BIKE') {
    base.push(
      {
        key: 'dispatchPermitUrl',
        label: t('driverDocs.dispatchPermitLabel'),
        hint: t('driverDocs.dispatchPermitHint'),
        icon: 'bicycle-outline',
        uploadKey: 'dispatch_permit',
        required: true,
      },
      {
        key: 'guarantorLetterUrl',
        label: t('driverDocs.guarantorLetterLabel'),
        hint: t('driverDocs.guarantorLetterHint'),
        icon: 'document-outline',
        uploadKey: 'guarantor_letter',
        required: true,
      },
      {
        key: 'guarantorIdUrl',
        label: t('driverDocs.guarantorIdLabel'),
        hint: t('driverDocs.guarantorIdHint'),
        icon: 'person-add-outline',
        uploadKey: 'guarantor_id',
        required: true,
      }
    );
  }

  // TRICYCLE extras
  if (vehicleType === 'TRICYCLE') {
    base.push(
      {
        key: 'riderCardUrl',
        label: t('driverDocs.tricycleOperatorLabel'),
        hint: t('driverDocs.tricycleOperatorHint'),
        icon: 'document-lock-outline',
        uploadKey: 'rider_card',
        required: true,
      }
    );
  }

  return base;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Map uploadKey → uploadAPI function
// ─────────────────────────────────────────────────────────────────────────────
const getUploadFn = (uploadKey) => {
  const map = {
    applicant_photo:  (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/photos'),
    govt_id:          (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/ids'),
    proof_of_address: (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/address'),
    license:          (asset) => uploadAPI.uploadDriverLicense(asset),
    registration:     (asset) => uploadAPI.uploadVehicleRegistration(asset),
    insurance:        (asset) => uploadAPI.uploadInsurance(asset),
    road_worthiness:  (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/roadworthy'),
    vehicle_exterior: (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/vehicles'),
    vehicle_interior: (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/vehicles'),
    hackney:          (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/permits'),
    inspection:       (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/inspection'),
    rider_card:       (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/permits'),
    helmet:           (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/helmet'),
    dispatch_permit:  (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/permits'),
    guarantor_letter: (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/guarantor'),
    guarantor_id:     (asset) => uploadAPI.uploadBase64AndReturn(asset, 'duoride/kyc/guarantor'),
  };
  return map[uploadKey] ?? null;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Helper — extract URL from any upload response shape
// ─────────────────────────────────────────────────────────────────────────────
const extractUrl = (res) =>
  res?.data?.url        ??
  res?.data?.secure_url ??
  res?.url              ??
  res?.secure_url       ??
  null;

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────
export default function DriverDocumentsScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const { t } = useTranslation();
  const insets          = useSafeAreaInsets();

  const TAB_H        = 54;
  const EXTRA_BOTTOM = Platform.OS === 'android' ? 16 : 0;
  const SCROLL_H     = height - insets.top - TAB_H - insets.bottom - EXTRA_BOTTOM;

  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState({});
  const [viewImage, setViewImage] = useState(null);

  // Profile-creation form
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleType,   setVehicleType]   = useState('CAR');
  const [vehicleMake,   setVehicleMake]   = useState('');
  const [vehicleModel,  setVehicleModel]  = useState('');
  const [vehicleYear,   setVehicleYear]   = useState('');
  const [vehicleColor,  setVehicleColor]  = useState('');
  const [vehiclePlate,  setVehiclePlate]  = useState('');
  const [numberOfSeats, setNumberOfSeats] = useState('');
  const [vehicleSubType,setVehicleSubType]= useState('');

  // ── Fetch profile ──────────────────────────────────────────────────────────
  const fetchProfile = async () => {
    try {
      const res  = await driverAPI.getProfile();
      const data = res?.data?.profile ?? res?.profile ?? res;
      setProfile(data ?? null);
    } catch (err) {
      const is404 =
        err?.message?.toLowerCase().includes('not found') ||
        err?.statusCode === 404 ||
        err?.status    === 404;
      if (!is404) Alert.alert(t('driverDocs.errorTitle'), t('driverDocs.couldNotLoadProfile'));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  // ── Create profile ─────────────────────────────────────────────────────────
  const handleCreateProfile = async () => {
    if (!licenseNumber.trim())
      return Alert.alert(t('driverDocs.missingFieldTitle'), t('driverDocs.enterLicenceNumber'));
    if (!vehicleMake.trim() || !vehicleModel.trim())
      return Alert.alert(t('driverDocs.missingFieldTitle'), t('driverDocs.enterVehicleMakeModel'));
    const yr = parseInt(vehicleYear, 10);
    if (!vehicleYear || isNaN(yr) || yr < 1990 || yr > new Date().getFullYear() + 1)
      return Alert.alert(t('driverDocs.invalidYearTitle'), t('driverDocs.invalidYearBody'));
    if (!vehicleColor.trim())
      return Alert.alert(t('driverDocs.missingFieldTitle'), t('driverDocs.enterVehicleColour'));
    if (!vehiclePlate.trim())
      return Alert.alert(t('driverDocs.missingFieldTitle'), t('driverDocs.enterPlateNumber'));

    const seats = parseInt(numberOfSeats, 10);

    setSaving(true);
    try {
      await driverAPI.updateProfile({
        licenseNumber:  licenseNumber.trim().toUpperCase(),
        vehicleType,
        vehicleMake:    vehicleMake.trim(),
        vehicleModel:   vehicleModel.trim(),
        vehicleYear:    yr,
        vehicleColor:   vehicleColor.trim(),
        vehiclePlate:   vehiclePlate.trim().toUpperCase(),
        numberOfSeats:  isNaN(seats) ? undefined : seats,
        vehicleSubType: vehicleSubType || undefined,
      });
      Alert.alert(
        t('driverDocs.profileCreatedTitle'),
        t('driverDocs.profileCreatedBody')
      );
      await fetchProfile();
    } catch (err) {
      const msg = err?.message || err?.errors?.[0]?.msg || t('driverDocs.couldNotCreateProfile');
      Alert.alert(t('driverDocs.errorTitle'), msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Pick & upload a document ───────────────────────────────────────────────
  const pickAndUpload = async (slot) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('driverDocs.permissionNeededTitle'), t('driverDocs.photoLibraryPermission'));
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
      setUploading((prev) => ({ ...prev, [slot.key]: true }));

      let url = null;

      // Try named upload function first
      const uploadFn = getUploadFn(slot.uploadKey);
      if (uploadFn) {
        try {
          url = extractUrl(await uploadFn(asset));
        } catch (e) {
          console.warn('[DriverDocuments] primary upload failed, falling back:', e?.message);
        }
      }

      // Base64 fallback
      if (!url) {
        const dataUri   = await toBase64DataUri(asset.uri);
        const uploadRes = await uploadAPI.uploadBase64(dataUri, 'duoride/documents');
        url = extractUrl(uploadRes);
      }

      if (!url) throw new Error('Upload succeeded but no URL was returned. Check Cloudinary config.');

      await driverAPI.uploadDocuments({ [slot.key]: url });
      await fetchProfile();
      Alert.alert(t('driverDocs.uploadedTitle'), t('driverDocs.uploadedSuccessBody', { label: slot.label }));
    } catch (err) {
      Alert.alert(t('driverDocs.uploadFailedTitle'), err?.message || t('driverDocs.pleaseTryAgain'));
    } finally {
      setUploading((prev) => ({ ...prev, [slot.key]: false }));
    }
  };

  // ── Download / save document ───────────────────────────────────────────────
  const handleDownload = async (url) => {
    if (Platform.OS === 'web') {
      try { window.open(url, '_blank'); }
      catch { Alert.alert(t('driverDocs.downloadFailedTitle'), t('driverDocs.couldNotOpenImageOnWeb')); }
      return;
    }
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(false);
      if (!perm.granted) {
        Alert.alert(t('driverDocs.permissionNeededLower'), t('driverDocs.mediaLibraryPermission'));
        return;
      }
      const localUri   = FileSystem.documentDirectory + `doc_${Date.now()}.jpg`;
      const downloadRes = await FileSystem.downloadAsync(url, localUri);
      if (downloadRes.status !== 200) throw new Error('Download failed');
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert(t('driverDocs.savedTitle'), t('driverDocs.savedToPhotos'));
    } catch (err) {
      Alert.alert(t('driverDocs.downloadFailedTitleCaps'), err?.message || t('driverDocs.couldNotSaveDocument'));
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[sx.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  VIEW A — No profile yet: show create-profile form
  // ─────────────────────────────────────────────────────────────────────────
  if (!profile) {
    const subTypes = VEHICLE_SUB_TYPES[vehicleType] ?? [];

    return (
      <View style={[sx.root, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ height: SCROLL_H }}>
            <ScrollView
              contentContainerStyle={sx.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Back */}
              <TouchableOpacity style={sx.back} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={22} color={theme.foreground} />
              </TouchableOpacity>

              {/* Info banner */}
              <View style={[sx.infoBanner, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
                <Ionicons name="information-circle-outline" size={20} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[sx.infoTitle, { color: theme.foreground }]}>{t('driverDocs.completeYourDriverProfile')}</Text>
                  <Text style={[sx.infoSub, { color: theme.hint }]}>
                    {t('driverDocs.enterLicenceAndVehicleDetails')}
                  </Text>
                </View>
              </View>

              {/* Licence info */}
              <Text style={[sx.sectionLabel, { color: theme.hint }]}>{t('driverDocs.licenceInfo')}</Text>
              <InputField
                placeholder={t('driverDocs.licenceNumberPlaceholder')}
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                autoCapitalize="characters"
                theme={theme}
              />

              {/* Vehicle type */}
              <Text style={[sx.sectionLabel, { color: theme.hint }]}>{t('driverDocs.vehicleType')}</Text>
              <View style={sx.chipRow}>
                {VEHICLE_TYPES.map((vt) => {
                  const sel = vehicleType === vt;
                  return (
                    <TouchableOpacity
                      key={vt}
                      style={[sx.chip, {
                        borderColor:     sel ? theme.accent : theme.border,
                        backgroundColor: sel ? theme.accent + '18' : 'transparent',
                      }]}
                      onPress={() => { setVehicleType(vt); setVehicleSubType(''); }}
                    >
                      <Text style={[sx.chipTxt, { color: sel ? theme.accent : theme.hint }]}>{vt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Sub type */}
              {subTypes.length > 0 && (
                <>
                  <Text style={[sx.sectionLabel, { color: theme.hint }]}>{t('driverDocs.vehicleSubType')}</Text>
                  <View style={sx.chipRow}>
                    {subTypes.map((st) => {
                      const sel = vehicleSubType === st;
                      return (
                        <TouchableOpacity
                          key={st}
                          style={[sx.chip, {
                            borderColor:     sel ? theme.accent : theme.border,
                            backgroundColor: sel ? theme.accent + '18' : 'transparent',
                          }]}
                          onPress={() => setVehicleSubType(st)}
                        >
                          <Text style={[sx.chipTxt, { color: sel ? theme.accent : theme.hint }]}>{st}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Vehicle details */}
              <Text style={[sx.sectionLabel, { color: theme.hint }]}>{t('driverDocs.vehicleDetails')}</Text>
              <View style={sx.row}>
                <View style={{ flex: 1 }}>
                  <InputField placeholder={t('driverDocs.makePlaceholder')} value={vehicleMake} onChangeText={setVehicleMake} autoCapitalize="words" theme={theme} />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField placeholder={t('driverDocs.modelPlaceholder')} value={vehicleModel} onChangeText={setVehicleModel} autoCapitalize="words" theme={theme} />
                </View>
              </View>
              <View style={sx.row}>
                <View style={{ flex: 1 }}>
                  <InputField placeholder={t('driverDocs.yearPlaceholder')} value={vehicleYear} onChangeText={setVehicleYear} keyboardType="numeric" theme={theme} />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField placeholder={t('driverDocs.colourPlaceholder')} value={vehicleColor} onChangeText={setVehicleColor} autoCapitalize="words" theme={theme} />
                </View>
              </View>
              <View style={sx.row}>
                <View style={{ flex: 1 }}>
                  <InputField placeholder={t('driverDocs.platePlaceholder')} value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" theme={theme} />
                </View>
                {(vehicleType === 'CAR' || vehicleType === 'VAN') && (
                  <View style={{ flex: 1 }}>
                    <InputField placeholder={t('driverDocs.seatsPlaceholder')} value={numberOfSeats} onChangeText={setNumberOfSeats} keyboardType="numeric" theme={theme} />
                  </View>
                )}
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[sx.primaryBtn, saving && sx.btnDim, { backgroundColor: theme.accent }]}
                onPress={handleCreateProfile}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={[sx.primaryBtnTxt, { color: theme.accentFg ?? '#fff' }]}>{t('driverDocs.submitApplication')}</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  VIEW B — Profile exists: document upload
  // ─────────────────────────────────────────────────────────────────────────
  const isApproved = profile?.isApproved ?? false;
  const isRejected = profile?.isRejected ?? false;
  const docSlots   = getDocSlots(profile?.vehicleType ?? 'CAR', t);

  const uploadedCount  = docSlots.filter((s) => !!profile?.[s.key]).length;
  const requiredCount  = docSlots.filter((s) => s.required).length;
  const requiredUploaded = docSlots.filter((s) => s.required && !!profile?.[s.key]).length;
  const progressPct    = Math.round((requiredUploaded / requiredCount) * 100);

  return (
    <View style={[sx.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={{ height: SCROLL_H }}>
        <ScrollView
          contentContainerStyle={sx.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={sx.back} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={theme.foreground} />
          </TouchableOpacity>

          <Text style={[sx.title, { color: theme.foreground }]}>{t('driverDocs.kycDocuments')}</Text>
          <Text style={[sx.subtitle, { color: theme.hint }]}>
            Upload clear, unobstructed photos of each document to speed up approval.
          </Text>

          {/* Progress bar */}
          <View style={[sx.progressWrap, { backgroundColor: theme.border }]}>
            <View style={[sx.progressBar, { width: `${progressPct}%`, backgroundColor: theme.accent }]} />
          </View>
          <Text style={[sx.progressLabel, { color: theme.hint }]}>
            {requiredUploaded} of {requiredCount} required documents uploaded
            {uploadedCount > requiredCount ? ` (+${uploadedCount - requiredCount} optional)` : ''}
          </Text>

          {/* Status banner */}
          {isRejected ? (
            <View style={[sx.statusBanner, { backgroundColor: '#E0555510', borderColor: '#E05555' }]}>
              <Ionicons name="close-circle-outline" size={18} color="#E05555" />
              <View style={{ flex: 1 }}>
                <Text style={[sx.statusTitle, { color: '#E05555' }]}>{t('driverDocs.applicationNotApproved')}</Text>
                <Text style={[sx.statusSub, { color: theme.hint }]}>
                  {profile.rejectionReason || t('driverDocs.contactSupportForInfo')}
                </Text>
              </View>
            </View>
          ) : isApproved ? (
            <View style={[sx.statusBanner, { backgroundColor: '#10B98110', borderColor: '#10B981' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={[sx.statusTitle, { color: '#10B981' }]}>{t('driverDocs.approvedAndVerified')}</Text>
                <Text style={[sx.statusSub, { color: theme.hint }]}>
                  {t('driverDocs.accountActiveBody')}
                </Text>
              </View>
            </View>
          ) : (
            <View style={[sx.statusBanner, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <Ionicons name="time-outline" size={18} color={theme.hint} />
              <View style={{ flex: 1 }}>
                <Text style={[sx.statusTitle, { color: theme.foreground }]}>{t('driverDocs.underReview')}</Text>
                <Text style={[sx.statusSub, { color: theme.hint }]}>
                  {t('driverDocs.reviewingApplicationBody')}
                </Text>
              </View>
            </View>
          )}

          {/* Vehicle summary */}
          <View style={[sx.vehicleCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
            <Ionicons name="car-outline" size={20} color={theme.accent} style={{ marginBottom: 6 }} />
            <Text style={[sx.vehicleTitle, { color: theme.foreground }]}>
              {profile.vehicleColor} {profile.vehicleMake} {profile.vehicleModel} ({profile.vehicleYear})
            </Text>
            <Text style={[sx.vehiclePlate, { color: theme.accent }]}>{profile.vehiclePlate}</Text>
            <Text style={[sx.vehicleMeta, { color: theme.hint }]}>
              {profile.vehicleType}
              {profile.vehicleSubType ? ` · ${profile.vehicleSubType}` : ''}
              {profile.numberOfSeats  ? t('driverDocs.seatsSuffix', { count: profile.numberOfSeats }) : ''}
              {t('driverDocs.licenceColon')}{profile.licenseNumber}
            </Text>
          </View>

          {/* Document slots */}
          <Text style={[sx.sectionLabel, { color: theme.hint, marginTop: 4 }]}>{t('driverDocs.documents')}</Text>

          {docSlots.map((slot) => {
            const currentUrl  = profile?.[slot.key];
            const isUploading = uploading[slot.key];

            return (
              <View
                key={slot.key}
                style={[sx.docCard, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
              >
                {/* Card header */}
                <View style={sx.docCardHeader}>
                  <View style={[sx.docIconBox, { backgroundColor: theme.accent + '15' }]}>
                    <Ionicons name={slot.icon} size={20} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[sx.docLabel, { color: theme.foreground }]}>
                      {slot.label}
                      {slot.required
                        ? <Text style={{ color: '#E05555' }}> *</Text>
                        : <Text style={[sx.optional, { color: theme.hint }]}> (optional)</Text>
                      }
                    </Text>
                    <Text style={[sx.docHint, { color: theme.hint }]}>{slot.hint}</Text>
                  </View>
                  {currentUrl
                    ? <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    : <Ionicons name="ellipse-outline"  size={20} color={theme.hint} />
                  }
                </View>

                {/* Preview or placeholder */}
                {currentUrl ? (
                  <>
                    <Image source={{ uri: currentUrl }} style={sx.preview} resizeMode="cover" />
                    <View style={sx.actionsRow}>
                      <TouchableOpacity
                        style={[sx.iconBtn, { backgroundColor: theme.accent + '15' }]}
                        onPress={() => setViewImage({ url: currentUrl })}
                      >
                        <Ionicons name="eye-outline" size={16} color={theme.accent} />
                        <Text style={[sx.iconBtnText, { color: theme.accent }]}>{t('driverDocs.view')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[sx.iconBtn, { backgroundColor: theme.accent + '15' }]}
                        onPress={() => handleDownload(currentUrl)}
                      >
                        <Ionicons name="download-outline" size={16} color={theme.accent} />
                        <Text style={[sx.iconBtnText, { color: theme.accent }]}>{t('driverDocs.download')}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={[sx.placeholder, { borderColor: theme.border }]}>
                    <Ionicons name="cloud-upload-outline" size={36} color={theme.hint} />
                    <Text style={[sx.placeholderTxt, { color: theme.hint }]}>{t('driverDocs.notUploadedYet')}</Text>
                  </View>
                )}

                {/* Upload button */}
                <TouchableOpacity
                  style={[sx.uploadBtn, { backgroundColor: theme.accent }, isUploading && sx.btnDim]}
                  onPress={() => pickAndUpload(slot)}
                  disabled={!!isUploading}
                  activeOpacity={0.85}
                >
                  {isUploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={16} color={theme.accentFg ?? '#fff'} />
                      <Text style={[sx.uploadBtnTxt, { color: theme.accentFg ?? '#fff' }]}>
                        {currentUrl ? 'Replace' : 'Upload'}
                      </Text>
                    </>
                  )}
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

      {/* Full-screen image viewer */}
      <Modal visible={!!viewImage} transparent animationType="fade" onRequestClose={() => setViewImage(null)}>
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

// ─────────────────────────────────────────────────────────────────────────────
//  Reusable input
// ─────────────────────────────────────────────────────────────────────────────
function InputField({ placeholder, value, onChangeText, keyboardType, autoCapitalize, theme }) {
  return (
    <TextInput
      style={[sx.input, {
        color:           theme.foreground,
        borderColor:     theme.border,
        backgroundColor: theme.backgroundAlt,
      }]}
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

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────
const sx = StyleSheet.create({
  root:    { flex: 1 },
  centered:{ flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:  { padding: 24, paddingTop: Platform.OS === 'ios' ? 58 : 42, paddingBottom: 40 },

  back: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },

  title:    { fontSize: 26, fontWeight: '900', marginBottom: 6, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, marginBottom: 16, lineHeight: 21 },

  progressWrap:  { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBar:   { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 12, marginBottom: 18 },

  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  infoTitle:  { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  infoSub:    { fontSize: 12, lineHeight: 18 },

  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 3, marginBottom: 10, marginTop: 4 },

  input: { borderWidth: 1.5, borderRadius: 13, padding: 14, fontSize: 15, marginBottom: 12 },

  row: { flexDirection: 'row', gap: 10 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:    { borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8 },
  chipTxt: { fontSize: 12, fontWeight: '700' },

  primaryBtn:    { height: 54, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 },
  primaryBtnTxt: { fontSize: 16, fontWeight: '800' },
  btnDim:        { opacity: 0.6 },

  statusBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 18 },
  statusTitle:  { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  statusSub:    { fontSize: 12, lineHeight: 17 },

  vehicleCard:  { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 20 },
  vehicleTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  vehiclePlate: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, marginBottom: 3 },
  vehicleMeta:  { fontSize: 12 },

  docCard:       { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14 },
  docCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  docIconBox:    { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  docLabel:      { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  docHint:       { fontSize: 11, lineHeight: 15 },
  optional:      { fontWeight: '400', fontSize: 12 },

  preview:    { width: '100%', height: 190, borderRadius: 10, marginBottom: 8 },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginBottom: 12 },
  iconBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  iconBtnText:{ fontSize: 13, fontWeight: '700' },

  placeholder:    { height: 190, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 12, gap: 8 },
  placeholderTxt: { fontSize: 13 },

  uploadBtn:    { height: 46, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  uploadBtnTxt: { fontSize: 14, fontWeight: '700' },

  footerNote: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 20, paddingHorizontal: 8 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalClose:    { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  modalImage:    { width: '95%', height: '75%' },
});