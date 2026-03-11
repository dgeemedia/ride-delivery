// mobile/src/screens/Partner/ProofOfDeliveryScreen.js
import React, {useState} from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert,
  Image, TouchableOpacity, Platform, SafeAreaView, ScrollView,
} from 'react-native';
import {useDelivery} from '../../context/DeliveryContext';
import Button from '../../components/Common/Button';
import {colors, spacing, radius} from '../../theme';

// Metro resolves this to src/mocks/react-native-image-picker.js on web
const {launchCamera} = require('react-native-image-picker');

const ProofOfDeliveryScreen = ({navigation}) => {
  const [recipientName, setRecipientName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const {activeDelivery, completeDelivery} = useDelivery();

  const handleTakePhoto = () => {
    if (Platform.OS === 'web') {
      Alert.alert('Camera', 'Camera is not available on web. Use the mobile app.');
      return;
    }
    launchCamera({mediaType: 'photo', quality: 0.8}, response => {
      if (response.assets?.[0]) setPhoto(response.assets[0]);
    });
  };

  const handleSubmit = async () => {
    if (!recipientName.trim()) {
      Alert.alert('Error', 'Please enter the recipient name');
      return;
    }
    if (!activeDelivery) {
      Alert.alert('Error', 'No active delivery found');
      return;
    }

    setUploading(true);
    try {
      await completeDelivery(activeDelivery.id, {
        recipientName: recipientName.trim(),
        photoUri: photo?.uri ?? null,
      });
      Alert.alert('Success', 'Delivery completed! 🎉', [
        {text: 'OK', onPress: () => navigation.navigate('Dashboard')},
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not complete delivery');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Proof of Delivery</Text>

        <Text style={styles.label}>Recipient Name *</Text>
        <TextInput
          style={styles.input}
          value={recipientName}
          onChangeText={setRecipientName}
          placeholder="Who received the package?"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          returnKeyType="done"
        />

        <Text style={styles.label}>Photo (Optional)</Text>
        {photo ? (
          <>
            <Image source={{uri: photo.uri}} style={styles.photo} />
            <TouchableOpacity style={styles.outlineBtn} onPress={handleTakePhoto}>
              <Text style={styles.outlineBtnText}>Retake Photo</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.outlineBtn} onPress={handleTakePhoto}>
            <Text style={styles.outlineBtnText}>
              {Platform.OS === 'web' ? '📷 Camera (Mobile Only)' : '📷 Take Photo'}
            </Text>
          </TouchableOpacity>
        )}

        <Button
          title={uploading ? 'Completing…' : 'Complete Delivery'}
          onPress={handleSubmit}
          loading={uploading}
          fullWidth
          style={{marginTop: spacing.xl}}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#fff'},
  container: {flexGrow: 1, padding: spacing.lg},
  title: {fontSize: 24, fontWeight: '700', marginBottom: spacing.xl},
  label: {fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs},
  input: {
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, fontSize: 16, color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  photo: {width: '100%', height: 200, borderRadius: radius.md, marginBottom: spacing.md},
  outlineBtn: {
    borderWidth: 2, borderColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginBottom: spacing.md,
  },
  outlineBtnText: {color: colors.primary, fontSize: 16, fontWeight: '600'},
});

export default ProofOfDeliveryScreen;