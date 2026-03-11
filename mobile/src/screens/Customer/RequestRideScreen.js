import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import {rideAPI} from '../../services/api';
import {colors} from '../../theme/colors';
import {spacing} from '../../theme/spacing';

const RequestRideScreen = ({navigation}) => {
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestRide = async () => {
    if (!pickupAddress || !dropoffAddress) {
      Alert.alert('Error', 'Please enter pickup and dropoff addresses');
      return;
    }

    setLoading(true);
    try {
      // For demo, using dummy coordinates
      await rideAPI.requestRide({
        pickupAddress,
        pickupLat: 6.5244,
        pickupLng: 3.3792,
        dropoffAddress,
        dropoffLat: 6.5344,
        dropoffLng: 3.3892,
      });

      Alert.alert('Success', 'Ride requested! Looking for drivers...', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to request ride');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.label}>Pickup Location</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter pickup address"
          value={pickupAddress}
          onChangeText={setPickupAddress}
          placeholderTextColor={colors.text.secondary}
        />

        <Text style={styles.label}>Dropoff Location</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter dropoff address"
          value={dropoffAddress}
          onChangeText={setDropoffAddress}
          placeholderTextColor={colors.text.secondary}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRequestRide}
          disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? 'Requesting...' : 'Request Ride'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  form: {
    paddingTop: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
    fontSize: 16,
    color: colors.text.primary,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RequestRideScreen;