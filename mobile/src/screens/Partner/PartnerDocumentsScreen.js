// mobile/src/screens/Partner/PartnerDocumentsScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, StatusBar, ActivityIndicator, Image, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { partnerAPI, uploadAPI } from '../../services/api';

const VEHICLE_TYPES = [
  { value: 'BIKE',       label: 'Bike',       icon: 'bicycle-outline' },
  { value: 'MOTORCYCLE', label: 'Motorcycle', icon: 'bicycle-outline' },
  { value: 'CAR',        label: 'Car',        icon: 'car-outline' },
  { value: 'VAN',        label: 'Van',        icon: 'bus-outline' },
  { value: 'TRICYCLE',   label: 'Tricycle',   icon: 'bicycle-outline' },
];

const DOC_TYPES = [
  { key: 'idImageUrl',      label: 'Government ID',   icon: 'card-outline', required: true,  uploadFn: uploadAPI.uploadPartnerId },
  { key: 'vehicleImageUrl', label: 'Vehicle Photo',    icon: 'car-outline',  required: false, uploadFn: uploadAPI.uploadPartnerVehicle },
];

// Simple FloatInput component (same as earlier)
const FloatInput = ({ label, iconName, value, onChangeText, keyboardType, autoCapitalize }) => {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const labelY  = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderV = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(labelY,  { toValue: focused || value ? 1 : 0, duration: 170, useNativeDriver: false }).start();
    Animated.timing(borderV, { toValue: focused ? 1 : 0,          duration: 170, useNativeDriver: false }).start();
  }, [focused, value]);

  return (
    <Animated.View style={[styles.inputBox, { backgroundColor: theme.backgroundAlt, borderColor: borderV.interpolate({ inputRange:[0,1], outputRange:[theme.border, theme.accent] }) }]}>
      <Ionicons name={iconName} size={16} color={focused ? theme.accent : theme.hint} style={styles.inputIcon} />
      <View style={{ flex:1 }}>
        <Animated.Text style={[styles.floatLabel, { top: labelY.interpolate({ inputRange:[0,1], outputRange:[18,7] }), fontSize: labelY.interpolate({ inputRange:[0,1], outputRange:[15,11] }), color: labelY.interpolate({ inputRange:[0,1], outputRange:[theme.hint, focused?theme.accent:theme.muted] }) }]}>{label}</Animated.Text>
        <TextInput style={[styles.inputText, { color: theme.foreground }]} value={value} onChangeText={onChangeText} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} keyboardType={keyboardType??'default'} autoCapitalize={autoCapitalize??'none'} placeholder=" " placeholderTextColor="transparent" />
      </View>
    </Animated.View>
  );
};

