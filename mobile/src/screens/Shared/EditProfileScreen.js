// mobile/src/screens/Shared/EditProfileScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  Animated, StatusBar, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons }      from '@expo/vector-icons';
import * as ImagePicker  from 'expo-image-picker';
import * as FileSystem   from 'expo-file-system/legacy';

import { useAuth }  from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { userAPI }  from '../../services/api';
import api          from '../../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Upload: read file as base64 → POST /api/upload/base64 → Cloudinary URL
// ─────────────────────────────────────────────────────────────────────────────
async function uploadToCloudinary(uri) {
  const ext      = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  // FIX: use the string literal 'base64' — FileSystem.EncodingType may be
  // undefined on some Expo SDK versions / web environments.
  const base64Raw  = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const base64Data = `data:${mimeType};base64,${base64Raw}`;

  // Axios interceptor returns response.data directly.
  // Shape: { success: true, data: { url, publicId } }
  const res = await api.post('/upload/base64', { base64Data, folder: 'diakite/profiles' });
  const url = res?.data?.url ?? res?.url;
  if (!url) throw new Error('Upload succeeded but no URL returned.');
  return url;
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating label input
// ─────────────────────────────────────────────────────────────────────────────
const FloatInput = ({ label, iconName, value, onChangeText, keyboardType, editable = true }) => {
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
    <Animated.View style={[s.inputBox, { backgroundColor: theme.backgroundAlt, borderColor, opacity: editable ? 1 : 0.45 }]}>
      <Ionicons name={iconName} size={16} color={focused ? theme.accent : theme.hint} style={s.inputIcon} />
      <View style={{ flex: 1 }}>
        <Animated.Text style={[s.floatLabel, { top: labelTop, fontSize: labelSize, color: labelColor }]}>{label}</Animated.Text>
        <TextInput
          style={[s.inputText, { color: theme.foreground }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize="none"
          editable={editable}
          placeholder=" "
          placeholderTextColor="transparent"
        />
      </View>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Image picker helpers — expo-image-picker v14+ API
// ─────────────────────────────────────────────────────────────────────────────
async function pickFromLibrary() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Please enable photo library access in your device Settings to change your profile photo.',
      [{ text: 'OK' }]
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.82,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

async function pickFromCamera() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Please enable camera access in your device Settings to take a photo.',
      [{ text: 'OK' }]
    );
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.82,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function EditProfileScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const { theme, mode }      = useTheme();

  const [firstName,     setFirstName]     = useState(user?.firstName    ?? '');
  const [lastName,      setLastName]      = useState(user?.lastName     ?? '');
  const [phone,         setPhone]         = useState(user?.phone        ?? '');
  const [profileImage,  setProfileImage]  = useState(user?.profileImage ?? null);
  const [imageLocalUri, setImageLocalUri] = useState(null);
  const [uploading,     setUploading]     = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);

  const fadeA  = useRef(new Animated.Value(0)).current;
  const slideA = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeA,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideA, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Show picker action sheet ────────────────────────────────────────────────
  const handleAvatarPress = () => {
    Alert.alert(
      'Profile Photo',
      'How would you like to update your photo?',
      [
        {
          text: 'Choose from Library',
          onPress: async () => {
            const uri = await pickFromLibrary();
            if (uri) setImageLocalUri(uri);
          },
        },
        {
          text: 'Take a Photo',
          onPress: async () => {
            const uri = await pickFromCamera();
            if (uri) setImageLocalUri(uri);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // ── Has anything changed? ───────────────────────────────────────────────────
  const hasChanges =
    firstName     !== (user?.firstName ?? '') ||
    lastName      !== (user?.lastName  ?? '') ||
    phone         !== (user?.phone     ?? '') ||
    imageLocalUri !== null;

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!firstName.trim()) return Alert.alert('Required', 'First name cannot be empty.');
    if (!lastName.trim())  return Alert.alert('Required', 'Last name cannot be empty.');

    setSaving(true);
    try {
      let finalImageUrl = profileImage;

      // Step 1 — upload new photo if selected
      if (imageLocalUri) {
        setUploading(true);
        finalImageUrl = await uploadToCloudinary(imageLocalUri);
        setUploading(false);
        setProfileImage(finalImageUrl);
        setImageLocalUri(null);
      }

      // Step 2 — patch profile
      const payload = {
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        ...(phone.trim() && { phone: phone.trim() }),
        ...(finalImageUrl && { profileImage: finalImageUrl }),
      };

      const res = await userAPI.updateProfile(payload);
      await updateUser(res?.data?.user ?? { ...user, ...payload });

      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch (err) {
      setUploading(false);
      const msg = err?.response?.data?.message ?? err?.message ?? 'Could not update profile.';
      Alert.alert('Update Failed', msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const displayUri = imageLocalUri ?? profileImage;
  const initials   = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  const busy       = saving || uploading;

  // FIX: resolve foreground color for elements that sit ON the accent colour.
  // theme.accentFg is '#000000' when accent is white (dark mode)
  //                and '#FFFFFF' when accent is black (light mode).
  const onAccent = theme.accentFg ?? '#FFFFFF';
  const savedBg  = '#5DAA72';

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      {/* ── Header ── */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.muted} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.foreground }]}>Edit Profile</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeA, transform: [{ translateY: slideA }] }}>

            {/* ── Avatar ── */}
            <View style={s.avatarSection}>
              <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8} style={s.avatarWrap}>
                {displayUri ? (
                  <Image
                    source={{ uri: displayUri }}
                    style={[s.avatarImg, { borderColor: theme.accent + '50' }]}
                  />
                ) : (
                  <View style={[s.avatarPlaceholder, { backgroundColor: theme.accent + '18', borderColor: theme.accent + '35' }]}>
                    <Text style={[s.avatarInitials, { color: theme.accent }]}>{initials || '?'}</Text>
                  </View>
                )}

                {/* Camera badge — FIX: icon color uses theme.accentFg */}
                <View style={[s.cameraBadge, { backgroundColor: theme.accent, borderColor: theme.background }]}>
                  {uploading
                    ? <ActivityIndicator size="small" color={onAccent} />
                    : <Ionicons name="camera" size={13} color={onAccent} />
                  }
                </View>
              </TouchableOpacity>

              <Text style={[s.avatarHint, { color: theme.hint }]}>
                {imageLocalUri ? 'New photo selected — tap Save to apply' : 'Tap photo to update'}
              </Text>

              {imageLocalUri && (
                <View style={[s.pendingPill, { backgroundColor: theme.accent + '14', borderColor: theme.accent + '28' }]}>
                  <Ionicons name="checkmark-circle-outline" size={12} color={theme.accent} />
                  <Text style={[s.pendingPillTxt, { color: theme.accent }]}>Photo ready to upload</Text>
                </View>
              )}
            </View>

            {/* ── Personal details ── */}
            <Text style={[s.sectionLabel, { color: theme.hint }]}>PERSONAL DETAILS</Text>
            <FloatInput label="First Name" iconName="person-outline" value={firstName} onChangeText={setFirstName} />
            <FloatInput label="Last Name"  iconName="person-outline" value={lastName}  onChangeText={setLastName}  />
            <FloatInput label="Phone"      iconName="call-outline"   value={phone}     onChangeText={setPhone}     keyboardType="phone-pad" />

            {/* ── Account (read-only) ── */}
            <Text style={[s.sectionLabel, { color: theme.hint, marginTop: 8 }]}>ACCOUNT</Text>
            <FloatInput label="Email" iconName="mail-outline" value={user?.email ?? ''} editable={false} />
            <Text style={[s.fieldNote, { color: theme.hint }]}>Email cannot be changed. Contact support if needed.</Text>

            {/* ── Save button ── */}
            {/* FIX: button bg = theme.accent; text/icon color = theme.accentFg (not hardcoded white) */}
            <TouchableOpacity
              style={[
                s.saveBtn,
                { backgroundColor: saved ? savedBg : theme.accent, shadowColor: theme.accent },
                (!hasChanges || busy) && !saved && { opacity: 0.38 },
              ]}
              onPress={handleSave}
              disabled={!hasChanges || busy || saved}
              activeOpacity={0.85}
            >
              {busy ? (
                <View style={s.btnRow}>
                  <ActivityIndicator color={saved ? '#FFFFFF' : onAccent} size="small" />
                  <Text style={[s.saveBtnTxt, { color: saved ? '#FFFFFF' : onAccent }]}>
                    {uploading ? 'Uploading photo…' : 'Saving…'}
                  </Text>
                </View>
              ) : (
                <View style={s.btnRow}>
                  <Ionicons
                    name={saved ? 'checkmark' : 'save-outline'}
                    size={18}
                    color={saved ? '#FFFFFF' : onAccent}
                  />
                  <Text style={[s.saveBtnTxt, { color: saved ? '#FFFFFF' : onAccent }]}>
                    {saved ? 'Saved!' : 'Save Changes'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:              { flex: 1 },
  header:            {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn:           { width: 38, height: 38, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle:       { fontSize: 16, fontWeight: '700' },
  scroll:            { paddingHorizontal: 24, paddingBottom: 64, paddingTop: 28 },

  // Avatar
  avatarSection:     { alignItems: 'center', marginBottom: 36 },
  avatarWrap:        { position: 'relative', marginBottom: 12 },
  avatarImg:         { width: 96, height: 96, borderRadius: 48, borderWidth: 2 },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  avatarInitials:    { fontSize: 30, fontWeight: '800' },
  cameraBadge:       { position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  avatarHint:        { fontSize: 12, fontWeight: '500', marginBottom: 8 },
  pendingPill:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  pendingPillTxt:    { fontSize: 11, fontWeight: '600' },

  // Form
  sectionLabel:      { fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 12 },
  inputBox:          { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, marginBottom: 12, height: 60, paddingHorizontal: 14 },
  inputIcon:         { marginRight: 10 },
  floatLabel:        { position: 'absolute', left: 0 },
  inputText:         { fontSize: 15, paddingTop: 18, paddingBottom: 4, fontWeight: '400' },
  fieldNote:         { fontSize: 11, marginTop: -4, marginBottom: 24, marginLeft: 2 },

  // Button — text color is applied inline via theme.accentFg, not in StyleSheet
  saveBtn:           {
    borderRadius: 13, height: 54, justifyContent: 'center', alignItems: 'center',
    marginTop: 8, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28,
    shadowRadius: 14, elevation: 8,
  },
  btnRow:            { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saveBtnTxt:        { fontSize: 16, fontWeight: '700' },
});