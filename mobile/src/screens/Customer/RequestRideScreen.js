import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRide } from '../../context/RideContext';
import { useLocation } from '../../context/LocationContext';
import AddressInput from '../../components/Inputs/AddressInput';
import Input from '../../components/Common/Input';
import Button from '../../components/Common/Button';
import { colors, spacing } from '../../theme';
import { rideAPI } from '../../services/api';

const RequestRideScreen = ({ navigation }) => {
  const [pickup, setPickup] = useState({ address: '', lat: 0, lng: 0 });
  const [dropoff, setDropoff] = useState({ address: '', lat: 0, lng: 0 });
  const [notes, setNotes] = useState('');
  const [estimatedFare, setEstimatedFare] = useState(null);
  const [loading, setLoading] = useState(false);
  const { requestRide } = useRide();
  const { location } = useLocation();

  const handleGetEstimate = async () => {
    if (!pickup.lat || !dropoff.lat) {
      Alert.alert('Error', 'Please select pickup and dropoff locations');
      return;
    }

    try {
      const response = await rideAPI.getEstimate({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
      });
      setEstimatedFare(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to get estimate');
    }
  };

  const handleRequestRide = async () => {
    if (!pickup.lat || !dropoff.lat) {
      Alert.alert('Error', 'Please select locations');
      return;
    }

    setLoading(true);
    try {
      await requestRide({
        pickupAddress: pickup.address,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        notes,
      });
      navigation.navigate('Tracking');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Request a Ride</Text>

      <AddressInput
        label="Pickup Location"
        placeholder="Where are you?"
        value={pickup.address}
        onSelectAddress={(addr) =>
          setPickup({ address: addr.description, lat: 0, lng: 0 })
        }
      />

      <AddressInput
        label="Dropoff Location"
        placeholder="Where to?"
        value={dropoff.address}
        onSelectAddress={(addr) =>
          setDropoff({ address: addr.description, lat: 0, lng: 0 })
        }
      />

      <Input
        label="Notes (Optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Any special instructions?"
        multiline
        numberOfLines={3}
      />

      <Button
        title="Get Fare Estimate"
        variant="outline"
        onPress={handleGetEstimate}
        fullWidth
      />

      {estimatedFare && (
        <View style={styles.estimateCard}>
          <Text style={styles.estimateLabel}>Estimated Fare</Text>
          <Text style={styles.estimateAmount}>
            ${estimatedFare.estimatedFare}
          </Text>
          <Text style={styles.estimateDetails}>
            {estimatedFare.distance} km • {estimatedFare.estimatedDuration} min
          </Text>
        </View>
      )}

      <Button
        title="Request Ride"
        onPress={handleRequestRide}
        loading={loading}
        fullWidth
        style={styles.requestButton}
      />
    </ScrollView>
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
  estimateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.lg,
    marginVertical: spacing.md,
    alignItems: 'center',
  },
  estimateLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  estimateAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginVertical: spacing.xs,
  },
  estimateDetails: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  requestButton: {
    marginTop: spacing.md,
  },
});

export default RequestRideScreen;