export default function PartnerDocumentsScreen({ navigation }) {
  const { theme, mode } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});
  const [profileMissing, setProfileMissing] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Form fields
  const [vehicleType, setVehicleType]   = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  const fetchProfile = async () => {
    try {
      const res = await partnerAPI.getProfile();
      setProfile(res?.data?.profile ?? res?.data);
      setProfileMissing(false);
    } catch (err) {
      console.error('[PartnerDocuments] fetchProfile error:', err);
      if (
        err?.message === 'Delivery partner profile not found' ||
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
    if (!vehicleType) {
      Alert.alert('Vehicle type required', 'Please select a vehicle type.');
      return;
    }
    setCreatingProfile(true);
    try {
      await partnerAPI.updateProfile({
        vehicleType,
        vehiclePlate: vehiclePlate.trim() || undefined,
      });
      await fetchProfile();
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || 'Failed to create profile.';
      Alert.alert('Error', msg);
    } finally {
      setCreatingProfile(false);
    }
  };

  const pickAndUpload = async (docType) => {
    if (!profile) {
      Alert.alert('No Profile', 'Please complete your courier profile first.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'We need camera roll access to upload documents.'); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      setUploading((prev) => ({ ...prev, [docType.key]: true }));
      const uploadRes = await docType.uploadFn(asset);
      const url = uploadRes?.data?.url ?? uploadRes?.url;
      if (!url) throw new Error('Upload failed');
      await partnerAPI.updateProfile({ [docType.key]: url });
      await fetchProfile();
      Alert.alert('Success', `${docType.label} uploaded.`);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Upload failed');
    } finally { setUploading((prev) => ({ ...prev, [docType.key]: false })); }
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.accent} /></View>;
  }

  if (profileMissing) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={mode==='dark'?'light-content':'dark-content'} backgroundColor={theme.background} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Complete Your Courier Profile</Text>
          <Text style={[styles.emptyText, { color: theme.hint }]}>Select your vehicle type to continue.</Text>
          <Text style={[styles.sectionLabel, { color: theme.hint }]}>VEHICLE TYPE</Text>
          <View style={styles.vehicleTypeGrid}>
            {VEHICLE_TYPES.map(vt => {
              const selected = vehicleType === vt.value;
              return (
                <TouchableOpacity key={vt.value} style={[styles.vehicleTypeOption, { backgroundColor: selected ? theme.accent+'18' : theme.backgroundAlt, borderColor: selected ? theme.accent : theme.border }]} onPress={() => setVehicleType(vt.value)} activeOpacity={0.7}>
                  <Ionicons name={vt.icon} size={18} color={selected ? theme.accent : theme.hint} />
                  <Text style={[styles.vehicleTypeLabel, { color: selected ? theme.accent : theme.hint }]}>{vt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <FloatInput label="Plate Number (optional)" iconName="document-text-outline" value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" />
          <TouchableOpacity style={[styles.createProfileBtn, { backgroundColor: theme.accent, opacity: creatingProfile?0.7:1 }]} onPress={handleCreateProfile} disabled={creatingProfile} activeOpacity={0.8}>
            {creatingProfile ? <ActivityIndicator color={theme.accentFg} /> : <Text style={[styles.createProfileBtnText, { color: theme.accentFg }]}>Save Vehicle Details</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={mode==='dark'?'light-content':'dark-content'} backgroundColor={theme.background} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: theme.foreground }]}>Required Documents</Text>
        <Text style={[styles.subtitle, { color: theme.hint }]}>Upload your ID and vehicle photo for verification.</Text>
        {DOC_TYPES.map((doc) => {
          const currentUrl = profile?.[doc.key]; const isUploaded = !!currentUrl; const isUploading = uploading[doc.key];
          return (
            <View key={doc.key} style={[styles.card, { backgroundColor:theme.backgroundAlt, borderColor:theme.border }]}>
              <View style={styles.cardHeader}>
                <Ionicons name={doc.icon} size={20} color={theme.accent} />
                <Text style={[styles.cardTitle, { color: theme.foreground }]}>{doc.label}</Text>
                <View style={[styles.statusDot, { backgroundColor: isUploaded?'#5DAA72': theme.hint }]} />
              </View>
              {isUploaded ? <Image source={{ uri: currentUrl }} style={styles.preview} resizeMode="cover" /> : <View style={[styles.placeholder, { borderColor: theme.border }]}><Ionicons name="cloud-upload-outline" size={32} color={theme.hint} /><Text style={[styles.placeholderText, { color: theme.hint }]}>No file uploaded</Text></View>}
              <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: theme.accent, opacity: isUploading?0.7:1 }]} onPress={()=>pickAndUpload(doc)} disabled={isUploading} activeOpacity={0.8}>
                {isUploading ? <ActivityIndicator color={theme.accentFg} /> : <Text style={[styles.uploadBtnText, { color: theme.accentFg }]}>{isUploaded?'Replace':'Upload'}</Text>}
              </TouchableOpacity>
            </View>
          );
        })}
        <Text style={[styles.note, { color: theme.hint }]}>An admin will review your documents. You can start accepting deliveries once approved.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex:1 }, scroll: { paddingHorizontal:20, paddingTop:24, paddingBottom:40 },
  title: { fontSize:22, fontWeight:'800', marginBottom:8 }, subtitle: { fontSize:14, marginBottom:24, lineHeight:20 },
  card: { borderRadius:16, borderWidth:1, padding:16, marginBottom:16 },
  cardHeader: { flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 },
  cardTitle: { fontSize:16, fontWeight:'700', flex:1 },
  statusDot: { width:10, height:10, borderRadius:5 },
  preview: { width:'100%', aspectRatio:16/9, borderRadius:10, marginBottom:12 },
  placeholder: { aspectRatio:16/9, borderRadius:10, borderWidth:1, borderStyle:'dashed', justifyContent:'center', alignItems:'center', marginBottom:12 },
  placeholderText: { fontSize:12, marginTop:8 },
  uploadBtn: { borderRadius:10, paddingVertical:10, alignItems:'center' },
  uploadBtnText: { fontSize:14, fontWeight:'700' },
  note: { fontSize:12, textAlign:'center', marginTop:16, lineHeight:18 },
  centered: { flex:1, justifyContent:'center', alignItems:'center' },

  emptyTitle: { fontSize:22, fontWeight:'800', marginBottom:8, marginTop:10 },
  emptyText: { fontSize:14, marginBottom:24, lineHeight:20 },
  sectionLabel: { fontSize:10, fontWeight:'700', letterSpacing:3, marginBottom:12, marginTop:8 },
  vehicleTypeGrid: { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:16 },
  vehicleTypeOption: { flexDirection:'row', alignItems:'center', gap:8, borderRadius:12, borderWidth:1.5, paddingVertical:10, paddingHorizontal:14 },
  vehicleTypeLabel: { fontSize:14, fontWeight:'600' },
  createProfileBtn: { borderRadius:13, height:54, justifyContent:'center', alignItems:'center', marginTop:8, marginBottom:24 },
  createProfileBtnText: { fontSize:16, fontWeight:'700' },

  inputBox: { flexDirection:'row', alignItems:'center', borderRadius:12, borderWidth:1.5, marginBottom:12, height:60, paddingHorizontal:14 },
  inputIcon: { marginRight:10 },
  floatLabel: { position:'absolute', left:0 },
  inputText: { fontSize:15, paddingTop:18, paddingBottom:4, fontWeight:'400' },
});