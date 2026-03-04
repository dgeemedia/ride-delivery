import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Image } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { useDelivery } from '../../context/DeliveryContext';
import Input from '../../components/Common/Input';
import Button from '../../components/Common/Button';
import { colors, spacing } from '../../theme';
import { uploadAPI } from '../../services/api';

const ProofOfDeliveryScreen = ({ navigation }) => {
  const [recipientName, setRecipientName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { activeDelivery, completeDelivery } = useDelivery();

  const handleTakePhoto = () => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
      },
      (response) => {
        if (response.assets && response.assets[0]) {
          setPhoto(response.assets[0]);
        }
      }
    );
  };

  const handleSubmit = async () => {
    if (!recipientName.trim()) {
      Alert.alert('Error', 'Please enter recipient name');
      return;
    }

    setUploading(true);
    try {
      let imageUrl = '';

      if (photo) {
        // Upload photo
        const formData = new FormData();
        formData.append('proof', {
          uri: photo.uri,
          type: photo.type,
          name: photo.fileName,
        });

        const uploadResponse = await uploadAPI.uploadDeliveryProof(formData);
        imageUrl = uploadResponse.data.url;
      }

      await completeDelivery(activeDelivery.id, {
        recipientName,
        deliveryImageUrl: imageUrl,
        actualFee: activeDelivery.estimatedFee,
      });

      Alert.alert('Success', 'Delivery completed!', [
        { text: 'OK', onPress: () => navigation.navigate('Dashboard') },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Proof of Delivery</Text>

      <Input
        label="Recipient Name"
        value={recipientName}
        onChangeText={setRecipientName}
        placeholder="Who received the package?"
      />

      <View style={styles.photoSection}>
        <Text style={styles.label}>Photo (Optional)</Text>
        {photo ? (
          <View>
            <Image source={{ uri: photo.uri }} style={styles.photo} />
            <Button title="Retake Photo" onPress={handleTakePhoto} variant="outline" />
          </View>
        ) : (
          <Button
            title="Take Photo"
            onPress={handleTakePhoto}
            icon="camera-alt"
            variant="outline"
          />
        )}
      </View>

      <Button
        title="Complete Delivery"
        onPress={handleSubmit}
        loading={uploading}
        fullWidth
        style={styles.submitButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
  },
  photoSection: {
    marginVertical: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  submitButton: {
    marginTop: spacing.xl,
  },
});

export default ProofOfDeliveryScreen;