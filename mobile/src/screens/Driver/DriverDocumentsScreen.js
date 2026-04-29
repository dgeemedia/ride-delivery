// mobile/src/screens/Driver/DriverDocumentsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, ActivityIndicator,
  Image, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { driverAPI, uploadAPI } from '../../services/api';

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

export default function DriverDocumentsScreen({ navigation }) {
  const { theme } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});

  const fetchProfile = async () => {
    try {
      const res = await driverAPI.getProfile();
      setProfile(res?.data?.profile ?? res?.data);
    } catch {
      Alert.alert('Error', 'Could not load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const pickAndUpload = async (docType) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll access to upload documents.');
      return;
    }

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
    } finally {
      setUploading((prev) => ({ ...prev, [docType.key]: false }));
    }
  };

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.title, { color: theme.foreground }]}>Required Documents</Text>
        <Text style={[s.subtitle, { color: theme.hint }]}>
          Upload clear photos of your documents for verification.
        </Text>

        {DOC_TYPES.map((doc) => {
          const currentUrl = profile?.[doc.key];
          const isUploaded = !!currentUrl;
          const isUploading = uploading[doc.key];

          return (
            <View key={doc.key} style={[s.card, { backgroundColor: theme.backgroundAlt, borderColor: theme.border }]}>
              <View style={s.cardHeader}>
                <Ionicons name={doc.icon} size={20} color={theme.accent} />
                <Text style={[s.cardTitle, { color: theme.foreground }]}>{doc.label}</Text>
                <View style={[s.statusDot, { backgroundColor: isUploaded ? '#5DAA72' : theme.hint }]} />
              </View>

              {isUploaded ? (
                <Image source={{ uri: currentUrl }} style={s.preview} resizeMode="cover" />
              ) : (
                <View style={[s.placeholder, { borderColor: theme.border }]}>
                  <Ionicons name="cloud-upload-outline" size={32} color={theme.hint} />
                  <Text style={[s.placeholderText, { color: theme.hint }]}>No file uploaded</Text>
                </View>
              )}

              <TouchableOpacity
                style={[s.uploadBtn, { backgroundColor: theme.accent, opacity: isUploading ? 0.7 : 1 }]}
                onPress={() => pickAndUpload(doc)}
                disabled={isUploading}
                activeOpacity={0.8}
              >
                {isUploading ? (
                  <ActivityIndicator color={theme.accentFg} />
                ) : (
                  <Text style={[s.uploadBtnText, { color: theme.accentFg }]}>
                    {isUploaded ? 'Replace' : 'Upload'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        <Text style={[s.note, { color: theme.hint }]}>
          After uploading all required documents, an admin will review your application. Approval usually takes 24–48 hours.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  scroll:  { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  title:   { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  subtitle:{ fontSize: 14, marginBottom: 24, lineHeight: 20 },
  card:    { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardTitle:  { fontSize: 16, fontWeight: '700', flex: 1 },
  statusDot:  { width: 10, height: 10, borderRadius: 5 },
  preview:    { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, marginBottom: 12 },
  placeholder:{ aspectRatio: 16 / 9, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  placeholderText: { fontSize: 12, marginTop: 8 },
  uploadBtn:     { borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  uploadBtnText: { fontSize: 14, fontWeight: '700' },
  note:      { fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
});